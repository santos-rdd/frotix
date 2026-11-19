import { Router } from 'express';

import {
    cadastrarUsuario,
    reenviarConfirmacao
} from '../controllers/authController.js';

import authController from '../controllers/authController.js';
import emailController from '../controllers/emailController.js';
import { autenticar, exigirPerfil, PERFIS } from '../middleware/auth.js';

const router = Router();

// Cadastro de usuário com e-mail e senha: só Admin e Financeiro (antes era aberto a qualquer um).
router.post('/cadastro', autenticar, exigirPerfil(PERFIS.ADMIN, PERFIS.FINANCEIRO), cadastrarUsuario);
router.post('/reenviar-confirmacao', reenviarConfirmacao);

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
            <style>
                body {
                    background: #121212;
                    color: white;
                    font-family: Arial, sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                    text-align: center;
                    margin: 0;
                }

                .container {
                    padding: 30px;
                }

                h1 {
                    color: #2541ff;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1 id="titulo">Frotix</h1>
                <p id="mensagem">Verificando confirmação...</p>
            </div>

            <script>
                const params = new URLSearchParams(
                    window.location.hash.slice(1)
                );

                const erro = params.get('error_description');

                if (erro) {
                    document.getElementById('titulo').textContent = 'Ops!';
                    document.getElementById('mensagem').textContent = erro;
                } else {
                    document.getElementById('titulo').textContent = 'E-mail confirmado!';
                    document.getElementById('mensagem').textContent =
                        'Seu endereço foi confirmado. Agora você pode voltar ao Frotix e entrar na sua conta.';
                }
            </script>
        </body>
        </html>
    `);
});

export default router;
