import { Router } from 'express';
import { cadastrarUsuario, obterViagensEmAndamento } from '../controllers/usuarioController.js';

const router = Router();

router.post('/usuarios', cadastrarUsuario);
router.get('/viagens-andamento', obterViagensEmAndamento);
router.get('/viagens', obterViagensEmAndamento);

export default router;