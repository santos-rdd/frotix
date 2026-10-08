import express from 'express';
import authRoutes from './routes/authRoutes.js';
<<<<<<< HEAD
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
=======

const app = express();
app.use(express.json()); 

app.use('/auth', authRoutes);

app.listen(3000, () => {
>>>>>>> e110326ceb7b63258327fd89dc1b2591e7a009b4
  console.log('Servidor rodando na porta 3000 🚀');
});