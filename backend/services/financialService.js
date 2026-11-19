import supabase from '../database/db.js';

export class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'AppError';
    this.status = status;
  }
}

const TABLE = 'lancamentos_financeiros';
const RECEIPTS_BUCKET = 'comprovantes';

const TYPE_TO_DB = { INCOME: 'ENTRADA', EXPENSE: 'SAIDA' };
const TYPE_FROM_DB = { ENTRADA: 'INCOME', SAIDA: 'EXPENSE', DIVIDA: 'EXPENSE' };
const STATUS_TO_DB = { PENDING: 'PENDENTE', PAID: 'PAGO' };
const STATUS_FROM_DB = { PENDENTE: 'PENDING', PAGO: 'PAID', CANCELADO: 'CANCELED' };


const DB_ERRORS = {
  '23503': [400, 'Referência inválida: usuário, categoria, forma de pagamento ou viagem não existe.'],
  '23514': [400, 'O banco recusou algum dos valores informados.'],
  '23502': [400, 'Falta um campo obrigatório.'],
  '22P02': [400, 'Identificador ou valor em formato inválido.'],
  '42501': [500, 'O banco negou o acesso. Confira se o backend usa a chave service_role do Supabase.']
};

const raiseDbError = (error, fallback) => {
  const known = DB_ERRORS[error?.code];
  if (known) throw new AppError(known[0], known[1]);
  console.error(`${fallback} ->`, error);
  throw new AppError(500, fallback);
};


const toTransaction = (row) => ({
  id: row.id,
  description: row.descricao,
  amount: Number(row.valor),
  type: TYPE_FROM_DB[row.tipo] ?? row.tipo,
  status: STATUS_FROM_DB[row.status] ?? row.status,
  date: row.data_lancamento,
  dueDate: row.data_vencimento,
  paymentDate: row.data_pagamento,
  categoryId: row.id_categoria,
  paymentMethodId: row.id_forma_pagamento,
  userId: row.id_usuario,
  tripId: row.id_viagem,
  financingId: row.id_financiamento,
  installmentNumber: row.numero_parcela,
  totalInstallments: row.total_parcelas,
  receiptUrl: row.comprovante_url,
  photoUrl: row.foto_url,
  documentUrl: row.documento_url
});

const toFinancing = (row, installments) => ({
  id: row.id,
  description: row.descricao,
  totalAmount: Number(row.valor_total),
  installmentAmount: Number(row.valor_parcela),
  installments: row.quantidade_parcelas,
  firstDueDate: row.data_primeiro_vencimento,
  earlyPayoffAmount: row.valor_quitacao_antecipada === null ? null : Number(row.valor_quitacao_antecipada),
  creditor: row.credor,
  categoryId: row.id_categoria,
  paymentMethodId: row.id_forma_pagamento,
  userId: row.id_usuario,
  ...(installments ? { installmentsList: installments.map(toTransaction) } : {})
});


async function assertCategory(categoryId, dbType) {
  const { data, error } = await supabase
    .from('categorias_financeiras')
    .select('id, tipo, ativo')
    .eq('id', categoryId)
    .maybeSingle();
  if (error) raiseDbError(error, 'Erro ao consultar a categoria.');
  if (!data || data.ativo === false) throw new AppError(400, 'Categoria não encontrada ou inativa.');
  if (data.tipo !== dbType) {
    throw new AppError(400, `A categoria é de ${data.tipo}, incompatível com o tipo do lançamento.`);
  }
}

async function assertPaymentMethod(paymentMethodId) {
  if (!paymentMethodId) return;
  const { data, error } = await supabase
    .from('formas_pagamento')
    .select('id, ativo')
    .eq('id', paymentMethodId)
    .maybeSingle();
  if (error) raiseDbError(error, 'Erro ao consultar a forma de pagamento.');
  if (!data || data.ativo === false) throw new AppError(400, 'Forma de pagamento não encontrada ou inativa.');
}


async function uploadReceipt(file, userId) {
  const safeName = String(file.originalname || 'comprovante').replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${userId}/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .upload(path, file.buffer, { contentType: file.mimetype, upsert: false });
  if (error) {
    console.error('Falha no upload do comprovante ->', error);
    throw new AppError(502, 'Não foi possível enviar o comprovante.');
  }

  const { data } = supabase.storage.from(RECEIPTS_BUCKET).getPublicUrl(path);
  return { path, url: data.publicUrl };
}

const removeReceipt = async (path) => {
  const { error } = await supabase.storage.from(RECEIPTS_BUCKET).remove([path]);
  if (error) console.warn('Não foi possível remover o comprovante órfão:', error.message);
};


async function createTransaction(data, file) {
  const dbType = TYPE_TO_DB[data.type];
  await assertCategory(data.categoryId, dbType);
  await assertPaymentMethod(data.paymentMethodId);

  let receipt = null;
  if (file) receipt = await uploadReceipt(file, data.userId);

  const row = {
    descricao: data.description,
    valor: data.amount,
    tipo: dbType,
    status: STATUS_TO_DB[data.status],
    data_lancamento: data.date,
    data_vencimento: data.dueDate,
    data_pagamento: data.paymentDate,
    id_categoria: data.categoryId,
    id_forma_pagamento: data.paymentMethodId,
    id_usuario: data.userId,
    id_viagem: data.tripId,
    id_financiamento: null,
    numero_parcela: null,
    total_parcelas: null,
    comprovante_url: receipt ? receipt.url : null,
    foto_url: null,
    documento_url: null
  };

  const { data: created, error } = await supabase.from(TABLE).insert([row]).select().single();
  if (error) {
    if (receipt) await removeReceipt(receipt.path);
    raiseDbError(error, 'Erro ao cadastrar o lançamento.');
  }
  return toTransaction(created);
}

async function listTransactions(filters) {
  let query = supabase.from(TABLE).select('*', { count: 'exact' });

  if (filters.type === 'INCOME') query = query.eq('tipo', 'ENTRADA');
  if (filters.type === 'EXPENSE') query = query.in('tipo', ['SAIDA', 'DIVIDA']);
  if (filters.status) query = query.eq('status', STATUS_TO_DB[filters.status]);
  if (filters.from) query = query.gte('data_vencimento', filters.from);
  if (filters.to) query = query.lte('data_vencimento', filters.to);
  if (filters.categoryId) query = query.eq('id_categoria', filters.categoryId);
  if (filters.userId) query = query.eq('id_usuario', filters.userId);

  const { data, error, count } = await query
    .order('data_vencimento', { ascending: false })
    .order('id', { ascending: true })
    .range(filters.offset, filters.offset + filters.limit - 1);
  if (error) raiseDbError(error, 'Erro ao listar os lançamentos.');

  return {
    items: (data ?? []).map(toTransaction),
    total: count ?? 0,
    limit: filters.limit,
    offset: filters.offset
  };
}

async function markAsPaid(id, paymentDate) {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ status: 'PAGO', data_pagamento: paymentDate, atualizado_em: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'PENDENTE')
    .select()
    .maybeSingle();
  if (error) raiseDbError(error, 'Erro ao registrar o pagamento.');
  if (data) return toTransaction(data);

  const { data: current, error: lookupError } = await supabase
    .from(TABLE).select('id, status').eq('id', id).maybeSingle();
  if (lookupError) raiseDbError(lookupError, 'Erro ao consultar o lançamento.');
  if (!current) throw new AppError(404, 'Lançamento não encontrado.');
  throw new AppError(409, `O lançamento já está com status ${STATUS_FROM_DB[current.status] ?? current.status}.`);
}


async function fetchInstallments(financingId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id_financiamento', financingId)
    .order('numero_parcela', { ascending: true });
  if (error) raiseDbError(error, 'Erro ao listar as parcelas.');
  return data ?? [];
}

async function fetchFinancing(financingId) {
  const { data, error } = await supabase
    .from('financiamentos').select('*').eq('id', financingId).maybeSingle();
  if (error) raiseDbError(error, 'Erro ao consultar o financiamento.');
  if (!data) throw new AppError(404, 'Financiamento não encontrado.');
  return data;
}

async function createFinancing(data) {
  await assertCategory(data.categoryId, 'SAIDA');
  await assertPaymentMethod(data.paymentMethodId);

  const { data: financingId, error } = await supabase.rpc('cadastrar_financiamento_com_parcelas', {
    p_descricao: data.description,
    p_valor_parcela: data.installmentAmount,
    p_quantidade_parcelas: data.installments,
    p_vencimento_inicial: data.firstDueDate,
    p_quitacao_antecipada: data.earlyPayoffAmount,
    p_id_categoria: data.categoryId,
    p_id_forma_pagamento: data.paymentMethodId,
    p_id_usuario: data.userId
  });
  if (error) raiseDbError(error, 'Erro ao cadastrar o financiamento.');

  if (data.creditor) {
    const { error: creditorError } = await supabase
      .from('financiamentos').update({ credor: data.creditor }).eq('id', financingId);
    if (creditorError) console.warn('Credor não gravado:', creditorError.message);
  }

  return toFinancing(await fetchFinancing(financingId), await fetchInstallments(financingId));
}

async function listInstallments(financingId) {
  const financing = await fetchFinancing(financingId);
  const installments = await fetchInstallments(financingId);
  return toFinancing(financing, installments);
}

async function getCashProjection() {
  const { data, error } = await supabase
    .from('view_projecao_caixa')
    .select('*')
    .order('competencia', { ascending: true });
  if (error) raiseDbError(error, 'Erro ao consultar a projeção de caixa.');

  return (data ?? []).map((row) => ({
    month: row.competencia,
    expectedIncome: Number(row.total_entradas_previstas),
    expectedExpenses: Number(row.total_saidas_previstas),
    projectedResult: Number(row.resultado_projetado)
  }));
}

export default {
  createTransaction,
  listTransactions,
  markAsPaid,
  createFinancing,
  listInstallments,
  getCashProjection
};