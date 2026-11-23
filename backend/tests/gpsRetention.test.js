import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { criarFakeSupabase } from './fakeSupabase.js';

const VIAGEM_ATIVA = 'a1000000-0000-0000-0000-000000000001';
const VIAGEM_CONCLUIDA = 'a1000000-0000-0000-0000-000000000002';
const agora = new Date();
const anteriorA90Dias = (dias) => new Date(agora.getTime() - dias * 24 * 60 * 60 * 1000).toISOString();
const fake = criarFakeSupabase({
  viagens: [
    { id: VIAGEM_ATIVA, status: 'EM_ANDAMENTO' },
    { id: VIAGEM_CONCLUIDA, status: 'CONCLUIDA' },
  ],
  posicoes_viagem: [
    { id: 'b1000000-0000-0000-0000-000000000001', id_viagem: VIAGEM_ATIVA, registrada_em: anteriorA90Dias(120) },
    {
      id: 'b1000000-0000-0000-0000-000000000002',
      id_viagem: VIAGEM_CONCLUIDA,
      registrada_em: anteriorA90Dias(120),
      recebida_em: agora.toISOString(),
    },
    { id: 'b1000000-0000-0000-0000-000000000003', id_viagem: VIAGEM_CONCLUIDA, registrada_em: anteriorA90Dias(89) },
  ],
});

mock.module('../database/db.js', {
  defaultExport: fake,
  namedExports: { createSupabaseAuthClient: () => fake },
});

const {
  iniciarRotinaRetencaoPosicoes,
  limparPosicoesGpsAntigas,
} = await import('../services/gpsRetentionService.js');

test('retenção remove posições persistidas há mais de 90 dias sem tocar viagens ativas', async () => {
  const viagensAntes = structuredClone(fake.tabelas.viagens);
  const removidas = await limparPosicoesGpsAntigas(agora);

  assert.equal(removidas, 1);
  assert.deepEqual(fake.tabelas.posicoes_viagem.map((item) => item.id).sort(), [
    'b1000000-0000-0000-0000-000000000001',
    'b1000000-0000-0000-0000-000000000003',
  ]);
  assert.deepEqual(fake.tabelas.viagens, viagensAntes);
});

test('rotina de retenção executa na inicialização e agenda repetição diária', async () => {
  const setIntervalOriginal = globalThis.setInterval;
  const clearIntervalOriginal = globalThis.clearInterval;
  const id = 'b1000000-0000-0000-0000-000000000004';
  let tarefaAgendada;
  let intervaloAgendado;
  let intervaloCancelado = false;
  fake.tabelas.posicoes_viagem.push({
    id,
    id_viagem: VIAGEM_CONCLUIDA,
    registrada_em: anteriorA90Dias(120),
  });

  globalThis.setInterval = (tarefa, intervalo) => {
    tarefaAgendada = tarefa;
    intervaloAgendado = intervalo;
    return { unref() {} };
  };
  globalThis.clearInterval = () => { intervaloCancelado = true; };

  let parar;
  try {
    parar = iniciarRotinaRetencaoPosicoes();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(fake.tabelas.posicoes_viagem.some((item) => item.id === id), false);
    assert.equal(intervaloAgendado, 24 * 60 * 60 * 1000);

    const segundoId = 'b1000000-0000-0000-0000-000000000005';
    fake.tabelas.posicoes_viagem.push({
      id: segundoId,
      id_viagem: VIAGEM_CONCLUIDA,
      registrada_em: anteriorA90Dias(120),
    });
    await tarefaAgendada();
    assert.equal(fake.tabelas.posicoes_viagem.some((item) => item.id === segundoId), false);
  } finally {
    parar?.();
    globalThis.setInterval = setIntervalOriginal;
    globalThis.clearInterval = clearIntervalOriginal;
  }
  assert.equal(intervaloCancelado, true);
});
