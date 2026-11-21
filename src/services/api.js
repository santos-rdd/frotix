import * as SecureStore from 'expo-secure-store';
import { API_URL } from '../config/api.js';

// Token de sessão devolvido pelo login. Fica na memória e no SecureStore do aparelho.
const CHAVE_TOKEN = 'frotix_token';
// Dados que a HomePage recebe no login (nome, perfil, foto), para abrir direto na próxima vez.
const CHAVE_SESSAO = 'frotix_sessao';
let tokenAtual = null;
let aoExpirarSessao = null;

export async function salvarToken(token) {
  tokenAtual = token || null;
  try {
    if (token) await SecureStore.setItemAsync(CHAVE_TOKEN, token);
    else await SecureStore.deleteItemAsync(CHAVE_TOKEN);
  } catch (e) {
    console.warn('Não foi possível guardar o token:', e?.message || e);
  }
}

export async function carregarToken() {
  if (tokenAtual) return tokenAtual;
  try {
    tokenAtual = await SecureStore.getItemAsync(CHAVE_TOKEN);
  } catch {
    tokenAtual = null;
  }
  return tokenAtual;
}

/**
 * Guarda o token e os parâmetros da HomePage ({ auth, bankUser }) depois do login.
 * Na próxima vez que o app abrir, App.js usa carregarSessao() para entrar direto.
 */
export async function salvarSessao(token, paramsHome) {
  await salvarToken(token);
  try {
    if (token && paramsHome) {
      // Do Google só guarda o necessário para a Home (nome e foto).
      const user = paramsHome.auth?.user || {};
      const enxuto = {
        bankUser: paramsHome.bankUser || null,
        auth: paramsHome.auth ? { user: { givenName: user.givenName || null, name: user.name || null, photo: user.photo || null } } : null,
      };
      await SecureStore.setItemAsync(CHAVE_SESSAO, JSON.stringify(enxuto));
    } else {
      await SecureStore.deleteItemAsync(CHAVE_SESSAO);
    }
  } catch (e) {
    console.warn('Não foi possível guardar a sessão:', e?.message || e);
  }
}

/** Token ainda vale? (confere o "exp" do JWT, com 1 minuto de folga). */
export function tokenValido(token) {
  const dados = decodificarToken(token);
  return Boolean(dados?.exp) && dados.exp * 1000 > Date.now() + 60 * 1000;
}

/**
 * Sessão salva do último login, ou null se não houver ou se o token já venceu.
 * Devolve os mesmos parâmetros que a tela de login passa para a HomePage.
 */
export async function carregarSessao() {
  try {
    const token = await carregarToken();
    if (!token || !tokenValido(token)) {
      if (token) await limparSessao();
      return null;
    }
    const texto = await SecureStore.getItemAsync(CHAVE_SESSAO);
    const params = texto ? JSON.parse(texto) : null;
    if (!params?.bankUser) return null;
    return params;
  } catch {
    return null;
  }
}

export async function limparSessao() {
  await salvarToken(null);
  try {
    await SecureStore.deleteItemAsync(CHAVE_SESSAO);
  } catch {
    // nada a fazer
  }
}

/** Erro de rede (sem internet ou servidor fora do ar). O modo offline usa isso para guardar o envio. */
export function erroSemConexao() {
  const erro = new Error('Sem conexão com o servidor. Verifique a internet e tente de novo.');
  erro.semConexao = true;
  return erro;
}

/** O App.js registra aqui o que fazer quando o backend responde 401 (voltar ao login). */
export function definirAoExpirarSessao(fn) {
  aoExpirarSessao = fn;
}

/**
 * fetch para o backend do Frotix: põe o endereço base e o token.
 * Devolve o Response (como o fetch normal). Para JSON direto, use apiJson.
 */
export async function apiFetch(caminho, opcoes = {}) {
  const token = await carregarToken();
  const headers = { ...(opcoes.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  let body = opcoes.body;
  const ehForm = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body !== undefined && !ehForm && typeof body !== 'string') {
    body = JSON.stringify(body);
    headers['Content-Type'] = 'application/json';
  }

  const resposta = await fetch(`${API_URL}${caminho}`, { ...opcoes, headers, body });

  if (resposta.status === 401 && token) {
    await limparSessao();
    aoExpirarSessao?.();
  }
  return resposta;
}

/** Chama o backend e devolve o JSON; lança Error com a mensagem do backend se der erro. */
export async function apiJson(caminho, opcoes = {}) {
  let resposta;
  try {
    resposta = await apiFetch(caminho, opcoes);
  } catch {
    throw erroSemConexao();
  }
  const json = await resposta.json().catch(() => ({}));
  if (!resposta.ok || json.sucesso === false) {
    const erro = new Error(json.erro || json.error || json.mensagem || `Erro ${resposta.status} no servidor.`);
    erro.status = resposta.status;
    // 502/503/504: servidor fora do ar (Render acordando, por exemplo) — conta como sem conexão.
    if (resposta.status >= 502 && resposta.status <= 504) erro.semConexao = true;
    throw erro;
  }
  return json;
}

/** Decodifica o payload do JWT sem depender de bibliotecas externas. */
export function decodificarToken(token) {
  if (!token) return null;
  try {
    const parte = token.split('.')[1];
    if (!parte) return null;
    const b64 = parte.replace(/-/g, '+').replace(/_/g, '/');
    const str = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('utf-8');
    return JSON.parse(str);
  } catch {
    return null;
  }
}

/** Retorna os dados do usuário autenticado ({ sub, perfil, nome }) salvos no token. */
export async function obterUsuarioLogado() {
  const token = await carregarToken();
  return decodificarToken(token);
}
