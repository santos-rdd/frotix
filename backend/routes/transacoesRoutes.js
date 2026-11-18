import { Router } from 'express';
import transacoesController from '../controllers/transacoesController.js';

const router = Router();

router.post('/transacoes', transacoesController.cadastrarTransacao);
router.get('/financiamentos/:id/parcelas-pendentes', transacoesController.listarParcelasPendentes);
router.get('/resumo-geral', transacoesController.obterResumoGeral);
router.get('/resumo', transacoesController.obterResumoGeral);
router.get('/visao-geral-frota', transacoesController.obterVisaoGeralFrota);
router.get('/despesas-frota', transacoesController.obterVisaoGeralFrota);

export default router;
