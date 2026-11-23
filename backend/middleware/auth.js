import jwt from 'jsonwebtoken';
import { SessionStoreError, validarSessaoFrotix } from '../services/sessionService.js';


export const PERFIS = { ADMIN: 1, GESTOR: 2, FINANCEIRO: 3, MOTORISTA: 4 };

const VALIDADE_TOKEN = '12h';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function segredo() {
  const valor = process.env.JWT_SECRET;
  if (!valor || valor.length < 32) {
    throw new Error('JWT_SECRET ausente ou curto demais (mínimo 32 caracteres) no .env do backend.');
  }
  return valor;
}


export function conferirConfiguracaoAuth() {
  segredo();
}


export function gerarToken(usuario, sessionId) {
  if (!usuario?.id || !UUID.test(sessionId || '')) {
    throw new Error('Usuário e identificador de sessão são obrigatórios para emitir o token.');
  }

  return jwt.sign(
    {
      sub: usuario.id,
      sid: sessionId,
      perfil: Number(usuario.id_perfil ?? usuario.perfil),
      nome: usuario.nome,
    },
    segredo(),
    { expiresIn: VALIDADE_TOKEN }
  );
}

function tokenDoCabecalho(req) {
  const cabecalho = req.headers.authorization || '';
  const [tipo, token] = cabecalho.split(' ');
  return tipo === 'Bearer' && token ? token : null;
}

function responderTokenInvalido(res, erro) {
  const expirou = erro?.name === 'TokenExpiredError';
  return res.status(401).json({
    sucesso: false,
    erro: expirou ? 'Sua sessão expirou. Entre novamente.' : 'Sessão inválida. Entre novamente.',
  });
}

async function autenticarRequisicao(req, res, next, somenteRevogacao = false) {
  const token = tokenDoCabecalho(req);
  if (!token) {
    return res.status(401).json({ sucesso: false, erro: 'Faça login para continuar.' });
  }

  let dados;
  try {
    dados = jwt.verify(
      token,
      segredo(),
      somenteRevogacao ? { ignoreExpiration: true } : undefined
    );
  } catch (erro) {
    return responderTokenInvalido(res, erro);
  }

  if (!dados || typeof dados !== 'object' || typeof dados.sub !== 'string') {
    return responderTokenInvalido(res);
  }

  if (somenteRevogacao) {
    req.usuario = {
      id: UUID.test(dados.sub) ? dados.sub : null,
      sid: UUID.test(dados.sid || '') ? dados.sid : null,
    };
    return next();
  }

  if (!UUID.test(dados.sub) || !UUID.test(dados.sid || '')) {
    return responderTokenInvalido(res);
  }

  try {
    const sessao = await validarSessaoFrotix(dados.sid, dados.sub);
    if (!sessao) return responderTokenInvalido(res);

    req.usuario = {
      id: sessao.userId,
      perfil: sessao.perfil,
      nome: sessao.nome,
      email: sessao.email,
      sid: sessao.sessionId,
    };
    req.sessao = { id: sessao.sessionId, expiresAt: sessao.expiresAt };
    return next();
  } catch (erro) {
    if (!(erro instanceof SessionStoreError)) {
      console.error('Erro inesperado ao validar a sessão:', erro);
    }
    return res.status(503).json({
      sucesso: false,
      erro: 'Não foi possível validar a sessão. Tente novamente.',
    });
  }
}


export function autenticar(req, res, next) {
  return autenticarRequisicao(req, res, next);
}


export function autenticarParaLogout(req, res, next) {
  return autenticarRequisicao(req, res, next, true);
}


export function exigirPerfil(...perfis) {
  return (req, res, next) => {
    if (!req.usuario || !perfis.includes(req.usuario.perfil)) {
      return res.status(403).json({ sucesso: false, erro: 'Seu perfil não tem acesso a esta função.' });
    }
    return next();
  };
}
