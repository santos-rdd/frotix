const TRANSACTION_TYPES = ['ENTRADA', 'SAIDA'];
const TRANSACTION_STATUSES = ['PENDENTE', 'PAGO'];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isUuid = (value) => typeof value === 'string' && UUID_REGEX.test(value);

const isPositiveNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
};

const isInteger = (value) => Number.isInteger(Number(value));

const isNonEmptyString = (value) =>
  typeof value === 'string' && value.trim().length > 0;

const isValidDate = (value) => {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
};

const isEmpty = (value) => value === undefined || value === null || value === '';

export function validateTransaction(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return ['Dados da transação inválidos.'];
  }

  if (!isNonEmptyString(data.description)) {
    errors.push('A descrição é obrigatória.');
  }

  if (!isPositiveNumber(data.amount)) {
    errors.push('O valor da movimentação deve ser um número maior que zero.');
  }

  if (!TRANSACTION_TYPES.includes(data.type)) {
    errors.push("O tipo deve ser 'ENTRADA' (Receita) ou 'SAIDA' (Despesa).");
  }

  if (!isUuid(data.category)) {
    errors.push('A categoria é obrigatória e deve ser válida.');
  }

  if (!isUuid(data.paymentMethod)) {
    errors.push('A forma de pagamento é obrigatória e deve ser válida.');
  }

  if (!isValidDate(data.dueDate)) {
    errors.push('A data de vencimento é obrigatória e deve estar no formato AAAA-MM-DD.');
  }

  if (!isEmpty(data.status) && !TRANSACTION_STATUSES.includes(data.status)) {
    errors.push("O status deve ser 'PENDENTE' ou 'PAGO'.");
  }

  if (data.status === 'PAGO' && !isValidDate(data.paymentDate)) {
    errors.push("Para transações 'PAGAS', a data de pagamento é obrigatória (AAAA-MM-DD).");
  }

  if (!isEmpty(data.tripId) && !isUuid(data.tripId)) {
    errors.push('A viagem informada é inválida.');
  }

  return errors;
}

export function validateFinancing(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return ['Dados do financiamento inválidos.'];
  }

  if (!isNonEmptyString(data.description)) {
    errors.push('A descrição do financiamento é obrigatória.');
  }

  if (!isPositiveNumber(data.installmentAmount)) {
    errors.push('O valor da parcela deve ser um número maior que zero.');
  }

  if (!isInteger(data.totalInstallments) || Number(data.totalInstallments) < 2) {
    errors.push('A quantidade de parcelas deve ser um número inteiro maior que 1.');
  }

  if (!isValidDate(data.firstDueDate)) {
    errors.push('A data de vencimento da 1ª parcela é obrigatória (AAAA-MM-DD).');
  }

  if (!isPositiveNumber(data.payoffAmount)) {
    errors.push('O valor para quitação antecipada é obrigatório e deve ser maior que zero.');
  }

  if (!isUuid(data.category)) {
    errors.push('A categoria é obrigatória e deve ser válida.');
  }

  if (!isUuid(data.paymentMethod)) {
    errors.push('A forma de pagamento é obrigatória e deve ser válida.');
  }

  return errors;
}