# Como rodar o Frotix

## 1. Depois de puxar a `main`

Sempre que alguém adicionar uma biblioteca, rode:

```bash
npm install
npx expo run:android
```

- `npm install` baixa o que falta em `node_modules`.
- `npx expo run:android` recompila o app. Isso é necessário quando a biblioteca nova tem parte nativa (como `expo-print`, `@react-native-async-storage/async-storage` e `@react-native-community/netinfo`, usadas no modo offline). Sem isso, o app abre com tela vermelha "Unable to resolve module" ou "NativeModule: AsyncStorage is null".

## 2. Arquivo `.env` (na raiz do projeto)

Copie o `.env.example` para `.env` e preencha. O `.env` nunca vai para o GitHub.

| Variável | Para quê |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_ANON_KEY` | Conexão do backend com o banco |
| `JWT_SECRET` | Assina o token de login. **Obrigatório**: o backend não sobe sem ele (mínimo 32 caracteres) |
| `GOOGLE_WEB_CLIENT_ID` | Confere o login com Google (o mesmo de `src/config/google.js`) |
| `EXPO_PUBLIC_API_URL` | Opcional. Endereço do backend usado pelo app. Vazio = Render |

Para gerar um `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

No Render, as mesmas variáveis vão em **Environment**.

## 3. Banco de dados

As mudanças no banco ficam em `backend/database/migrations/`. Cada arquivo roda **uma vez** no SQL Editor do Supabase, antes de publicar o backend que depende dele.

- `2026-11-19_correcoes_testes.sql`: tabelas `veiculos` e `manutencoes`, colunas novas em `viagens` e `formas_pagamento`, e remoção da coluna `password` de `usuarios`.
- `2026-11-20_distancia_prevista.sql`: coluna `distancia_prevista_km` em `viagens`.
- `2026-11-21_funcionalidades_faltando.sql`: estorno (colunas `cancelado_em`, `cancelado_por`, `motivo_cancelamento` e status `CANCELADO` em `lancamentos_financeiros`), `cancelado_em` em `financiamentos`, `id_local` com índice único (envio offline sem duplicar; a coluna já existia vazia) e a tabela `abastecimentos`. Rodar **na ordem**, depois das duas anteriores. Pode rodar de novo sem problema.

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
| Gestor de Frota (2) | Veículos, rotas, viagens, manutenções, abastecimentos, relatórios, alertas da frota |
| Financeiro (3) | Extrato, dívidas, previsão, estornos, categorias, formas de pagamento, usuários, relatórios, alertas financeiros |
| Motorista (4) | As próprias viagens, lançamentos e abastecimentos, enviar comprovantes (funciona offline) |

## 6. Modo offline (motorista)

Sem internet, o que o motorista registra fica numa fila no celular e é enviado quando a conexão volta.
Para testar no emulador: desligue o Wi-Fi e os dados, abra/feche uma viagem ou lance uma despesa,
e religue. O aviso amarelo no topo das telas do motorista mostra o que falta enviar.
Ao sair da conta com itens na fila, o app avisa antes de apagar.
