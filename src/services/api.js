import { API_URL } from '../config/api.js';

const CHAVE_TOKEN = 'frotix_token';
let tokenAtual = null;
let aoExpirarSessao = null;
let instanciaSecureStore = null;

export function definirSecureStore(instancia) {
  instanciaSecureStore = instancia;
}

async function obterSecureStore() {
  if (instanciaSecureStore) return instanciaSecureStore;
  try {
    const mod = await import('expo-secure-store');
    return mod.default || mod;
  } catch {
    return null;
  }
}

export async function salvarToken(token) {
  tokenAtual = token || null;
  try {
    const ss = await obterSecureStore();
    if (token) await ss?.setItemAsync?.(CHAVE_TOKEN, token);
    else await ss?.deleteItemAsync?.(CHAVE_TOKEN);
  } catch (e) {
    console.warn('Não foi possível guardar o token:', e?.message || e);
  }
}

export async function carregarToken() {
  if (tokenAtual) return tokenAtual;
  try {
    const ss = await obterSecureStore();
    tokenAtual = await ss?.getItemAsync?.(CHAVE_TOKEN);
  } catch {
    tokenAtual = null;
  }
  return tokenAtual;
}

export const limparSessao = () => salvarToken(null);

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
    throw new Error('Sem conexão com o servidor. Verifique a internet e tente de novo.');
  }
  const json = await resposta.json().catch(() => ({}));
  if (!resposta.ok || json.sucesso === false) {
    throw new Error(json.erro || json.error || json.mensagem || `Erro ${resposta.status} no servidor.`);
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
