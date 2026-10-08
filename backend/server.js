import express from 'express';
import authRoutes from './routes/authRoutes.js';
import 'dotenv/config';

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

app.listen(port, () => {
  console.log('Servidor rodando na porta 3000 🚀');
});