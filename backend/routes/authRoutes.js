import { Router } from 'express';

import {
    cadastrarUsuario,
    reenviarConfirmacao
} from '../controllers/authController.js';

import authController from '../controllers/authController.js';
import emailController from '../controllers/emailController.js';

const router = Router();

router.post('/cadastro', cadastrarUsuario);
router.post('/reenviar-confirmacao', reenviarConfirmacao);

router.post('/login', emailController);
router.post('/login-email', emailController);
router.post('/login-google', authController);

router.get('/confirmado', (req, res) => {
    res.status(200).send(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Confirmação Frotix</title>
        </head>
        <body style="background:#121212;color:white;text-align:center;font-family:Arial;padding:50px">
            <h1 style="color:#2541ff">FrotiX</h1>
            <p id="mensagem">Verificando confirmação...</p>

            <script>
                const params = new URLSearchParams(
                    window.location.hash.slice(1)
                );

                const erro = params.get('error_description');
                const token = params.get('access_token');

                const mensagem = document.getElementById('mensagem');

                if (erro) {
                    mensagem.textContent = erro;
                } else if (token) {
                    mensagem.textContent =
                        'E-mail confirmado! Agora você pode voltar ao Frotix.';
                } else {
                    mensagem.textContent =
                        'Não foi possível identificar a confirmação.';
                }
            </script>
        </body>
        </html>
    `);
});

export default router;