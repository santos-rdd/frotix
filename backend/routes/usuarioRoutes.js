import { Router } from 'express';
import { obterViagensEmAndamento, listarUsuarios } from '../controllers/usuarioController.js';
import { autenticar } from '../middleware/auth.js';

const router = Router();

router.use(autenticar);
router.get('/listar', listarUsuarios);
router.get('/viagens-andamento', obterViagensEmAndamento);
router.get('/viagens', obterViagensEmAndamento);

export default router;