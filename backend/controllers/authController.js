<<<<<<< HEAD
import supabase from '../database/db.js';
=======
import pool from '../database/db.js';
>>>>>>> e110326ceb7b63258327fd89dc1b2591e7a009b4

export default async function authController(req, res) {
    const { email } = req.body;
    try {
<<<<<<< HEAD
        const { data, error } = await supabase
            .from('usuarios')
            .select('*')
            .eq('email', email);

        if (error) {
            throw error;
        }

        if (data.length === 0) {
=======
        const queryVerificacao = 'SELECT * FROM users WHERE email = $1';
        const resultado = await pool.query(queryVerificacao, [email]);

        if (resultado.rows.length === 0) {
>>>>>>> e110326ceb7b63258327fd89dc1b2591e7a009b4
        return res.status(403).json({ 
            erro: 'Acesso negado. Este e-mail não possui cadastro no sistema.' 
        });
        }
<<<<<<< HEAD
        const usuarioDoBanco = data[0];
=======
        const usuarioDoBanco = resultado.rows[0];
>>>>>>> e110326ceb7b63258327fd89dc1b2591e7a009b4

        return res.status(200).json({
        mensagem: 'Login autorizado com sucesso!',
        usuario: {
            id: usuarioDoBanco.id,
            email: usuarioDoBanco.email,
<<<<<<< HEAD
            nome: usuarioDoBanco.nome,
            role: usuarioDoBanco.id_perfil
=======
            name: usuarioDoBanco.name,
            role: usuarioDoBanco.role
>>>>>>> e110326ceb7b63258327fd89dc1b2591e7a009b4
        }
        });
    } catch (err){
        console.error('Erro ao verificar usuário:', err);
        return res.status(500).json({ err: 'Erro interno no servidor.' });
    }
}