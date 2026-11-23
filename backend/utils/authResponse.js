import { gerarToken } from '../middleware/auth.js';
import { criarObjetoSessaoApi } from '../services/sessionService.js';

export function criarRespostaAutenticada(usuario, sessao) {
  const perfilAtual = Number(sessao.perfil);
  const usuarioAutenticado = {
    ...usuario,
    id_perfil: perfilAtual,
    perfil: perfilAtual,
  };
  const token = gerarToken(usuarioAutenticado, sessao.sessionId);
  const usuarioResposta = {
    id: usuario.id,
    email: usuario.email,
    nome: usuario.nome,
    name: usuario.nome,
    role: perfilAtual,
  };
  if (typeof usuario.imagem === 'string' && usuario.imagem.trim()) {
    usuarioResposta.imagem = usuario.imagem;
  }

  return {
    token,
    usuario: usuarioResposta,
    sessao: criarObjetoSessaoApi(sessao, token),
  };
}
