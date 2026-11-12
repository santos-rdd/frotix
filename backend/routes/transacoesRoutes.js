import { Router } from 'express';
import transacoesController from '../controllers/transacoesController.js';

const router = Router();

router.post('/transacoes', transacoesController.cadastrarTransacao);
router.get('/financiamentos/:id/parcelas-pendentes', transacoesController.listarParcelasPendentes);

export default router;