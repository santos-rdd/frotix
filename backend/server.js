import express from 'express';
import authRoutes from './routes/authRoutes.js';
import transacoesRoutes from './routes/transacoesRoutes.js';
import resumoRoutes from './routes/resumoRoutes.js';
import usuarioRoutes from './routes/usuarioRoutes.js';
import financialRoutes from './routes/financialRoutes.js';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json()); 

app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({ erro: 'JSON malformado ou inválido no corpo da requisição.' });
    }
    next();
});

app.use('/auth', authRoutes);
app.use('/financeiro', transacoesRoutes);
app.use('/resumo', resumoRoutes);
app.use('/usuarios', usuarioRoutes);
app.use('/', usuarioRoutes);
app.use('/financial', financialRoutes);

app.listen(port, '0.0.0.0', () => {
  console.log('Servidor rodando na porta 3000 🚀');
});
