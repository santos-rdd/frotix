import { API_URL } from '../config/api.js';

const CHAVE_ACCESS_TOKEN = 'frotix_access_token';
const CHAVE_REFRESH_TOKEN = 'frotix_refresh_token';
const CHAVE_REFRESH_BIOMETRICO = 'frotix_refresh_biometrico';
const CHAVE_BIOMETRIA_ATIVA = 'frotix_biometria_ativa';
const CHAVE_CREDENCIAIS_SALVAS = 'frotix_credenciais_salvas';
const OPCAO_BIOMETRIA = {
  requireAuthentication: true,
  authenticationPrompt: 'Autentique-se para acessar sua conta Frotix.',
};

let tokenAtual = null;
let refreshTokenAtual = null;
let biometriaAtiva = false;
let biometriaTentada = false;
let aoExpirarSessao = null;
let logoutEmAndamento = false;
let promessaRefresh = null;
let instanciaSecureStore = null;
let instanciaLocalAuthentication = null;

export function definirSecureStore(instancia) {
  instanciaSecureStore = instancia;
}

export function definirLocalAuthentication(instancia) {
  instanciaLocalAuthentication = instancia;
}

async function obterSecureStore(opcional = false) {
  if (instanciaSecureStore) return instanciaSecureStore;
  try {
    const mod = await import('expo-secure-store');
    return mod.default || mod;
  } catch (error) {
    if (opcional) return null;
    throw new Error('O armazenamento seguro não está disponível neste dispositivo.', { cause: error });
  }
}

async function obterLocalAuthentication() {
  if (instanciaLocalAuthentication) return instanciaLocalAuthentication;
  return import('expo-local-authentication');
}

export async function salvarToken(token) {
  tokenAtual = token || null;
  const secureStore = await obterSecureStore();
  if (token) {
    await secureStore.setItemAsync(CHAVE_ACCESS_TOKEN, token);
  } else {
    await secureStore.deleteItemAsync(CHAVE_ACCESS_TOKEN);
  }
}

export async function salvarSessao(sessao) {
  const accessToken = sessao?.access_token;
  if (typeof accessToken !== 'string' || !accessToken) {
    throw new Error('A resposta de autenticação não contém um access token válido.');
  }
  if (typeof sessao.refresh_token !== 'string' || !sessao.refresh_token) {
    await salvarToken(accessToken);
    return;
  }

  const secureStore = await obterSecureStore();
  tokenAtual = accessToken;
  refreshTokenAtual = sessao.refresh_token;
  biometriaAtiva = false;
  biometriaTentada = false;

  await secureStore.deleteItemAsync(CHAVE_BIOMETRIA_ATIVA);
  await secureStore.deleteItemAsync(CHAVE_REFRESH_BIOMETRICO);
  await secureStore.setItemAsync(CHAVE_REFRESH_TOKEN, sessao.refresh_token);
  await secureStore.setItemAsync(CHAVE_ACCESS_TOKEN, accessToken);
}

async function salvarSessaoRotacionada(sessao) {
  const accessToken = sessao?.access_token;
  const refreshToken = sessao?.refresh_token;
  if (typeof accessToken !== 'string' || !accessToken ||
      typeof refreshToken !== 'string' || !refreshToken) {
    return false;
  }

  tokenAtual = accessToken;
  refreshTokenAtual = refreshToken;
  const secureStore = await obterSecureStore();

  if (biometriaAtiva) {
    await secureStore.setItemAsync(CHAVE_REFRESH_BIOMETRICO, refreshToken, OPCAO_BIOMETRIA);
    await secureStore.deleteItemAsync(CHAVE_REFRESH_TOKEN);
  } else {
    await secureStore.setItemAsync(CHAVE_REFRESH_TOKEN, refreshToken);
  }
  await secureStore.setItemAsync(CHAVE_ACCESS_TOKEN, accessToken);
  return true;
}

export async function carregarToken() {
  if (tokenAtual) return tokenAtual;
  const secureStore = await obterSecureStore(true);
  tokenAtual = await secureStore?.getItemAsync(CHAVE_ACCESS_TOKEN) || null;
  return tokenAtual;
}

async function carregarRefreshToken() {
  if (refreshTokenAtual) return refreshTokenAtual;
  const secureStore = await obterSecureStore();
  biometriaAtiva = (await secureStore.getItemAsync(CHAVE_BIOMETRIA_ATIVA)) === 'true';
  refreshTokenAtual = biometriaAtiva
    ? await secureStore.getItemAsync(CHAVE_REFRESH_BIOMETRICO, OPCAO_BIOMETRIA)
    : await secureStore.getItemAsync(CHAVE_REFRESH_TOKEN);
  return refreshTokenAtual;
}

export async function limparSessao() {
  tokenAtual = null;
  refreshTokenAtual = null;
  biometriaAtiva = false;
  biometriaTentada = false;
  const secureStore = await obterSecureStore();
  await Promise.all([
    secureStore.deleteItemAsync(CHAVE_ACCESS_TOKEN),
    secureStore.deleteItemAsync(CHAVE_REFRESH_TOKEN),
    secureStore.deleteItemAsync(CHAVE_REFRESH_BIOMETRICO),
    secureStore.deleteItemAsync(CHAVE_BIOMETRIA_ATIVA),
  ]);
}

export async function salvarCredenciaisLembradas(email, senha) {
  if (!email || !senha) {
    throw new Error('E-mail e senha são necessários para salvar as credenciais.');
  }
  const secureStore = await obterSecureStore();
  await secureStore.setItemAsync(
    CHAVE_CREDENCIAIS_SALVAS,
    JSON.stringify({ email, senha })
  );
}

export async function carregarCredenciaisLembradas() {
  const secureStore = await obterSecureStore();
  const valor = await secureStore.getItemAsync(CHAVE_CREDENCIAIS_SALVAS);
  if (!valor) return null;

  try {
    const credenciais = JSON.parse(valor);
    return credenciais?.email && credenciais?.senha ? credenciais : null;
  } catch {
    await secureStore.deleteItemAsync(CHAVE_CREDENCIAIS_SALVAS);
    return null;
  }
}

export async function removerCredenciaisLembradas() {
  const secureStore = await obterSecureStore();
  await secureStore.deleteItemAsync(CHAVE_CREDENCIAIS_SALVAS);
}

export async function removerCredenciaisDeAutenticacao() {
  const resultados = await Promise.allSettled([
    limparSessao(),
    removerCredenciaisLembradas(),
  ]);
  if (resultados.some((resultado) => resultado.status === 'rejected')) {
    throw new Error('Não foi possível remover todas as credenciais locais.');
  }
}

export async function biometriaConfigurada() {
  const secureStore = await obterSecureStore();
  return (await secureStore.getItemAsync(CHAVE_BIOMETRIA_ATIVA)) === 'true';
}

export async function habilitarBiometria(refreshToken) {
  const localAuth = await obterLocalAuthentication();
  const [hardware, cadastrada] = await Promise.all([
    localAuth.hasHardwareAsync(),
    localAuth.isEnrolledAsync(),
  ]);
  if (!hardware || !cadastrada) return { status: 'unavailable' };

  const resultado = await localAuth.authenticateAsync({
    promptMessage: 'Confirme sua identidade para ativar o acesso biométrico.',
    cancelLabel: 'Agora não',
    disableDeviceFallback: true,
  });
  if (!resultado.success) return { status: 'cancelled' };

  const secureStore = await obterSecureStore();
  await secureStore.setItemAsync(CHAVE_REFRESH_BIOMETRICO, refreshToken, OPCAO_BIOMETRIA);
  await secureStore.setItemAsync(CHAVE_BIOMETRIA_ATIVA, 'true');
  await secureStore.deleteItemAsync(CHAVE_REFRESH_TOKEN);
  refreshTokenAtual = refreshToken;
  biometriaAtiva = true;
  return { status: 'enabled' };
}

async function renovarComRefreshToken(refreshToken) {
  if (promessaRefresh) return promessaRefresh;

  promessaRefresh = (async () => {
    if (logoutEmAndamento) return { status: 'logout' };

    let resposta;
    try {
      resposta = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    } catch {
      return { status: 'unavailable' };
    }

    if (resposta.status === 401) {
      try {
        await limparSessao();
      } finally {
        aoExpirarSessao?.();
      }
      return { status: 'invalid' };
    }
    if (!resposta.ok) return { status: 'unavailable' };

    const dados = await resposta.json();
    if (!await salvarSessaoRotacionada(dados?.sessao)) {
      return { status: 'unavailable' };
    }
    return {
      status: 'success',
      token: dados.sessao.access_token,
      data: dados,
    };
  })();

  try {
    return await promessaRefresh;
  } finally {
    promessaRefresh = null;
  }
}

export async function recuperarSessaoBiometrica() {
  if (!await biometriaConfigurada()) return { status: 'not-configured' };
  if (biometriaTentada) return { status: 'already-attempted' };
  biometriaTentada = true;

  const localAuth = await obterLocalAuthentication();
  const [hardware, cadastrada] = await Promise.all([
    localAuth.hasHardwareAsync(),
    localAuth.isEnrolledAsync(),
  ]);
  if (!hardware || !cadastrada) return { status: 'unavailable' };

  let refreshToken;
  try {
    const secureStore = await obterSecureStore();
    refreshToken = await secureStore.getItemAsync(CHAVE_REFRESH_BIOMETRICO, OPCAO_BIOMETRIA);
  } catch {
    return { status: 'cancelled' };
  }
  if (!refreshToken) {
    const secureStore = await obterSecureStore();
    await secureStore.deleteItemAsync(CHAVE_REFRESH_BIOMETRICO);
    await secureStore.deleteItemAsync(CHAVE_BIOMETRIA_ATIVA);
    biometriaAtiva = false;
    return { status: 'unavailable' };
  }

  refreshTokenAtual = refreshToken;
  biometriaAtiva = true;
  return renovarComRefreshToken(refreshToken);
}

export function definirLogoutEmAndamento(valor) {
  logoutEmAndamento = Boolean(valor);
}


export function definirAoExpirarSessao(fn) {
  aoExpirarSessao = fn;
}

async function fetchComToken(caminho, opcoes, token) {
  const headers = { ...(opcoes.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  let body = opcoes.body;
  const ehForm = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body !== undefined && !ehForm && typeof body !== 'string') {
    body = JSON.stringify(body);
    headers['Content-Type'] = 'application/json';
  }

  return fetch(`${API_URL}${caminho}`, { ...opcoes, headers, body });
}





export async function apiFetch(caminho, opcoes = {}) {
  const { naoRenovarSessao = false, ...fetchOptions } = opcoes;
  const token = await carregarToken();
  const resposta = await fetchComToken(caminho, fetchOptions, token);
  if (resposta.status !== 401 || !token || naoRenovarSessao || logoutEmAndamento) {
    return resposta;
  }

  const tokenAtualizado = await carregarToken();
  if (tokenAtualizado && tokenAtualizado !== token) {
    return fetchComToken(caminho, fetchOptions, tokenAtualizado);
  }

  const refreshToken = await carregarRefreshToken();
  if (!refreshToken) return resposta;

  const renovacao = await renovarComRefreshToken(refreshToken);
  if (renovacao.status !== 'success') return resposta;
  return fetchComToken(caminho, fetchOptions, renovacao.token);
}


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


export async function obterUsuarioLogado() {
  const token = await carregarToken();
  return decodificarToken(token);
}
