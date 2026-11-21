import { Router } from 'express';
import transacoesController from '../controllers/transacoesController.js';
import * as financeiro from '../controllers/financeiroController.js';
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

// Extrato: Admin e Financeiro veem tudo; os outros perfis, só os próprios lançamentos.
router.get('/lancamentos', financeiro.listarLancamentos);
router.get('/viagens-vinculo', financeiro.listarViagensParaVinculo);

// Rollback e pagamentos: só Admin e Financeiro.
const financas = exigirPerfil(ADMIN, FINANCEIRO);
router.post('/lancamentos/:id/estornar', financas, financeiro.estornarLancamento);
router.post('/lancamentos/:id/pagar', financas, financeiro.pagarLancamento);
router.post('/lancamentos/:id/desfazer-pagamento', financas, financeiro.desfazerPagamento);

router.get('/dividas', financas, financeiro.listarDividas);
router.get('/dividas/:id', financas, financeiro.detalharDivida);
router.post('/dividas/:id/cancelar', financas, financeiro.cancelarDivida);

router.get('/previsao', financas, financeiro.obterPrevisao);
router.get('/fluxo-mensal', financas, financeiro.obterFluxoMensal);

export default router;
