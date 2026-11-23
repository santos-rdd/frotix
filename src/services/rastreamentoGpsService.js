import { apiFetch, obterUsuarioLogado } from './api.js';
import {
  abrirBanco,
  listarPosicoesGpsPendentes,
  listarViagensComPosicoesGpsPendentes,
  obterIdRemoto,
  removerPosicoesGpsPersistidas,
  salvarPosicaoGpsPendente,
} from '../database/index.js';

const TAMANHO_LOTE = 200;
const INTERVALO_ENVIO_MS = 15_000;
let locationModule = null;
const rastreamentosAtivos = new Map();
const enviosAtivos = new Map();
const timersEnvio = new Map();

function falhaTransitoria(resultado) {
  return /failed|network|conex|timeout|http_5\d\d/i.test(resultado?.erro || '');
}

export function definirModuloLocation(instancia) {
  locationModule = instancia;
}

async function obterLocation() {
  if (locationModule) return locationModule;
  const modulo = await import('expo-location');
  locationModule = modulo.default || modulo;
  return locationModule;
}

function gerarUuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (caractere) => {
    const aleatorio = Math.floor(Math.random() * 16);
    const valor = caractere === 'x' ? aleatorio : (aleatorio & 0x3) | 0x8;
    return valor.toString(16);
  });
}

function numeroOpcional(valor) {
  return Number.isFinite(valor) && valor >= 0 ? valor : null;
}

async function validarMotoristaAutenticado(usuarioId) {
  const usuario = await obterUsuarioLogado();
  const idAutenticado = usuario?.id || usuario?.sub;
  if (!idAutenticado || String(idAutenticado) !== String(usuarioId) || Number(usuario?.perfil) !== 4) {
    throw new Error('A localização só pode ser registrada pelo motorista autenticado.');
  }
}

async function resolverViagemRemota(db, viagemId) {
  if (!String(viagemId).startsWith('local_')) return String(viagemId);
  return (await obterIdRemoto(db, 'rotas', viagemId)) ||
    (await obterIdRemoto(db, 'viagens', viagemId));
}

async function enviarLote(usuarioId, viagemId) {
  const db = await abrirBanco();
  const posicoes = await listarPosicoesGpsPendentes(db, usuarioId, viagemId, TAMANHO_LOTE);
  if (posicoes.length === 0) return { sucesso: true, processadas: 0, pendentes: 0 };
  await validarMotoristaAutenticado(usuarioId);

  const viagemRemotaId = await resolverViagemRemota(db, viagemId);
  if (!viagemRemotaId) {
    return { sucesso: false, processadas: 0, pendentes: posicoes.length, erro: 'viagem_local_pendente' };
  }

  let resposta;
  try {
    resposta = await apiFetch(`/frota/rotas/${encodeURIComponent(viagemRemotaId)}/posicoes`, {
      method: 'POST',
      body: {
        posicoes: posicoes.map((item) => ({
          id: item.id,
          latitude: item.latitude,
          longitude: item.longitude,
          precisao: item.precisao,
          velocidade: item.velocidade,
          registradaEm: item.registrada_em,
        })),
      },
    });
  } catch (erro) {
    return {
      sucesso: false,
      processadas: 0,
      pendentes: posicoes.length,
      erro: erro?.message || 'falha_de_rede',
    };
  }

  const dados = await resposta.json().catch(() => ({}));
  const idsEnviados = new Set(posicoes.map((item) => item.id));
  const idsPersistidos = Array.isArray(dados.persistidas)
    ? [...new Set(dados.persistidas.filter((id) => idsEnviados.has(id)))]
    : [];

  await removerPosicoesGpsPersistidas(db, usuarioId, idsPersistidos);

  const processadas = idsPersistidos.length;
  return {
    sucesso: resposta.ok && dados.sucesso === true && processadas === posicoes.length,
    processadas,
    pendentes: posicoes.length - processadas,
    erro: resposta.ok ? (dados.naoPersistidas?.length ? 'posicao_nao_persistida' : null) : `http_${resposta.status}`,
  };
}

export async function sincronizarPosicoesGpsDaViagem(usuarioId, viagemId) {
  if (!usuarioId || !viagemId) {
    return { sucesso: false, processadas: 0, pendentes: 0, erro: 'parametros_invalidos' };
  }
  const chave = `${usuarioId}:${viagemId}`;
  if (enviosAtivos.has(chave)) return enviosAtivos.get(chave);

  const promessa = (async () => {
    let processadas = 0;
    let pendentes = 0;
    while (true) {
      const resultado = await enviarLote(usuarioId, viagemId);
      processadas += resultado.processadas;
      pendentes = resultado.pendentes;
      if (!resultado.sucesso || pendentes === 0) {
        return { ...resultado, processadas, pendentes };
      }
    }
  })();

  enviosAtivos.set(chave, promessa);
  try {
    const resultado = await promessa;
    if (resultado.sucesso && resultado.pendentes === 0) {
      const timer = timersEnvio.get(chave);
      if (timer) clearTimeout(timer);
      timersEnvio.delete(chave);
    }
    return resultado;
  } finally {
    enviosAtivos.delete(chave);
  }
}

export async function sincronizarPosicoesGpsPendentes(usuarioId) {
  if (!usuarioId) return { sucesso: false, processadas: 0, pendentes: 0 };
  const db = await abrirBanco();
  const viagens = await listarViagensComPosicoesGpsPendentes(db, usuarioId);
  let processadas = 0;
  let pendentes = 0;
  let sucesso = true;

  for (const item of viagens) {
    const resultado = await sincronizarPosicoesGpsDaViagem(usuarioId, item.viagem_id);
    processadas += resultado.processadas;
    pendentes += resultado.pendentes;
    sucesso = sucesso && resultado.sucesso;
    if (!resultado.sucesso && falhaTransitoria(resultado)) {
      agendarEnvio(String(usuarioId), String(item.viagem_id));
    }
  }

  return { sucesso, processadas, pendentes };
}

function agendarEnvio(usuarioId, viagemId) {
  const chave = `${usuarioId}:${viagemId}`;
  if (timersEnvio.has(chave)) return;
  const timer = setTimeout(async () => {
    timersEnvio.delete(chave);
    let resultado;
    try {
      resultado = await sincronizarPosicoesGpsDaViagem(usuarioId, viagemId);
    } catch (erro) {
      console.error('Falha ao enviar posições GPS pendentes:', erro);
      resultado = { sucesso: false };
    }
    if (falhaTransitoria(resultado)) {
      agendarEnvio(usuarioId, viagemId);
    }
  }, INTERVALO_ENVIO_MS);
  timer.unref?.();
  timersEnvio.set(chave, timer);
}

export async function iniciarRastreamentoGps({ usuarioId, viagemId, onPosicao, onErro }) {
  await validarMotoristaAutenticado(usuarioId);
  const chave = `${usuarioId}:${viagemId}`;
  if (rastreamentosAtivos.has(chave)) {
    throw new Error('O rastreamento desta viagem já está ativo.');
  }

  const Location = await obterLocation();
  const permissao = await Location.requestForegroundPermissionsAsync();
  if (permissao?.status !== 'granted') {
    throw new Error('Permita o acesso à localização durante o uso do aplicativo para rastrear a viagem.');
  }

  let assinatura;
  let ativo = true;
  assinatura = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 15_000,
      distanceInterval: 50,
    },
    async (localizacao) => {
      if (!ativo) return;
      const coordenadas = localizacao?.coords || {};
      const latitude = coordenadas.latitude;
      const longitude = coordenadas.longitude;
      const timestamp = Number(localizacao?.timestamp);
      if (
        !Number.isFinite(latitude) ||
        latitude < -90 ||
        latitude > 90 ||
        !Number.isFinite(longitude) ||
        longitude < -180 ||
        longitude > 180 ||
        !Number.isFinite(timestamp)
      ) {
        onErro?.(new Error('O dispositivo retornou uma posição GPS inválida.'));
        return;
      }

      const dataPosicao = new Date(timestamp);
      if (!Number.isFinite(dataPosicao.getTime())) {
        onErro?.(new Error('O dispositivo retornou uma posição GPS inválida.'));
        return;
      }
      const registradaEm = dataPosicao.toISOString();
      const agora = new Date().toISOString();
      const posicao = {
        id: gerarUuid(),
        usuarioId: String(usuarioId),
        viagemId: String(viagemId),
        latitude,
        longitude,
        precisao: numeroOpcional(coordenadas.accuracy),
        velocidade: numeroOpcional(coordenadas.speed),
        registradaEm,
        criadoEm: agora,
      };

      try {
        const db = await abrirBanco();
        await salvarPosicaoGpsPendente(db, posicao);
        if (!ativo) return;
        onPosicao?.(posicao);
        agendarEnvio(String(usuarioId), String(viagemId));
      } catch (erro) {
        if (ativo) onErro?.(erro);
      }
    }
  );

  const parar = () => {
    ativo = false;
    assinatura?.remove?.();
    rastreamentosAtivos.delete(chave);
    const timer = timersEnvio.get(chave);
    if (timer) clearTimeout(timer);
    timersEnvio.delete(chave);
  };
  rastreamentosAtivos.set(chave, { parar });
  return parar;
}
