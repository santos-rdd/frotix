import pool from '../database/db.js';

export default async function emailController(req, res) {
    try {
        // Proteção caso req.body venha undefined
        if (!req.body) {
            return res.status(400).json({ erro: 'O corpo da requisição está vazio.' });
        }

        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ erro: 'E-mail e senha são obrigatórios.' });
        }

        const queryVerificacao = 'SELECT * FROM users WHERE email = $1';
        const resultado = await pool.query(queryVerificacao, [email]);

        if (resultado.rows.length === 0) {
            return res.status(403).json({ 
                erro: 'E-mail não cadastrado no sistema.' 
            });
        }

        const usuarioDoBanco = resultado.rows[0];

        if (!usuarioDoBanco.password) {
            return res.status(401).json({ 
                erro: 'Este e-mail utiliza login com o Google.' 
            });
        }

        if (usuarioDoBanco.password !== password) {
            return res.status(401).json({ 
                erro: 'Senha incorreta.' 
            });
        }

        return res.status(200).json({
            mensagem: 'Login com senha autorizado com sucesso!',
            usuario: {
                id: usuarioDoBanco.id,
                email: usuarioDoBanco.email,
                name: usuarioDoBanco.name,
                role: usuarioDoBanco.role
            }
        });
    } catch (err) {
        console.error('Erro ao logar com email e senha:', err);
        return res.status(500).json({ erro: 'Erro interno no servidor.' });
    }
}