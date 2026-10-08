import supabase from '../database/db.js';

export default async function emailController(req, res) {
    try {
        if (!req.body) {
            return res.status(400).json({ erro: 'O corpo da requisição está vazio.' });
        }

        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ erro: 'E-mail e senha são obrigatórios.' });
        }

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
            return res.status(403).json({ 
                erro: 'E-mail não cadastrado no sistema.' 
            });
        }

        const usuarioDoBanco = data[0];

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
                name: usuarioDoBanco.nome,
                role: usuarioDoBanco.id_perfil
            }
        });
    } catch (err) {
        console.error('Erro ao logar com email e senha:', err);
        return res.status(500).json({ erro: 'Erro interno no servidor.' });
    }
}