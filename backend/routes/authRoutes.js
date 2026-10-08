import { Router } from 'express';
import authController from '../controllers/authController.js';
import emailController from '../controllers/emailController.js';

const router = Router();

router.post('/login-google', authController);
router.post('/login-email', emailController);

export default router;