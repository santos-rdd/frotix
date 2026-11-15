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

export const obterViagensEmAndamento = async (req, res) => {
  try {
    let { data, error } = await supabase
      .from('viagens')
      .select('*, usuarios(id, nome, email, imagem)')
      .eq('status', 'EM_ANDAMENTO');

    if (error) {
      console.warn('Join com usuarios falhou, buscando viagens diretamente:', error.message);
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('viagens')
        .select('*')
        .eq('status', 'EM_ANDAMENTO');

      if (fallbackError) {
        throw fallbackError;
      }
      data = fallbackData;
    }

    const motoristasIds = [...new Set((data || []).map((v) => v.id_motorista).filter(Boolean))];
    const mapaMotoristas = {};

    if (motoristasIds.length > 0) {
      const { data: usuariosData } = await supabase
        .from('usuarios')
        .select('id, nome, email, imagem')
        .in('id', motoristasIds);

      for (const u of usuariosData || []) {
        mapaMotoristas[u.id] = u;
      }
    }

    const viagensFormatadas = (data || []).map((v) => {
      const usuarioJoin = Array.isArray(v.usuarios) ? v.usuarios[0] : v.usuarios;
      const motoristaObj = usuarioJoin || mapaMotoristas[v.id_motorista] || {};
      const motoristaNome = motoristaObj.nome || 'Motorista';

      return {
        id: v.id,
        origem: v.origem || 'Origem não informada',
        destino: v.destino || 'Destino não informado',
        status: v.status || 'EM_ANDAMENTO',
        km_inicial: v.km_inicial ?? null,
        km_final: v.km_final ?? null,
        iniciada_em: v.iniciada_em || null,
        id_motorista: v.id_motorista,
        motorista: motoristaNome,
        motorista_email: motoristaObj.email || null,
        motorista_imagem: motoristaObj.imagem || null,
        placa: v.placa || 'POX-XX'
      };
    });

    res.set('Cache-Control', 'no-store');
    return res.status(200).json({
      sucesso: true,
      viagens: viagensFormatadas
    });
  } catch (err) {
    console.error('Erro ao obter viagens em andamento:', err);
    return res.status(500).json({
      sucesso: false,
      erro: 'Erro interno no servidor ao consultar viagens em andamento.'
    });
  }
};