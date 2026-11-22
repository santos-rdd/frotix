import { createHash, randomBytes, randomUUID } from 'node:crypto';
import supabase from '../database/db.js';

const HASH_HEX = /^[0-9a-f]{64}$/;

export class SessionStoreError extends Error {
  constructor(message = 'Não foi possível validar a sessão.') {
    super(message);
    this.name = 'SessionStoreError';
  }
}

export class SessionUserInactiveError extends Error {
  constructor() {
    super('Esta conta está desativada.');
    this.name = 'SessionUserInactiveError';
  }
}

const hashRefreshToken = (token) =>
  createHash('sha256').update(token, 'utf8').digest('hex');

const resultadoRpc = (data) => Array.isArray(data) ? data[0] : data;

const chamarRpc = async (nome, parametros) => {
  let resposta;
  try {
    resposta = await supabase.rpc(nome, parametros);
  } catch {
    throw new SessionStoreError();
  }
  if (!resposta || resposta.error) throw new SessionStoreError();
  return resultadoRpc(resposta.data);
};

const credencialAtiva = (resultado) =>
  resultado?.status === 'active' &&
  resultado.session_id &&
  resultado.user_id &&
  Number.isInteger(Number(resultado.perfil)) &&
  Number(resultado.perfil) > 0;

const sessaoDaResposta = (resultado, refreshToken) => ({
  sessionId: resultado.session_id,
  userId: resultado.user_id,
  perfil: Number(resultado.perfil),
  nome: resultado.nome,
  email: resultado.email,
  expiresAt: resultado.expires_at,
  refreshToken,
});

export async function criarSessaoFrotix(userId) {
  const sessionId = randomUUID();
  const refreshToken = randomBytes(32).toString('hex');
  const resultado = await chamarRpc('frotix_criar_sessao', {
    p_session_id: sessionId,
    p_user_id: userId,
    p_refresh_token_hash: hashRefreshToken(refreshToken),
  });

  if (!credencialAtiva(resultado)) {
    if (resultado?.status === 'user_inactive') {
      throw new SessionUserInactiveError();
    }
    throw new SessionStoreError('Não foi possível criar uma sessão ativa.');
  }

  return sessaoDaResposta(resultado, refreshToken);
}

export async function validarSessaoFrotix(sessionId, userId) {
  if (typeof sessionId !== 'string' || typeof userId !== 'string') {
    return null;
  }

  const resultado = await chamarRpc('frotix_validar_sessao', {
    p_session_id: sessionId,
    p_user_id: userId,
  });

  if (!credencialAtiva(resultado)) return null;
  return sessaoDaResposta(resultado, null);
}

export async function rotacionarRefreshToken(refreshToken) {
  if (typeof refreshToken !== 'string' || !HASH_HEX.test(refreshToken)) {
    return null;
  }

  const novoRefreshToken = randomBytes(32).toString('hex');
  const resultado = await chamarRpc('frotix_rotacionar_refresh', {
    p_refresh_token_hash: hashRefreshToken(refreshToken),
    p_novo_refresh_token_hash: hashRefreshToken(novoRefreshToken),
  });

  if (!credencialAtiva(resultado)) return null;
  return sessaoDaResposta(resultado, novoRefreshToken);
}

export async function revogarSessaoFrotix(sessionId, userId) {
  if (typeof sessionId !== 'string' || typeof userId !== 'string') return;

  await chamarRpc('frotix_revogar_sessao', {
    p_session_id: sessionId,
    p_user_id: userId,
  });
}

export async function revogarSessoesFrotixDoUsuario(userId) {
  if (typeof userId !== 'string' || !userId) {
    throw new SessionStoreError('Não foi possível identificar o usuário da sessão.');
  }

  const resultado = await chamarRpc('frotix_revogar_sessoes_usuario', {
    p_user_id: userId,
  });
  if (resultado?.status !== 'revoked') {
    throw new SessionStoreError('Não foi possível invalidar as sessões anteriores.');
  }
}

export function criarObjetoSessaoApi(sessao, accessToken) {
  const partes = accessToken.split('.');
  let claims;
  try {
    claims = JSON.parse(Buffer.from(partes[1], 'base64url').toString('utf8'));
  } catch {
    throw new SessionStoreError('Não foi possível preparar a resposta da sessão.');
  }

  if (!Number.isInteger(claims.exp)) {
    throw new SessionStoreError('O token de acesso não possui expiração válida.');
  }

  return {
    session_id: sessao.sessionId,
    access_token: accessToken,
    refresh_token: sessao.refreshToken,
    expires_at: claims.exp,
    session_expires_at: sessao.expiresAt,
  };
}
