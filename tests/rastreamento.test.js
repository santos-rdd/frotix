// Rastreamento do motorista: fila local (SQLite real em memória) + envio ao backend.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { executarMigracoes } from '../src/database/migrations/index.js';
import { definirInstanciaBanco } from '../src/database/index.js';
import {
  definirDependenciasRastreamento,
  registrarLeitura,
  enviarPosicoesPendentes,
  iniciarRastreamento,
  pararRastreamento,
  estaRastreando,
  converterLeitura,
} from '../src/services/rastreamentoService.js';

// Adaptador: mesma API assíncrona do expo-sqlite em cima do node:sqlite.
function criarBanco() {
  const banco = new DatabaseSync(':memory:');
  const db = {
    banco,
    async execAsync(sql) { banco.exec(sql); },
    async runAsync(sql, params = []) { return banco.prepare(sql).run(...params); },
    async getAllAsync(sql, params = []) { return banco.prepare(sql).all(...params); },
    async getFirstAsync(sql, params = []) { return banco.prepare(sql).get(...params) ?? null; },
    async withExclusiveTransactionAsync(fn) {
      banco.exec('BEGIN');
      try { await fn(db); banco.exec('COMMIT'); } catch (e) { banco.exec('ROLLBACK'); throw e; }
    },
  };
  return db;
}

const leitura = (lat, lon, ms) => ({ coords: { latitude: lat, longitude: lon, accuracy: 8, speed: 20 }, timestamp: ms });
const pendentes = (db) => db.banco.prepare('SELECT * FROM posicoes_pendentes ORDER BY registrada_em').all();

let db;
let enviados;
let respostaServidor;

beforeEach(async () => {
  pararRastreamento();
  db = criarBanco();
  await executarMigracoes(db);
  definirInstanciaBanco(db);
  enviados = [];
  respostaServidor = { status: 200, ok: true };
  definirDependenciasRastreamento({
    enviar: async (viagemId, posicoes) => {
      if (respostaServidor === 'offline') throw new Error('sem rede');
      enviados.push({ viagemId, posicoes });
      return respostaServidor;
    },
  });
});

test('converte a leitura do expo-location e ignora velocidade negativa', () => {
  const p = converterLeitura({ coords: { latitude: -22, longitude: -47, accuracy: 5, speed: -1 }, timestamp: 0 });
  assert.equal(p.velocidade, null);
  assert.equal(p.registradaEm, '1970-01-01T00:00:00.000Z');
  assert.equal(converterLeitura({ coords: {} }), null);
});

test('online: leitura é enviada e sai da fila local', async () => {
  await registrarLeitura('m1', 'v1', leitura(-22.1, -47.1, Date.now()));
  assert.equal(enviados.length, 1);
  assert.equal(enviados[0].viagemId, 'v1');
  assert.equal(enviados[0].posicoes[0].latitude, -22.1);
  assert.equal(pendentes(db).length, 0);
});

test('offline: leituras ficam no SQLite e vão juntas quando a internet volta', async () => {
  respostaServidor = 'offline';
  const base = Date.now() - 60_000;
  await registrarLeitura('m1', 'v1', leitura(-22.1, -47.1, base));
  await registrarLeitura('m1', 'v1', leitura(-22.2, -47.2, base + 15_000));
  await registrarLeitura('m1', 'v1', leitura(-22.2, -47.2, base + 15_000)); // repetida
  assert.equal(pendentes(db).length, 2);

  respostaServidor = { status: 200, ok: true };
  const aceitas = await enviarPosicoesPendentes('m1', 'v1');
  assert.equal(aceitas, 2);
  assert.deepEqual(enviados.at(-1).posicoes.map((p) => p.latitude), [-22.1, -22.2]);
  assert.equal(pendentes(db).length, 0);
});

test('viagem recusada pelo servidor (409): mantém a fila e espera antes de tentar de novo', async () => {
  respostaServidor = { status: 409, ok: false };
  await registrarLeitura('m1', 'v9', leitura(-22.1, -47.1, Date.now()));
  assert.equal(pendentes(db).length, 1);
  const antes = enviados.length;
  respostaServidor = { status: 200, ok: true };
  await enviarPosicoesPendentes('m1', 'v9');
  assert.equal(enviados.length, antes, 'não reenvia durante a espera');
  assert.equal(pendentes(db).length, 1);
});

test('leituras com mais de 24 h são descartadas', async () => {
  respostaServidor = 'offline';
  await registrarLeitura('m1', 'v2', leitura(-22.1, -47.1, Date.now() - 25 * 3600_000));
  await registrarLeitura('m1', 'v2', leitura(-22.2, -47.2, Date.now()));
  respostaServidor = { status: 200, ok: true };
  await enviarPosicoesPendentes('m1', 'v2');
  assert.deepEqual(enviados.at(-1).posicoes.map((p) => p.latitude), [-22.2]);
});

test('fila grande é enviada em lotes de 200', async () => {
  respostaServidor = 'offline';
  const base = Date.now() - 3600_000;
  for (let i = 0; i < 450; i += 1) {
    await registrarLeitura('m1', 'v3', leitura(-22 - i / 1000, -47, base + i * 1000));
  }
  respostaServidor = { status: 200, ok: true };
  const aceitas = await enviarPosicoesPendentes('m1', 'v3');
  assert.equal(aceitas, 450);
  assert.deepEqual(enviados.slice(-3).map((e) => e.posicoes.length), [200, 200, 50]);
  assert.equal(pendentes(db).length, 0);
});

test('iniciar pede permissão, assina o GPS e parar cancela', async () => {
  let removido = false;
  let callback;
  definirDependenciasRastreamento({
    location: {
      Accuracy: { High: 4 },
      hasServicesEnabledAsync: async () => true,
      requestForegroundPermissionsAsync: async () => ({ status: 'granted' }),
      watchPositionAsync: async (opcoes, cb) => { callback = cb; assert.equal(opcoes.accuracy, 4); return { remove: () => { removido = true; } }; },
      getLastKnownPositionAsync: async () => null,
    },
  });
  const r = await iniciarRastreamento({ usuarioId: 'm1', viagemId: 'v5' });
  assert.deepEqual(r, { ativo: true });
  assert.equal(estaRastreando('v5'), true);

  callback(leitura(-22.5, -47.5, Date.now()));
  await new Promise((ok) => setTimeout(ok, 20));
  assert.equal(enviados.at(-1).viagemId, 'v5');

  pararRastreamento();
  assert.equal(removido, true);
  assert.equal(estaRastreando(), false);
});

test('sem permissão ou GPS desligado não rastreia', async () => {
  const base = {
    hasServicesEnabledAsync: async () => true,
    requestForegroundPermissionsAsync: async () => ({ status: 'denied' }),
    watchPositionAsync: async () => { throw new Error('não deveria assinar'); },
  };
  definirDependenciasRastreamento({ location: base });
  assert.deepEqual(await iniciarRastreamento({ usuarioId: 'm1', viagemId: 'v6' }), { ativo: false, motivo: 'sem_permissao' });

  definirDependenciasRastreamento({ location: { ...base, hasServicesEnabledAsync: async () => false } });
  assert.deepEqual(await iniciarRastreamento({ usuarioId: 'm1', viagemId: 'v6' }), { ativo: false, motivo: 'gps_desligado' });
});
