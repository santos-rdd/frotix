/**
 * Rastreamento do motorista durante a viagem (Frotix)
 *
 * Enquanto o motorista tem uma viagem em andamento e o app está aberto, o GPS é lido
 * a cada ~15 s (ou a cada 50 m andados). Cada leitura:
 *   1. vai para a tabela local posicoes_pendentes (SQLite) — assim nada se perde sem internet;
 *   2. é enviada ao backend em lote (POST /frota/rotas/:id/posicoes) e apagada da fila local.
 *
 * O mapa da Home (Admin/Gestor) lê a última posição em GET /frota/rotas/:id/posicao.
 *
 * Limitação conhecida: o expo-location só entrega leituras com o app em primeiro plano
 * (watchPositionAsync). Rastrear com o app minimizado exige startLocationUpdatesAsync +
 * expo-task-manager e permissão de localização em segundo plano.
 */
import {
  abrirBanco,
  salvarPosicaoPendente,
  listarPosicoesPendentes,
  removerPosicoesPendentes,
  descartarPosicoesAntigas,
  limitarPosicoesPendentes,
  limparPosicoesDaViagem,
} from '../database/index.js';
import { apiFetch } from './api.js';

const INTERVALO_GPS_MS = 15000;
const DISTANCIA_MINIMA_M = 50;
const INTERVALO_REENVIO_MS = 30000;
const ESPERA_APOS_RECUSA_MS = 60000;
const VALIDADE_LEITURA_MS = 24 * 60 * 60 * 1000;
const MAX_POR_ENVIO = 200;

let moduloLocation = null;
let funcaoEnvio = null;

// Estado do rastreamento atual (só existe uma viagem em andamento por motorista).
let assinaturaGps = null;
let timerReenvio = null;
let atual = { usuarioId: null, viagemId: null };
let geracao = 0; // invalida um iniciar() que ainda estava esperando permissão quando parar() foi chamado
let enviando = false;
const bloqueadoAte = new Map(); // viagemId -> instante (ms) até quando não tentar reenviar

// Se o SQLite não abrir (ex.: versão web), as leituras ficam só na memória.
const filaMemoria = [];
let proximoIdMemoria = 1;

/** Para os testes: troca o expo-location e o envio HTTP por versões falsas. */
export function definirDependenciasRastreamento({ location, enviar } = {}) {
  if (location !== undefined) moduloLocation = location;
  if (enviar !== undefined) funcaoEnvio = enviar;
}

async function carregarLocation() {
  if (moduloLocation) return moduloLocation;
  const mod = await import('expo-location');
  moduloLocation = mod.default?.watchPositionAsync ? mod.default : mod;
  return moduloLocation;
}

async function enviarAoBackend(viagemId, posicoes) {
  if (funcaoEnvio) return funcaoEnvio(viagemId, posicoes);
  const resposta = await apiFetch(`/frota/rotas/${encodeURIComponent(viagemId)}/posicoes`, {
    method: 'POST',
    body: { posicoes },
  });
  return { status: resposta.status, ok: resposta.ok };
}

async function bancoOuNulo() {
  try {
    return await abrirBanco();
  } catch {
    return null;
  }
}

/** Converte o LocationObject do expo-location no formato que o backend espera. */
export function converterLeitura(location) {
  const c = location?.coords || {};
  if (!Number.isFinite(c.latitude) || !Number.isFinite(c.longitude)) return null;
  const instante = Number.isFinite(location.timestamp) ? new Date(location.timestamp) : new Date();
  return {
    latitude: c.latitude,
    longitude: c.longitude,
    precisao: Number.isFinite(c.accuracy) && c.accuracy >= 0 ? c.accuracy : null,
    velocidade: Number.isFinite(c.speed) && c.speed >= 0 ? c.speed : null,
    registradaEm: instante.toISOString(),
  };
}

/** Guarda uma leitura na fila local e tenta enviar. */
export async function registrarLeitura(usuarioId, viagemId, location) {
  const posicao = converterLeitura(location);
  if (!posicao || !usuarioId || !viagemId) return;

  const db = await bancoOuNulo();
  if (db) {
    await salvarPosicaoPendente(db, usuarioId, viagemId, posicao);
  } else if (!filaMemoria.some((p) => p.id_viagem === String(viagemId) && p.registrada_em === posicao.registradaEm)) {
    filaMemoria.push({
      id: proximoIdMemoria++,
      usuario_id: String(usuarioId),
      id_viagem: String(viagemId),
      latitude: posicao.latitude,
      longitude: posicao.longitude,
      precisao: posicao.precisao,
      velocidade: posicao.velocidade,
      registrada_em: posicao.registradaEm,
    });
  }

  await enviarPosicoesPendentes(usuarioId, viagemId);
}

async function lerFila(db, usuarioId, viagemId) {
  const limiteAntigo = new Date(Date.now() - VALIDADE_LEITURA_MS).toISOString();
  if (db) {
    await descartarPosicoesAntigas(db, usuarioId, limiteAntigo);
    await limitarPosicoesPendentes(db, usuarioId, viagemId);
    return listarPosicoesPendentes(db, usuarioId, viagemId, MAX_POR_ENVIO);
  }
  for (let i = filaMemoria.length - 1; i >= 0; i -= 1) {
    if (filaMemoria[i].registrada_em < limiteAntigo) filaMemoria.splice(i, 1);
  }
  return filaMemoria
    .filter((p) => p.usuario_id === String(usuarioId) && p.id_viagem === String(viagemId))
    .sort((a, b) => a.registrada_em.localeCompare(b.registrada_em))
    .slice(0, MAX_POR_ENVIO);
}

async function apagarDaFila(db, ids) {
  if (db) return removerPosicoesPendentes(db, ids);
  const remover = new Set(ids);
  for (let i = filaMemoria.length - 1; i >= 0; i -= 1) {
    if (remover.has(filaMemoria[i].id)) filaMemoria.splice(i, 1);
  }
  return undefined;
}

/**
 * Envia a fila local desta viagem. Devolve quantas posições o servidor aceitou.
 * - 2xx: apaga da fila.
 * - 400: leituras inválidas, nunca vão passar → apaga.
 * - 403/404/409: a viagem ainda não foi sincronizada (aberta offline) ou já terminou →
 *   mantém e espera 1 min antes de tentar de novo (leituras com mais de 24 h são descartadas).
 * - sem internet / 5xx: mantém para o próximo envio.
 */
export async function enviarPosicoesPendentes(usuarioId, viagemId) {
  if (!usuarioId || !viagemId || enviando) return 0;
  if (Date.now() < (bloqueadoAte.get(String(viagemId)) || 0)) return 0;
  enviando = true;
  let aceitas = 0;
  try {
    const db = await bancoOuNulo();
    // Repete enquanto houver lotes cheios (fila acumulada de quando estava offline).
    for (;;) {
      const lote = await lerFila(db, usuarioId, viagemId);
      if (lote.length === 0) break;

      const corpo = lote.map((p) => ({
        latitude: p.latitude,
        longitude: p.longitude,
        precisao: p.precisao,
        velocidade: p.velocidade,
        registradaEm: p.registrada_em,
      }));

      let resposta;
      try {
        resposta = await enviarAoBackend(viagemId, corpo);
      } catch {
        break; // sem conexão
      }

      if (resposta.ok || resposta.status === 400) {
        await apagarDaFila(db, lote.map((p) => p.id));
        if (resposta.ok) aceitas += lote.length;
        if (lote.length < MAX_POR_ENVIO) break;
        continue;
      }
      if ([403, 404, 409].includes(resposta.status)) {
        bloqueadoAte.set(String(viagemId), Date.now() + ESPERA_APOS_RECUSA_MS);
      }
      break;
    }
  } finally {
    enviando = false;
  }
  return aceitas;
}

/**
 * Começa a enviar a localização desta viagem. Pode ser chamado várias vezes:
 * se já está rastreando a mesma viagem, não faz nada.
 * Devolve { ativo: true } ou { ativo: false, motivo: 'gps_desligado' | 'sem_permissao' | 'erro' }.
 */
export async function iniciarRastreamento({ usuarioId, viagemId }) {
  if (!usuarioId || !viagemId) return { ativo: false, motivo: 'erro' };
  if (assinaturaGps && atual.viagemId === String(viagemId) && atual.usuarioId === String(usuarioId)) {
    return { ativo: true };
  }

  pararRastreamento();
  const minhaGeracao = geracao;

  try {
    const Location = await carregarLocation();

    if (typeof Location.hasServicesEnabledAsync === 'function') {
      const ligado = await Location.hasServicesEnabledAsync();
      if (!ligado) return { ativo: false, motivo: 'gps_desligado' };
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return { ativo: false, motivo: 'sem_permissao' };
    if (minhaGeracao !== geracao) return { ativo: false, motivo: 'cancelado' };

    const uId = String(usuarioId);
    const vId = String(viagemId);
    bloqueadoAte.delete(vId);

    const aoLer = (location) => {
      registrarLeitura(uId, vId, location).catch((e) => {
        console.warn('Não foi possível guardar a localização:', e?.message || e);
      });
    };

    const assinatura = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy?.High ?? 4,
        timeInterval: INTERVALO_GPS_MS,
        distanceInterval: DISTANCIA_MINIMA_M,
      },
      aoLer,
      (erro) => console.warn('Erro no GPS:', erro)
    );

    if (minhaGeracao !== geracao) {
      assinatura?.remove?.();
      return { ativo: false, motivo: 'cancelado' };
    }

    assinaturaGps = assinatura;
    atual = { usuarioId: uId, viagemId: vId };

    // Primeira posição na hora, sem esperar o caminhão andar 50 m.
    if (typeof Location.getLastKnownPositionAsync === 'function') {
      Location.getLastKnownPositionAsync({ maxAge: 2 * 60 * 1000 })
        .then((ultima) => { if (ultima && minhaGeracao === geracao) aoLer(ultima); })
        .catch(() => {});
    }

    // Caminhão parado não gera leitura nova; reenvia a fila quando a internet voltar.
    timerReenvio = setInterval(() => {
      enviarPosicoesPendentes(uId, vId).catch(() => {});
    }, INTERVALO_REENVIO_MS);

    return { ativo: true };
  } catch (e) {
    console.warn('Não foi possível iniciar o rastreamento:', e?.message || e);
    return { ativo: false, motivo: 'erro' };
  }
}

export function pararRastreamento() {
  geracao += 1;
  if (assinaturaGps) {
    try {
      assinaturaGps.remove();
    } catch {}
  }
  assinaturaGps = null;
  if (timerReenvio) clearInterval(timerReenvio);
  timerReenvio = null;
  atual = { usuarioId: null, viagemId: null };
}

/**
 * Chamar logo depois de concluir uma viagem (online ou offline): para o GPS se era
 * essa a viagem rastreada e apaga as leituras dela que ainda estavam na fila, porque
 * o servidor recusaria (409) tudo que chegasse depois da conclusão.
 */
export async function encerrarRastreamentoDaViagem(viagemId) {
  if (!viagemId) return;
  const vId = String(viagemId);
  if (atual.viagemId === vId) pararRastreamento();
  bloqueadoAte.delete(vId);
  const db = await bancoOuNulo();
  if (db) {
    await limparPosicoesDaViagem(db, vId);
  } else {
    for (let i = filaMemoria.length - 1; i >= 0; i -= 1) {
      if (filaMemoria[i].id_viagem === vId) filaMemoria.splice(i, 1);
    }
  }
}

export function estaRastreando(viagemId) {
  return Boolean(assinaturaGps) && (viagemId == null || atual.viagemId === String(viagemId));
}
