import { Router } from 'express';
import transacoesController from '../controllers/transacoesController.js';
import { autenticar } from '../middleware/auth.js';

const router = Router();


router.get('/atividades-recentes', autenticar, transacoesController.listarAtividadesRecentes);

export default router;
