import app from './app.js';
import { conferirConfiguracaoAuth } from './middleware/auth.js';

// Para a subida se faltar o JWT_SECRET no .env (ou nas variáveis do Render).
conferirConfiguracaoAuth();

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port} 🚀`);
});
