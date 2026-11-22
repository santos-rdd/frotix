import jwt from 'jsonwebtoken';
import { SessionStoreError, validarSessaoFrotix } from '../services/sessionService.js';

// Perfis (tabela perfis): 1 = Admin, 2 = Gestor de Frota, 3 = Financeiro, 4 = Motorista.
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

// Confere o segredo ao subir o servidor, para o erro aparecer logo no deploy.
export function conferirConfiguracaoAuth() {
  segredo();
}

/** Gera o JWT de acesso associado a uma sessão individual do Frotix. */
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

/** Verifica JWT, sessão ativa e perfil atual antes de liberar endpoints protegidos. */
export function autenticar(req, res, next) {
  return autenticarRequisicao(req, res, next);
}

/** Permite somente revogar o sid assinado, inclusive após expiração ou revogação. */
export function autenticarParaLogout(req, res, next) {
  return autenticarRequisicao(req, res, next, true);
}

/** Libera a rota só para os perfis informados. Usar depois de autenticar. */
export function exigirPerfil(...perfis) {
  return (req, res, next) => {
    if (!req.usuario || !perfis.includes(req.usuario.perfil)) {
      return res.status(403).json({ sucesso: false, erro: 'Seu perfil não tem acesso a esta função.' });
    }
    return next();
  };
}
