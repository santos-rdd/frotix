import supabase from '../database/db.js';

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