import { Router } from 'express';
import { obterViagensEmAndamento, listarUsuarios } from '../controllers/usuarioController.js';

const router = Router();

router.get('/listar', listarUsuarios);
router.get('/viagens-andamento', obterViagensEmAndamento);
router.get('/viagens', obterViagensEmAndamento);

export default router;