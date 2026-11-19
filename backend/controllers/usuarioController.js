import supabase, { createSupabaseAuthClient } from '../database/db.js';

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


export const listarUsuarios = async (req, res) => {
    try {
        const { data: usuarios, error: usuariosError } = await supabase
            .from('usuarios')
            .select('id, nome, email, id_perfil, imagem, ativo, criado_em')
            .order('nome', { ascending: true });

        if (usuariosError) {
            throw usuariosError;
        }

        const { data: perfis, error: perfisError } = await supabase
            .from('perfis')
            .select('id, codigo, nome');

        if (perfisError) {
            throw perfisError;
        }

        const usuariosFormatados = (usuarios || []).map((usuario) => {
            const perfil = (perfis || []).find(
                (p) => p.id === usuario.id_perfil
            );

            return {
                ...usuario,
                ativo: usuario.ativo !== false,
                perfil: perfil
                    ? {
                        codigo: perfil.codigo,
                        nome: perfil.nome
                    }
                    : null
            };
        });

        res.set('Cache-Control', 'no-store');

        return res.status(200).json({
            sucesso: true,
            usuarios: usuariosFormatados
        });

    } catch (err) {
        console.error('Erro ao listar usuários:', err);

        return res.status(500).json({
            sucesso: false,
            erro: 'Erro interno ao consultar os usuários.'
        });
    }
};
