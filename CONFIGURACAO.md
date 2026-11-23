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
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` | `SUPABASE_SERVICE_ROLE_KEY` é obrigatória para o cliente privilegiado do backend e deve permanecer somente no servidor. `SUPABASE_ANON_KEY` é usada apenas pelo cliente de autenticação do backend; não substitua a chave de serviço pela chave anônima ou por `SUPABASE_KEY`. |
| `JWT_SECRET` | Assina o token de login. **Obrigatório**: o backend não sobe sem ele (mínimo 32 caracteres) |
| `GOOGLE_WEB_CLIENT_ID` | Confere o login com Google (o mesmo de `src/config/google.js`) |
| `EXPO_PUBLIC_API_URL` | Sobrescreve o backend somente em desenvolvimento. Builds de produção usam `https://frotix.onrender.com`. |
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

Para usar o backend local durante o desenvolvimento, coloque no `.env`:

```
EXPO_PUBLIC_API_URL=http://localhost:3000
```

Em um aparelho Android conectado por USB, encaminhe a porta com `adb reverse tcp:3000 tcp:3000`. No emulador Android, use `http://10.0.2.2:3000`. Reinicie o Metro depois de mudar o `.env`. Builds de produção ignoram essa sobrescrita local e usam o backend do Render.

## 5. Login e permissões

Todas as rotas, menos `/auth/*`, exigem o token devolvido no login (`Authorization: Bearer <token>`). O token vale 12 horas.

| Perfil | Pode |
| --- | --- |
| Admin (1) | Tudo |
| Gestor de Frota (2) | Veículos, rotas, viagens, manutenções, relatórios |
| Financeiro (3) | Números financeiros, categorias, formas de pagamento, usuários, relatórios |
| Motorista (4) | As próprias viagens e lançamentos, enviar comprovantes |
