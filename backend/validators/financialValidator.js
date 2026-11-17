const TYPE_ALIASES = { INCOME: 'INCOME', ENTRADA: 'INCOME', EXPENSE: 'EXPENSE', SAIDA: 'EXPENSE' };
const STATUS_ALIASES = { PENDING: 'PENDING', PENDENTE: 'PENDING', PAID: 'PAID', PAGO: 'PAID' };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_TEXT = 255;
const MAX_AMOUNT = 1_000_000_000;
const MAX_INSTALLMENTS = 360;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;


const token = (value) =>
  String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();

const isBlank = (value) => value === undefined || value === null || String(value).trim() === '';

export const isUuid = (value) => typeof value === 'string' && UUID_RE.test(value);

const parseMoney = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  let s = value.replace(/[^\d.,-]/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

export const isValidDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;
  const [y, m, d] = String(value).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};

export const todayISO = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

const checkText = (errors, field, value, { required = false } = {}) => {
  const text = String(value ?? '').trim();
  if (!text) {
    if (required) errors.push(`${field}: campo obrigatório.`);
    return null;
  }
  if (text.length > MAX_TEXT) errors.push(`${field}: no máximo ${MAX_TEXT} caracteres.`);
  return text;
};

const checkUuid = (errors, field, value, { required = false } = {}) => {
  if (isBlank(value)) {
    if (required) errors.push(`${field}: campo obrigatório.`);
    return null;
  }
  if (!isUuid(value)) {
    errors.push(`${field}: identificador inválido.`);
    return null;
  }
  return String(value);
};

const checkDate = (errors, field, value, fallback = null) => {
  if (isBlank(value)) return fallback;
  if (!isValidDate(value)) {
    errors.push(`${field}: data inválida, use AAAA-MM-DD.`);
    return null;
  }
  return String(value);
};

const checkAmount = (errors, field, value, { required = true } = {}) => {
  if (isBlank(value)) {
    if (required) errors.push(`${field}: informe um valor maior que zero.`);
    return null;
  }
  const n = parseMoney(value);
  if (n === null || n <= 0 || n > MAX_AMOUNT) {
    errors.push(`${field}: informe um valor maior que zero.`);
    return null;
  }
  return round2(n);
};

const result = (errors, data) => ({ valid: errors.length === 0, errors, data });


export function validateTransaction(body = {}) {
  const errors = [];

  const description = checkText(errors, 'description', body.description, { required: true });
  const amount = checkAmount(errors, 'amount', body.amount);

  const type = TYPE_ALIASES[token(body.type)];
  if (!type) errors.push('type: use INCOME ou EXPENSE.');

  const status = isBlank(body.status) ? 'PENDING' : STATUS_ALIASES[token(body.status)];
  if (!status) errors.push('status: use PENDING ou PAID.');

  const date = checkDate(errors, 'date', body.date, todayISO());
  const dueDate = checkDate(errors, 'dueDate', body.dueDate, date);

  let paymentDate = checkDate(errors, 'paymentDate', body.paymentDate, null);
  if (status === 'PENDING' && !isBlank(body.paymentDate)) {
    errors.push('paymentDate: só pode ser informada quando o status é PAID.');
  }
  if (status === 'PAID' && !paymentDate) paymentDate = date;
  if (status === 'PENDING') paymentDate = null;

  const categoryId = checkUuid(errors, 'categoryId', body.categoryId, { required: true });
  const paymentMethodId = checkUuid(errors, 'paymentMethodId', body.paymentMethodId);
  const userId = checkUuid(errors, 'userId', body.userId, { required: true });
  const tripId = checkUuid(errors, 'tripId', body.tripId);

  return result(errors, {
    description, amount, type, status, date, dueDate, paymentDate,
    categoryId, paymentMethodId, userId, tripId
  });
}

export function validateFinancing(body = {}) {
  const errors = [];

  const description = checkText(errors, 'description', body.description, { required: true });
  const installmentAmount = checkAmount(errors, 'installmentAmount', body.installmentAmount);

  const installments = Number(body.installments);
  if (!Number.isInteger(installments) || installments < 2 || installments > MAX_INSTALLMENTS) {
    errors.push(`installments: informe um número inteiro de 2 a ${MAX_INSTALLMENTS}.`);
  }

  const firstDueDate = checkDate(errors, 'firstDueDate', body.firstDueDate, todayISO());

  const earlyPayoffAmount = checkAmount(errors, 'earlyPayoffAmount', body.earlyPayoffAmount, { required: false });
  if (
    earlyPayoffAmount !== null && installmentAmount !== null && Number.isInteger(installments) &&
    earlyPayoffAmount > round2(installmentAmount * installments)
  ) {
    errors.push('earlyPayoffAmount: não pode ser maior que o valor total do financiamento.');
  }

  const creditor = checkText(errors, 'creditor', body.creditor);
  const categoryId = checkUuid(errors, 'categoryId', body.categoryId, { required: true });
  const paymentMethodId = checkUuid(errors, 'paymentMethodId', body.paymentMethodId);
  const userId = checkUuid(errors, 'userId', body.userId, { required: true });

  return result(errors, {
    description, installmentAmount, installments, firstDueDate,
    earlyPayoffAmount, creditor, categoryId, paymentMethodId, userId
  });
}

export function validatePayment(body = {}) {
  const errors = [];
  const paymentDate = checkDate(errors, 'paymentDate', body.paymentDate, todayISO());
  return result(errors, { paymentDate });
}

export function validateListFilters(query = {}) {
  const errors = [];
  const data = {};

  if (!isBlank(query.type)) {
    data.type = TYPE_ALIASES[token(query.type)];
    if (!data.type) errors.push('type: use INCOME ou EXPENSE.');
  }
  if (!isBlank(query.status)) {
    data.status = STATUS_ALIASES[token(query.status)];
    if (!data.status) errors.push('status: use PENDING ou PAID.');
  }

  data.from = checkDate(errors, 'from', query.from, null);
  data.to = checkDate(errors, 'to', query.to, null);
  if (data.from && data.to && data.from > data.to) errors.push('from: não pode ser depois de to.');

  data.categoryId = checkUuid(errors, 'categoryId', query.categoryId);
  data.userId = checkUuid(errors, 'userId', query.userId);

  const limit = isBlank(query.limit) ? DEFAULT_LIMIT : Number(query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    errors.push(`limit: informe um inteiro de 1 a ${MAX_LIMIT}.`);
  }
  const offset = isBlank(query.offset) ? 0 : Number(query.offset);
  if (!Number.isInteger(offset) || offset < 0) errors.push('offset: informe um inteiro maior ou igual a 0.');

  data.limit = limit;
  data.offset = offset;
  return result(errors, data);
}