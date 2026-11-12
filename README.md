 # 🚛 FrotiX - Sistema de Gestão e Controle

    O **FrotiX** é uma aplicação mobile moderna desenvolvida para
  simplificar a gestão e o controle de frotas e serviços, oferecendo
  uma experiência fluida de autenticação e visualização financeira.

    Este repositório contém tanto o aplicativo mobile (**React
  Native / Expo**) quanto a API de autenticação (**Node.js /
  Express**) integrada a um banco de dados relacional
  (**PostgreSQL**).

    ---

    ## 📱 Funcionalidades Demonstradas no Vídeo

    1. **Apresentação Inicial (Onboarding):**
       * Tela inicial com identidade visual moderna e botão de
  acesso rápido.
    2. **Autenticação Dupla:**
       * **Login com Google (OAuth 2.0 Nativo):** Integração via
  Google Play Services, permitindo autenticação direta com conta
  Gmail institucional ou pessoal.
       * **Login Tradicional:** Autenticação por e-mail e senha
  cadastrados previamente.
    3. **Validação de Acesso via Backend:**
       * Verificação em tempo real de e-mails autorizados
  diretamente na base de dados PostgreSQL.
    4. **Dashboard Principal (HomePage):**
       * Saudação personalizada com o nome e foto de perfil do
  usuário autenticado.
       * Resumo financeiro (balanço atual, entradas e saídas).
       * Carrossel de ações rápidas (Categorias financeiras, formas
  de pagamento, gestão de usuários).
       * Barra inferior de navegação rápida.

    ---

    ## 🛠️ Tecnologias Utilizadas

    ### **Mobile (Front-end)**
    * [React Native](https://reactnative.dev/) (v0.86) &
  [Expo](https://expo.dev/) (SDK 57)
    * [@react-native-google-signin/google-signin](https://github.
  com/react-native-google-signin/google-signin) (Autenticação nativa
  com Google Play Services)
    * [@react-navigation/native-stack](https://reactnavigation.org/)
  (Navegação entre telas)
    * [Expo Vector Icons](https://docs.expo.dev/guides/icons/)
  (Feather, Ionicons, MaterialCommunityIcons)

    ### **Back-end**
    * [Node.js](https://nodejs.org/) (ES Modules)
    * [Express 5](https://expressjs.com/)
    * [node-postgres (pg)](https://node-postgres.com/) (Pool de
  conexões com PostgreSQL)

    ### **Banco de Dados**
    * [PostgreSQL](https://www.postgresql.org/)

    ---

    ## 📋 Pré-requisitos para Reprodução

    Antes de começar, certifique-se de ter instalado em sua máquina:
    * **Node.js** (versão 20 ou superior) e **npm**
    * **Java JDK 17** e variáveis de ambiente (`JAVA_HOME`)
  configuradas
    * **Android SDK & Platform Tools (adb)** configurados no `PATH`
    * **PostgreSQL** instalado e rodando localmente (porta 5432)
    * **Dispositivo Android Físico** com a *Depuração USB* ativada
  conectado via cabo (ou Emulador Android com Google Play Store)

    ---

    ## 🚀 Passo a Passo para Reproduzir o Projeto

    ### 1. Clonar o Repositório
    ```bash
    git clone https://github.com/SEU_USUARIO/frotix.git
    cd frotix

  ### 2. Instalar as Dependências

    npm install
  ──────
  ### 3. Configuração do Banco de Dados (PostgreSQL)

  1. Abra o seu cliente PostgreSQL (pgAdmin, DBeaver ou terminal
  psql).
  2. Crie a base de dados chamada frotix:
    CREATE DATABASE frotix;

  3. Conecte-se ao banco frotix e crie a tabela de usuários:
    CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        password VARCHAR(255),
        role VARCHAR(50) DEFAULT 'user'
    );

  4. Insira um usuário de teste (utilize o seu e-mail do Gmail para
  testar o Google Sign-In e uma senha para testar o login
  tradicional):
    INSERT INTO users (name, email, password, role)
    VALUES
    ('Seu Nome', 'seu_email@gmail.com', '123456', 'admin');


  │ Nota: Certifique-se de que as credenciais do banco em
  │ backend/database/db.js coincidem com a senha do seu PostgreSQL
  │ local.
  ──────
  ### 4. Inicializar o Servidor Backend

  Abra um terminal dedicado para o servidor Node.js e execute:

    node --watch backend/server.js

  • O servidor iniciará na porta 3000 (http://localhost:3000).
  ──────
  ### 5. Configurar o Túnel de Comunicação USB (ADB Reverse)

  Como o aplicativo mobile roda no celular e a API roda no
  computador, configure o redirecionamento de portas via cabo USB:

    adb reverse tcp:3000 tcp:3000
    adb reverse tcp:8081 tcp:8081

  │ Dica: Sempre que desconectar o cabo USB do computador, repita
  │ esse comando para reativar o túnel.
  ──────
  ### 6. Executar o Aplicativo Mobile

  Com o celular conectado e reconhecido pelo adb devices, inicie o
  build nativo:

    npx expo run:android

  Ou inicie o Metro Bundler:

    npx expo start
  ──────
  ## 🔑 Configuração da Autenticação Google (OAuth 2.0)

  Para o login nativo com o Google funcionar sem erros
  (DEVELOPER_ERROR / code: 10), o aplicativo precisa estar
  registrado no Google Cloud Console
  https://console.cloud.google.com/:

  1. Credencial do Tipo Android:
      • Nome do Pacote: com.frotix.android
      • SHA-1 do Certificado: O SHA-1 da chave de debug do projeto:
        5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25

  2. Credencial do Tipo Aplicativo da Web (Web Client):
      • Criada no mesmo projeto para emissão do ID Token/offline
      access.
      • O ID do cliente Web gerado deve estar referenciado em
      src/config/google.js:
        export const GOOGLE_CONFIG = {
          webClientId: 'SEU_WEB_CLIENT_ID.apps.googleusercontent.
      com'
        };

  3. Tela de Consentimento OAuth:
      • Caso o projeto esteja com status "Em teste", o e-mail que
      fará o login no celular deve ser cadastrado na lista de
      Usuários de teste.

  ──────
  ## 📡 Rotas da API (Endpoints)

   Método │ Rota             │ Descrição        │ Payload (Body)
  ────────┼──────────────────┼──────────────────┼───────────────────
   POST   │ /auth/login-     │ Valida           │ {"email":
          │ google           │ autorização de   │ "usuario@gmail.co
          │                  │ e-mail           │ m"}
          │                  │ autenticado pelo │
          │                  │ Google           │
   POST   │ /auth/login-     │ Autentica        │ {"email":
          │ email            │ usuário          │ "usuario@email.co
          │                  │ tradicional com  │ m", "password":
          │                  │ e-mail e senha   │ "123"}
  ──────
  ## 📁 Estrutura de Pastas do Projeto

    frotix/
    ├── assets/                 # Ícones, imagens da frota e logos
    ├── backend/                # Servidor Node.js
    │   ├── controllers/        # Lógica das rotas (login com Google
  e login com email)
    │   ├── database/           # Configuração de conexão com
  PostgreSQL
    │   ├── routes/             # Definição das rotas Express
  (/auth)
    │   └── server.js           # Ponto de entrada do servidor
  Express
    ├── src/                    # Código fonte do aplicativo React
  Native
    │   ├── components/         # Componentes reutilizáveis
  (BottomNav, QuickActions, Cards)
    │   ├── config/             # Configurações de API e chaves do
  Google
    │   └── screens/            # Telas (HomeScreen, LoginScreen,
  HomePage)
    ├── app.json                # Configuração do Expo e metadados
  Android
    ├── App.js                  # Navegação principal
  (NavigationContainer / Stack)
    └── package.json            # Dependências e scripts do projeto
