import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  apiFetch,
  definirAoExpirarSessao,
  definirLocalAuthentication,
  definirLogoutEmAndamento,
  definirSecureStore,
  carregarCredenciaisLembradas,
  habilitarBiometria,
  limparSessao,
  removerCredenciaisLembradas,
  recuperarSessaoBiometrica,
  salvarCredenciaisLembradas,
  salvarSessao,
} from '../src/services/api.js';

function criarSecureStore() {
  const itens = new Map();
  const protegidas = new Set();
  return {
    itens,
    protegidas,
    falharAutenticacaoBiometrica: false,
    async setItemAsync(chave, valor, opcoes) {
      itens.set(chave, valor);
      if (opcoes?.requireAuthentication) protegidas.add(chave);
    },
    async getItemAsync(chave, opcoes) {
      if (opcoes?.requireAuthentication && this.falharAutenticacaoBiometrica) {
        throw new Error('Autenticação cancelada');
      }
      return itens.get(chave) ?? null;
    },
    async deleteItemAsync(chave) { itens.delete(chave); },
  };
}

const respostaJson = (dados, status = 200) =>
  new Response(JSON.stringify(dados), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

test('renova concorrente uma vez, persiste a rotação e repete cada requisição no máximo uma vez', async () => {
  const store = criarSecureStore();
  definirSecureStore(store);
  await salvarSessao({ access_token: 'access-antigo', refresh_token: 'refresh-antigo' });

  let chamadasRefresh = 0;
  const chamadasProtegidas = new Map();
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).endsWith('/auth/refresh')) {
      chamadasRefresh += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return respostaJson({
        usuario: { id: 'user-1', role: 4 },
        token: 'access-novo',
        sessao: {
          access_token: 'access-novo',
          refresh_token: 'refresh-novo',
        },
      });
    }

    const caminho = String(url).split('/').pop();
    chamadasProtegidas.set(caminho, (chamadasProtegidas.get(caminho) || 0) + 1);
    if (options.headers.Authorization === 'Bearer access-antigo') {
      return respostaJson({ erro: 'expirado' }, 401);
    }
    return respostaJson({ sucesso: true });
  };

  const respostas = await Promise.all([
    apiFetch('/frota/veiculos'),
    apiFetch('/frota/rotas'),
  ]);
  assert.deepEqual(respostas.map((resposta) => resposta.status), [200, 200]);
  assert.equal(chamadasRefresh, 1);
  assert.deepEqual([...chamadasProtegidas.values()], [2, 2]);
  assert.equal(store.itens.get('frotix_access_token'), 'access-novo');
  assert.equal(store.itens.get('frotix_refresh_token'), 'refresh-novo');

  globalThis.fetch = async (url, options = {}) => {
    if (String(url).endsWith('/auth/refresh')) {
      chamadasRefresh += 1;
      return respostaJson({ erro: 'expirado' }, 401);
    }
    return respostaJson({ erro: 'expirado' }, 401);
  };
  const repetida = await apiFetch('/frota/veiculos');
  assert.equal(repetida.status, 401);
  assert.equal(chamadasRefresh, 2);
});

test('falha temporária de refresh preserva tokens locais e não encerra a sessão', async () => {
  const store = criarSecureStore();
  definirSecureStore(store);
  await salvarSessao({ access_token: 'access-atual', refresh_token: 'refresh-atual' });
  let expiracaoNotificada = false;
  definirAoExpirarSessao(() => { expiracaoNotificada = true; });
  globalThis.fetch = async (url) =>
    String(url).endsWith('/auth/refresh')
      ? respostaJson({ erro: 'indisponível' }, 503)
      : respostaJson({ erro: 'expirado' }, 401);

  const resposta = await apiFetch('/frota/veiculos');
  assert.equal(resposta.status, 401);
  assert.equal(store.itens.get('frotix_access_token'), 'access-atual');
  assert.equal(store.itens.get('frotix_refresh_token'), 'refresh-atual');
  assert.equal(expiracaoNotificada, false);
});

test('refresh confirmado inválido limpa tokens de sessão e notifica o app', async () => {
  const store = criarSecureStore();
  definirSecureStore(store);
  await salvarSessao({ access_token: 'access-atual', refresh_token: 'refresh-atual' });
  let expiracaoNotificada = false;
  definirAoExpirarSessao(() => { expiracaoNotificada = true; });
  globalThis.fetch = async (url) =>
    String(url).endsWith('/auth/refresh')
      ? respostaJson({ erro: 'inválido' }, 401)
      : respostaJson({ erro: 'expirado' }, 401);

  const resposta = await apiFetch('/frota/veiculos');
  assert.equal(resposta.status, 401);
  assert.equal(store.itens.has('frotix_access_token'), false);
  assert.equal(store.itens.has('frotix_refresh_token'), false);
  assert.equal(expiracaoNotificada, true);
});

test('logout em andamento impede que uma resposta 401 inicie refresh', async () => {
  const store = criarSecureStore();
  definirSecureStore(store);
  await salvarSessao({ access_token: 'access-atual', refresh_token: 'refresh-atual' });
  const chamadas = [];
  globalThis.fetch = async (url) => {
    chamadas.push(String(url));
    return new Response(null, { status: 204 });
  };

  definirLogoutEmAndamento(true);
  try {
    assert.equal((await apiFetch('/auth/logout', { method: 'POST' })).status, 204);
    assert.equal(chamadas.length, 1);
    assert.equal(chamadas[0].endsWith('/auth/logout'), true);
  } finally {
    definirLogoutEmAndamento(false);
  }
});

test('Salvar senha mantém credenciais em SecureStore e a desmarcação as remove', async () => {
  const store = criarSecureStore();
  definirSecureStore(store);
  await salvarCredenciaisLembradas('motorista@frotix.com', 'senha-segura');
  assert.deepEqual(await carregarCredenciaisLembradas(), {
    email: 'motorista@frotix.com',
    senha: 'senha-segura',
  });
  assert.equal(store.itens.has('frotix_credenciais_salvas'), true);
  await removerCredenciaisLembradas();
  assert.equal(await carregarCredenciaisLembradas(), null);
});

test('limpeza da sessão não remove credenciais lembradas', async () => {
  const store = criarSecureStore();
  definirSecureStore(store);
  await salvarSessao({ access_token: 'access-atual', refresh_token: 'refresh-atual' });
  await salvarCredenciaisLembradas('motorista@frotix.com', 'senha-segura');
  await limparSessao();
  assert.equal(store.itens.has('frotix_access_token'), false);
  assert.equal(store.itens.has('frotix_refresh_token'), false);
  assert.ok(await carregarCredenciaisLembradas());
});

test('biometria habilitada protege o refresh token e renova a sessão antes de autenticar', async () => {
  const store = criarSecureStore();
  definirSecureStore(store);
  await salvarSessao({ access_token: 'access-antigo', refresh_token: 'refresh-antigo' });
  definirLocalAuthentication({
    async hasHardwareAsync() { return true; },
    async isEnrolledAsync() { return true; },
    async authenticateAsync() { return { success: true }; },
  });
  assert.deepEqual(await habilitarBiometria('refresh-antigo'), { status: 'enabled' });
  assert.equal(store.itens.has('frotix_refresh_token'), false);
  assert.equal(store.protegidas.has('frotix_refresh_biometrico'), true);

  globalThis.fetch = async () => respostaJson({
    usuario: { id: 'motorista-1', role: 4 },
    token: 'access-renovado',
    sessao: {
      access_token: 'access-renovado',
      refresh_token: 'refresh-renovado',
    },
  });
  const resultado = await recuperarSessaoBiometrica();
  assert.equal(resultado.status, 'success');
  assert.equal(resultado.data.usuario.role, 4);
  assert.equal(store.itens.get('frotix_refresh_biometrico'), 'refresh-renovado');
  assert.equal(store.itens.get('frotix_access_token'), 'access-renovado');
  assert.equal(store.protegidas.has('frotix_refresh_biometrico'), true);
});

test('cancelar biometria mantém a credencial e permite o login tradicional', async () => {
  const store = criarSecureStore();
  definirSecureStore(store);
  await limparSessao();
  store.itens.set('frotix_biometria_ativa', 'true');
  store.itens.set('frotix_refresh_biometrico', 'refresh-protegido');
  store.falharAutenticacaoBiometrica = true;
  definirLocalAuthentication({
    async hasHardwareAsync() { return true; },
    async isEnrolledAsync() { return true; },
  });

  const resultado = await recuperarSessaoBiometrica();
  assert.equal(resultado.status, 'cancelled');
  assert.equal(store.itens.get('frotix_biometria_ativa'), 'true');
  assert.equal(store.itens.get('frotix_refresh_biometrico'), 'refresh-protegido');
});
