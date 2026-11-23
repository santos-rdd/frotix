import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { executarMigracoes } from '../src/database/migrations/index.js';
import {
  listarPosicoesGpsPendentes,
  salvarPosicaoGpsPendente,
} from '../src/database/repositories/posicoesGpsRepository.js';
import { definirInstanciaBanco } from '../src/database/index.js';
import { salvarDadoLocal } from '../src/database/repositories/dadosLocaisRepository.js';
import { concluirViagemOffline } from '../src/services/localDataService.js';
import { definirSecureStore, salvarToken } from '../src/services/api.js';
import { sincronizarOperacoes } from '../src/services/syncService.js';
import {
  definirModuloLocation,
  iniciarRastreamentoGps,
} from '../src/services/rastreamentoGpsService.js';

const USUARIO = 'a2000000-0000-0000-0000-000000000001';
const VIAGEM = 'b2000000-0000-0000-0000-000000000001';

class BancoSQLiteTeste {
  constructor() {
    this.db = new DatabaseSync(':memory:');
  }

  async execAsync(sql) {
    this.db.exec(sql);
  }

  async runAsync(sql, parametros = []) {
    return this.db.prepare(sql).run(...parametros);
  }

  async getAllAsync(sql, parametros = []) {
    return this.db.prepare(sql).all(...parametros);
  }

  async getFirstAsync(sql, parametros = []) {
    return this.db.prepare(sql).get(...parametros) || null;
  }

  async withExclusiveTransactionAsync(callback) {
    return callback(this);
  }

  close() {
    this.db.close();
  }
}

async function criarBanco() {
  const db = new BancoSQLiteTeste();
  await executarMigracoes(db);
  definirInstanciaBanco(db);
  return db;
}

async function autenticarMotorista() {
  const armazenamento = {
    itens: new Map(),
    async setItemAsync(chave, valor) { this.itens.set(chave, valor); },
    async getItemAsync(chave) { return this.itens.get(chave) || null; },
    async deleteItemAsync(chave) { this.itens.delete(chave); },
  };
  definirSecureStore(armazenamento);
  const payload = Buffer.from(JSON.stringify({ sub: USUARIO, perfil: 4 })).toString('base64url');
  await salvarToken(`header.${payload}.signature`);
}

function resposta(dados, status = 200) {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('SQLite deduplica amostras e isola posições por usuário e viagem', async () => {
  const db = await criarBanco();
  const registradaEm = new Date(Date.now() - 60_000).toISOString();
  const primeira = {
    id: 'c2000000-0000-0000-0000-000000000001',
    usuarioId: USUARIO,
    viagemId: VIAGEM,
    latitude: -23.5,
    longitude: -46.5,
    precisao: 5,
    velocidade: null,
    registradaEm,
    criadoEm: new Date().toISOString(),
  };

  try {
    assert.equal((await salvarPosicaoGpsPendente(db, primeira)).changes, 1);
    assert.equal((await salvarPosicaoGpsPendente(db, { ...primeira, id: 'c2000000-0000-0000-0000-000000000002' })).changes, 0);
    assert.equal((await listarPosicoesGpsPendentes(db, USUARIO, VIAGEM)).length, 1);
    assert.equal((await salvarPosicaoGpsPendente(db, {
      ...primeira,
      id: 'c2000000-0000-0000-0000-000000000003',
      usuarioId: 'a2000000-0000-0000-0000-000000000002',
    })).changes, 1);
    assert.equal((await listarPosicoesGpsPendentes(db, USUARIO, VIAGEM)).length, 1);
  } finally {
    definirInstanciaBanco(null);
    db.close();
  }
});

test('GPS usa somente permissão foreground e persiste amostras da viagem autenticada', async () => {
  const db = await criarBanco();
  await autenticarMotorista();
  let observador;
  let opcoes;
  let removido = false;
  definirModuloLocation({
    Accuracy: { Balanced: 3 },
    async requestForegroundPermissionsAsync() {
      return { status: 'granted' };
    },
    async watchPositionAsync(parametros, callback) {
      opcoes = parametros;
      observador = callback;
      return { remove() { removido = true; } };
    },
  });

  let parar;
  try {
    parar = await iniciarRastreamentoGps({ usuarioId: USUARIO, viagemId: VIAGEM });
    assert.equal(opcoes.timeInterval, 15_000);
    assert.equal(opcoes.distanceInterval, 50);
    await observador({
      timestamp: Date.now(),
      coords: { latitude: -23.5, longitude: -46.5, accuracy: 5, speed: 2 },
    });
    assert.equal((await listarPosicoesGpsPendentes(db, USUARIO, VIAGEM)).length, 1);
  } finally {
    parar?.();
    definirModuloLocation(null);
    definirInstanciaBanco(null);
    db.close();
  }
  assert.equal(removido, true);
});

test('conclusão offline preserva a fila GPS até confirmação por posição na sincronização', async (contexto) => {
  const db = await criarBanco();
  await autenticarMotorista();
  const originalFetch = globalThis.fetch;
  contexto.after(() => {
    globalThis.fetch = originalFetch;
    definirInstanciaBanco(null);
    db.close();
  });

  const instante = new Date(Date.now() - 60_000).toISOString();
  const posicoes = [
    {
      id: 'c2000000-0000-0000-0000-000000000011',
      usuarioId: USUARIO,
      viagemId: VIAGEM,
      latitude: -23.5,
      longitude: -46.5,
      precisao: 5,
      velocidade: 2,
      registradaEm: instante,
      criadoEm: new Date().toISOString(),
    },
    {
      id: 'c2000000-0000-0000-0000-000000000012',
      usuarioId: USUARIO,
      viagemId: VIAGEM,
      latitude: -23.51,
      longitude: -46.51,
      precisao: 6,
      velocidade: 3,
      registradaEm: new Date(Date.now() - 30_000).toISOString(),
      criadoEm: new Date().toISOString(),
    },
  ];
  for (const posicao of posicoes) await salvarPosicaoGpsPendente(db, posicao);
  await salvarDadoLocal(db, USUARIO, 'colecao_rotas', [{
    id: VIAGEM,
    status: 'em_transito',
    hodometroInicial: 1000,
    veiculoId: 'veiculo-remoto',
  }]);

  await concluirViagemOffline(USUARIO, VIAGEM, { hodometroFinal: 1100 });
  assert.equal((await listarPosicoesGpsPendentes(db, USUARIO, VIAGEM)).length, 2);

  let respostaGps = 'rede';
  let chamadasConclusao = 0;
  let idsPersistidas = [];
  globalThis.fetch = async (url, opcoes = {}) => {
    const caminho = new URL(url).pathname;
    if (caminho === '/') return resposta({ sucesso: true });
    if (caminho.endsWith('/posicoes')) {
      const solicitacao = JSON.parse(opcoes.body);
      if (respostaGps === 'rede') throw new TypeError('fetch failed');
      if (respostaGps === 'parcial') {
        idsPersistidas = [solicitacao.posicoes[0].id];
        return resposta({
          sucesso: false,
          persistidas: idsPersistidas,
          naoPersistidas: [solicitacao.posicoes[1].id],
        }, 207);
      }
      idsPersistidas = solicitacao.posicoes.map((item) => item.id);
      return resposta({ sucesso: true, persistidas: idsPersistidas });
    }
    if (caminho.endsWith('/concluir')) {
      chamadasConclusao++;
      return resposta({ sucesso: true });
    }
    throw new Error(`Chamada inesperada no teste: ${caminho}`);
  };

  const falhaRede = await sincronizarOperacoes(USUARIO);
  assert.equal(falhaRede.sucesso, false);
  assert.equal((await listarPosicoesGpsPendentes(db, USUARIO, VIAGEM)).length, 2);
  assert.equal(chamadasConclusao, 0);

  respostaGps = 'parcial';
  const persistenciaParcial = await sincronizarOperacoes(USUARIO);
  assert.equal(persistenciaParcial.sucesso, false);
  assert.equal((await listarPosicoesGpsPendentes(db, USUARIO, VIAGEM)).length, 1);
  assert.equal(chamadasConclusao, 0);

  respostaGps = 'completa';
  const sincronizada = await sincronizarOperacoes(USUARIO);
  assert.equal(sincronizada.sucesso, true);
  assert.equal((await listarPosicoesGpsPendentes(db, USUARIO, VIAGEM)).length, 0);
  assert.equal(chamadasConclusao, 1);
  assert.deepEqual(idsPersistidas, [posicoes[1].id]);
  assert.equal((await db.getAllAsync('SELECT * FROM sync_queue WHERE usuario_id = ?', [USUARIO])).length, 0);
});
