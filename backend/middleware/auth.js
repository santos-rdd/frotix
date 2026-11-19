import jwt from 'jsonwebtoken';

// Perfis (tabela perfis): 1 = Admin, 2 = Gestor de Frota, 3 = Financeiro, 4 = Motorista.
export const PERFIS = { ADMIN: 1, GESTOR: 2, FINANCEIRO: 3, MOTORISTA: 4 };

const VALIDADE_TOKEN = '12h';

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

/** Gera o token de sessão do Frotix para um usuário da tabela usuarios. */
export function gerarToken(usuario) {
  return jwt.sign(
    { sub: usuario.id, perfil: Number(usuario.id_perfil), nome: usuario.nome },
    segredo(),
    { expiresIn: VALIDADE_TOKEN }
  );
}

/**
 * Exige o cabeçalho "Authorization: Bearer <token>".
 * Em caso de sucesso, deixa req.usuario = { id, perfil, nome }.
 */
export function autenticar(req, res, next) {
  const cabecalho = req.headers.authorization || '';
  const [tipo, token] = cabecalho.split(' ');

  if (tipo !== 'Bearer' || !token) {
    return res.status(401).json({ sucesso: false, erro: 'Faça login para continuar.' });
  }

  try {
    const dados = jwt.verify(token, segredo());
    req.usuario = { id: dados.sub, perfil: Number(dados.perfil), nome: dados.nome };
    return next();
  } catch (erro) {
    const expirou = erro.name === 'TokenExpiredError';
    return res.status(401).json({
      sucesso: false,
      erro: expirou ? 'Sua sessão expirou. Entre novamente.' : 'Sessão inválida. Entre novamente.',
    });
  }
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
