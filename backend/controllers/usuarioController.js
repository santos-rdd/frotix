import supabase from '../database/db.js';

export const cadastrarUsuario = async (req, res) => {
  try {
    const { nome, email, password, id_perfil, imagem } = req.body;

    if (!email || !password || !nome || !id_perfil) {
      return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
    }

    const { data, error } = await supabase
      .from('usuarios')
      .insert([
        {
          nome,
          email,
          password,
          id_perfil,
          ativo: true,
          criado_em: new Date(),
          imagem: imagem || null
        }
      ])
      .select();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(201).json({
      message: 'Usuário cadastrado com sucesso!',
      usuario: data[0]
    });

  } catch (err) {
    return res.status(500).json({ error: 'Erro interno no servidor.' });
  }
};

export const loginUsuario = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    }

    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', email)
      .eq('password', password)
      .single();

    if (error || !data) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    return res.status(200).json({
      message: 'Login realizado com sucesso!',
      usuario: data
    });

  } catch (err) {
    return res.status(500).json({ error: 'Erro interno no servidor.' });
  }
};