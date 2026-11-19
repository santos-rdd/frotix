import { Router } from 'express';
import * as frota from '../controllers/frotaController.js';
import { autenticar, exigirPerfil, PERFIS } from '../middleware/auth.js';

const { ADMIN, GESTOR, FINANCEIRO, MOTORISTA } = PERFIS;
const gestao = exigirPerfil(ADMIN, GESTOR);

const router = Router();
router.use(autenticar);

router.get('/veiculos', frota.listarVeiculos);
router.post('/veiculos', gestao, frota.cadastrarVeiculo);

// Rotas = viagens planejadas. O motorista só vê e mexe nas dele (o controller filtra).
router.get('/rotas', frota.listarRotas);
router.post('/rotas', gestao, frota.cadastrarRota);
router.post('/rotas/:id/abrir', exigirPerfil(ADMIN, GESTOR, MOTORISTA), frota.abrirViagem);
router.post('/rotas/:id/concluir', exigirPerfil(ADMIN, GESTOR, MOTORISTA), frota.concluirViagem);
router.get('/viagens-andamento', frota.listarViagensEmAndamento);
router.get('/motoristas', gestao, frota.listarMotoristas);

router.get('/manutencoes', gestao, frota.listarManutencoes);
router.post('/manutencoes', gestao, frota.agendarManutencao);
router.post('/manutencoes/:id/avancar', gestao, frota.avancarManutencao);

router.get('/resumo', exigirPerfil(ADMIN, GESTOR, FINANCEIRO), frota.resumoFrota);
router.get('/relatorio', exigirPerfil(ADMIN, GESTOR, FINANCEIRO), frota.relatorio);

export default router;
