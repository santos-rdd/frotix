import { createSupabaseAuthClient } from '../database/db.js';
import {
  revogarSessoesFrotixDoUsuario,
  SessionStoreError,
} from '../services/sessionService.js';

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RESPOSTA_RECUPERACAO = {
  sucesso: true,
  mensagem: 'Se houver uma conta associada a este e-mail, você receberá as instruções de recuperação.',
};

const erroDeContaInexistente = (error) =>
  error?.status === 404 ||
  ['user_not_found', 'email_not_found'].includes(String(error?.code || '').toLowerCase()) ||
  /user (not found|does not exist)/i.test(String(error?.message || ''));

export async function solicitarRecuperacaoSenha(req, res) {
  const email = typeof req.body?.email === 'string'
    ? req.body.email.trim().toLowerCase()
    : '';
  if (!EMAIL_VALIDO.test(email)) {
    return res.status(400).json({
      sucesso: false,
      mensagem: 'Informe um endereço de e-mail válido.',
    });
  }

  try {
    const authClient = createSupabaseAuthClient();
    const { error } = await authClient.auth.resetPasswordForEmail(email, {
      redirectTo: process.env.PASSWORD_RECOVERY_REDIRECT_URL || 'frotix://auth/recovery',
    });
    if (error && !erroDeContaInexistente(error)) {
      return res.status(503).json({
        sucesso: false,
        mensagem: 'Não foi possível solicitar a recuperação agora. Tente novamente mais tarde.',
      });
    }
    return res.status(202).json(RESPOSTA_RECUPERACAO);
  } catch {
    return res.status(503).json({
      sucesso: false,
      mensagem: 'Não foi possível solicitar a recuperação agora. Tente novamente mais tarde.',
    });
  }
}

export async function redefinirSenha(req, res) {
  const { token_hash: tokenHash, access_token: accessToken, refresh_token: refreshToken } = req.body || {};
  const senha = req.body?.password;
  const usaTokenHash = typeof tokenHash === 'string' && tokenHash.length > 0;
  const usaSessaoSupabase =
    typeof accessToken === 'string' &&
    accessToken.length > 0 &&
    typeof refreshToken === 'string' &&
    refreshToken.length > 0;

  if ((!usaTokenHash && !usaSessaoSupabase) || typeof senha !== 'string' || senha.length < 6) {
    return res.status(400).json({
      sucesso: false,
      mensagem: 'Link inválido ou senha fora dos requisitos.',
    });
  }

  try {
    const authClient = createSupabaseAuthClient();
    const verificacao = usaTokenHash
      ? await authClient.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' })
      : await authClient.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

    const usuarioVerificado = verificacao.data?.user || verificacao.data?.session?.user;
    if (verificacao.error || !usuarioVerificado?.id) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'O link de recuperação é inválido, expirou ou já foi utilizado.',
      });
    }

    await revogarSessoesFrotixDoUsuario(usuarioVerificado.id);

    const { error } = await authClient.auth.updateUser({ password: senha });
    if (error) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'Não foi possível redefinir a senha. Solicite um novo link de recuperação.',
      });
    }

    return res.json({
      sucesso: true,
      mensagem: 'Senha redefinida. Entre novamente com a senha atualizada.',
    });
  } catch (error) {
    if (error instanceof SessionStoreError) {
      return res.status(503).json({
        sucesso: false,
        mensagem: 'Não foi possível encerrar as sessões anteriores. Tente novamente.',
      });
    }
    return res.status(503).json({
      sucesso: false,
      mensagem: 'Não foi possível concluir a recuperação agora. Solicite um novo link.',
    });
  }
}
