import supabase, { createSupabaseAuthClient } from '../database/db.js';
import {
    criarSessaoFrotix,
    SessionStoreError,
    SessionUserInactiveError
} from '../services/sessionService.js';
import { criarRespostaAutenticada } from '../utils/authResponse.js';

export default async function emailController(req, res) {
    try {
        const { email, password } = req.body || {};

        if (!email || !password) {
            return res.status(400).json({
                erro: 'E-mail e senha são obrigatórios.'
            });
        }

        const authClient = createSupabaseAuthClient();


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


        const { data: usuario, error: userError } = await supabase
            .from('usuarios')
            .select('id, nome, email, id_perfil, ativo, imagem')
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

        if (usuario.ativo !== true) {
            return res.status(403).json({
                erro: 'Esta conta está desativada.'
            });
        }


        const sessao = await criarSessaoFrotix(usuario.id);

        return res.status(200).json({
            mensagem: 'Login realizado com sucesso!',
            ...criarRespostaAutenticada(usuario, sessao),
        });

    } catch (err) {
        if (err instanceof SessionUserInactiveError) {
            return res.status(403).json({ erro: err.message });
        }
        if (err instanceof SessionStoreError) {
            return res.status(503).json({
                erro: 'Não foi possível criar a sessão. Tente novamente.'
            });
        }

        console.error('ERRO AO REALIZAR LOGIN:', err);

        return res.status(500).json({
            erro: 'Erro interno no servidor.'
        });
    }
}