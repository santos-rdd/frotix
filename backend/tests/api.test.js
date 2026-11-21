// Testes do backend com um Supabase falso em memória.
// Rodar com:  npm run test:backend
import { test, mock, before, after } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { criarFakeSupabase } from './fakeSupabase.js';

process.env.JWT_SECRET = 'segredo-de-teste-com-mais-de-32-caracteres!!';

const ADMIN = 'a0000000-0000-0000-0000-000000000001';
const GESTOR = 'a0000000-0000-0000-0000-000000000002';
const FINANCEIRO = 'a0000000-0000-0000-0000-000000000003';
const MOTORISTA_1 = 'a0000000-0000-0000-0000-000000000004';
const MOTORISTA_2 = 'a0000000-0000-0000-0000-000000000005';
const INATIVO = 'a0000000-0000-0000-0000-000000000009';
const VEICULO = 'b0000000-0000-0000-0000-000000000001';
const CAT_FRETE = 'c0000000-0000-0000-0000-000000000001';
const CAT_DIESEL = 'c0000000-0000-0000-0000-000000000002';

const hoje = new Date().toISOString().slice(0, 10);
const agora = new Date().toISOString();

const fake = criarFakeSupabase({
  usuarios: [
    { id: ADMIN, nome: 'Carlos Admin', email: 'admin@logfin.com', id_perfil: 1, ativo: true },
    { id: GESTOR, nome: 'Mariana Gestora', email: 'frota@logfin.com', id_perfil: 2, ativo: true },
    { id: FINANCEIRO, nome: 'Roberto Finanças', email: 'financeiro@logfin.com', id_perfil: 3, ativo: true },
    { id: MOTORISTA_1, nome: 'João Silva', email: 'joao@logfin.com', id_perfil: 4, ativo: true },
    { id: MOTORISTA_2, nome: 'Marcos Souza', email: 'marcos@logfin.com', id_perfil: 4, ativo: true },
    { id: INATIVO, nome: 'Antigo', email: 'antigo@logfin.com', id_perfil: 1, ativo: false },
  ],
  veiculos: [
    { id: VEICULO, modelo: 'Scania R450', placa: 'ABC-1234', hodometro: 45789.2, status: 'DISPONIVEL', ativo: true },
  ],
  viagens: [
    // Os mesmos números do banco que geraram o erro I7 (134.910 km).
    { id: 'v1', origem: 'São Paulo', destino: 'BH', id_motorista: MOTORISTA_1, status: 'CONCLUIDA', km_inicial: 45200.5, km_final: 45789.2, iniciada_em: agora, concluida_em: agora, id_veiculo: VEICULO },
    { id: 'v2', origem: 'Campinas', destino: 'Rio', id_motorista: MOTORISTA_2, status: 'EM_ANDAMENTO', km_inicial: 89120, km_final: null, iniciada_em: agora },
    { id: 'v3', origem: 'Curitiba', destino: 'Santos', id_motorista: MOTORISTA_1, status: 'EM_ANDAMENTO', km_inicial: 45790, km_final: null, iniciada_em: agora },
  ],
  categorias_financeiras: [
    { id: CAT_FRETE, nome: 'Frete e Serviços de Transporte', tipo: 'ENTRADA', ativo: true },
    { id: CAT_DIESEL, nome: 'Combustível / Diesel S10', tipo: 'SAIDA', ativo: true },
  ],
  formas_pagamento: [
    { id: 'f1', nome: 'Pix', tipo: 'pix', ativo: true, lancamento: '2026-01-01' },
  ],
  lancamentos_financeiros: [
    { id: 'l1', descricao: 'Frete', valor: 5000, tipo: 'ENTRADA', status: 'PAGO', id_usuario: FINANCEIRO, data_lancamento: hoje, id_categoria: CAT_FRETE },
    { id: 'l2', descricao: 'Diesel', valor: 1177.4, tipo: 'SAIDA', status: 'PAGO', id_usuario: MOTORISTA_1, data_lancamento: hoje, id_categoria: CAT_DIESEL, id_viagem: 'v1' },
  ],
  financiamentos: [],
  manutencoes: [],
});

mock.module('../database/db.js', {
  defaultExport: fake,
  namedExports: { createSupabaseAuthClient: () => fake },
});

let base;
let servidor;
const token = (id, perfil) => jwt.sign({ sub: id, perfil, nome: 'Teste' }, process.env.JWT_SECRET, { expiresIn: '1h' });
const T = {
  admin: token(ADMIN, 1),
  gestor: token(GESTOR, 2),
  financeiro: token(FINANCEIRO, 3),
  motorista1: token(MOTORISTA_1, 4),
  motorista2: token(MOTORISTA_2, 4),
};

async function chamar(metodo, caminho, { token: tk, corpo, form } = {}) {
  const headers = {};
  if (tk) headers.Authorization = `Bearer ${tk}`;
  let body;
  if (form) body = form;
  else if (corpo !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(corpo);
  }
  const r = await fetch(`${base}${caminho}`, { method: metodo, headers, body });
  return { status: r.status, json: await r.json().catch(() => null) };
}

before(async () => {
  const auth = await import('../controllers/authController.js');
  auth.definirVerificadorGoogle(async (idToken) => {
    if (idToken === 'token-falso') throw new Error('Invalid token signature');
    return { email: idToken.replace('google:', ''), email_verified: true };
  });
  const { default: app } = await import('../app.js');
  await new Promise((ok) => { servidor = app.listen(0, ok); });
  base = `http://127.0.0.1:${servidor.address().port}`;
});

after(() => servidor?.close());

// ---------------------------------------------------------------- C2 / I10
test('rotas protegidas recusam pedido sem token (C2)', async () => {
  for (const [m, c] of [
    ['GET', '/financeiro/resumo-geral'], ['GET', '/frota/veiculos'], ['GET', '/resumo/atividades-recentes'],
    ['POST', '/financeiro/transacoes'], ['GET', '/usuarios'], ['GET', '/categorias'], ['POST', '/comprovantes/upload'],
  ]) {
    const r = await chamar(m, c);
    assert.equal(r.status, 401, `${m} ${c}`);
  }
});

test('token adulterado é recusado', async () => {
  const falso = jwt.sign({ sub: ADMIN, perfil: 1 }, 'outro-segredo-qualquer-com-32-caracteres-ou-mais');
  assert.equal((await chamar('GET', '/frota/veiculos', { token: falso })).status, 401);
});

// ---------------------------------------------------------------- C1
test('login Google sem idToken é recusado (C1)', async () => {
  const r = await chamar('POST', '/auth/login-google', { corpo: { email: 'admin@logfin.com' } });
  assert.equal(r.status, 400);
  assert.equal(r.json.token, undefined);
});

test('login Google com idToken inválido é recusado (C1)', async () => {
  const r = await chamar('POST', '/auth/login-google', { corpo: { idToken: 'token-falso' } });
  assert.equal(r.status, 401);
});

test('login Google válido devolve token com o perfil do banco', async () => {
  const r = await chamar('POST', '/auth/login-google', { corpo: { idToken: 'google:ADMIN@logfin.com' } });
  assert.equal(r.status, 200);
  const dados = jwt.verify(r.json.token, process.env.JWT_SECRET);
  assert.equal(dados.sub, ADMIN);
  assert.equal(dados.perfil, 1);
  assert.equal(r.json.usuario.role, 1);
});

test('login Google de e-mail sem cadastro ou conta desativada é recusado', async () => {
  assert.equal((await chamar('POST', '/auth/login-google', { corpo: { idToken: 'google:x@y.com' } })).status, 403);
  assert.equal((await chamar('POST', '/auth/login-google', { corpo: { idToken: 'google:antigo@logfin.com' } })).status, 403);
});

test('cadastro de usuário por e-mail exige apenas Admin', async () => {
  assert.equal((await chamar('POST', '/auth/cadastro', { corpo: {} })).status, 401);
  assert.equal((await chamar('POST', '/auth/cadastro', { token: T.motorista1, corpo: {} })).status, 403);
  assert.equal((await chamar('POST', '/auth/cadastro', { token: T.financeiro, corpo: {} })).status, 403);
});

// ---------------------------------------------------------------- permissões
test('motorista não vê números da empresa nem usuários', async () => {
  assert.equal((await chamar('GET', '/financeiro/resumo-geral', { token: T.motorista1 })).status, 403);
  assert.equal((await chamar('GET', '/financeiro/visao-geral-frota', { token: T.motorista1 })).status, 403);
  assert.equal((await chamar('GET', '/usuarios', { token: T.motorista1 })).status, 403);
  assert.equal((await chamar('POST', '/frota/veiculos', { token: T.motorista1, corpo: {} })).status, 403);
});

test('gerenciamento de usuários é exclusivo do Admin (Financeiro e Motorista bloqueados)', async () => {
  assert.equal((await chamar('GET', '/usuarios', { token: T.motorista1 })).status, 403);
  assert.equal((await chamar('GET', '/usuarios', { token: T.financeiro })).status, 403);
  const r = await chamar('GET', '/usuarios', { token: T.admin });
  assert.equal(r.status, 200);
  assert.ok(r.json.usuarios.every((u) => u.ativo));
  assert.ok(!r.json.usuarios.some((u) => u.email === 'antigo@logfin.com'));
});

test('financeiro não acessa operações administrativas da frota mas acessa resumo e relatórios', async () => {
  assert.equal((await chamar('GET', '/frota/veiculos', { token: T.financeiro })).status, 403);
  assert.equal((await chamar('GET', '/frota/rotas', { token: T.financeiro })).status, 403);
  assert.equal((await chamar('GET', '/frota/viagens-andamento', { token: T.financeiro })).status, 403);
  assert.equal((await chamar('POST', '/frota/veiculos', { token: T.financeiro, corpo: {} })).status, 403);
  assert.equal((await chamar('GET', '/frota/motoristas', { token: T.financeiro })).status, 403);
  assert.equal((await chamar('GET', '/frota/manutencoes', { token: T.financeiro })).status, 403);
  assert.equal((await chamar('GET', '/frota/resumo', { token: T.financeiro })).status, 200);
  assert.equal((await chamar('GET', '/frota/relatorio', { token: T.financeiro })).status, 200);
});

test('motorista só vê veículos das próprias viagens', async () => {
  const r1 = await chamar('GET', '/frota/veiculos', { token: T.motorista1 });
  assert.equal(r1.status, 200);
  assert.equal(r1.json.veiculos.length, 1);
  assert.equal(r1.json.veiculos[0].placa, 'ABC-1234');

  const r2 = await chamar('GET', '/frota/veiculos', { token: T.motorista2 });
  assert.equal(r2.status, 200);
  assert.equal(r2.json.veiculos.length, 0);
});

// ---------------------------------------------------------------- I7
test('km rodados usa km_final − km_inicial (I7)', async () => {
  const r = await chamar('GET', '/financeiro/visao-geral-frota?dias=7', { token: T.admin });
  assert.equal(r.status, 200);
  assert.equal(r.json.kmRodados, 588.7);
  assert.notEqual(r.json.kmRodados, 134910);
  assert.equal(r.json.veiculosEmRota, 2);
  assert.equal(r.json.custoPorKm, 2); // 1.177,40 / 588,7 km
});

// ---------------------------------------------------------------- I3 / I5 / I6 / I4 / C5
test('transação grava o usuário logado e a categoria pelo id (I5, I3)', async () => {
  const r = await chamar('POST', '/financeiro/transacoes', {
    token: T.motorista2,
    corpo: { tipo: 'saida', descricao: 'Pedágio', valorParcela: '45,90', idCategoria: CAT_DIESEL, idFormaPagamento: 'f1',
      anexos: { comprovantes: ['file:///data/user/0/foto.jpg'], fotos: ['m2/2026/a.jpg'] } },
  });
  assert.equal(r.status, 201);
  assert.equal(r.json.lancamento.id_usuario, MOTORISTA_2);
  assert.equal(r.json.lancamento.id_categoria, CAT_DIESEL);
  assert.equal(r.json.lancamento.valor, 45.9);
  assert.equal(r.json.lancamento.comprovante_url, null); // caminho local é descartado (I4)
  assert.equal(r.json.lancamento.foto_url, 'm2/2026/a.jpg');
});

test('categoria pelo nome ainda funciona e nome desconhecido não quebra (C5)', async () => {
  const r1 = await chamar('POST', '/financeiro/transacoes', {
    token: T.financeiro, corpo: { tipo: 'entrada', descricao: 'Frete extra', valorParcela: 100, categoria: 'frete e serviços de transporte' },
  });
  assert.equal(r1.json.lancamento.id_categoria, CAT_FRETE);
  const r2 = await chamar('POST', '/financeiro/transacoes', {
    token: T.financeiro, corpo: { tipo: 'entrada', descricao: 'Outro', valorParcela: 10, categoria: 'Outros' },
  });
  assert.equal(r2.status, 201);
  assert.equal(r2.json.lancamento.id_categoria, null);
});

test('transação valida tipo, descrição e valor', async () => {
  assert.equal((await chamar('POST', '/financeiro/transacoes', { token: T.admin, corpo: { tipo: 'x', descricao: 'a', valorParcela: 1 } })).status, 400);
  assert.equal((await chamar('POST', '/financeiro/transacoes', { token: T.admin, corpo: { tipo: 'saida', descricao: '', valorParcela: 1 } })).status, 400);
  assert.equal((await chamar('POST', '/financeiro/transacoes', { token: T.admin, corpo: { tipo: 'saida', descricao: 'a', valorParcela: 0 } })).status, 400);
});

test('dívida exige 2+ parcelas e grava dono e categoria no financiamento (I6)', async () => {
  const r1 = await chamar('POST', '/financeiro/transacoes', {
    token: T.financeiro, corpo: { tipo: 'divida', descricao: 'Pneus', valorParcela: 500, quantidadeParcelas: 1 },
  });
  assert.equal(r1.status, 400);

  const r2 = await chamar('POST', '/financeiro/transacoes', {
    token: T.financeiro,
    corpo: { tipo: 'divida', descricao: 'Pneus', valorParcela: 500, quantidadeParcelas: 3, idCategoria: CAT_DIESEL, vencimentoPrimeira: '2026-12-10' },
  });
  assert.equal(r2.status, 201);
  const fin = fake.tabelas.financiamentos.find((f) => f.id === r2.json.financiamentoId);
  assert.equal(fin.id_usuario, FINANCEIRO);
  assert.equal(fin.id_categoria, CAT_DIESEL);
  assert.equal(fin.valor_total, 1500);
  const parcelas = fake.tabelas.lancamentos_financeiros.filter((l) => l.id_financiamento === fin.id);
  assert.deepEqual(parcelas.map((p) => p.data_vencimento), ['2026-12-10', '2027-01-10', '2027-02-10']);
});

test('atividades recentes: motorista só vê os próprios lançamentos', async () => {
  const r = await chamar('GET', '/resumo/atividades-recentes?limite=50', { token: T.motorista1 });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.atividades.map((a) => a.id), ['l2']);
});

// ---------------------------------------------------------------- frota (P5, P6, P7, P10, P11)
test('motorista só vê as próprias rotas (P10, P11)', async () => {
  const r = await chamar('GET', '/frota/rotas', { token: T.motorista1 });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.rotas.map((x) => x.id).sort(), ['v1', 'v3']);
  const andamento = await chamar('GET', '/frota/viagens-andamento', { token: T.motorista1 });
  assert.deepEqual(andamento.json.viagens.map((x) => x.id), ['v3']);
  const gestor = await chamar('GET', '/frota/viagens-andamento', { token: T.gestor });
  assert.equal(gestor.json.viagens.length, 2);
});

test('veículo: cadastro, validação e placa repetida', async () => {
  assert.equal((await chamar('POST', '/frota/veiculos', { token: T.gestor, corpo: { modelo: 'Volvo', placa: 'XX', hodometro: 1 } })).status, 400);
  const ok = await chamar('POST', '/frota/veiculos', { token: T.gestor, corpo: { modelo: 'Volvo FH 540', placa: 'def1g23', hodometro: 98210, consumoMedio: 2.8 } });
  assert.equal(ok.status, 201);
  assert.equal(ok.json.veiculo.placa, 'DEF1G23');
  assert.equal(ok.json.veiculo.status, 'disponivel');
  const dup = await chamar('POST', '/frota/veiculos', { token: T.gestor, corpo: { modelo: 'Outro', placa: 'DEF1G23', hodometro: 1 } });
  assert.equal(dup.status, 409);
});

test('rota: motorista precisa ter perfil Motorista (P7) e o ciclo agendada → em trânsito → concluída', async () => {
  const futuro = new Date(Date.now() + 3 * 86400000).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const errado = await chamar('POST', '/frota/rotas', {
    token: T.gestor, corpo: { origem: 'A', destino: 'B', veiculoId: VEICULO, motoristaId: GESTOR, dataSaida: futuro, receita: 1000 },
  });
  assert.equal(errado.status, 400);

  const passado = await chamar('POST', '/frota/rotas', {
    token: T.gestor, corpo: { origem: 'A', destino: 'B', veiculoId: VEICULO, motoristaId: MOTORISTA_2, dataSaida: '01/01/2020', receita: 1000 },
  });
  assert.equal(passado.status, 400);

  const distNegativa = await chamar('POST', '/frota/rotas', {
    token: T.gestor, corpo: { origem: 'A', destino: 'B', veiculoId: VEICULO, motoristaId: MOTORISTA_2, dataSaida: futuro, receita: 1000, distanciaPrevistaKm: -10 },
  });
  assert.equal(distNegativa.status, 400);

  const criada = await chamar('POST', '/frota/rotas', {
    token: T.gestor, corpo: { origem: 'Sorocaba', destino: 'Curitiba', veiculoId: VEICULO, motoristaId: MOTORISTA_2, dataSaida: futuro, receita: 7400, distanciaPrevistaKm: 420 },
  });
  assert.equal(criada.status, 201);
  assert.equal(criada.json.rota.distanciaPrevistaKm, 420);
  const id = criada.json.rota.id;

  const listadas = await chamar('GET', '/frota/rotas', { token: T.gestor });
  const rotaCriada = listadas.json.rotas.find((x) => x.id === id);
  assert.equal(rotaCriada?.distanciaPrevistaKm, 420);

  // Outro motorista não abre a rota que não é dele.
  assert.equal((await chamar('POST', `/frota/rotas/${id}/abrir`, { token: T.motorista1, corpo: { hodometroInicial: 46000 } })).status, 403);
  // Hodômetro menor que o do veículo é recusado.
  assert.equal((await chamar('POST', `/frota/rotas/${id}/abrir`, { token: T.motorista2, corpo: { hodometroInicial: 100 } })).status, 400);

  const aberta = await chamar('POST', `/frota/rotas/${id}/abrir`, { token: T.motorista2, corpo: { hodometroInicial: 45800 } });
  assert.equal(aberta.status, 200);
  assert.equal(fake.tabelas.veiculos.find((v) => v.id === VEICULO).status, 'EM_VIAGEM');
  assert.equal((await chamar('POST', `/frota/rotas/${id}/abrir`, { token: T.motorista2, corpo: { hodometroInicial: 45800 } })).status, 400);

  assert.equal((await chamar('POST', `/frota/rotas/${id}/concluir`, { token: T.motorista2, corpo: { hodometroFinal: 45000 } })).status, 400);
  const fim = await chamar('POST', `/frota/rotas/${id}/concluir`, { token: T.motorista2, corpo: { hodometroFinal: 46300 } });
  assert.equal(fim.status, 200);
  assert.equal(fim.json.kmRodados, 500);
  const veiculo = fake.tabelas.veiculos.find((v) => v.id === VEICULO);
  assert.equal(veiculo.status, 'DISPONIVEL');
  assert.equal(veiculo.hodometro, 46300);
});

test('manutenção: agendar, iniciar (veículo em manutenção) e concluir', async () => {
  assert.equal((await chamar('POST', '/frota/manutencoes', { token: T.gestor, corpo: { veiculoId: VEICULO, tipo: 'freios', data: '31/02/2026', oficina: 'X' } })).status, 400);
  const r = await chamar('POST', '/frota/manutencoes', { token: T.gestor, corpo: { veiculoId: VEICULO, tipo: 'freios', data: '04/12/2026', oficina: 'Oficina Central', custo: 2350 } });
  assert.equal(r.status, 201);
  assert.equal(r.json.manutencao.data, '04/12/2026');
  const id = r.json.manutencao.id;
  await chamar('POST', `/frota/manutencoes/${id}/avancar`, { token: T.gestor });
  assert.equal(fake.tabelas.veiculos.find((v) => v.id === VEICULO).status, 'MANUTENCAO');
  await chamar('POST', `/frota/manutencoes/${id}/avancar`, { token: T.gestor });
  assert.equal(fake.tabelas.veiculos.find((v) => v.id === VEICULO).status, 'DISPONIVEL');
  assert.equal((await chamar('POST', `/frota/manutencoes/${id}/avancar`, { token: T.gestor })).status, 400);
});

test('resumo da frota e relatório usam os dados do banco (P3, P5)', async () => {
  const resumo = await chamar('GET', '/frota/resumo?dias=7', { token: T.gestor });
  assert.equal(resumo.status, 200);
  assert.equal(resumo.json.totalVeiculos, 2);
  assert.ok(resumo.json.kmRodados > 0);

  const rel = await chamar('GET', '/frota/relatorio?dias=30', { token: T.financeiro });
  assert.equal(rel.status, 200);
  const r = rel.json.relatorio;
  const entradas = fake.tabelas.lancamentos_financeiros.filter((l) => l.tipo === 'ENTRADA').reduce((s, l) => s + Number(l.valor), 0);
  assert.equal(r.receita, entradas);
  assert.equal(r.custoManutencao, 2350);
  assert.equal(r.saldo, Number((r.receita - r.despesas).toFixed(2)));
  assert.equal(r.kmRodados, 1088.7); // 588,7 + 500 da rota concluída no teste anterior
});

// ---------------------------------------------------------------- cadastros (P4)
test('categorias: criar, duplicada, remover e reativar', async () => {
  const c = await chamar('POST', '/categorias', { token: T.financeiro, corpo: { nome: 'Seguro', tipo: 'saida' } });
  assert.equal(c.status, 201);
  assert.equal((await chamar('POST', '/categorias', { token: T.financeiro, corpo: { nome: 'seguro', tipo: 'saida' } })).status, 409);
  assert.equal((await chamar('POST', '/categorias', { token: T.motorista1, corpo: { nome: 'X', tipo: 'saida' } })).status, 403);
  await chamar('DELETE', `/categorias/${c.json.categoria.id}`, { token: T.financeiro });
  const lista = await chamar('GET', '/categorias', { token: T.motorista1 });
  assert.ok(!lista.json.categorias.some((x) => x.nome === 'Seguro'));
  const de_novo = await chamar('POST', '/categorias', { token: T.financeiro, corpo: { nome: 'Seguro', tipo: 'saida' } });
  assert.equal(de_novo.json.categoria.id, c.json.categoria.id);
});

test('formas de pagamento: validação e cadastro', async () => {
  assert.equal((await chamar('POST', '/formas-pagamento', { token: T.admin, corpo: { tipo: 'debito', titular: 'Ana', validade: '13/28' } })).status, 400);
  const r = await chamar('POST', '/formas-pagamento', { token: T.admin, corpo: { tipo: 'credito', titular: 'Ana', validade: '12/28' } });
  assert.equal(r.status, 201);
  assert.equal(r.json.forma.nome, 'Cartão de Crédito · Ana');
});

test('usuários: cadastro Google, editar perfil, não remover a si mesmo', async () => {
  const novo = await chamar('POST', '/usuarios/google', { token: T.admin, corpo: { nome: 'Lucas', email: 'Lucas@Gmail.com', perfil: 4 } });
  assert.equal(novo.status, 201);
  assert.equal(novo.json.usuario.email, 'lucas@gmail.com');
  assert.equal((await chamar('POST', '/usuarios/google', { token: T.admin, corpo: { nome: 'L', email: 'lucas@gmail.com', perfil: 4 } })).status, 409);
  const ed = await chamar('PUT', `/usuarios/${novo.json.usuario.id}`, { token: T.admin, corpo: { perfil: 2 } });
  assert.equal(ed.json.usuario.perfil, 2);
  assert.equal((await chamar('PUT', `/usuarios/${ADMIN}`, { token: T.admin, corpo: { perfil: 4 } })).status, 400);
  assert.equal((await chamar('DELETE', `/usuarios/${ADMIN}`, { token: T.admin })).status, 400);
});

// ---------------------------------------------------------------- I1
test('upload de comprovante salva no Storage (I1)', async () => {
  const semArquivo = await chamar('POST', '/comprovantes/upload', { token: T.motorista1, form: new FormData() });
  assert.equal(semArquivo.status, 400);

  const form = new FormData();
  form.append('comprovante', new Blob([Buffer.from([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' }), 'recibo.png');
  form.append('idLancamento', 'l2');
  const r = await chamar('POST', '/comprovantes/upload', { token: T.motorista1, form });
  assert.equal(r.status, 201);
  assert.match(r.json.caminho, new RegExp(`^${MOTORISTA_1}/\\d{4}-\\d{2}-\\d{2}/[0-9a-f-]+\\.png$`));
  assert.ok(fake.buckets.has('comprovantes'));
  assert.equal(fake.tabelas.lancamentos_financeiros.find((l) => l.id === 'l2').comprovante_url, r.json.caminho);

  // Outro motorista não abre o comprovante.
  const link = await chamar('GET', `/comprovantes/link?caminho=${encodeURIComponent(r.json.caminho)}`, { token: T.motorista2 });
  assert.equal(link.status, 403);
});

test('tipo de arquivo não aceito é recusado', async () => {
  const form = new FormData();
  form.append('comprovante', new Blob(['oi'], { type: 'text/plain' }), 'a.txt');
  assert.equal((await chamar('POST', '/comprovantes/upload', { token: T.admin, form })).status, 400);
});

// =============================================================================
// Funcionalidades novas (branch feature/funcionalidades-faltando)
// =============================================================================

const diaBr = (dias) => {
  const d = new Date(Date.now() + dias * 86400000);
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
};
const diaIso = (dias) => new Date(Date.now() + dias * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const novoLancamento = async (tk, corpo) => {
  const r = await chamar('POST', '/financeiro/transacoes', { token: tk, corpo: { descricao: 'Teste', valorParcela: '100', ...corpo } });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  return r.json.lancamento;
};

// ---------------------------------------------------------------- estorno / rollback
test('estorno: só Admin/Financeiro, exige motivo, não estorna duas vezes e sai das contas', async () => {
  const antes = await chamar('GET', '/financeiro/resumo-geral', { token: T.admin });
  const l = await novoLancamento(T.financeiro, { tipo: 'entrada', valorParcela: '1000', idCategoria: CAT_FRETE });
  const depois = await chamar('GET', '/financeiro/resumo-geral', { token: T.admin });
  assert.equal(depois.json.totalEntradas, antes.json.totalEntradas + 1000);

  assert.equal((await chamar('POST', `/financeiro/lancamentos/${l.id}/estornar`, { token: T.motorista1, corpo: { motivo: 'erro' } })).status, 403);
  assert.equal((await chamar('POST', `/financeiro/lancamentos/${l.id}/estornar`, { token: T.financeiro, corpo: {} })).status, 400);

  const r = await chamar('POST', `/financeiro/lancamentos/${l.id}/estornar`, { token: T.financeiro, corpo: { motivo: 'Lançado em dobro' } });
  assert.equal(r.status, 200);
  assert.equal(r.json.lancamento.status, 'cancelado');
  assert.equal(r.json.lancamento.cancelamento.motivo, 'Lançado em dobro');
  const linha = fake.tabelas.lancamentos_financeiros.find((x) => x.id === l.id);
  assert.equal(linha.cancelado_por, FINANCEIRO);

  assert.equal((await chamar('POST', `/financeiro/lancamentos/${l.id}/estornar`, { token: T.financeiro, corpo: { motivo: 'de novo' } })).status, 409);
  const final = await chamar('GET', '/financeiro/resumo-geral', { token: T.admin });
  assert.equal(final.json.totalEntradas, antes.json.totalEntradas);

  const atividades = await chamar('GET', '/resumo/atividades-recentes?limite=50', { token: T.admin });
  assert.ok(!atividades.json.atividades.some((a) => a.id === l.id));
});

test('pagar e desfazer pagamento de um lançamento pendente', async () => {
  const l = await novoLancamento(T.financeiro, { tipo: 'saida', estadoOuStatus: 'pendente', idCategoria: CAT_DIESEL });
  assert.equal(l.status, 'PENDENTE');
  assert.equal((await chamar('POST', `/financeiro/lancamentos/${l.id}/pagar`, { token: T.financeiro, corpo: { data: diaIso(5) } })).status, 400);
  const pago = await chamar('POST', `/financeiro/lancamentos/${l.id}/pagar`, { token: T.financeiro, corpo: {} });
  assert.equal(pago.status, 200);
  assert.equal(pago.json.lancamento.status, 'pago');
  assert.equal((await chamar('POST', `/financeiro/lancamentos/${l.id}/pagar`, { token: T.financeiro })).status, 409);
  const desfeito = await chamar('POST', `/financeiro/lancamentos/${l.id}/desfazer-pagamento`, { token: T.admin });
  assert.equal(desfeito.status, 200);
  assert.equal(desfeito.json.lancamento.status, 'pendente');
  assert.equal(desfeito.json.lancamento.pagamento, null);
});

// ---------------------------------------------------------------- dívidas
test('dívidas: listar, pagar parcela, detalhar e cancelar (rollback das pendentes)', async () => {
  const r = await chamar('POST', '/financeiro/transacoes', {
    token: T.financeiro,
    corpo: { tipo: 'divida', descricao: 'Financiamento caminhão', valorParcela: '2500', quantidadeParcelas: '3', vencimentoPrimeira: diaIso(-40), credor: 'Banco X', idCategoria: CAT_DIESEL },
  });
  assert.equal(r.status, 201);
  const id = r.json.financiamentoId;

  assert.equal((await chamar('GET', '/financeiro/dividas', { token: T.motorista1 })).status, 403);
  const lista = await chamar('GET', '/financeiro/dividas', { token: T.financeiro });
  const divida = lista.json.dividas.find((d) => d.id === id);
  assert.equal(divida.pendentes, 3);
  assert.equal(divida.valorRestante, 7500);
  assert.equal(divida.status, 'atrasada'); // a 1ª venceu há 40 dias
  assert.ok(lista.json.totais.parcelasAtrasadas >= 1);

  const det = await chamar('GET', `/financeiro/dividas/${id}`, { token: T.financeiro });
  const [p1] = det.json.divida.parcelas;
  assert.equal(p1.parcela, '1/3');
  assert.equal(p1.atrasada, true);

  // Parcela não é estornada sozinha.
  assert.equal((await chamar('POST', `/financeiro/lancamentos/${p1.id}/estornar`, { token: T.financeiro, corpo: { motivo: 'teste' } })).status, 400);

  assert.equal((await chamar('POST', `/financeiro/lancamentos/${p1.id}/pagar`, { token: T.financeiro })).status, 200);
  const det2 = await chamar('GET', `/financeiro/dividas/${id}`, { token: T.financeiro });
  assert.equal(det2.json.divida.pagas, 1);
  assert.equal(det2.json.divida.valorPago, 2500);

  assert.equal((await chamar('POST', `/financeiro/dividas/${id}/cancelar`, { token: T.financeiro, corpo: {} })).status, 400);
  const canc = await chamar('POST', `/financeiro/dividas/${id}/cancelar`, { token: T.financeiro, corpo: { motivo: 'Renegociada' } });
  assert.equal(canc.status, 200);
  assert.equal(canc.json.parcelasCanceladas, 2);
  const det3 = await chamar('GET', `/financeiro/dividas/${id}`, { token: T.financeiro });
  assert.equal(det3.json.divida.status, 'cancelada');
  assert.equal(det3.json.divida.pagas, 1); // a paga continua no histórico
  assert.equal((await chamar('POST', `/financeiro/dividas/${id}/cancelar`, { token: T.financeiro, corpo: { motivo: 'de novo' } })).status, 409);
});

test('resumo geral soma o valor da parcela (sem dividir de novo pelo total)', async () => {
  const antes = await chamar('GET', '/financeiro/resumo-geral', { token: T.admin });
  await chamar('POST', '/financeiro/transacoes', {
    token: T.financeiro,
    corpo: { tipo: 'divida', descricao: 'Pneus', valorParcela: '600', quantidadeParcelas: '2', vencimentoPrimeira: diaIso(10), idCategoria: CAT_DIESEL },
  });
  const depois = await chamar('GET', '/financeiro/resumo-geral', { token: T.admin });
  assert.equal(Number((depois.json.detalhes.dividasPendentes - antes.json.detalhes.dividasPendentes).toFixed(2)), 1200);
});

// ---------------------------------------------------------------- previsão e fluxo
test('previsão de caixa: saldo atual, meses e permissão', async () => {
  assert.equal((await chamar('GET', '/financeiro/previsao', { token: T.motorista1 })).status, 403);
  assert.equal((await chamar('GET', '/financeiro/previsao', { token: T.gestor })).status, 403);
  const r = await chamar('GET', '/financeiro/previsao?meses=4', { token: T.financeiro });
  assert.equal(r.status, 200);
  const { previsao } = r.json;
  assert.equal(previsao.meses.length, 4);
  // saldo projetado = saldo atual + resultado acumulado
  const acumulado = previsao.meses.reduce((s, m) => s + m.resultado, previsao.saldoAtual);
  assert.equal(Number(acumulado.toFixed(2)), previsao.saldoFinal);
  assert.match(previsao.meses[0].rotulo, /^[A-Z][a-z]{2}\/\d{2}$/);
});

test('fluxo mensal devolve entradas e saídas pagas dos últimos meses', async () => {
  const r = await chamar('GET', '/financeiro/fluxo-mensal?meses=3', { token: T.admin });
  assert.equal(r.status, 200);
  assert.equal(r.json.meses.length, 3);
  const atual = r.json.meses[2];
  assert.ok(atual.entradas >= 5000); // l1 (frete pago hoje)
});

// ---------------------------------------------------------------- extrato
test('extrato: motorista vê só os dele; filtros e validação', async () => {
  const mot = await chamar('GET', '/financeiro/lancamentos?limite=100', { token: T.motorista1 });
  assert.equal(mot.status, 200);
  assert.ok(mot.json.lancamentos.length > 0);
  const donos = new Set(fake.tabelas.lancamentos_financeiros.filter((l) => l.id_usuario === MOTORISTA_1).map((l) => l.id));
  assert.ok(mot.json.lancamentos.every((l) => donos.has(l.id)));

  const adm = await chamar('GET', '/financeiro/lancamentos?tipo=divida&limite=100', { token: T.admin });
  assert.ok(adm.json.lancamentos.length >= 5);
  assert.ok(adm.json.lancamentos.every((l) => l.tipo === 'divida'));

  const diesel = await chamar('GET', '/financeiro/lancamentos?busca=diesel', { token: T.admin });
  assert.ok(diesel.json.lancamentos.some((l) => l.id === 'l2'));
  assert.equal(diesel.json.lancamentos.find((l) => l.id === 'l2').viagem.label.startsWith('São Paulo → BH'), true);

  assert.equal((await chamar('GET', '/financeiro/lancamentos?tipo=xyz', { token: T.admin })).status, 400);
  assert.equal((await chamar('GET', '/financeiro/lancamentos?inicio=21/11/2026', { token: T.admin })).status, 400);
});

// ---------------------------------------------------------------- offline (idCliente) e vínculo com viagem
test('lançamento reenviado com o mesmo idCliente não duplica (modo offline)', async () => {
  const idCliente = '11111111-2222-4333-8444-555555555555';
  const corpo = { tipo: 'saida', descricao: 'Pedágio offline', valorParcela: '12,50', idCategoria: CAT_DIESEL, idViagem: 'v3', idCliente };
  const a = await chamar('POST', '/financeiro/transacoes', { token: T.motorista1, corpo });
  assert.equal(a.status, 201);
  const b = await chamar('POST', '/financeiro/transacoes', { token: T.motorista1, corpo });
  assert.equal(b.status, 200);
  assert.equal(b.json.duplicado, true);
  assert.equal(fake.tabelas.lancamentos_financeiros.filter((l) => l.id_local === idCliente).length, 1);
  assert.equal((await chamar('POST', '/financeiro/transacoes', { token: T.motorista1, corpo: { ...corpo, idCliente: 'abc' } })).status, 400);
});

test('motorista não liga lançamento à viagem de outro motorista', async () => {
  const r = await chamar('POST', '/financeiro/transacoes', {
    token: T.motorista1, corpo: { tipo: 'saida', descricao: 'X', valorParcela: '10', idViagem: 'v2' },
  });
  assert.equal(r.status, 403);
  const inexistente = await chamar('POST', '/financeiro/transacoes', {
    token: T.motorista1, corpo: { tipo: 'saida', descricao: 'X', valorParcela: '10', idViagem: 'nao-existe' },
  });
  assert.equal(inexistente.status, 400);
});

// ---------------------------------------------------------------- alertas
test('alertas: financeiro vê os financeiros, gestor os de frota, motorista nenhum', async () => {
  await novoLancamento(T.financeiro, { tipo: 'saida', estadoOuStatus: 'pendente', data: diaIso(-3), idCategoria: CAT_DIESEL, descricao: 'Boleto vencido' });
  assert.equal((await chamar('GET', '/alertas', { token: T.motorista1 })).status, 403);

  const fin = await chamar('GET', '/alertas', { token: T.financeiro });
  assert.equal(fin.status, 200);
  assert.ok(fin.json.alertas.length > 0);
  assert.ok(fin.json.alertas.every((a) => a.area === 'financeiro'));
  assert.ok(fin.json.alertas.some((a) => a.id === 'contas-vencidas'));

  await chamar('POST', '/frota/manutencoes', { token: T.gestor, corpo: { veiculoId: VEICULO, tipo: 'revisao', data: diaBr(-2), oficina: 'Oficina Atrasada' } });
  const ges = await chamar('GET', '/alertas', { token: T.gestor });
  assert.ok(ges.json.alertas.every((a) => a.area === 'frota'));
  assert.ok(ges.json.alertas.some((a) => a.id.startsWith('manutencao-atrasada')));
  // a ordem vai do mais grave para o menos grave
  const niveis = { critico: 0, atencao: 1, info: 2 };
  const adm = await chamar('GET', '/alertas', { token: T.admin });
  for (let i = 1; i < adm.json.alertas.length; i++) {
    assert.ok(niveis[adm.json.alertas[i - 1].nivel] <= niveis[adm.json.alertas[i].nivel]);
  }
});

// ---------------------------------------------------------------- edição e exclusão na frota
test('veículos: editar com validação e desativar', async () => {
  const novo = await chamar('POST', '/frota/veiculos', { token: T.gestor, corpo: { modelo: 'Volvo FH', placa: 'XYZ1A23', hodometro: 1000 } });
  assert.equal(novo.status, 201);
  const id = novo.json.veiculo.id;

  assert.equal((await chamar('PUT', `/frota/veiculos/${id}`, { token: T.motorista1, corpo: { modelo: 'X' } })).status, 403);
  assert.equal((await chamar('PUT', `/frota/veiculos/${id}`, { token: T.gestor, corpo: { placa: '123' } })).status, 400);
  assert.equal((await chamar('PUT', `/frota/veiculos/${id}`, { token: T.gestor, corpo: { placa: 'ABC-1234' } })).status, 409);
  assert.equal((await chamar('PUT', `/frota/veiculos/${id}`, { token: T.gestor, corpo: {} })).status, 400);
  const ok = await chamar('PUT', `/frota/veiculos/${id}`, { token: T.gestor, corpo: { modelo: 'Volvo FH 540', consumoMedio: 2.6, status: 'manutencao' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.veiculo.modelo, 'Volvo FH 540');
  assert.equal(ok.json.veiculo.status, 'manutencao');

  // O hodômetro não volta para trás de uma viagem registrada.
  assert.equal((await chamar('PUT', `/frota/veiculos/${VEICULO}`, { token: T.gestor, corpo: { hodometro: 100 } })).status, 400);

  assert.equal((await chamar('DELETE', `/frota/veiculos/${id}`, { token: T.gestor })).status, 200);
  assert.equal((await chamar('DELETE', `/frota/veiculos/${id}`, { token: T.gestor })).status, 404);
  const lista = await chamar('GET', '/frota/veiculos', { token: T.gestor });
  assert.ok(!lista.json.veiculos.some((v) => v.id === id));
});

test('rotas agendadas: editar e excluir; viagens abertas/concluídas não', async () => {
  const criada = await chamar('POST', '/frota/rotas', {
    token: T.gestor,
    corpo: { origem: 'Varginha', destino: 'Três Corações', veiculoId: VEICULO, motoristaId: MOTORISTA_1, dataSaida: diaBr(2), receita: 900 },
  });
  assert.equal(criada.status, 201);
  const id = criada.json.rota.id;

  // O veículo com rota agendada não pode ser desativado.
  assert.equal((await chamar('DELETE', `/frota/veiculos/${VEICULO}`, { token: T.gestor })).status, 400);

  assert.equal((await chamar('PUT', `/frota/rotas/${id}`, { token: T.motorista1, corpo: { receita: 1 } })).status, 403);
  assert.equal((await chamar('PUT', `/frota/rotas/${id}`, { token: T.gestor, corpo: { destino: 'varginha' } })).status, 400);
  assert.equal((await chamar('PUT', `/frota/rotas/${id}`, { token: T.gestor, corpo: { dataSaida: diaBr(-1) } })).status, 400);
  assert.equal((await chamar('PUT', `/frota/rotas/${id}`, { token: T.gestor, corpo: { motoristaId: GESTOR } })).status, 400);
  const ed = await chamar('PUT', `/frota/rotas/${id}`, { token: T.gestor, corpo: { receita: 1200, dataSaida: diaBr(3) } });
  assert.equal(ed.status, 200);
  assert.equal(fake.tabelas.viagens.find((v) => v.id === id).receita_prevista, 1200);

  assert.equal((await chamar('PUT', '/frota/rotas/v1', { token: T.gestor, corpo: { receita: 1 } })).status, 400);
  assert.equal((await chamar('DELETE', '/frota/rotas/v1', { token: T.gestor })).status, 400);

  assert.equal((await chamar('DELETE', `/frota/rotas/${id}`, { token: T.gestor })).status, 200);
  assert.ok(!fake.tabelas.viagens.some((v) => v.id === id));
});

test('manutenções: editar e excluir só enquanto agendada', async () => {
  const r = await chamar('POST', '/frota/manutencoes', { token: T.gestor, corpo: { veiculoId: VEICULO, tipo: 'pneus', data: diaBr(5), oficina: 'Borracharia' } });
  const id = r.json.manutencao.id;
  const ed = await chamar('PUT', `/frota/manutencoes/${id}`, { token: T.gestor, corpo: { custo: 1800, oficina: 'Borracharia Sul' } });
  assert.equal(ed.status, 200);
  assert.equal(ed.json.manutencao.custo, 1800);
  assert.equal((await chamar('PUT', `/frota/manutencoes/${id}`, { token: T.gestor, corpo: { tipo: 'xyz' } })).status, 400);

  await chamar('POST', `/frota/manutencoes/${id}/avancar`, { token: T.gestor });
  assert.equal((await chamar('DELETE', `/frota/manutencoes/${id}`, { token: T.gestor })).status, 400);
  await chamar('POST', `/frota/manutencoes/${id}/avancar`, { token: T.gestor });
  // Concluída: custo pode mudar, a data não.
  assert.equal((await chamar('PUT', `/frota/manutencoes/${id}`, { token: T.gestor, corpo: { data: diaBr(6) } })).status, 400);
  assert.equal((await chamar('PUT', `/frota/manutencoes/${id}`, { token: T.gestor, corpo: { custo: 1950 } })).status, 200);

  const outra = await chamar('POST', '/frota/manutencoes', { token: T.gestor, corpo: { veiculoId: VEICULO, tipo: 'freios', data: diaBr(9), oficina: 'X' } });
  assert.equal((await chamar('DELETE', `/frota/manutencoes/${outra.json.manutencao.id}`, { token: T.gestor })).status, 200);
});

// ---------------------------------------------------------------- abastecimentos e consumo
test('abastecimentos: motorista registra, gera saída na viagem e calcula o consumo', async () => {
  const hodo = Number(fake.tabelas.veiculos.find((v) => v.id === VEICULO).hodometro);
  const corpo = (km, litros, extra = {}) => ({ veiculoId: VEICULO, viagemId: 'v1', data: diaBr(0), litros, valor: litros * 6, hodometro: km, posto: 'Posto BR', ...extra });

  assert.equal((await chamar('POST', '/frota/abastecimentos', { token: T.motorista2, corpo: corpo(hodo + 10, 100) })).status, 403);
  assert.equal((await chamar('POST', '/frota/abastecimentos', { token: T.motorista1, corpo: corpo(hodo + 10, 0) })).status, 400);
  assert.equal((await chamar('POST', '/frota/abastecimentos', { token: T.motorista1, corpo: { ...corpo(hodo + 10, 100), data: diaBr(3) } })).status, 400);

  const a1 = await chamar('POST', '/frota/abastecimentos', { token: T.motorista1, corpo: corpo(hodo + 10, 300) });
  assert.equal(a1.status, 201, JSON.stringify(a1.json));
  assert.equal(a1.json.consumoMedio, null); // um abastecimento só não dá consumo

  const saida = fake.tabelas.lancamentos_financeiros.find((l) => l.descricao === 'Abastecimento ABC-1234 · Posto BR');
  assert.equal(saida.tipo, 'SAIDA');
  assert.equal(saida.id_viagem, 'v1');
  assert.equal(saida.id_categoria, CAT_DIESEL);

  assert.equal((await chamar('POST', '/frota/abastecimentos', { token: T.motorista1, corpo: corpo(hodo + 5, 50) })).status, 400);

  const idCliente = '99999999-2222-4333-8444-555555555555';
  const a2 = await chamar('POST', '/frota/abastecimentos', { token: T.motorista1, corpo: corpo(hodo + 760, 250, { idCliente }) });
  assert.equal(a2.status, 201);
  assert.equal(a2.json.consumoMedio, 3); // 750 km / 250 l
  const repetido = await chamar('POST', '/frota/abastecimentos', { token: T.motorista1, corpo: corpo(hodo + 760, 250, { idCliente }) });
  assert.equal(repetido.json.duplicado, true);

  const veics = await chamar('GET', '/frota/veiculos', { token: T.gestor });
  const v = veics.json.veiculos.find((x) => x.id === VEICULO);
  assert.equal(v.consumoCalculado, 3);
  assert.equal(v.consumoMedio, 3);
  assert.equal(v.hodometro, hodo + 760);

  const doMot2 = await chamar('GET', '/frota/abastecimentos', { token: T.motorista2 });
  assert.equal(doMot2.json.abastecimentos.length, 0);
  const todos = await chamar('GET', `/frota/abastecimentos?veiculoId=${VEICULO}`, { token: T.gestor });
  assert.equal(todos.json.abastecimentos.length, 2);
  assert.equal(todos.json.consumoMedio, 3);
});

// ---------------------------------------------------------------- relatório
test('relatório traz rentabilidade por viagem, ranking por rota e fluxo mensal', async () => {
  const r = await chamar('GET', '/frota/relatorio?dias=tudo', { token: T.gestor });
  assert.equal(r.status, 200);
  const rel = r.json.relatorio;
  assert.equal(rel.porMes.length, 6);
  assert.ok(rel.rankingRotas.length >= 1);
  const sp = rel.rankingRotas.find((x) => x.trajeto === 'São Paulo → BH');
  assert.ok(sp);
  assert.ok(sp.custos > 0);

  const rotas = await chamar('GET', '/frota/rotas', { token: T.gestor });
  const v1 = rotas.json.rotas.find((x) => x.id === 'v1');
  assert.equal(v1.custos, Number(v1.despesas.reduce((s, d) => s + d.valor, 0).toFixed(2)));
  assert.equal(v1.saldo, Number((v1.receita - v1.custos).toFixed(2)));
  assert.ok(v1.custoKm > 0);
});

test('viagens para vincular: motorista vê as dele, financeiro vê todas', async () => {
  const mot = await chamar('GET', '/financeiro/viagens-vinculo', { token: T.motorista1 });
  assert.equal(mot.status, 200);
  const minhas = fake.tabelas.viagens.filter((v) => v.id_motorista === MOTORISTA_1).length;
  assert.equal(mot.json.viagens.length, minhas);
  const fin = await chamar('GET', '/financeiro/viagens-vinculo', { token: T.financeiro });
  assert.equal(fin.json.viagens.length, fake.tabelas.viagens.length);
  assert.equal(fin.json.viagens[0].status, 'em_andamento'); // em andamento primeiro
  assert.match(fin.json.viagens[0].label, / → /);
});
