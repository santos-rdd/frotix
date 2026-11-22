import { Router } from 'express';
import transacoesController from '../controllers/transacoesController.js';
import * as financeiro from '../controllers/financeiroController.js';
import { autenticar, exigirPerfil, PERFIS } from '../middleware/auth.js';

const { ADMIN, FINANCEIRO } = PERFIS;
const router = Router();

router.use(autenticar);

// Qualquer perfil logado registra entradas, saídas e dívidas (o motorista lança despesas da viagem).
router.post('/transacoes', transacoesController.cadastrarTransacao);

// O backend limita motorista e gestor aos próprios lançamentos e dívidas.
router.get('/lancamentos', financeiro.listarLancamentos);
router.get('/dividas', financeiro.listarDividas);
router.get('/dividas/:id', financeiro.detalharDivida);

// Números da empresa toda: só Admin e Financeiro.
router.get('/resumo-geral', exigirPerfil(ADMIN, FINANCEIRO), transacoesController.obterResumoGeral);
router.get('/visao-geral-frota', exigirPerfil(ADMIN, FINANCEIRO), transacoesController.obterVisaoGeralFrota);
router.get('/financiamentos/:id/parcelas-pendentes', exigirPerfil(ADMIN, FINANCEIRO), transacoesController.listarParcelasPendentes);

export default router;
