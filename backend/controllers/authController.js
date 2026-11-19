import supabase, { createSupabaseAuthClient } from '../database/db.js';
import { OAuth2Client } from 'google-auth-library';

export default async function authController(req, res) {
    try {
        const { idToken } = req.body || {};

        if (!idToken) {
            return res.status(400).json({
                erro: 'Token de autenticação Google não informado.'
            });
        }

        const webClientId = process.env.GOOGLE_WEB_CLIENT_ID;

        if (!webClientId) {
            console.error('GOOGLE_WEB_CLIENT_ID não configurado.');

            return res.status(500).json({
                erro: 'Configuração Google não encontrada no servidor.'
            });
        }

        const googleClient = new OAuth2Client(webClientId);

        let payload;

        try {
            const ticket = await googleClient.verifyIdToken({
                idToken,
                audience: webClientId
            });

            payload = ticket.getPayload();

        } catch (error) {
            console.error('TOKEN GOOGLE INVÁLIDO:', error.message);

            return res.status(401).json({
                erro: 'Não foi possível validar sua autenticação Google.'
            });
        }

        if (!payload || !payload.email || payload.email_verified !== true) {
            return res.status(401).json({
                erro: 'A conta Google precisa possuir um e-mail verificado.'
            });
        }

        const emailGoogle = payload.email.trim().toLowerCase();

        const { data: usuarioCadastrado, error: consultaError } =
            await supabase
                .from('usuarios')
                .select('id, nome, email, id_perfil, ativo, imagem')
                .eq('email', emailGoogle)
                .maybeSingle();

        if (consultaError) {
            throw consultaError;
        }

        if (!usuarioCadastrado) {
            return res.status(403).json({
                erro: 'Acesso negado. Este e-mail não possui cadastro no Frotix.'
            });
        }

        if (!usuarioCadastrado.ativo) {
            return res.status(403).json({
                erro: 'Esta conta está desativada.'
            });
        }

        const { data: authExistente, error: authConsultaError } =
            await supabase.auth.admin.getUserById(usuarioCadastrado.id);

        if (authConsultaError || !authExistente.user) {
            return res.status(403).json({
                erro: 'A identidade deste usuário não foi encontrada no sistema.'
            });
        }

        const authClient = createSupabaseAuthClient();

        const { data: authData, error: authError } =
            await authClient.auth.signInWithIdToken({
                provider: 'google',
                token: idToken
            });

        if (authError) {
            console.error('ERRO SUPABASE GOOGLE:', authError);

            return res.status(401).json({
                erro: 'Não foi possível concluir a autenticação Google.',
                details: authError.message
            });
        }

        if (!authData.user || !authData.session) {
            return res.status(401).json({
                erro: 'Não foi possível obter a sessão do usuário.'
            });
        }

        if (authData.user.id !== usuarioCadastrado.id) {
            console.error('UUID Google diferente do cadastro Frotix:', {
                googleUserId: authData.user.id,
                frotixUserId: usuarioCadastrado.id
            });

            return res.status(403).json({
                erro: 'Não foi possível vincular sua conta Google ao cadastro do Frotix.'
            });
        }

        const fotoGoogle = payload.picture || null;

        if (fotoGoogle && fotoGoogle !== usuarioCadastrado.imagem) {
            const { data: usuarioAtualizado, error: imagemError } = await supabase
                .from('usuarios')
                .update({
                    imagem: fotoGoogle
                })
                .eq('id', usuarioCadastrado.id)
                .select('imagem')
                .single();

            if (imagemError) {
                throw imagemError;
            }

            usuarioCadastrado.imagem = usuarioAtualizado.imagem;
        }

        return res.status(200).json({
            mensagem: 'Login Google realizado com sucesso!',

            usuario: {
                id: usuarioCadastrado.id,
                email: usuarioCadastrado.email,
                nome: usuarioCadastrado.nome,
                role: usuarioCadastrado.id_perfil,
                imagem: usuarioCadastrado.imagem
            },

            sessao: {
                access_token: authData.session.access_token,
                refresh_token: authData.session.refresh_token,
                expires_at: authData.session.expires_at
            }
        });

    } catch (err) {
        console.error('ERRO AO REALIZAR LOGIN GOOGLE:', err);

        return res.status(500).json({
            erro: 'Erro interno ao realizar login Google.'
        });
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


export const cadastrarUsuario = async (req, res) => {
    try {
        const {
            nome,
            email,
            password,
            id_perfil,
            imagem,
            accessMethod = 'email'
        } = req.body;

        if (!nome || !email || !id_perfil) {
            return res.status(400).json({
                error: 'Preencha os campos obrigatórios.'
            });
        }

        if (!['email', 'gmail'].includes(accessMethod)) {
            return res.status(400).json({
                error: 'Método de acesso inválido.'
            });
        }

        if (accessMethod === 'email' && !password) {
            return res.status(400).json({
                error: 'A senha é obrigatória.'
            });
        }

        if (accessMethod === 'email' && password.length < 6) {
            return res.status(400).json({
                error: 'A senha deve possuir pelo menos 6 caracteres.'
            });
        }

        const emailNormalizado = email.trim().toLowerCase();

        const formatoEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

        if (!formatoEmail.test(emailNormalizado)) {
            return res.status(400).json({
                error: 'Informe um endereço de e-mail válido.'
            });
        }

        const perfisValidos = [1, 2, 3, 4];

        if (!perfisValidos.includes(Number(id_perfil))) {
            return res.status(400).json({
                error: 'Perfil inválido.'
            });
        }

        // Verifica se existe na tabela usuarios.
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

        let authData;
        let authError;

        const imagemNormalizada =
            imagem && imagem !== 'null' ? imagem : null;

        // CADASTRO TRADICIONAL
        if (accessMethod === 'email') {

            const authClient = createSupabaseAuthClient();

            const resultado = await authClient.auth.signUp({
                email: emailNormalizado,
                password,

                options: {
                    emailRedirectTo: process.env.EMAIL_CONFIRM_REDIRECT_URL,

                    data: {
                        nome,
                        id_perfil: Number(id_perfil),
                        imagem: imagemNormalizada,
                        accessMethod: 'email'
                    }
                }
            });

            authData = resultado.data;
            authError = resultado.error;

        } else {

            const resultado = await supabase.auth.admin.createUser({
                email: emailNormalizado,
                email_confirm: true,

                user_metadata: {
                    nome,
                    id_perfil: Number(id_perfil),
                    imagem: imagemNormalizada,
                    accessMethod: 'gmail'
                }
            });

            authData = resultado.data;
            authError = resultado.error;
        }

        if (authError) {
            console.error('ERRO AO CRIAR IDENTIDADE:', authError);

            return res.status(authError.status || 400).json({
                error: authError.message
            });
        }

        if (!authData.user) {
            return res.status(400).json({
                error: 'Não foi possível criar a conta.'
            });
        }

        if (
            accessMethod === 'email' &&
            Array.isArray(authData.user.identities) &&
            authData.user.identities.length === 0
        ) {
            return res.status(409).json({
                error: 'Este e-mail já possui uma conta.'
            });
        }

        const { data: usuario, error: usuarioError } = await supabase
            .from('usuarios')
            .select('id, nome, email, id_perfil, ativo, criado_em, imagem')
            .eq('id', authData.user.id)
            .maybeSingle();

        if (usuarioError) {
            console.error('ERRO AO CONSULTAR USUARIO:', usuarioError);

            return res.status(500).json({
                error: 'Erro ao consultar os dados do usuário.'
            });
        }

        if (!usuario) {
            return res.status(500).json({
                error: 'A identidade foi criada, mas o registro do Frotix não foi encontrado.'
            });
        }

        return res.status(201).json({
            message: accessMethod === 'gmail'
                ? 'Usuário cadastrado para utilizar o Google.'
                : 'Usuário cadastrado! Verifique seu e-mail para confirmar a conta.',

            usuario
        });

    } catch (err) {
        console.error('ERRO AO CADASTRAR USUARIO:', err);

        return res.status(500).json({
            error: 'Erro interno no servidor.'
        });
    }
};
