# Como rodar o Frotix

## 1. Depois de puxar a `main`

Sempre que alguém adicionar uma biblioteca, rode:

```bash
npm install
npx expo run:android
```

- `npm install` baixa o que falta em `node_modules`.
- `npx expo run:android` recompila o app. Isso é necessário quando a biblioteca nova tem parte nativa (como `expo-print`). Sem isso, o app abre com tela vermelha "Unable to resolve module".

## 2. Arquivo `.env` (na raiz do projeto)

Copie o `.env.example` para `.env` e preencha. O `.env` nunca vai para o GitHub.

| Variável | Para quê |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` | Conexão do backend com o banco; a chave `service_role` é exclusiva do backend |
| `JWT_SECRET` | Assina o token de login. **Obrigatório**: o backend não sobe sem ele (mínimo 32 caracteres) |
| `GOOGLE_WEB_CLIENT_ID` | Confere o login com Google (o mesmo de `src/config/google.js`) |
| `EXPO_PUBLIC_API_URL` | Opcional. Endereço do backend usado pelo app. Vazio = Render |
| `EMAIL_CONFIRM_REDIRECT_URL` | Destino já utilizado pela confirmação de cadastro no Supabase |
| `PASSWORD_RECOVERY_REDIRECT_URL` | Deep link de recuperação; padrão local `frotix://auth/recovery` |

Para gerar um `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

No Render, as mesmas variáveis vão em **Environment**.

## 3. Banco de dados

As mudanças no banco ficam em `backend/database/migrations/`. Cada arquivo roda **uma vez** no SQL Editor do Supabase, antes de publicar o backend que depende dele.

- `2026-11-19_correcoes_testes.sql`: tabelas `veiculos` e `manutencoes`, colunas novas em `viagens` e `formas_pagamento`, e remoção da coluna `password` de `usuarios`.

Para recuperação de senha, autorize `frotix://auth/recovery` em **Supabase Auth > URL Configuration > Redirect URLs** e mantenha o template de recuperação usando o link oficial `{{ .ConfirmationURL }}`. A confirmação de cadastro continua usando `EMAIL_CONFIRM_REDIRECT_URL` e seu fluxo existente. Não foi configurada nem presumida uma URL de produção.

## 4. Rodar

```bash
npm run backend          # backend local na porta 3000
npx expo start --dev-client
npm run test:backend     # testes do backend (sem tocar no banco de verdade)
```

Para o app do emulador usar o backend local, coloque no `.env`:

```
EXPO_PUBLIC_API_URL=http://10.0.2.2:3000
```

O `10.0.2.2` é como o emulador Android enxerga o `localhost` do computador. Reinicie o Metro depois de mudar o `.env`.

## 5. Login e permissões

Todas as rotas, menos `/auth/*`, exigem o token devolvido no login (`Authorization: Bearer <token>`). O token vale 12 horas.

| Perfil | Pode |
| --- | --- |
| Admin (1) | Tudo |
| Gestor de Frota (2) | Veículos, rotas, viagens, manutenções, relatórios |
| Financeiro (3) | Números financeiros, categorias, formas de pagamento, usuários, relatórios |
| Motorista (4) | As próprias viagens e lançamentos, enviar comprovantes |
