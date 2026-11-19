import { Router } from 'express';
import * as cadastros from '../controllers/cadastrosController.js';
import { autenticar, exigirPerfil, PERFIS } from '../middleware/auth.js';

const { ADMIN, FINANCEIRO } = PERFIS;
const soFinanceiro = exigirPerfil(ADMIN, FINANCEIRO);

export const categoriasRoutes = Router()
  .use(autenticar)
  .get('/', cadastros.listarCategorias)
  .post('/', soFinanceiro, cadastros.criarCategoria)
  .delete('/:id', soFinanceiro, cadastros.removerCategoria);

export const formasRoutes = Router()
  .use(autenticar)
  .get('/', cadastros.listarFormas)
  .post('/', soFinanceiro, cadastros.criarForma)
  .delete('/:id', soFinanceiro, cadastros.removerForma);

// Gerenciador de usuários: Admin e Financeiro (decisão da equipe em 19/11/2026).
export const usuariosRoutes = Router()
  .use(autenticar, soFinanceiro)
  .get('/', cadastros.listarUsuarios)
  .post('/google', cadastros.criarUsuarioGoogle)
  .put('/:id', cadastros.atualizarUsuario)
  .delete('/:id', cadastros.desativarUsuario);
