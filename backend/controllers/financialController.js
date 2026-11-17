import financialService, { AppError } from '../services/financialService.js';
import {
  validateTransaction,
  validateFinancing,
  validatePayment,
  validateListFilters,
  isUuid
} from '../validators/financialValidator.js';

const invalid = (res, errors) =>
  res.status(400).json({ sucesso: false, mensagem: 'Dados inválidos.', erros: errors });

const fail = (res, error) => {
  if (error instanceof AppError) {
    return res.status(error.status).json({ sucesso: false, mensagem: error.message });
  }
  console.error('Erro inesperado no módulo financeiro:', error);
  return res.status(500).json({ sucesso: false, mensagem: 'Erro interno no módulo financeiro.' });
};

const bodyOf = (req) => ({ ...(req.body ?? {}), userId: req.user?.id ?? req.body?.userId });

const idParam = (req, res) => {
  if (isUuid(req.params.id)) return req.params.id;
  invalid(res, ['id: identificador inválido.']);
  return null;
};

async function createTransaction(req, res) {
  const { valid, errors, data } = validateTransaction(bodyOf(req));
  if (!valid) return invalid(res, errors);
  try {
    const transaction = await financialService.createTransaction(data, req.file);
    return res.status(201).json({ sucesso: true, mensagem: 'Lançamento cadastrado com sucesso.', dados: transaction });
  } catch (error) {
    return fail(res, error);
  }
}

async function listTransactions(req, res) {
  const { valid, errors, data } = validateListFilters(req.query);
  if (!valid) return invalid(res, errors);
  try {
    return res.json({ sucesso: true, dados: await financialService.listTransactions(data) });
  } catch (error) {
    return fail(res, error);
  }
}

async function payTransaction(req, res) {
  const id = idParam(req, res);
  if (!id) return undefined;
  const { valid, errors, data } = validatePayment(req.body ?? {});
  if (!valid) return invalid(res, errors);
  try {
    const transaction = await financialService.markAsPaid(id, data.paymentDate);
    return res.json({ sucesso: true, mensagem: 'Pagamento registrado.', dados: transaction });
  } catch (error) {
    return fail(res, error);
  }
}

async function createFinancing(req, res) {
  const { valid, errors, data } = validateFinancing(bodyOf(req));
  if (!valid) return invalid(res, errors);
  try {
    const financing = await financialService.createFinancing(data);
    return res.status(201).json({ sucesso: true, mensagem: 'Financiamento e parcelas cadastrados com sucesso.', dados: financing });
  } catch (error) {
    return fail(res, error);
  }
}

async function getFinancing(req, res) {
  const id = idParam(req, res);
  if (!id) return undefined;
  try {
    return res.json({ sucesso: true, dados: await financialService.listInstallments(id) });
  } catch (error) {
    return fail(res, error);
  }
}

async function getCashProjection(req, res) {
  try {
    return res.json({ sucesso: true, dados: await financialService.getCashProjection() });
  } catch (error) {
    return fail(res, error);
  }
}

export default {
  createTransaction,
  listTransactions,
  payTransaction,
  createFinancing,
  getFinancing,
  getCashProjection
};