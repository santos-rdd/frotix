import { Router } from 'express';
import { listarAlertas } from '../controllers/financeiroController.js';
import { autenticar, exigirPerfil, PERFIS } from '../middleware/auth.js';

const { ADMIN, GESTOR, FINANCEIRO } = PERFIS;
const router = Router();

// Alertas automáticos: financeiros (Admin/Financeiro) e de frota (Admin/Gestor).
router.get('/', autenticar, exigirPerfil(ADMIN, GESTOR, FINANCEIRO), listarAlertas);

export default router;
