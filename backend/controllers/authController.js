import pool from '../database/db.js';

export default async function authController(req, res) {
    const { email } = req.body;
    try {
        const queryVerificacao = 'SELECT * FROM users WHERE email = $1';
        const resultado = await pool.query(queryVerificacao, [email]);

        if (resultado.rows.length === 0) {
        return res.status(403).json({ 
            erro: 'Acesso negado. Este e-mail não possui cadastro no sistema.' 
        });
        }
        const usuarioDoBanco = resultado.rows[0];

        return res.status(200).json({
        mensagem: 'Login autorizado com sucesso!',
        usuario: {
            id: usuarioDoBanco.id,
            email: usuarioDoBanco.email,
            name: usuarioDoBanco.name,
            role: usuarioDoBanco.role
        }
        });
    } catch (err){
        console.error('Erro ao verificar usuário:', err);
        return res.status(500).json({ err: 'Erro interno no servidor.' });
    }
}