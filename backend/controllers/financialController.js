import fs from 'fs/promises';
import financialService, { ValidationError } from '../services/financialService.js';

const getUserId = (req) => req.user?.id;

const removeUpload = async (file) => {
  if (file?.path) await fs.unlink(file.path).catch(() => {});
};

function handleError(res, err) {
  if (err instanceof ValidationError) {
    return res.status(400).json({ errors: err.errors });
  }
  console.error(err);
  return res.status(500).json({ error: 'Erro interno do servidor.' });
}

class FinancialController {
  async createTransaction(req, res) {
    try {
      const userId = getUserId(req);
      if (!userId) {
        await removeUpload(req.file);
        return res.status(401).json({ error: 'Usuário não autenticado.' });
      }

      const result = await financialService.createTransaction(req.body, req.file, userId);
      return res.status(201).json(result);
    } catch (err) {
      await removeUpload(req.file);
      return handleError(res, err);
    }
  }

  async createFinancing(req, res) {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'Usuário não autenticado.' });
      }

      const result = await financialService.createFinancing(req.body, userId);
      return res.status(201).json(result);
    } catch (err) {
      return handleError(res, err);
    }
  }

  async getSummary(req, res) {
    try {
      const result = await financialService.getSummary();
      return res.json(result);
    } catch (err) {
      return handleError(res, err);
    }
  }
}

export default new FinancialController();