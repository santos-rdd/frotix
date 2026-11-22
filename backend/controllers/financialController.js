import financialService, { AppError } from '../services/financialService.js';
import {
  validateTransaction,
  validateFinancing,
  validatePayment,
  validateListFilters,
  isUuid
} from '../validators/financialValidator.js';
import { PERFIS } from '../middleware/auth.js';

const PERFIS_VISUALIZACAO_GLOBAL = new Set([PERFIS.ADMIN, PERFIS.FINANCEIRO]);

const invalid = (res, errors) =>
  res.status(400).json({ sucesso: false, mensagem: 'Dados inválidos.', erros: errors });

const fail = (res, error) => {
  if (error instanceof AppError) {
    return res.status(error.status).json({ sucesso: false, mensagem: error.message });
  }
  console.error('Erro inesperado no módulo financeiro:', error);
  return res.status(500).json({ sucesso: false, mensagem: 'Erro interno no módulo financeiro.' });
};

const bodyOf = (req) => ({ ...(req.body ?? {}), userId: req.usuario.id });

const idParam = (req, res) => {
  if (isUuid(req.params.id)) return req.params.id;
  invalid(res, ['id: identificador inválido.']);
  return null;
};

async function createTransaction(req, res) {
  const { valid, errors, data } = validateTransaction(bodyOf(req));
  if (!valid) return invalid(res, errors);
  try {
    const transaction = await financialService.createTransaction(data, req.file, req.usuario);
    return res.status(201).json({ sucesso: true, mensagem: 'Lançamento cadastrado com sucesso.', dados: transaction });
  } catch (error) {
    return fail(res, error);
  }
}

async function listTransactions(req, res) {
  const { valid, errors, data } = validateListFilters(req.query);
  if (!valid) return invalid(res, errors);
  try {
    return res.json({
      sucesso: true,
      dados: await financialService.listTransactions(data, req.usuario),
    });
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
    const transaction = await financialService.markAsPaid(id, data.paymentDate, req.usuario);
    return res.json({ sucesso: true, mensagem: 'Pagamento registrado.', dados: transaction });
  } catch (error) {
    return fail(res, error);
  }
}

async function createFinancing(req, res) {
  const { valid, errors, data } = validateFinancing(bodyOf(req));
  if (!valid) return invalid(res, errors);
  try {
    const financing = await financialService.createFinancing(data, req.usuario);
    return res.status(201).json({ sucesso: true, mensagem: 'Financiamento e parcelas cadastrados com sucesso.', dados: financing });
  } catch (error) {
    return fail(res, error);
  }
}

async function getFinancing(req, res) {
  const id = idParam(req, res);
  if (!id) return undefined;
  try {
    return res.json({
      sucesso: true,
      dados: await financialService.listInstallments(id, req.usuario),
    });
  } catch (error) {
    return fail(res, error);
  }
}

async function getCashProjection(req, res) {
  if (!PERFIS_VISUALIZACAO_GLOBAL.has(req.usuario.perfil)) {
    return res.status(403).json({ sucesso: false, mensagem: 'Seu perfil não pode consultar a projeção financeira.' });
  }

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