<<<<<<< HEAD
import supabase from '../database/db.js';

export default async function emailController(req, res) {
    try {
=======
import pool from '../database/db.js';

export default async function emailController(req, res) {
    try {
        // Proteção caso req.body venha undefined
>>>>>>> e110326ceb7b63258327fd89dc1b2591e7a009b4
        if (!req.body) {
            return res.status(400).json({ erro: 'O corpo da requisição está vazio.' });
        }

        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ erro: 'E-mail e senha são obrigatórios.' });
        }

<<<<<<< HEAD
        console.log('Buscando no banco o e-mail:', email);
        const { data, error } = await supabase
            .from('usuarios')
            .select('*')
            .eq('email', email);

        if (error) {
            throw error;
        }

        console.log('Resultado da busca:', data);

        if (data.length === 0) {
=======
        const queryVerificacao = 'SELECT * FROM users WHERE email = $1';
        const resultado = await pool.query(queryVerificacao, [email]);

        if (resultado.rows.length === 0) {
>>>>>>> e110326ceb7b63258327fd89dc1b2591e7a009b4
            return res.status(403).json({ 
                erro: 'E-mail não cadastrado no sistema.' 
            });
        }

<<<<<<< HEAD
        const usuarioDoBanco = data[0];
=======
        const usuarioDoBanco = resultado.rows[0];
>>>>>>> e110326ceb7b63258327fd89dc1b2591e7a009b4

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
<<<<<<< HEAD
                email: usuarioDoBanco.email,    
                name: usuarioDoBanco.nome,
                role: usuarioDoBanco.id_perfil
=======
                email: usuarioDoBanco.email,
                name: usuarioDoBanco.name,
                role: usuarioDoBanco.role
>>>>>>> e110326ceb7b63258327fd89dc1b2591e7a009b4
            }
        });
    } catch (err) {
        console.error('Erro ao logar com email e senha:', err);
        return res.status(500).json({ erro: 'Erro interno no servidor.' });
    }
}