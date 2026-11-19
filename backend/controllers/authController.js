import supabase, { createSupabaseAuthClient } from '../database/db.js';
import { OAuth2Client } from 'google-auth-library';
import { gerarToken } from '../middleware/auth.js';

// Client ID "Web" do Google usado pelo app (src/config/google.js). O idToken que o
// app recebe do Google é emitido para esse público; qualquer outro é recusado.
const GOOGLE_WEB_CLIENT_ID =
    process.env.GOOGLE_WEB_CLIENT_ID ||
    '716901513376-tnb5fm21k2t2hlavoei6n7052m2terdk.apps.googleusercontent.com';

const googleClient = new OAuth2Client(GOOGLE_WEB_CLIENT_ID);

// Permite trocar a verificação nos testes automatizados.
export let verificarIdTokenGoogle = async (idToken) => {
    const ticket = await googleClient.verifyIdToken({ idToken, audience: GOOGLE_WEB_CLIENT_ID });
    return ticket.getPayload();
};
export const definirVerificadorGoogle = (fn) => { verificarIdTokenGoogle = fn; };

/**
 * POST /auth/login-google  { idToken }
 * Confere com o Google que o idToken é válido e pertence ao app, e só então
 * libera o usuário cadastrado com aquele e-mail (erro C1: antes bastava mandar
 * um e-mail qualquer).
 */
export default async function authController(req, res) {
    const { idToken } = req.body || {};

    if (!idToken) {
        return res.status(400).json({ erro: 'Token do Google não enviado. Atualize o aplicativo.' });
    }

    let payload;
    try {
        payload = await verificarIdTokenGoogle(idToken);
    } catch (err) {
        console.warn('idToken do Google recusado:', err.message);
        return res.status(401).json({ erro: 'Não foi possível confirmar seu login com o Google.' });
    }

    if (!payload?.email || payload.email_verified === false) {
        return res.status(401).json({ erro: 'A conta Google não tem e-mail verificado.' });
    }

    try {
        const { data: usuario, error } = await supabase
            .from('usuarios')
            .select('id, nome, email, id_perfil, ativo, imagem')
            .ilike('email', payload.email.trim())
            .maybeSingle();

        if (error) throw error;

        if (!usuario) {
            return res.status(403).json({
                erro: 'Acesso negado. Este e-mail não possui cadastro no sistema.'
            });
        }

        if (usuario.ativo === false) {
            return res.status(403).json({ erro: 'Esta conta está desativada.' });
        }

        return res.status(200).json({
            mensagem: 'Login autorizado com sucesso!',
            token: gerarToken(usuario),
            usuario: {
                id: usuario.id,
                email: usuario.email,
                nome: usuario.nome,
                name: usuario.nome,
                role: usuario.id_perfil
            }
        });
    } catch (err) {
        console.error('Erro ao verificar usuário:', err);
        return res.status(500).json({ erro: 'Erro interno no servidor.' });
    }
}

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
                error: 'Não foi possível reenviar a confirmação.'
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
