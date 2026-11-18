import { Router } from 'express';
import { obterViagensEmAndamento } from '../controllers/usuarioController.js';

const router = Router();

router.get('/viagens-andamento', obterViagensEmAndamento);
router.get('/viagens', obterViagensEmAndamento);

export default router;