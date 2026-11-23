import { Router } from 'express';
import * as frota from '../controllers/frotaController.js';
import { autenticar, exigirPerfil, PERFIS } from '../middleware/auth.js';

const { ADMIN, GESTOR, FINANCEIRO, MOTORISTA } = PERFIS;
const gestao = exigirPerfil(ADMIN, GESTOR);
const frotaAcesso = exigirPerfil(ADMIN, GESTOR, MOTORISTA);

const router = Router();
router.use(autenticar);

router.get('/veiculos', frotaAcesso, frota.listarVeiculos);
router.post('/veiculos', gestao, frota.cadastrarVeiculo);


router.get('/rotas', frotaAcesso, frota.listarRotas);
router.post('/rotas', gestao, frota.cadastrarRota);
router.post('/rotas/:id/abrir', frotaAcesso, frota.abrirViagem);
router.post('/rotas/:id/concluir', frotaAcesso, frota.concluirViagem);
router.get('/viagens-andamento', frotaAcesso, frota.listarViagensEmAndamento);
router.post('/rotas/:id/posicoes', exigirPerfil(MOTORISTA), frota.registrarPosicoesViagem);
router.get('/posicoes', exigirPerfil(ADMIN, GESTOR), frota.listarPosicoesViagem);
router.get('/motoristas', gestao, frota.listarMotoristas);

router.get('/manutencoes', gestao, frota.listarManutencoes);
router.post('/manutencoes', gestao, frota.agendarManutencao);
router.post('/manutencoes/:id/avancar', gestao, frota.avancarManutencao);

router.get('/resumo', exigirPerfil(ADMIN, GESTOR, FINANCEIRO), frota.resumoFrota);
router.get('/relatorio', exigirPerfil(ADMIN, GESTOR, FINANCEIRO), frota.relatorio);

export default router;
