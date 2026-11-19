import { Router } from 'express';
import transacoesController from '../controllers/transacoesController.js';
import { autenticar } from '../middleware/auth.js';

const router = Router();

// Admin e Financeiro veem a empresa toda; os outros perfis só os próprios lançamentos.
router.get('/atividades-recentes', autenticar, transacoesController.listarAtividadesRecentes);

export default router;
