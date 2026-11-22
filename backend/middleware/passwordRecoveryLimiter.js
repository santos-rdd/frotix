import { rateLimit } from 'express-rate-limit';

export const limitarSolicitacoesRecuperacao = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler(_req, res) {
    return res.status(429).json({
      sucesso: false,
      mensagem: 'Muitas solicitações. Aguarde antes de tentar novamente.',
    });
  },
});
