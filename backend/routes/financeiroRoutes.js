import { Router } from 'express';
import transacoesController from '../controllers/transacoesController.js';
import { autenticar, exigirPerfil, PERFIS } from '../middleware/auth.js';

const { ADMIN, FINANCEIRO } = PERFIS;
const router = Router();

router.use(autenticar);

// Qualquer perfil logado registra entradas, saídas e dívidas (o motorista lança despesas da viagem).
router.post('/transacoes', transacoesController.cadastrarTransacao);

// Números da empresa toda: só Admin e Financeiro.
router.get('/resumo-geral', exigirPerfil(ADMIN, FINANCEIRO), transacoesController.obterResumoGeral);
router.get('/visao-geral-frota', exigirPerfil(ADMIN, FINANCEIRO), transacoesController.obterVisaoGeralFrota);
router.get('/financiamentos/:id/parcelas-pendentes', exigirPerfil(ADMIN, FINANCEIRO), transacoesController.listarParcelasPendentes);

export default router;
