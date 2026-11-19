import supabase, { createSupabaseAuthClient } from '../database/db.js';
import { gerarToken } from '../middleware/auth.js';

export default async function emailController(req, res) {
    try {
        const { email, password } = req.body || {};

        if (!email || !password) {
            return res.status(400).json({
                erro: 'E-mail e senha são obrigatórios.'
            });
        }

        const authClient = createSupabaseAuthClient();

        // 1. Autentica utilizando o Supabase Auth.
        const { data: authData, error: authError } =
            await authClient.auth.signInWithPassword({
                email: email.trim().toLowerCase(),
                password
            });

        if (authError) {
            console.error('ERRO NO LOGIN SUPABASE:', authError);

            if (authError.code === 'email_not_confirmed') {
                return res.status(403).json({
                    erro: 'Confirme seu endereço de e-mail antes de entrar.'
                });
            }

            return res.status(401).json({
                erro: 'E-mail ou senha incorretos.'
            });
        }

        if (!authData.user || !authData.session) {
            return res.status(401).json({
                erro: 'Não foi possível autenticar o usuário.'
            });
        }

        // 2. Busca os dados complementares na tabela usuarios.
        const { data: usuario, error: userError } = await supabase
            .from('usuarios')
            .select('id, nome, email, id_perfil, ativo')
            .eq('id', authData.user.id)
            .maybeSingle();

        if (userError) {
            throw userError;
        }

        if (!usuario) {
            return res.status(403).json({
                erro: 'Usuário não encontrado no sistema.'
            });
        }

        if (!usuario.ativo) {
            return res.status(403).json({
                erro: 'Esta conta está desativada.'
            });
        }

        // 3. Retorna os dados para o aplicativo.
        return res.status(200).json({
            mensagem: 'Login realizado com sucesso!',

            // Token do Frotix: o app manda em "Authorization: Bearer" nas outras rotas.
            token: gerarToken(usuario),

            usuario: {
                id: usuario.id,
                email: usuario.email,
                nome: usuario.nome,
                name: usuario.nome,
                role: usuario.id_perfil
            },

            // Tokens da sessão para utilização pelo aplicativo.
            sessao: {
                access_token: authData.session.access_token,
                refresh_token: authData.session.refresh_token,
                expires_at: authData.session.expires_at
            }
        });

    } catch (err) {
        console.error('ERRO AO REALIZAR LOGIN:', err);

        return res.status(500).json({
            erro: 'Erro interno no servidor.'
        });
    }
}