import { Router } from 'express';
import transacoesController from '../controllers/transacoesController.js';

const router = Router();

router.get('/resumo-geral', transacoesController.obterResumoGeral);
router.get('/atividades-recentes', transacoesController.listarAtividadesRecentes);
router.get('/visao-geral-frota', transacoesController.obterVisaoGeralFrota);
router.get('/despesas-frota', transacoesController.obterVisaoGeralFrota);
router.get('/', transacoesController.obterResumoGeral);

export default router;
