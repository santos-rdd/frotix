// Testes do backend com um Supabase falso em memória.
// Rodar com:  npm run test:backend
import { test, mock, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
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
    { id: 'v3', origem: 'Curitiba', destino: 'Santos', id_motorista: MOTORISTA_1, id_veiculo: VEICULO, status: 'EM_ANDAMENTO', km_inicial: 45790, km_final: null, iniciada_em: agora },
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
  posicoes_viagem: [],
});

mock.module('../database/db.js', {
  defaultExport: fake,
  namedExports: { createSupabaseAuthClient: () => fake },
});

let base;
let servidor;
const token = (id, perfil, opcoes = {}) => {
  const sid = opcoes.sid || randomUUID();
  const agora = new Date();
  (fake.tabelas.auth_sessions ||= []).push({
    id: sid,
    user_id: id,
    created_at: agora.toISOString(),
    expires_at: new Date(agora.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    revoked_at: null,
    revoke_reason: null,
  });
  return jwt.sign(
    { sub: id, sid, perfil, nome: 'Teste' },
    process.env.JWT_SECRET,
    { expiresIn: opcoes.expiresIn || '1h' }
  );
};
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
    if (idToken.startsWith('google:photo:')) {
      return {
        email: idToken.slice('google:photo:'.length),
        email_verified: true,
        picture: 'https://google.test/profile-photo.jpg',
      };
    }
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
    ['GET', '/financeiro/lancamentos'], ['GET', '/financeiro/dividas'],
    ['GET', '/financial/transactions'], ['GET', '/financial/projection'],
    ['GET', '/financial/financings/00000000-0000-0000-0000-000000000001'],
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
  assert.ok(dados.sid);
  assert.equal(r.json.usuario.role, 1);
  assert.equal(r.json.sessao.access_token, r.json.token);
  assert.equal(r.json.sessao.refresh_token.length, 64);
  assert.equal(
    fake.tabelas.auth_refresh_tokens.some(
      (item) =>
        item.session_id === r.json.sessao.session_id &&
        item.token_hash === createHash('sha256').update(r.json.sessao.refresh_token).digest('hex')
    ),
    true
  );
});

test('foto Google persiste no perfil e permanece disponível após refresh', async () => {
  const usuario = fake.tabelas.usuarios.find((item) => item.id === MOTORISTA_1);
  const imagemOriginal = usuario.imagem;
  usuario.imagem = null;

  try {
    const login = await chamar('POST', '/auth/login-google', {
      corpo: { idToken: 'google:photo:joao@logfin.com' },
    });
    assert.equal(login.status, 200);
    assert.equal(login.json.usuario.imagem, 'https://google.test/profile-photo.jpg');
    assert.equal(usuario.imagem, 'https://google.test/profile-photo.jpg');

    const refresh = await chamar('POST', '/auth/refresh', {
      corpo: { refresh_token: login.json.sessao.refresh_token },
    });
    assert.equal(refresh.status, 200);
    assert.equal(refresh.json.usuario.imagem, usuario.imagem);

    usuario.imagem = 'https://frotix.test/foto-atual.jpg';
    const loginComImagemExistente = await chamar('POST', '/auth/login-google', {
      corpo: { idToken: 'google:photo:joao@logfin.com' },
    });
    assert.equal(loginComImagemExistente.json.usuario.imagem, usuario.imagem);
  } finally {
    if (imagemOriginal === undefined) delete usuario.imagem;
    else usuario.imagem = imagemOriginal;
  }
});

test('login por e-mail emite somente uma sessão persistente Frotix', async () => {
  const r = await chamar('POST', '/auth/login-email', {
    corpo: { email: 'joao@logfin.com', password: 'senha-teste-valida' },
  });
  assert.equal(r.status, 200);
  const dados = jwt.verify(r.json.token, process.env.JWT_SECRET);
  assert.equal(dados.sub, MOTORISTA_1);
  assert.equal(r.json.sessao.access_token, r.json.token);
  assert.notEqual(r.json.sessao.refresh_token, 'supabase-refresh-test');
  assert.equal(
    Date.parse(r.json.sessao.session_expires_at) > r.json.sessao.expires_at * 1000,
    true
  );
});

test('resposta de autenticação usa o perfil atual retornado pela sessão', async () => {
  const { criarRespostaAutenticada } = await import('../utils/authResponse.js');
  const resposta = criarRespostaAutenticada(
    { id: MOTORISTA_1, email: 'joao@logfin.com', nome: 'João', id_perfil: 1 },
    {
      sessionId: randomUUID(),
      perfil: 4,
      refreshToken: 'refresh-token-de-teste',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }
  );

  assert.equal(jwt.verify(resposta.token, process.env.JWT_SECRET).perfil, 4);
  assert.equal(resposta.usuario.role, 4);
});

test('consulta da sessão usa o estado e perfil atuais do banco', async () => {
  const resposta = await chamar('GET', '/auth/session', { token: T.admin });
  assert.equal(resposta.status, 200);
  assert.equal(resposta.json.usuario.role, 1);
  assert.equal(resposta.json.sessao.session_id, jwt.decode(T.admin).sid);
});

test('migração bloqueia sempre a sessão antes dos tokens de refresh', async () => {
  const { readFile } = await import('node:fs/promises');
  const sql = await readFile(
    new URL('../database/migrations/2026-11-22_sessoes_frotix.sql', import.meta.url),
    'utf8'
  );
  const corpoFuncao = (nome) => {
    const inicio = sql.indexOf(`create or replace function public.${nome}`);
    assert.notEqual(inicio, -1, `função ${nome} não encontrada`);
    const fim = sql.indexOf('\n$function$;', inicio);
    assert.notEqual(fim, -1, `fim da função ${nome} não encontrado`);
    return sql.slice(inicio, fim);
  };

  const rotacao = corpoFuncao('frotix_rotacionar_refresh');
  const lookupPorHash = rotacao.indexOf('select t.session_id');
  const lockSessao = rotacao.indexOf('for update', rotacao.indexOf('select s.*'));
  const lockToken = rotacao.indexOf('for update', rotacao.indexOf('select t.*'));
  assert.ok(lookupPorHash >= 0 && lookupPorHash < lockSessao);
  assert.ok(lockSessao < lockToken);
  assert.match(rotacao, /insert into public\.auth_refresh_tokens[\s\S]*?v_session\.expires_at/);

  for (const nome of [
    'frotix_validar_sessao',
    'frotix_revogar_sessao',
    'frotix_revogar_sessoes_usuario',
  ]) {
    const funcao = corpoFuncao(nome);
    const buscaSessao = funcao.indexOf(nome === 'frotix_revogar_sessoes_usuario' ? 'perform s.id' : 'select s.*');
    const lockSessao = funcao.indexOf('for update', buscaSessao);
    const alterarTokens = funcao.indexOf('update public.auth_refresh_tokens');
    assert.ok(lockSessao >= 0 && lockSessao < alterarTokens, `${nome} deve bloquear a sessão antes dos tokens`);
  }
});

test('sessão é revogada após desativação do usuário', async () => {
  const accessToken = token(MOTORISTA_1, 4);
  const sessionId = jwt.decode(accessToken).sid;
  const usuario = fake.tabelas.usuarios.find((item) => item.id === MOTORISTA_1);
  const ativoOriginal = usuario.ativo;
  usuario.ativo = false;

  try {
    const resposta = await chamar('GET', '/auth/session', { token: accessToken });
    assert.equal(resposta.status, 401);
    assert.equal(
      fake.tabelas.auth_sessions.find((item) => item.id === sessionId).revoke_reason,
      'user_inactive'
    );
    usuario.ativo = true;
    assert.equal((await chamar('GET', '/auth/session', { token: accessToken })).status, 401);
  } finally {
    usuario.ativo = ativoOriginal;
  }
});

test('rebaixamento e elevação de perfil atualizam autorização sem novo JWT', async () => {
  const usuarioAdmin = fake.tabelas.usuarios.find((item) => item.id === ADMIN);
  const perfilAdminOriginal = usuarioAdmin.id_perfil;
  const usuarioMotorista = fake.tabelas.usuarios.find((item) => item.id === MOTORISTA_1);
  const perfilMotoristaOriginal = usuarioMotorista.id_perfil;

  try {
    usuarioAdmin.id_perfil = 4;
    assert.equal((await chamar('GET', '/usuarios', { token: T.admin })).status, 403);

    usuarioMotorista.id_perfil = 1;
    const elevado = await chamar('GET', '/usuarios', { token: T.motorista1 });
    assert.equal(elevado.status, 200);
    assert.equal(
      (await chamar('GET', '/auth/session', { token: T.motorista1 })).json.usuario.role,
      1
    );
  } finally {
    usuarioAdmin.id_perfil = perfilAdminOriginal;
    usuarioMotorista.id_perfil = perfilMotoristaOriginal;
  }
});

test('JWT expirado, legado ou com payload não-objeto não autoriza endpoints protegidos', async () => {
  const claims = jwt.decode(T.motorista1);
  const expirado = jwt.sign(
    { sub: claims.sub, sid: claims.sid, perfil: 4 },
    process.env.JWT_SECRET,
    { expiresIn: -1 }
  );
  const legado = jwt.sign(
    { sub: MOTORISTA_1, perfil: 4 },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  const payloadNaoObjeto = jwt.sign(
    'payload-sem-claims',
    process.env.JWT_SECRET
  );

  assert.equal((await chamar('GET', '/auth/session', { token: expirado })).status, 401);
  assert.equal((await chamar('GET', '/auth/session', { token: legado })).status, 401);
  assert.equal((await chamar('GET', '/auth/session', { token: payloadNaoObjeto })).status, 401);
});

test('falha ao validar sessão fecha o acesso sem degradar para JWT-only', async () => {
  fake.setRpcError('frotix_validar_sessao', { message: 'database unavailable' });
  try {
    const resposta = await chamar('GET', '/auth/session', { token: T.motorista1 });
    assert.equal(resposta.status, 503);
  } finally {
    fake.setRpcError('frotix_validar_sessao', null);
  }
});

test('refresh rotaciona token sem estender a validade absoluta e detecta reutilização', async () => {
  const login = await chamar('POST', '/auth/login-google', {
    corpo: { idToken: 'google:joao@logfin.com' },
  });
  const refreshOriginal = login.json.sessao.refresh_token;
  const expiracaoAbsoluta = login.json.sessao.session_expires_at;

  const renovada = await chamar('POST', '/auth/refresh', {
    corpo: { refresh_token: refreshOriginal },
  });
  assert.equal(renovada.status, 200);
  assert.notEqual(renovada.json.sessao.refresh_token, refreshOriginal);
  assert.equal(renovada.json.sessao.session_expires_at, expiracaoAbsoluta);

  const reutilizada = await chamar('POST', '/auth/refresh', {
    corpo: { refresh_token: refreshOriginal },
  });
  assert.equal(reutilizada.status, 401);
  assert.equal(
    (await chamar('GET', '/auth/session', { token: renovada.json.token })).status,
    401
  );
  assert.equal(
    (await chamar('POST', '/auth/refresh', {
      corpo: { refresh_token: renovada.json.sessao.refresh_token },
    })).status,
    401
  );
});

test('logout idempotente revoga somente uma sessão e aceita JWT expirado para revogação', async () => {
  const primeira = await chamar('POST', '/auth/login-google', {
    corpo: { idToken: 'google:joao@logfin.com' },
  });
  const segunda = await chamar('POST', '/auth/login-google', {
    corpo: { idToken: 'google:joao@logfin.com' },
  });
  assert.notEqual(primeira.json.sessao.session_id, segunda.json.sessao.session_id);

  const claims = jwt.decode(primeira.json.token);
  const expirado = jwt.sign(
    { sub: claims.sub, sid: claims.sid, perfil: claims.perfil },
    process.env.JWT_SECRET,
    { expiresIn: -1 }
  );
  assert.equal((await chamar('POST', '/auth/logout', { token: expirado })).status, 204);
  assert.equal((await chamar('POST', '/auth/logout', { token: primeira.json.token })).status, 204);
  assert.equal((await chamar('GET', '/auth/session', { token: primeira.json.token })).status, 401);
  assert.equal((await chamar('GET', '/auth/session', { token: segunda.json.token })).status, 200);
  assert.equal(
    (await chamar('POST', '/auth/refresh', {
      corpo: { refresh_token: primeira.json.sessao.refresh_token },
    })).status,
    401
  );
});

test('duas renovações concorrentes não permitem reutilizar refresh token', async () => {
  const login = await chamar('POST', '/auth/login-google', {
    corpo: { idToken: 'google:marcos@logfin.com' },
  });
  const refreshToken = login.json.sessao.refresh_token;
  const [a, b] = await Promise.all([
    chamar('POST', '/auth/refresh', { corpo: { refresh_token: refreshToken } }),
    chamar('POST', '/auth/refresh', { corpo: { refresh_token: refreshToken } }),
  ]);

  assert.deepEqual([a.status, b.status].sort(), [200, 401]);
  const respostaValida = a.status === 200 ? a : b;
  assert.equal((await chamar('GET', '/auth/session', { token: respostaValida.json.token })).status, 401);
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
  const r1 = await chamar(
    'GET',
    `/frota/veiculos?motoristaId=${MOTORISTA_2}`,
    { token: T.motorista1 }
  );
  assert.equal(r1.status, 200);
  assert.equal(r1.json.veiculos.length, 1);
  assert.equal(r1.json.veiculos[0].placa, 'ABC-1234');
  assert.equal(Object.hasOwn(r1.json.veiculos[0], 'gastosTotais'), false);
  assert.equal(Object.hasOwn(r1.json.veiculos[0], 'custoKm'), false);

  const r2 = await chamar('GET', '/frota/veiculos', { token: T.motorista2 });
  assert.equal(r2.status, 200);
  assert.equal(r2.json.veiculos.length, 0);

  const gestor = await chamar('GET', '/frota/veiculos', { token: T.gestor });
  assert.equal(gestor.status, 200);
  assert.equal(Object.hasOwn(gestor.json.veiculos[0], 'gastosTotais'), true);
  assert.equal(Object.hasOwn(gestor.json.veiculos[0], 'custoKm'), true);

  const semRotaIndividual = await chamar(
    'GET',
    `/frota/veiculos/${VEICULO}`,
    { token: T.motorista1 }
  );
  assert.equal(semRotaIndividual.status, 404);
  assert.equal(semRotaIndividual.json.veiculo, undefined);
});

// ---------------------------------------------------------------- I7
test('km rodados usa km_final − km_inicial (I7)', async () => {
  const r = await chamar('GET', '/financeiro/visao-geral-frota?dias=7', { token: T.admin });
  assert.equal(r.status, 200);
  assert.equal(r.json.kmRodados, 588.7);
  assert.notEqual(r.json.kmRodados, 134910);
  assert.equal(r.json.veiculosEmRota, 1);
  assert.equal(r.json.custoPorKm, 2); // 1.177,40 / 588,7 km
});

test('visão da frota mantém despesas e percentuais dentro do período solicitado', async () => {
  const lancamentosOriginais = fake.tabelas.lancamentos_financeiros;
  const categoriasOriginais = fake.tabelas.categorias_financeiras;
  const viagensOriginais = fake.tabelas.viagens;
  const dataRecente = new Date().toISOString().slice(0, 10);
  const dataAntiga = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
  const categorias = Array.from({ length: 6 }, (_, index) => ({
    id: `categoria-${index}`,
    nome: `Categoria ${index}`,
  }));
  const despesas = categorias.map((categoria, index) => ({
    id: `despesa-${index}`,
    tipo: 'SAIDA',
    status: 'PAGO',
    valor: (index + 1) * 10,
    id_categoria: categoria.id,
    data_lancamento: dataRecente,
  }));

  fake.tabelas.categorias_financeiras = categorias;
  fake.tabelas.lancamentos_financeiros = despesas;
  fake.tabelas.viagens = [{
    id: 'viagem-historica',
    status: 'CONCLUIDA',
    km_inicial: 100,
    km_final: 200,
    concluida_em: dataRecente,
  }];

  try {
    const recente = await chamar('GET', '/financeiro/visao-geral-frota?dias=7', { token: T.admin });
    assert.equal(recente.json.totalDespesas, 210);
    assert.equal(recente.json.kmRodados, 100);
    assert.equal(recente.json.despesas[0].porcentagemExata, 28.57);
    assert.ok(recente.json.despesas.reduce((soma, item) => soma + item.porcentagemExata, 0) < 100);

    fake.tabelas.lancamentos_financeiros = despesas.map((item, index) => ({
      ...item,
      data_lancamento: dataAntiga,
      data_pagamento: index === 0 ? dataRecente : dataAntiga,
    }));
    fake.tabelas.viagens = [{
      ...fake.tabelas.viagens[0],
      concluida_em: dataAntiga,
    }];
    const pagamentoRecente = await chamar('GET', '/financeiro/visao-geral-frota?dias=7', { token: T.admin });
    assert.equal(pagamentoRecente.json.totalDespesas, 10);
    assert.equal(pagamentoRecente.json.despesas[0].porcentagemExata, 100);
    assert.equal(pagamentoRecente.json.kmRodados, 0);

    fake.tabelas.lancamentos_financeiros = fake.tabelas.lancamentos_financeiros.map((item) => ({
      ...item,
      data_pagamento: dataAntiga,
    }));
    const semDadosRecentes = await chamar('GET', '/financeiro/visao-geral-frota?dias=7', { token: T.admin });
    assert.equal(semDadosRecentes.json.totalDespesas, 0);
    assert.equal(semDadosRecentes.json.kmRodados, 0);
    assert.deepEqual(semDadosRecentes.json.despesas, []);
  } finally {
    fake.tabelas.lancamentos_financeiros = lancamentosOriginais;
    fake.tabelas.categorias_financeiras = categoriasOriginais;
    fake.tabelas.viagens = viagensOriginais;
  }
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

test('idempotência: repetição de requisição com idLocal não duplica transação', async () => {
  const idLocal = 'tx_idemp_teste_001';
  const totalAntes = fake.tabelas.lancamentos_financeiros.length;

  const r1 = await chamar('POST', '/financeiro/transacoes', {
    token: T.financeiro,
    corpo: { idLocal, tipo: 'saida', descricao: 'Troca de filtro', valorParcela: 120, idCategoria: CAT_DIESEL },
  });
  assert.equal(r1.status, 201);
  assert.equal(fake.tabelas.lancamentos_financeiros.length, totalAntes + 1);

  const r2 = await chamar('POST', '/financeiro/transacoes', {
    token: T.financeiro,
    corpo: { idLocal, tipo: 'saida', descricao: 'Troca de filtro', valorParcela: 120, idCategoria: CAT_DIESEL },
  });
  assert.equal(r2.status, 200);
  assert.equal(r2.json.jaExistente, true);
  assert.equal(r2.json.lancamento.id, r1.json.lancamento.id);
  assert.equal(fake.tabelas.lancamentos_financeiros.length, totalAntes + 1);
});

test('idempotência: repetição de dívida com idLocal não duplica financiamento nem parcelas', async () => {
  const idLocal = 'divida_idemp_001';
  const totalFinAntes = fake.tabelas.financiamentos.length;
  const totalLancAntes = fake.tabelas.lancamentos_financeiros.length;

  const r1 = await chamar('POST', '/financeiro/transacoes', {
    token: T.financeiro,
    corpo: { idLocal, tipo: 'divida', descricao: 'Caminhão Novo', valorParcela: 2000, quantidadeParcelas: 4, idCategoria: CAT_DIESEL },
  });
  assert.equal(r1.status, 201);
  assert.equal(fake.tabelas.financiamentos.length, totalFinAntes + 1);
  assert.equal(fake.tabelas.lancamentos_financeiros.length, totalLancAntes + 4);

  const r2 = await chamar('POST', '/financeiro/transacoes', {
    token: T.financeiro,
    corpo: { idLocal, tipo: 'divida', descricao: 'Caminhão Novo', valorParcela: 2000, quantidadeParcelas: 4, idCategoria: CAT_DIESEL },
  });
  assert.equal(r2.status, 200);
  assert.equal(r2.json.jaExistente, true);
  assert.equal(r2.json.financiamentoId, r1.json.financiamentoId);
  assert.equal(fake.tabelas.financiamentos.length, totalFinAntes + 1);
  assert.equal(fake.tabelas.lancamentos_financeiros.length, totalLancAntes + 4);
});

test('idempotência: requisições simultâneas com mesmo idLocal tratam concorrência', async () => {
  const idLocal = 'concorrente_001';
  const totalAntes = fake.tabelas.lancamentos_financeiros.length;

  const [r1, r2] = await Promise.all([
    chamar('POST', '/financeiro/transacoes', {
      token: T.financeiro,
      corpo: { idLocal, tipo: 'entrada', descricao: 'Adiantamento', valorParcela: 750 },
    }),
    chamar('POST', '/financeiro/transacoes', {
      token: T.financeiro,
      corpo: { idLocal, tipo: 'entrada', descricao: 'Adiantamento', valorParcela: 750 },
    }),
  ]);

  assert.ok([200, 201].includes(r1.status));
  assert.ok([200, 201].includes(r2.status));
  assert.equal(fake.tabelas.lancamentos_financeiros.length, totalAntes + 1);
});

test('atividades recentes: motorista só vê os próprios lançamentos', async () => {
  const r = await chamar('GET', '/resumo/atividades-recentes?limite=50', { token: T.motorista1 });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.atividades.map((a) => a.id), ['l2']);
});

test('módulo financeiro legado restringe consultas e mutações ao usuário autenticado', async () => {
  const lista = await chamar(
    'GET',
    `/financial/transactions?userId=${FINANCEIRO}`,
    { token: T.motorista1 }
  );
  assert.equal(lista.status, 200);
  assert.deepEqual(lista.json.dados.items.map((item) => item.id), ['l2']);
  assert.equal(lista.json.dados.items[0].userId, MOTORISTA_1);

  const listaFinanceiro = await chamar('GET', '/financial/transactions', {
    token: T.financeiro,
  });
  assert.equal(listaFinanceiro.status, 200);
  assert.ok(listaFinanceiro.json.dados.items.some((item) => item.id === 'l1'));
  assert.ok(listaFinanceiro.json.dados.items.some((item) => item.id === 'l2'));

  const criada = await chamar('POST', '/financial/transactions', {
    token: T.motorista1,
    corpo: {
      userId: FINANCEIRO,
      description: 'Despesa do motorista',
      amount: 125,
      type: 'EXPENSE',
      categoryId: CAT_DIESEL,
      date: hoje,
    },
  });
  assert.equal(criada.status, 201);
  assert.equal(criada.json.dados.userId, MOTORISTA_1);
  const transacaoCriada = fake.tabelas.lancamentos_financeiros.find(
    (item) => item.id === criada.json.dados.id
  );
  assert.equal(transacaoCriada.id_usuario, MOTORISTA_1);

  const totalAntesViagemEstranha = fake.tabelas.lancamentos_financeiros.length;
  const viagemDeOutroId = 'c0000000-0000-0000-0000-000000000099';
  fake.tabelas.viagens.push({
    id: viagemDeOutroId,
    id_motorista: MOTORISTA_2,
    status: 'EM_ANDAMENTO',
  });
  const viagemDeOutro = await chamar('POST', '/financial/transactions', {
    token: T.motorista1,
    corpo: {
      userId: FINANCEIRO,
      description: 'Despesa vinculada a terceiro',
      amount: 80,
      type: 'EXPENSE',
      categoryId: CAT_DIESEL,
      date: hoje,
      tripId: viagemDeOutroId,
    },
  });
  assert.equal(viagemDeOutro.status, 404);
  assert.equal(viagemDeOutro.json.dados, undefined);
  assert.equal(fake.tabelas.lancamentos_financeiros.length, totalAntesViagemEstranha);

  const lancamentoDeOutroId = 'c0000000-0000-0000-0000-000000000098';
  fake.tabelas.lancamentos_financeiros.push({
    id: lancamentoDeOutroId,
    descricao: 'Lançamento privado',
    valor: 50,
    tipo: 'SAIDA',
    status: 'PENDENTE',
    id_usuario: FINANCEIRO,
  });
  const pagoDeOutro = await chamar('PATCH', `/financial/transactions/${lancamentoDeOutroId}/pay`, {
    token: T.motorista1,
    corpo: { paymentDate: hoje },
  });
  assert.equal(pagoDeOutro.status, 404);
  assert.equal(pagoDeOutro.json.dados, undefined);

  const editarOutro = await chamar('PUT', `/financial/transactions/${lancamentoDeOutroId}`, {
    token: T.motorista1,
    corpo: { amount: 1 },
  });
  assert.equal(editarOutro.status, 404);
  const excluirOutro = await chamar('DELETE', `/financial/transactions/${lancamentoDeOutroId}`, {
    token: T.motorista1,
  });
  assert.equal(excluirOutro.status, 404);

  const pagoProprio = await chamar(
    'PATCH',
    `/financial/transactions/${criada.json.dados.id}/pay`,
    { token: T.motorista1, corpo: { paymentDate: hoje } }
  );
  assert.equal(pagoProprio.status, 200);
  assert.equal(pagoProprio.json.dados.userId, MOTORISTA_1);

  const userIdForjado = await chamar('POST', '/financial/financings', {
    token: T.motorista1,
    corpo: {
      userId: FINANCEIRO,
      description: 'Financiamento do motorista',
      installmentAmount: 100,
      installments: 2,
      firstDueDate: hoje,
      categoryId: CAT_DIESEL,
    },
  });
  assert.equal(userIdForjado.status, 201);
  assert.equal(userIdForjado.json.dados.userId, MOTORISTA_1);

  const financiamentoDeOutroId = 'd0000000-0000-0000-0000-000000000099';
  fake.tabelas.financiamentos.push({
    id: financiamentoDeOutroId,
    descricao: 'Financiamento privado',
    valor_total: 200,
    valor_parcela: 100,
    quantidade_parcelas: 2,
    data_primeiro_vencimento: hoje,
    id_usuario: FINANCEIRO,
  });
  const financiamentoDeOutro = await chamar(
    'GET',
    `/financial/financings/${financiamentoDeOutroId}`,
    { token: T.motorista1 }
  );
  assert.equal(financiamentoDeOutro.status, 404);
  assert.equal(financiamentoDeOutro.json.dados, undefined);

  fake.tabelas.viagens = fake.tabelas.viagens.filter((item) => item.id !== viagemDeOutroId);
  fake.tabelas.lancamentos_financeiros = fake.tabelas.lancamentos_financeiros.filter(
    (item) => item.id !== criada.json.dados.id && item.id !== lancamentoDeOutroId
  );
  fake.tabelas.financiamentos = fake.tabelas.financiamentos.filter(
    (item) =>
      item.id !== userIdForjado.json.dados.id &&
      item.id !== financiamentoDeOutroId
  );
  fake.tabelas.lancamentos_financeiros = fake.tabelas.lancamentos_financeiros.filter(
    (item) => item.id_financiamento !== userIdForjado.json.dados.id
  );
});

test('projeção financeira global permite apenas Admin e Financeiro', async () => {
  for (const tokenRestrito of [T.motorista1, T.gestor]) {
    const negada = await chamar('GET', '/financial/projection', { token: tokenRestrito });
    assert.equal(negada.status, 403);
    assert.equal(negada.json.dados, undefined);
  }

  for (const tokenAutorizado of [T.admin, T.financeiro]) {
    const permitida = await chamar('GET', '/financial/projection', { token: tokenAutorizado });
    assert.equal(permitida.status, 200);
  }
});

test('motorista não pode alterar o próprio perfil nem elevar privilégios', async () => {
  const resposta = await chamar('PUT', `/usuarios/${MOTORISTA_1}`, {
    token: T.motorista1,
    corpo: { perfil: 1 },
  });
  assert.equal(resposta.status, 403);
  assert.equal(resposta.json.usuario, undefined);
});

// ---------------------------------------------------------------- frota (P5, P6, P7, P10, P11)
test('motorista só vê as próprias rotas (P10, P11)', async () => {
  const r = await chamar('GET', '/frota/rotas', { token: T.motorista1 });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.rotas.map((x) => x.id).sort(), ['v1', 'v3']);
  const andamento = await chamar('GET', '/frota/viagens-andamento', { token: T.motorista1 });
  assert.deepEqual(andamento.json.viagens.map((x) => x.id), ['v3']);
  assert.deepEqual(
    {
      status: andamento.json.viagens[0].status,
      hodometroInicial: andamento.json.viagens[0].hodometroInicial,
      motoristaId: andamento.json.viagens[0].motoristaId,
      motorista: andamento.json.viagens[0].motorista,
      veiculoId: andamento.json.viagens[0].veiculoId,
      veiculoModelo: andamento.json.viagens[0].veiculoModelo,
      placa: andamento.json.viagens[0].placa,
    },
    {
      status: 'em_transito',
      hodometroInicial: 45790,
      motoristaId: MOTORISTA_1,
      motorista: 'João Silva',
      veiculoId: VEICULO,
      veiculoModelo: 'Scania R450',
      placa: 'ABC-1234',
    }
  );
  const gestor = await chamar('GET', '/frota/viagens-andamento', { token: T.gestor });
  assert.equal(gestor.json.viagens.length, 2);
});

test('GPS: identidade JWT prevalece sobre IDs enviados e motorista não envia para viagem alheia', async () => {
  const viagemId = 'd0000000-0000-0000-0000-000000000001';
  const viagemAlheiaId = 'd0000000-0000-0000-0000-000000000002';
  const iniciouEm = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const registradaEm = new Date(Date.now() - 60 * 1000).toISOString();
  fake.tabelas.viagens.push(
    {
      id: viagemId,
      id_motorista: MOTORISTA_1,
      id_veiculo: VEICULO,
      status: 'EM_ANDAMENTO',
      iniciada_em: iniciouEm,
      origem: 'Campinas',
      destino: 'Santos',
    },
    {
      id: viagemAlheiaId,
      id_motorista: MOTORISTA_2,
      id_veiculo: VEICULO,
      status: 'EM_ANDAMENTO',
      iniciada_em: iniciouEm,
    }
  );
  const posicao = {
    id: randomUUID(),
    latitude: -23.55,
    longitude: -46.63,
    precisao: 8,
    velocidade: 4,
    registradaEm,
  };
  const tamanhoInicial = fake.tabelas.posicoes_viagem.length;

  try {
    const registrada = await chamar('POST', `/frota/rotas/${viagemId}/posicoes`, {
      token: T.motorista1,
      corpo: { usuarioId: MOTORISTA_2, posicoes: [posicao] },
    });
    assert.equal(registrada.status, 200);
    assert.deepEqual(registrada.json.persistidas, [posicao.id]);
    const salva = fake.tabelas.posicoes_viagem.find((item) => item.id === posicao.id);
    assert.equal(salva.id_motorista, MOTORISTA_1);
    assert.equal(salva.id_viagem, viagemId);
    assert.equal(salva.precisao_m, posicao.precisao);
    assert.equal(salva.velocidade_ms, posicao.velocidade);
    assert.equal(Object.hasOwn(salva, 'precisao'), false);
    assert.equal(Object.hasOwn(salva, 'velocidade'), false);
    assert.equal(Object.hasOwn(salva, 'usuarioId'), false);

    const repetida = await chamar('POST', `/frota/rotas/${viagemId}/posicoes`, {
      token: T.motorista1,
      corpo: { posicoes: [posicao] },
    });
    assert.equal(repetida.status, 200);
    assert.deepEqual(repetida.json.persistidas, [posicao.id]);

    const conflito = {
      ...posicao,
      id: randomUUID(),
      latitude: -23.56,
    };
    const repeticaoConflitante = await chamar('POST', `/frota/rotas/${viagemId}/posicoes`, {
      token: T.motorista1,
      corpo: { posicoes: [conflito] },
    });
    assert.equal(repeticaoConflitante.status, 207);
    assert.deepEqual(repeticaoConflitante.json.persistidas, []);
    assert.deepEqual(repeticaoConflitante.json.naoPersistidas, [conflito.id]);

    const viagemDeOutro = await chamar('POST', `/frota/rotas/${viagemAlheiaId}/posicoes`, {
      token: T.motorista1,
      corpo: { posicoes: [{ ...posicao, id: randomUUID() }] },
    });
    assert.equal(viagemDeOutro.status, 403);
    assert.equal(fake.tabelas.posicoes_viagem.length, tamanhoInicial + 1);

    assert.equal((await chamar('GET', '/frota/posicoes', { token: T.motorista1 })).status, 403);
    assert.equal((await chamar('GET', '/frota/posicoes', { token: T.financeiro })).status, 403);
    for (const tokenGestao of [T.admin, T.gestor]) {
      const consulta = await chamar('GET', `/frota/posicoes?viagemId=${viagemId}`, { token: tokenGestao });
      assert.equal(consulta.status, 200);
      assert.equal(consulta.json.posicoes.length, 1);
      assert.equal(consulta.json.posicoes[0].motoristaId, MOTORISTA_1);
    }
  } finally {
    fake.tabelas.viagens = fake.tabelas.viagens.filter(
      (item) => item.id !== viagemId && item.id !== viagemAlheiaId
    );
    fake.tabelas.posicoes_viagem = fake.tabelas.posicoes_viagem.filter(
      (item) => item.id !== posicao.id
    );
  }
});

test('GPS aceita sincronização tardia apenas para posições capturadas antes da conclusão', async () => {
  const viagemId = 'd0000000-0000-0000-0000-000000000003';
  const iniciouEm = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const concluiuEm = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const posicoesExistentes = new Set(fake.tabelas.posicoes_viagem.map((item) => item.id));
  fake.tabelas.viagens.push({
    id: viagemId,
    id_motorista: MOTORISTA_1,
    id_veiculo: VEICULO,
    status: 'CONCLUIDA',
    iniciada_em: iniciouEm,
    concluida_em: concluiuEm,
  });

  try {
    const antesDeConcluir = {
      id: randomUUID(),
      latitude: -23.5,
      longitude: -46.5,
      registradaEm: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    };
    const aceita = await chamar('POST', `/frota/rotas/${viagemId}/posicoes`, {
      token: T.motorista1,
      corpo: { posicoes: [antesDeConcluir] },
    });
    assert.equal(aceita.status, 200);

    const depoisDeConcluir = {
      ...antesDeConcluir,
      id: randomUUID(),
      registradaEm: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    };
    const rejeitada = await chamar('POST', `/frota/rotas/${viagemId}/posicoes`, {
      token: T.motorista1,
      corpo: { posicoes: [depoisDeConcluir] },
    });
    assert.equal(rejeitada.status, 409);
    assert.equal(fake.tabelas.posicoes_viagem.some((item) => item.id === depoisDeConcluir.id), false);
  } finally {
    fake.tabelas.viagens = fake.tabelas.viagens.filter((item) => item.id !== viagemId);
    fake.tabelas.posicoes_viagem = fake.tabelas.posicoes_viagem.filter(
      (item) => posicoesExistentes.has(item.id)
    );
  }
});

test('GPS aceita duplicata legada sem metadados opcionais e retorna NULL na consulta', async () => {
  const viagemId = 'd0000000-0000-0000-0000-000000000004';
  const iniciouEm = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const registradaEm = new Date(Date.now() - 60 * 1000).toISOString();
  const posicaoLegada = {
    id: randomUUID(),
    id_motorista: MOTORISTA_1,
    id_viagem: viagemId,
    latitude: -23.55,
    longitude: -46.63,
    registrada_em: registradaEm,
  };
  fake.tabelas.viagens.push({
    id: viagemId,
    id_motorista: MOTORISTA_1,
    id_veiculo: VEICULO,
    status: 'EM_ANDAMENTO',
    iniciada_em: iniciouEm,
    origem: 'Campinas',
    destino: 'Santos',
  });
  fake.tabelas.posicoes_viagem.push(posicaoLegada);

  try {
    const repetida = {
      id: randomUUID(),
      latitude: posicaoLegada.latitude,
      longitude: posicaoLegada.longitude,
      precisao: 8,
      velocidade: 4,
      registradaEm,
    };
    const sincronizada = await chamar('POST', `/frota/rotas/${viagemId}/posicoes`, {
      token: T.motorista1,
      corpo: { posicoes: [repetida] },
    });
    assert.equal(sincronizada.status, 200);
    assert.deepEqual(sincronizada.json.persistidas, [repetida.id]);

    const consultada = await chamar('GET', `/frota/posicoes?viagemId=${viagemId}`, {
      token: T.gestor,
    });
    assert.equal(consultada.status, 200);
    assert.equal(consultada.json.posicoes.length, 1);
    assert.equal(consultada.json.posicoes[0].precisao_m, null);
    assert.equal(consultada.json.posicoes[0].velocidade_ms, null);
    assert.equal(consultada.json.posicoes[0].latitude, posicaoLegada.latitude);
  } finally {
    fake.tabelas.viagens = fake.tabelas.viagens.filter((item) => item.id !== viagemId);
    fake.tabelas.posicoes_viagem = fake.tabelas.posicoes_viagem.filter(
      (item) => item.id !== posicaoLegada.id
    );
  }
});

test('motorista não pode trocar o veículo previamente associado à rota', async () => {
  const outroVeiculoId = 'b0000000-0000-0000-0000-000000000002';
  const rotaId = 'rota-associada-veiculo-a';
  const outraRotaId = 'rota-associada-veiculo-b';
  fake.tabelas.veiculos.push({
    id: outroVeiculoId,
    modelo: 'Volvo FH',
    placa: 'XYZ-9Y99',
    hodometro: 12000,
    status: 'DISPONIVEL',
    ativo: true,
  });
  fake.tabelas.viagens.push(
    { id: rotaId, id_motorista: MOTORISTA_1, id_veiculo: VEICULO, status: 'PLANEJADA' },
    { id: outraRotaId, id_motorista: MOTORISTA_1, id_veiculo: outroVeiculoId, status: 'PLANEJADA' }
  );

  try {
    const resposta = await chamar('POST', `/frota/rotas/${rotaId}/abrir`, {
      token: T.motorista1,
      corpo: { veiculoId: outroVeiculoId, hodometroInicial: 12000 },
    });
    assert.equal(resposta.status, 403);
    assert.equal(fake.tabelas.viagens.find((item) => item.id === rotaId).status, 'PLANEJADA');
  } finally {
    fake.tabelas.veiculos = fake.tabelas.veiculos.filter((item) => item.id !== outroVeiculoId);
    fake.tabelas.viagens = fake.tabelas.viagens.filter(
      (item) => item.id !== rotaId && item.id !== outraRotaId
    );
  }
});

test('rotas e viagens filtram despesas pelo motorista autenticado', async () => {
  const viagemSemDespesas = {
    id: 'v4',
    origem: 'Recife',
    destino: 'Natal',
    id_motorista: MOTORISTA_1,
    id_veiculo: VEICULO,
    status: 'EM_ANDAMENTO',
    km_inicial: 45790,
  };
  const despesaPropria = {
    id: 'l-rota-propria',
    descricao: 'Combustível próprio',
    valor: 125.5,
    tipo: 'SAIDA',
    id_usuario: MOTORISTA_1,
    id_viagem: 'v3',
  };
  const despesaTerceiro = {
    id: 'l-rota-terceiro',
    descricao: 'Despesa confidencial de terceiro',
    valor: 98765.43,
    tipo: 'SAIDA',
    id_usuario: FINANCEIRO,
    id_viagem: 'v3',
  };
  fake.tabelas.viagens.push(viagemSemDespesas);
  fake.tabelas.lancamentos_financeiros.push(despesaPropria, despesaTerceiro);

  try {
    for (const [endpoint, chave, idViagem] of [
      ['/frota/rotas', 'rotas', 'v3'],
      ['/frota/viagens-andamento', 'viagens', 'v3'],
    ]) {
      const motorista = await chamar('GET', `${endpoint}?motoristaId=${MOTORISTA_2}`, {
        token: T.motorista1,
      });
      assert.equal(motorista.status, 200);
      assert.deepEqual(
        motorista.json[chave].find((item) => item.id === idViagem).despesas,
        [{
          id: despesaPropria.id,
          descricao: despesaPropria.descricao,
          valor: despesaPropria.valor,
          comprovante: 'Sem comprovante',
        }]
      );
      assert.ok(motorista.json[chave].some((item) => item.id === viagemSemDespesas.id && item.despesas.length === 0));

      const conteudo = JSON.stringify(motorista.json);
      assert.equal(conteudo.includes(despesaTerceiro.id), false);
      assert.equal(conteudo.includes(despesaTerceiro.descricao), false);
      assert.equal(conteudo.includes(String(despesaTerceiro.valor)), false);

      const administrador = await chamar('GET', endpoint, { token: T.admin });
      const viagemAdministrador = administrador.json[chave].find((item) => item.id === idViagem);
      assert.deepEqual(
        viagemAdministrador.despesas.map((item) => item.id).sort(),
        [despesaPropria.id, despesaTerceiro.id].sort()
      );

      const gestor = await chamar('GET', endpoint, { token: T.gestor });
      const viagemGestor = gestor.json[chave].find((item) => item.id === idViagem);
      assert.deepEqual(
        viagemGestor.despesas.map((item) => item.id).sort(),
        [despesaPropria.id, despesaTerceiro.id].sort()
      );

      const financeiroSemPermissaoDeFrota = await chamar('GET', endpoint, {
        token: T.financeiro,
      });
      assert.equal(financeiroSemPermissaoDeFrota.status, 403);
    }

    const veiculos = await chamar('GET', '/frota/veiculos', { token: T.motorista1 });
    assert.equal(veiculos.status, 200);
    assert.equal(Object.hasOwn(veiculos.json.veiculos[0], 'gastosTotais'), false);
    assert.equal(Object.hasOwn(veiculos.json.veiculos[0], 'custoKm'), false);

    const outraViagem = await chamar('POST', '/frota/rotas/v2/abrir', {
      token: T.motorista1,
      corpo: { veiculoId: VEICULO, hodometroInicial: 45790 },
    });
    assert.equal(outraViagem.status, 403);
  } finally {
    fake.tabelas.viagens = fake.tabelas.viagens.filter(
      (item) => item.id !== viagemSemDespesas.id
    );
    fake.tabelas.lancamentos_financeiros = fake.tabelas.lancamentos_financeiros.filter(
      (item) => ![despesaPropria.id, despesaTerceiro.id].includes(item.id)
    );
  }
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
  assert.equal((await chamar('POST', `/frota/rotas/${id}/abrir`, {
    token: T.motorista2,
    corpo: { veiculoId: 'b0000000-0000-0000-0000-000000000099', hodometroInicial: 45800 },
  })).status, 403);
  // Hodômetro menor que o do veículo é recusado.
  assert.equal((await chamar('POST', `/frota/rotas/${id}/abrir`, { token: T.motorista2, corpo: { hodometroInicial: 100 } })).status, 400);
  // Concluir uma rota agendada não pode pular a abertura.
  assert.equal((await chamar('POST', `/frota/rotas/${id}/concluir`, { token: T.motorista2, corpo: { hodometroFinal: 46000 } })).status, 400);

  const aberta = await chamar('POST', `/frota/rotas/${id}/abrir`, { token: T.motorista2, corpo: { hodometroInicial: 45800 } });
  assert.equal(aberta.status, 200);
  assert.equal(fake.tabelas.veiculos.find((v) => v.id === VEICULO).status, 'EM_VIAGEM');
  const aberturaRepetida = await chamar('POST', `/frota/rotas/${id}/abrir`, { token: T.motorista2, corpo: { hodometroInicial: 45800 } });
  assert.equal(aberturaRepetida.status, 200);
  assert.equal(aberturaRepetida.json.jaExistente, true);
  assert.equal((await chamar('POST', `/frota/rotas/${id}/abrir`, { token: T.motorista2, corpo: { hodometroInicial: 45801 } })).status, 409);

  assert.equal((await chamar('POST', `/frota/rotas/${id}/concluir`, { token: T.motorista2, corpo: { hodometroFinal: '' } })).status, 400);
  assert.equal((await chamar('POST', `/frota/rotas/${id}/concluir`, { token: T.motorista2, corpo: { hodometroFinal: 45000 } })).status, 400);
  const hodometroAnterior = fake.tabelas.veiculos.find((v) => v.id === VEICULO).hodometro;
  fake.tabelas.veiculos.find((v) => v.id === VEICULO).hodometro = 46301;
  assert.equal((await chamar('POST', `/frota/rotas/${id}/concluir`, { token: T.motorista2, corpo: { hodometroFinal: 46300 } })).status, 400);
  fake.tabelas.veiculos.find((v) => v.id === VEICULO).hodometro = hodometroAnterior;

  const fim = await chamar('POST', `/frota/rotas/${id}/concluir`, { token: T.motorista2, corpo: { hodometroFinal: 46300 } });
  assert.equal(fim.status, 200);
  assert.equal(fim.json.kmRodados, 500);
  const veiculo = fake.tabelas.veiculos.find((v) => v.id === VEICULO);
  veiculo.status = 'EM_VIAGEM';
  veiculo.hodometro = 45800;
  const conclusaoRepetida = await chamar('POST', `/frota/rotas/${id}/concluir`, { token: T.motorista2, corpo: { hodometroFinal: 46300 } });
  assert.equal(conclusaoRepetida.status, 200);
  assert.equal(conclusaoRepetida.json.jaExistente, true);
  assert.equal(veiculo.status, 'DISPONIVEL');
  assert.equal(veiculo.hodometro, 46300);
  assert.equal((await chamar('POST', `/frota/rotas/${id}/concluir`, { token: T.motorista2, corpo: { hodometroFinal: 46301 } })).status, 409);
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

test('motorista consulta apenas os próprios lançamentos e dívidas', async () => {
  const idFinProprio = 'd0000000-0000-0000-0000-000000000001';
  const idFinAlheio = 'd0000000-0000-0000-0000-000000000002';
  fake.tabelas.financiamentos.push(
    { id: idFinProprio, id_usuario: MOTORISTA_1, descricao: 'Dívida própria', valor_total: 200, valor_parcela: 100, quantidade_parcelas: 2 },
    { id: idFinAlheio, id_usuario: MOTORISTA_2, descricao: 'Dívida de outro motorista', valor_total: 900, valor_parcela: 900, quantidade_parcelas: 1 }
  );
  fake.tabelas.lancamentos_financeiros.push(
    { id: 'e0000000-0000-0000-0000-000000000001', id_usuario: MOTORISTA_1, id_financiamento: idFinProprio, tipo: 'DIVIDA', descricao: 'Parcela própria', valor: 100, status: 'PENDENTE', numero_parcela: 1, data_vencimento: hoje },
    { id: 'e0000000-0000-0000-0000-000000000002', id_usuario: MOTORISTA_2, id_financiamento: idFinAlheio, tipo: 'DIVIDA', descricao: 'Parcela alheia', valor: 900, status: 'PENDENTE', numero_parcela: 1, data_vencimento: hoje },
    { id: 'e0000000-0000-0000-0000-000000000003', id_usuario: MOTORISTA_2, tipo: 'SAIDA', descricao: 'Lançamento de outro motorista', valor: 777, status: 'PAGO', data_lancamento: hoje }
  );

  const lancamentos = await chamar('GET', '/financeiro/lancamentos?limite=100', { token: T.motorista1 });
  assert.equal(lancamentos.status, 200);
  assert.ok(lancamentos.json.lancamentos.some((item) => item.id === 'l2'));
  assert.ok(!lancamentos.json.lancamentos.some((item) => item.descricao === 'Lançamento de outro motorista'));

  const dividas = await chamar('GET', '/financeiro/dividas', { token: T.motorista1 });
  assert.equal(dividas.status, 200);
  assert.deepEqual(dividas.json.dividas.map((item) => item.id), [idFinProprio]);
  assert.equal(dividas.json.totais.valorRestante, 100);
  assert.equal((await chamar('GET', `/financeiro/dividas/${idFinAlheio}`, { token: T.motorista1 })).status, 404);
});

test('motorista não vincula lançamento a viagem de outro motorista', async () => {
  const totalAntes = fake.tabelas.lancamentos_financeiros.length;
  const tentativa = await chamar('POST', '/financeiro/transacoes', {
    token: T.motorista1,
    corpo: { tipo: 'saida', descricao: 'Despesa em viagem alheia', valorParcela: 30, idViagem: 'v2' },
  });
  assert.equal(tentativa.status, 403);
  assert.equal(fake.tabelas.lancamentos_financeiros.length, totalAntes);

  const propria = await chamar('POST', '/financeiro/transacoes', {
    token: T.motorista1,
    corpo: { tipo: 'saida', descricao: 'Despesa em viagem própria', valorParcela: 30, idViagem: 'v1' },
  });
  assert.equal(propria.status, 201);
  assert.equal(propria.json.lancamento.id_usuario, MOTORISTA_1);
  assert.equal(propria.json.lancamento.id_viagem, 'v1');
});

test('solicitação de recuperação usa resposta genérica e valida o formato do e-mail', async () => {
  const existente = await chamar('POST', '/auth/password/recovery', {
    corpo: { email: 'joao@logfin.com' },
  });
  const inexistente = await chamar('POST', '/auth/password/recovery', {
    corpo: { email: 'naocadastrado@logfin.com' },
  });
  assert.equal(existente.status, 202);
  assert.equal(inexistente.status, 202);
  assert.deepEqual(inexistente.json, existente.json);
  assert.equal(
    fake.solicitacoesRecuperacao.at(-1).options.redirectTo,
    process.env.PASSWORD_RECOVERY_REDIRECT_URL || 'frotix://auth/recovery'
  );
  assert.equal(
    (await chamar('POST', '/auth/password/recovery', { corpo: { email: 'invalido' } })).status,
    400
  );
});

test('redefinição valida o recovery token, ignora user_id e revoga todas as sessões do usuário verificado', async () => {
  const outraSessaoId = randomUUID();
  fake.tabelas.auth_sessions.push({
    id: outraSessaoId,
    user_id: MOTORISTA_2,
    created_at: agora,
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    revoked_at: null,
    revoke_reason: null,
  });
  fake.tabelas.auth_refresh_tokens.push({
    id: randomUUID(),
    session_id: outraSessaoId,
    token_hash: 'f'.repeat(64),
    issued_at: agora,
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    consumed_at: null,
    revoked_at: null,
  });
  const resposta = await chamar('POST', '/auth/password/recovery/complete', {
    corpo: {
      token_hash: 'recovery-token-valido',
      password: 'nova-senha-valida',
      user_id: MOTORISTA_1,
    },
  });

  assert.equal(resposta.status, 200);
  assert.equal(resposta.json.token, undefined);
  assert.equal(fake.alteracoesSenha.at(-1), 'nova-senha-valida');
  assert.equal(
    fake.tabelas.auth_sessions.find((sessao) => sessao.id === outraSessaoId).revoke_reason,
    'password_reset'
  );
  assert.ok(fake.tabelas.auth_refresh_tokens.find((item) => item.session_id === outraSessaoId).revoked_at);
  assert.equal(
    fake.tabelas.auth_sessions.find((sessao) => sessao.id === jwt.decode(T.motorista1).sid).revoked_at,
    null
  );

  const invalido = await chamar('POST', '/auth/password/recovery/complete', {
    corpo: { token_hash: 'recovery-token-expirado', password: 'nova-senha-valida' },
  });
  assert.equal(invalido.status, 400);
});

test('sessão Supabase verificada pode redefinir senha sem aceitar identidade enviada pelo app', async () => {
  const resposta = await chamar('POST', '/auth/password/recovery/complete', {
    corpo: {
      access_token: 'recovery-access-valido',
      refresh_token: 'recovery-refresh-valido',
      password: 'outra-senha-valida',
      user_id: MOTORISTA_1,
    },
  });
  assert.equal(resposta.status, 200);
  assert.equal(fake.alteracoesSenha.at(-1), 'outra-senha-valida');
  assert.equal(
    fake.tabelas.auth_sessions.find((sessao) => sessao.id === jwt.decode(T.motorista1).sid).revoked_at,
    null
  );
});

test('solicitações repetidas de recuperação são limitadas por IP', async () => {
  const respostas = [];
  for (let i = 0; i < 3; i++) {
    respostas.push(await chamar('POST', '/auth/password/recovery', {
      corpo: { email: `usuario${i}@logfin.com` },
    }));
  }
  assert.deepEqual(respostas.map((resposta) => resposta.status), [202, 202, 429]);
});
