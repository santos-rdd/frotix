import supabase from '../database/db.js';
import { PERFIS } from '../middleware/auth.js';

function erroInterno(res, contexto, erro) {
  console.error(`Erro ao ${contexto}:`, erro);
  return res.status(500).json({ sucesso: false, erro: `Erro interno ao ${contexto}.` });
}

const normalizar = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

// -----------------------------------------------------------------------------
// Categorias financeiras (erro P4: o app usava categorias de exemplo)
// -----------------------------------------------------------------------------

const montarCategoria = (c) => ({ id: c.id, nome: c.nome, tipo: String(c.tipo).toLowerCase() });

export async function listarCategorias(req, res) {
  try {
    const { data, error } = await supabase
      .from('categorias_financeiras')
      .select('id, nome, tipo')
      .eq('ativo', true)
      .order('nome');
    if (error) throw error;
    return res.json({ sucesso: true, categorias: (data || []).map(montarCategoria) });
  } catch (e) {
    return erroInterno(res, 'listar as categorias', e);
  }
}

export async function criarCategoria(req, res) {
  try {
    const nome = String(req.body?.nome || '').trim();
    const tipo = String(req.body?.tipo || '').toUpperCase();
    if (!nome) return res.status(400).json({ sucesso: false, erro: 'Informe o nome da categoria.' });
    if (normalizar(nome) === 'outros') return res.status(400).json({ sucesso: false, erro: '"Outros" já aparece sempre no fim da lista.' });
    if (!['ENTRADA', 'SAIDA'].includes(tipo)) return res.status(400).json({ sucesso: false, erro: 'Tipo inválido.' });

    const { data: existentes, error: eL } = await supabase
      .from('categorias_financeiras')
      .select('id, nome, ativo')
      .eq('tipo', tipo);
    if (eL) throw eL;

    const igual = (existentes || []).find((c) => normalizar(c.nome) === normalizar(nome));
    if (igual?.ativo) return res.status(409).json({ sucesso: false, erro: 'Essa categoria já existe.' });

    // Se já existiu e foi removida, reativa em vez de duplicar.
    const resultado = igual
      ? await supabase.from('categorias_financeiras').update({ ativo: true, nome }).eq('id', igual.id).select().single()
      : await supabase.from('categorias_financeiras').insert([{ nome, tipo }]).select().single();
    if (resultado.error) throw resultado.error;

    return res.status(201).json({ sucesso: true, categoria: montarCategoria(resultado.data) });
  } catch (e) {
    return erroInterno(res, 'criar a categoria', e);
  }
}

/** Desativa (não apaga): lançamentos antigos continuam apontando para ela. */
export async function removerCategoria(req, res) {
  try {
    const { error } = await supabase.from('categorias_financeiras').update({ ativo: false }).eq('id', req.params.id);
    if (error) throw error;
    return res.json({ sucesso: true });
  } catch (e) {
    return erroInterno(res, 'remover a categoria', e);
  }
}

// -----------------------------------------------------------------------------
// Formas de pagamento (erro P4)
// -----------------------------------------------------------------------------

const TIPOS_FORMA = ['debito', 'credito', 'pix', 'boleto', 'dinheiro', 'outros'];

const montarForma = (f) => ({
  id: f.id,
  nome: f.nome,
  tipo: f.tipo || 'outros',
  titular: f.titular || null,
  validade: f.validade || null,
  chave: f.chave || null,
  descricao: ['boleto', 'dinheiro', 'outros'].includes(f.tipo || 'outros') ? f.nome : null,
});

const nomeDaForma = ({ tipo, titular, chave, descricao }) => {
  const rotulos = { debito: 'Cartão de Débito', credito: 'Cartão de Crédito', pix: 'Pix', boleto: 'Boleto', dinheiro: 'Dinheiro', outros: 'Outros' };
  if (tipo === 'debito' || tipo === 'credito') return `${rotulos[tipo]} · ${titular}`;
  if (tipo === 'pix') return chave ? `Pix · ${chave}` : 'Pix';
  return descricao ? `${rotulos[tipo]} · ${descricao}` : rotulos[tipo];
};

export async function listarFormas(req, res) {
  try {
    const { data, error } = await supabase
      .from('formas_pagamento')
      .select('*')
      .eq('ativo', true)
      .order('lancamento', { ascending: true });
    if (error) throw error;
    return res.json({ sucesso: true, formas: (data || []).map(montarForma) });
  } catch (e) {
    return erroInterno(res, 'listar as formas de pagamento', e);
  }
}

export async function criarForma(req, res) {
  try {
    const tipo = String(req.body?.tipo || '');
    const titular = req.body?.titular ? String(req.body.titular).trim() : null;
    const validade = req.body?.validade ? String(req.body.validade).trim() : null;
    const chave = req.body?.chave ? String(req.body.chave).trim() : null;
    const descricao = req.body?.descricao ? String(req.body.descricao).trim() : null;

    if (!TIPOS_FORMA.includes(tipo)) return res.status(400).json({ sucesso: false, erro: 'Tipo de pagamento inválido.' });
    if ((tipo === 'debito' || tipo === 'credito')) {
      if (!titular) return res.status(400).json({ sucesso: false, erro: 'Informe o nome do titular do cartão.' });
      const m = /^(\d{2})\/(\d{2})$/.exec(validade || '');
      if (!m || Number(m[1]) < 1 || Number(m[1]) > 12) {
        return res.status(400).json({ sucesso: false, erro: 'Validade inválida. Use MM/AA.' });
      }
    }
    if (tipo === 'pix' && !chave) return res.status(400).json({ sucesso: false, erro: 'Informe a chave Pix.' });

    const { data, error } = await supabase
      .from('formas_pagamento')
      .insert([{ nome: nomeDaForma({ tipo, titular, chave, descricao }), tipo, titular, validade, chave }])
      .select()
      .single();
    if (error) throw error;
    return res.status(201).json({ sucesso: true, forma: montarForma(data) });
  } catch (e) {
    return erroInterno(res, 'criar a forma de pagamento', e);
  }
}

export async function removerForma(req, res) {
  try {
    const { error } = await supabase.from('formas_pagamento').update({ ativo: false }).eq('id', req.params.id);
    if (error) throw error;
    return res.json({ sucesso: true });
  } catch (e) {
    return erroInterno(res, 'remover a forma de pagamento', e);
  }
}

// -----------------------------------------------------------------------------
// Usuários (erro P4 e P9: lista e detalhe usavam dados de exemplo)
// -----------------------------------------------------------------------------

const montarUsuario = (u) => ({
  id: u.id,
  nome: u.nome,
  email: u.email,
  perfil: u.id_perfil,
  foto: u.imagem || null,
  ativo: u.ativo !== false,
});

export async function listarUsuarios(req, res) {
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nome, email, id_perfil, imagem, ativo')
      .eq('ativo', true)
      .order('nome');
    if (error) throw error;
    return res.json({ sucesso: true, usuarios: (data || []).map(montarUsuario) });
  } catch (e) {
    return erroInterno(res, 'listar os usuários', e);
  }
}

/**
 * Cadastro de quem entra com Google: não tem senha, só precisa existir na tabela
 * usuarios com o e-mail da conta Google. (Quem entra com e-mail e senha usa
 * POST /auth/cadastro, que cria a conta no Supabase Auth.)
 */
export async function criarUsuarioGoogle(req, res) {
  try {
    const nome = String(req.body?.nome || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const perfil = Number(req.body?.perfil);

    if (!nome) return res.status(400).json({ sucesso: false, erro: 'Informe o nome.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return res.status(400).json({ sucesso: false, erro: 'Informe um e-mail válido.' });
    if (![1, 2, 3, 4].includes(perfil)) return res.status(400).json({ sucesso: false, erro: 'Perfil inválido.' });

    const { data, error } = await supabase
      .from('usuarios')
      .insert([{ nome, email, id_perfil: perfil }])
      .select('id, nome, email, id_perfil, imagem, ativo')
      .single();
    if (error) {
      if (error.code === '23505') return res.status(409).json({ sucesso: false, erro: 'Este e-mail já está cadastrado.' });
      throw error;
    }
    return res.status(201).json({ sucesso: true, usuario: montarUsuario(data) });
  } catch (e) {
    return erroInterno(res, 'cadastrar o usuário', e);
  }
}

export async function atualizarUsuario(req, res) {
  try {
    const mudancas = {};
    if (req.body?.nome !== undefined) {
      const nome = String(req.body.nome).trim();
      if (!nome) return res.status(400).json({ sucesso: false, erro: 'Informe o nome.' });
      mudancas.nome = nome;
    }
    if (req.body?.perfil !== undefined) {
      const perfil = Number(req.body.perfil);
      if (![1, 2, 3, 4].includes(perfil)) return res.status(400).json({ sucesso: false, erro: 'Perfil inválido.' });
      // Ninguém tira o próprio acesso de Admin sem querer.
      if (req.params.id === req.usuario.id && req.usuario.perfil === PERFIS.ADMIN && perfil !== PERFIS.ADMIN) {
        return res.status(400).json({ sucesso: false, erro: 'Você não pode tirar o seu próprio perfil de Admin.' });
      }
      mudancas.id_perfil = perfil;
    }
    if (!Object.keys(mudancas).length) return res.status(400).json({ sucesso: false, erro: 'Nada para atualizar.' });

    const { data, error } = await supabase
      .from('usuarios')
      .update(mudancas)
      .eq('id', req.params.id)
      .select('id, nome, email, id_perfil, imagem, ativo')
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ sucesso: false, erro: 'Usuário não encontrado.' });
    return res.json({ sucesso: true, usuario: montarUsuario(data) });
  } catch (e) {
    return erroInterno(res, 'atualizar o usuário', e);
  }
}

/** "Remover" desativa a conta: o histórico de lançamentos e viagens continua ligado a ela. */
export async function desativarUsuario(req, res) {
  try {
    if (req.params.id === req.usuario.id) {
      return res.status(400).json({ sucesso: false, erro: 'Você não pode remover a sua própria conta.' });
    }
    const { error } = await supabase.from('usuarios').update({ ativo: false }).eq('id', req.params.id);
    if (error) throw error;
    return res.json({ sucesso: true });
  } catch (e) {
    return erroInterno(res, 'remover o usuário', e);
  }
}
