import { Router } from 'express';
import { receberArquivo, enviarComprovante, linkComprovante } from '../controllers/comprovantesController.js';
import { autenticar } from '../middleware/auth.js';

const router = Router();
router.use(autenticar);

router.post('/upload', receberArquivo, enviarComprovante);
router.get('/link', linkComprovante);

export default router;
