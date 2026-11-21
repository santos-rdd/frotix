// Modo offline do motorista (requisito "Offline-First" do projeto).
//
// - Sem internet, o que o motorista registra (abrir/fechar viagem, despesa, abastecimento,
//   comprovante) vai para uma fila salva no aparelho (AsyncStorage).
// - Quando a internet volta (ou o app volta para a tela), a fila é enviada na mesma ordem.
// - Rotas, veículos, categorias e formas de pagamento ficam guardados no aparelho para
//   as telas abrirem sem internet.
// Os outros perfis continuam como antes: sem internet, aparece a mensagem de erro.

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';
import { File, Directory, Paths } from 'expo-file-system';

import { obterUsuarioLogado } from './api.js';
import * as frotix from './frotix.js';

const CHAVE_FILA = 'frotix_fila_offline';
const CHAVE_CACHE = 'frotix_cache_';
const PASTA_ANEXOS = 'frotix-pendentes';
const PERFIL_MOTORISTA = 4;

let fila = null; // cópia em memória da fila
let online = true;
let sincronizando = false;
let iniciado = false;
const ouvintes = new Set();

// -----------------------------------------------------------------------------
// Apoio
// -----------------------------------------------------------------------------

/** id único gerado no celular (o backend usa para não duplicar quando o envio se repete). */
export function gerarId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export async function ehMotorista() {
  const usuario = await obterUsuarioLogado();
  return Number(usuario?.perfil) === PERFIL_MOTORISTA;
}

async function lerFila() {
  if (fila) return fila;
  try {
    const texto = await AsyncStorage.getItem(CHAVE_FILA);
    fila = texto ? JSON.parse(texto) : [];
  } catch {
    fila = [];
  }
  return fila;
}

async function gravarFila(nova) {
  fila = nova;
  try {
    await AsyncStorage.setItem(CHAVE_FILA, JSON.stringify(nova));
  } catch (e) {
    console.warn('Não foi possível salvar a fila offline:', e?.message || e);
  }
  avisar();
}

function estado() {
  const lista = fila || [];
  return {
    online,
    sincronizando,
    pendentes: lista.filter((i) => !i.erro).length,
    falhas: lista.filter((i) => i.erro),
    itens: lista,
  };
}

function avisar() {
  const atual = estado();
  ouvintes.forEach((fn) => fn(atual));
}

/** Para os componentes acompanharem a fila. Devolve a função que cancela. */
export function assinarFila(fn) {
  ouvintes.add(fn);
  lerFila().then(() => fn(estado()));
  return () => ouvintes.delete(fn);
}

export const estaOnline = () => online;

// Copia o arquivo (foto/PDF) para uma pasta do app: o arquivo temporário da câmera
// pode sumir antes de a internet voltar.
function guardarArquivo(arquivo) {
  try {
    const pasta = new Directory(Paths.document, PASTA_ANEXOS);
    if (!pasta.exists) pasta.create();
    const nomeOriginal = arquivo.name || arquivo.fileName || arquivo.uri.split('/').pop() || 'comprovante.jpg';
    const destino = new File(pasta, `${gerarId()}-${nomeOriginal.replace(/[^a-zA-Z0-9._-]/g, '_')}`);
    new File(arquivo.uri).copy(destino);
    return { uri: destino.uri, name: nomeOriginal, mimeType: arquivo.mimeType || null, local: true };
  } catch (e) {
    console.warn('Não foi possível guardar o anexo no aparelho:', e?.message || e);
    return { uri: arquivo.uri, name: arquivo.name || arquivo.fileName || null, mimeType: arquivo.mimeType || null };
  }
}

function apagarArquivos(lista) {
  for (const a of lista || []) {
    if (!a?.local) continue;
    try {
      const f = new File(a.uri);
      if (f.exists) f.delete();
    } catch {
      // arquivo já não existe
    }
  }
}

const arquivosDoItem = (item) => {
  const d = item.dados || {};
  if (item.tipo === 'transacao') return [...(d.arquivos?.fotos || []), ...(d.arquivos?.documentos || []), ...(d.arquivos?.comprovantes || [])];
  if (item.tipo === 'comprovante') return [d.arquivo];
  return [];
};

// -----------------------------------------------------------------------------
// Execução de cada tipo de envio
// -----------------------------------------------------------------------------

async function enviarArquivos(lista) {
  const caminhos = [];
  for (const arquivo of lista || []) caminhos.push(await frotix.enviarComprovante(arquivo));
  return caminhos;
}

// Respostas que significam "isso já foi feito" (o envio chegou ao servidor antes,
// mas a resposta se perdeu). Nesses casos o item sai da fila sem erro.
const JA_FEITO = {
  abrirViagem: /só é possível abrir uma rota agendada|acabou de ser aberta/i,
  concluirViagem: /já foi concluída/i,
};

async function executar(tipo, dados) {
  switch (tipo) {
    case 'transacao': {
      const anexos = {
        fotos: await enviarArquivos(dados.arquivos?.fotos),
        documentos: await enviarArquivos(dados.arquivos?.documentos),
        comprovantes: await enviarArquivos(dados.arquivos?.comprovantes),
      };
      return frotix.registrarTransacao({ ...dados.transacao, anexos, idCliente: dados.idCliente });
    }
    case 'abrirViagem':
      return frotix.abrirViagem(dados.rotaId, { veiculoId: dados.veiculoId, hodometroInicial: dados.hodometroInicial });
    case 'concluirViagem':
      return frotix.concluirViagem(dados.rotaId, dados.hodometroFinal);
    case 'abastecimento':
      return frotix.registrarAbastecimento(dados);
    case 'comprovante':
      return frotix.enviarComprovante(dados.arquivo, dados.idLancamento);
    default:
      throw new Error(`Tipo de envio desconhecido: ${tipo}`);
  }
}

function prepararParaFila(tipo, dados) {
  if (tipo === 'transacao') {
    return {
      ...dados,
      idCliente: dados.idCliente || gerarId(),
      arquivos: {
        fotos: (dados.arquivos?.fotos || []).map(guardarArquivo),
        documentos: (dados.arquivos?.documentos || []).map(guardarArquivo),
        comprovantes: (dados.arquivos?.comprovantes || []).map(guardarArquivo),
      },
    };
  }
  if (tipo === 'abastecimento') return { ...dados, idCliente: dados.idCliente || gerarId() };
  if (tipo === 'comprovante') return { ...dados, arquivo: guardarArquivo(dados.arquivo) };
  return dados;
}

async function enfileirar(tipo, dados, descricao) {
  const atual = await lerFila();
  const item = {
    id: gerarId(),
    tipo,
    descricao: descricao || tipo,
    dados: prepararParaFila(tipo, dados),
    criadoEm: new Date().toISOString(),
    tentativas: 0,
    erro: null,
  };
  await gravarFila([...atual, item]);
  return item;
}

/**
 * Envia agora ou, para o motorista sem internet, guarda na fila.
 * tipo: 'transacao' | 'abrirViagem' | 'concluirViagem' | 'abastecimento' | 'comprovante'
 * Devolve { offline: false, resultado } ou { offline: true } (ficou salvo no aparelho).
 * Para os outros perfis, o erro de conexão continua sendo lançado.
 */
export async function enviarOuGuardar(tipo, dados, descricao) {
  const motorista = await ehMotorista();
  // O mesmo idCliente vale para a tentativa de agora e para o reenvio da fila:
  // se a resposta se perder no caminho, o backend não duplica.
  const comId = tipo === 'transacao' || tipo === 'abastecimento' ? { ...dados, idCliente: dados.idCliente || gerarId() } : dados;
  if (motorista) {
    const atual = await lerFila();
    // Se já há itens esperando (ou estamos sem rede), entra na fila para manter a ordem.
    if (!online || atual.some((i) => !i.erro)) {
      await enfileirar(tipo, comId, descricao);
      sincronizar();
      return { offline: true };
    }
  }
  try {
    return { offline: false, resultado: await executar(tipo, comId) };
  } catch (e) {
    if (motorista && e.semConexao) {
      await enfileirar(tipo, comId, descricao);
      return { offline: true };
    }
    throw e;
  }
}

/** Envia a fila na ordem. Para no primeiro erro de conexão; erros do servidor ficam marcados. */
export async function sincronizar() {
  if (sincronizando) return;
  const atual = await lerFila();
  if (!atual.some((i) => !i.erro)) return;
  sincronizando = true;
  avisar();
  try {
    for (const item of [...atual]) {
      if (item.erro) continue;
      try {
        await executar(item.tipo, item.dados);
        apagarArquivos(arquivosDoItem(item));
        await gravarFila((fila || []).filter((i) => i.id !== item.id));
      } catch (e) {
        if (e.semConexao) break;
        if (JA_FEITO[item.tipo]?.test(e.message || '')) {
          await gravarFila((fila || []).filter((i) => i.id !== item.id));
          continue;
        }
        await gravarFila((fila || []).map((i) => (i.id === item.id ? { ...i, tentativas: i.tentativas + 1, erro: e.message || 'Erro no servidor.' } : i)));
      }
    }
  } finally {
    sincronizando = false;
    avisar();
  }
}

/** Volta a tentar os itens que deram erro (por exemplo, depois de entrar de novo). */
export async function tentarNovamente() {
  const atual = await lerFila();
  await gravarFila(atual.map((i) => ({ ...i, erro: null })));
  await sincronizar();
}

export async function descartarItem(id) {
  const atual = await lerFila();
  const item = atual.find((i) => i.id === id);
  if (item) apagarArquivos(arquivosDoItem(item));
  await gravarFila(atual.filter((i) => i.id !== id));
}

export async function descartarTudo() {
  const atual = await lerFila();
  atual.forEach((i) => apagarArquivos(arquivosDoItem(i)));
  await gravarFila([]);
}

export async function contarPendentes() {
  return (await lerFila()).length;
}

/** Liga a sincronização automática. Chamado uma vez pelo App.js. */
export function iniciarModoOffline() {
  if (iniciado) return;
  iniciado = true;
  lerFila().then(() => sincronizar());

  NetInfo.addEventListener((rede) => {
    const agora = Boolean(rede.isConnected) && rede.isInternetReachable !== false;
    const voltou = agora && !online;
    online = agora;
    avisar();
    if (voltou) sincronizar();
  });

  AppState.addEventListener('change', (situacao) => {
    if (situacao === 'active') sincronizar();
  });
}

// -----------------------------------------------------------------------------
// Dados guardados no aparelho (para as telas abrirem sem internet)
// -----------------------------------------------------------------------------

async function comCache(chave, buscar) {
  const motorista = await ehMotorista();
  try {
    const dados = await buscar();
    if (motorista) AsyncStorage.setItem(CHAVE_CACHE + chave, JSON.stringify({ em: Date.now(), dados })).catch(() => {});
    return dados;
  } catch (e) {
    if (motorista && e.semConexao) {
      const texto = await AsyncStorage.getItem(CHAVE_CACHE + chave).catch(() => null);
      if (texto) return JSON.parse(texto).dados;
    }
    throw e;
  }
}

// Aplica nas listas o que ainda está na fila, para a tela já mostrar a viagem aberta/fechada.
function aplicarNasRotas(rotas) {
  const pendentes = (fila || []).filter((i) => !i.erro);
  if (!pendentes.length) return rotas;
  return (rotas || []).map((r) => {
    let rota = r;
    for (const item of pendentes) {
      if (item.dados?.rotaId !== r.id) continue;
      if (item.tipo === 'abrirViagem') {
        rota = { ...rota, status: 'em_transito', veiculoId: item.dados.veiculoId || rota.veiculoId, hodometroInicial: item.dados.hodometroInicial, pendenteEnvio: true };
      }
      if (item.tipo === 'concluirViagem') {
        const km = Math.max(0, item.dados.hodometroFinal - (rota.hodometroInicial || 0));
        rota = { ...rota, status: 'concluida', hodometroFinal: item.dados.hodometroFinal, kmRodados: km, pendenteEnvio: true };
      }
    }
    return rota;
  });
}

function aplicarNosVeiculos(veiculos, rotas) {
  const pendentes = (fila || []).filter((i) => !i.erro);
  if (!pendentes.length) return veiculos;
  return (veiculos || []).map((v) => {
    let veiculo = v;
    for (const item of pendentes) {
      const rota = (rotas || []).find((r) => r.id === item.dados?.rotaId);
      const veiculoId = item.dados?.veiculoId || rota?.veiculoId;
      if (veiculoId !== v.id) continue;
      if (item.tipo === 'abrirViagem') veiculo = { ...veiculo, status: 'em_viagem' };
      if (item.tipo === 'concluirViagem') veiculo = { ...veiculo, status: 'disponivel', hodometro: Math.max(veiculo.hodometro, item.dados.hodometroFinal) };
    }
    return veiculo;
  });
}

export async function listarRotasOffline() {
  await lerFila();
  return aplicarNasRotas(await comCache('rotas', frotix.listarRotas));
}

export async function listarVeiculosOffline() {
  await lerFila();
  const [veiculos, rotas] = await Promise.all([
    comCache('veiculos', frotix.listarVeiculos),
    comCache('rotas', frotix.listarRotas).catch(() => []),
  ]);
  return aplicarNosVeiculos(veiculos, rotas);
}

export const listarCategoriasOffline = () => comCache('categorias', frotix.listarCategorias);
export const listarFormasOffline = () => comCache('formas', frotix.listarFormas);
export const listarViagensVinculoOffline = () => comCache('viagensVinculo', frotix.listarViagensVinculo);
