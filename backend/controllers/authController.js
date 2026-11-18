import supabase, { createSupabaseAuthClient } from '../database/db.js';

export default async function authController(req, res) {
    const { email } = req.body;
    try {
        const { data, error } = await supabase
            .from('usuarios')
            .select('*')
            .eq('email', email);

        if (error) {
            throw error;
        }

        if (data.length === 0) {
        return res.status(403).json({ 
            erro: 'Acesso negado. Este e-mail não possui cadastro no sistema.' 
        });
        }
        const usuarioDoBanco = data[0];

        return res.status(200).json({
        mensagem: 'Login autorizado com sucesso!',
        usuario: {
            id: usuarioDoBanco.id,
            email: usuarioDoBanco.email,
            nome: usuarioDoBanco.nome,
            role: usuarioDoBanco.id_perfil
        }
        });
    } catch (err){
        console.error('Erro ao verificar usuário:', err);
        return res.status(500).json({ err: 'Erro interno no servidor.' });
    }
}

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
export const cadastrarUsuario = async (req, res) => {
    try {
        const { nome, email, password, id_perfil, imagem } = req.body;

        if (!nome || !email || !password || !id_perfil) {
            return res.status(400).json({
                error: 'Preencha todos os campos obrigatórios.'
            });
        }

        const emailNormalizado = email.trim().toLowerCase();

        // Validação do e-mail.
        const formatoEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

        if (!formatoEmail.test(emailNormalizado)) {
            return res.status(400).json({
                error: 'Informe um e-mail válido.'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                error: 'A senha deve possuir pelo menos 6 caracteres.'
            });
        }

        // Validação do perfil.
        const perfisValidos = [1, 2, 3, 4];

        if (!perfisValidos.includes(Number(id_perfil))) {
            return res.status(400).json({
                error: 'Perfil inválido.'
            });
        }

        // Verifica se já existe na tabela usuarios.
        const { data: usuarioExistente, error: consultaError } =
            await supabase
                .from('usuarios')
                .select('id')
                .eq('email', emailNormalizado)
                .maybeSingle();

        if (consultaError) {
            throw consultaError;
        }

        if (usuarioExistente) {
            return res.status(409).json({
                error: 'Este e-mail já está cadastrado.'
            });
        }

        const authClient = createSupabaseAuthClient();

        const { data: authData, error: authError } =
            await authClient.auth.signUp({
                email: emailNormalizado,
                password,
                options: {
                    emailRedirectTo: process.env.EMAIL_CONFIRM_REDIRECT_URL,
                        data: {
                            nome,
                            id_perfil: Number(id_perfil),
                            imagem: imagem || null,
                            accessMethod: 'email'
                        }
                }
            });

        if (authError) {
            console.error('ERRO SUPABASE AUTH:', authError);

            return res.status(authError.status || 400).json({
                error: authError.message
            });
        }

        if (!authData.user) {
            return res.status(400).json({
                error: 'Não foi possível criar a conta.'
            });
        }

        // Verifica se o e-mail já possuía identidade no Auth.
        if (
            Array.isArray(authData.user.identities) &&
            authData.user.identities.length === 0
        ) {
            return res.status(409).json({
                error: 'Este e-mail já possui uma conta.'
            });
        }

        // O trigger já criou o registro em public.usuarios.
        // Aqui apenas buscamos os dados criados automaticamente.
        const { data: usuario, error: usuarioError } = await supabase
            .from('usuarios')
            .select('id, nome, email, id_perfil, ativo, criado_em, imagem')
            .eq('id', authData.user.id)
            .maybeSingle();

        if (usuarioError) {
            console.error('ERRO AO CONSULTAR USUARIO:', usuarioError);

            return res.status(500).json({
                error: 'A conta foi criada, mas houve um erro ao consultar os dados do usuário.'
            });
        }

        if (!usuario) {
            console.error(
                'O trigger não criou o registro para:',
                authData.user.id
            );

            return res.status(500).json({
                error: 'A identidade foi criada, mas o registro do Frotix não foi encontrado.'
            });
        }

        return res.status(201).json({
            message: 'Usuário cadastrado! Verifique seu e-mail para confirmar a conta.',
            usuario
        });

    } catch (err) {
        console.error('ERRO AO CADASTRAR USUARIO:', err);

        return res.status(500).json({
            error: 'Erro interno no servidor.'
        });
    }
};

export const reenviarConfirmacao = async (req, res) => {
    try {
        const { email } = req.body || {};

        if (!email) {
            return res.status(400).json({
                error: 'Informe seu endereço de e-mail.'
            });
        }

        const emailNormalizado = email.trim().toLowerCase();

        const authClient = createSupabaseAuthClient();

        const { error } = await authClient.auth.resend({
            type: 'signup',
            email: emailNormalizado,

            options: {
                emailRedirectTo: process.env.EMAIL_CONFIRM_REDIRECT_URL
            }
        });

        if (error) {
            console.error('ERRO AO REENVIAR CONFIRMAÇÃO:', error);

            return res.status(error.status || 400).json({
                error: error.message
            });
        }

        return res.status(200).json({
            message: 'Solicitação de confirmação enviada. Verifique seu e-mail.'
        });

    } catch (err) {
        console.error('ERRO NO REENVIO:', err);

        return res.status(500).json({
            error: 'Erro interno ao reenviar confirmação.'
        });
    }
};