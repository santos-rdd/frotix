import { Router } from 'express';
import { cadastrarUsuario } from '../controllers/usuarioController.js';

const router = Router();

router.post('/usuarios', cadastrarUsuario);

export default router;