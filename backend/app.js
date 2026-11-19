import express from 'express';
import multer from 'multer';
import authRoutes from './routes/authRoutes.js';
import financeiroRoutes from './routes/financeiroRoutes.js';
import resumoRoutes from './routes/resumoRoutes.js';
import frotaRoutes from './routes/frotaRoutes.js';
import comprovantesRoutes from './routes/comprovantesRoutes.js';
import { categoriasRoutes, formasRoutes, usuariosRoutes } from './routes/cadastrosRoutes.js';

// O app fica separado do listen() para os testes automatizados conseguirem usá-lo.
const app = express();

app.use(express.json({ limit: '1mb' }));

app.get('/', (req, res) => res.json({ sucesso: true, servico: 'frotix-backend' }));

// Só /auth é público. Todas as outras rotas exigem o token do login (erro C2/I10).
app.use('/auth', authRoutes);
app.use('/financeiro', financeiroRoutes);
app.use('/resumo', resumoRoutes);
app.use('/categorias', categoriasRoutes);
app.use('/formas-pagamento', formasRoutes);
app.use('/usuarios', usuariosRoutes);
app.use('/frota', frotaRoutes);
app.use('/comprovantes', comprovantesRoutes);

app.use((req, res) => res.status(404).json({ sucesso: false, erro: 'Rota não encontrada.' }));

// Tratador de erros: precisa vir depois das rotas para funcionar.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ sucesso: false, erro: 'JSON malformado ou inválido no corpo da requisição.' });
  }
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'O arquivo passa de 10 MB.' : 'Arquivo inválido.';
    return res.status(400).json({ sucesso: false, erro: msg });
  }
  console.error('Erro não tratado:', err);
  return res.status(500).json({ sucesso: false, erro: 'Erro interno no servidor.' });
});

export default app;
