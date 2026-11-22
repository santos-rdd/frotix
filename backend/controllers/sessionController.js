import {
  rotacionarRefreshToken,
  revogarSessaoFrotix,
  SessionStoreError,
} from '../services/sessionService.js';
import { criarRespostaAutenticada } from '../utils/authResponse.js';

export async function renovarSessao(req, res) {
  const refreshToken = req.body?.refresh_token;
  if (typeof refreshToken !== 'string') {
    return res.status(401).json({ sucesso: false, erro: 'Refresh token inválido ou expirado.' });
  }

  try {
    const sessao = await rotacionarRefreshToken(refreshToken);
    if (!sessao) {
      return res.status(401).json({ sucesso: false, erro: 'Refresh token inválido ou expirado.' });
    }

    const usuario = {
      id: sessao.userId,
      email: sessao.email,
      nome: sessao.nome,
      id_perfil: sessao.perfil,
    };

    return res.json({
      mensagem: 'Sessão renovada.',
      ...criarRespostaAutenticada(usuario, sessao),
    });
  } catch (erro) {
    if (erro instanceof SessionStoreError) {
      return res.status(503).json({
        sucesso: false,
        erro: 'Não foi possível validar a sessão. Tente novamente.',
      });
    }
    console.error('Erro inesperado ao renovar a sessão:', erro);
    return res.status(500).json({ sucesso: false, erro: 'Erro interno no servidor.' });
  }
}

export async function encerrarSessao(req, res) {
  if (!req.usuario?.id || !req.usuario.sid) {
    return res.sendStatus(204);
  }

  try {
    await revogarSessaoFrotix(req.usuario.sid, req.usuario.id);
    return res.sendStatus(204);
  } catch (erro) {
    if (!(erro instanceof SessionStoreError)) {
      console.error('Erro inesperado ao revogar a sessão:', erro);
    }
    return res.status(503).json({
      sucesso: false,
      erro: 'Não foi possível encerrar a sessão. Tente novamente.',
    });
  }
}

export function consultarSessao(req, res) {
  return res.json({
    sucesso: true,
    usuario: {
      id: req.usuario.id,
      email: req.usuario.email,
      nome: req.usuario.nome,
      role: req.usuario.perfil,
    },
    sessao: {
      session_id: req.sessao.id,
      session_expires_at: req.sessao.expiresAt,
    },
  });
}
