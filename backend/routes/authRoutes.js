import { Router } from 'express';
import { cadastrarUsuario, loginUsuario } from '../controllers/usuarioController.js';
import authController from '../controllers/authController.js';
import emailController from '../controllers/emailController.js';

const router = Router();

router.post('/cadastro', cadastrarUsuario);
router.post('/login', emailController);
router.post('/login-email', emailController);
router.post('/login-google', authController);

export default router;