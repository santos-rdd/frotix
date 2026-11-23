import app from './app.js';
import { conferirConfiguracaoAuth } from './middleware/auth.js';
import { iniciarRotinaRetencaoPosicoes } from './services/gpsRetentionService.js';


conferirConfiguracaoAuth();

const port = process.env.PORT || 3000;

iniciarRotinaRetencaoPosicoes();

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port} 🚀`);
});
