# 📘 Documentação Detalhada da Mesclagem (Front-End) - FrotiX

Este documento explica detalhadamente como o projeto **FrotiX** recebeu e integrou as telas vindas da pasta `TelasFrotix-main`, respeitando estritamente a arquitetura de pastas, o padrão de código em JavaScript puro (`.js`) e as dependências já existentes no projeto original.

---

## 🏗️ 1. Padrão Arquitetural e Regras de Pastas

O projeto original do FrotiX adota a seguinte convenção rigorosa:
- **Telas**: cada tela reside em sua própria pasta dentro de `src/screens/<nomeDaTela>/<nomeDaTela>.js`.
- **Componentes**: cada componente reutilizável reside em sua pasta dentro de `src/components/<nomeDoComponente>/<nomeDoComponente>.js`.
- **Extensão**: 100% JavaScript padrão (`.js`) com módulos ES (`import`/`export`).
- **Ícones**: exclusivamente `@expo/vector-icons` (`Ionicons`, `Feather`, `MaterialCommunityIcons`, `FontAwesome5`).
- **Navegação**: exclusivamente `@react-navigation/native-stack` via propriedades `{ navigation, route }`.

Nenhuma biblioteca nova precisou ser instalada no `package.json`. Tudo roda diretamente com o que o FrotiX já possui.

---

## 🔄 2. Arquivos Existentes que Foram Alterados (Mínimo de Código Possível)

### 📄 `frotix/App.js`
- **O que foi feito**: 
  1. Removidos conflitos de mesclagem (`<<<<<<< HEAD`, `=======`) que estavam presentes no final do arquivo.
  2. Importada a tela `AdmFormaPag` (`import AdmFormaPag from './src/screens/admFormaPag/admFormaPag.js';`).
  3. Adicionada a rota `<Stack.Screen name="AdmFormaPag" component={AdmFormaPag} />` ao `Stack.Navigator`.
- **Impacto**: Todas as rotas existentes (`Home`, `Login`, `HomePage`, `LoginEmail`, `VerifyCodeScreen`) continuam intactas, e agora `AdmFormaPag` pode ser aberta diretamente de qualquer lugar pelo React Navigation.

---

### 📄 `frotix/src/screens/home/homePage.js`
- **O que foi feito**:
  1. Removidos conflitos de mesclagem (`<<<<<<< HEAD`) nas linhas de leitura de perfil e renderização de cabeçalho.
  2. Implementada a lógica de resolução do papel do usuário (`userRole`), respeitando o mapeamento do FrotiX:
     - `1`: Administrador (`AdminHomeScreen`)
     - `2`: Gestor de Frota (`GestorHomeScreen`)
     - `3`: Financeiro (`FinanceiroHomeScreen`)
     - `4`: Motorista (`MotoristaHomeScreen`)
  3. Adicionada uma barra superior de simulação/teste (`testerBar`) para alternar os perfis instantaneamente durante os testes no celular (possui botão "Ocultar").
  4. Mantido o `<BottomNavigation />` oficial do FrotiX no rodapé.
- **Impacto**: Quando o usuário faz login via Google ou e-mail/senha, a tela inicial renderiza automaticamente o painel específico do perfil dele vindo do banco (`bankUser.role`), sem quebrar nada do fluxo de autenticação já implementado.

---

## 🆕 3. Novas Telas Integradas (`src/screens/`)

### 1. `src/screens/adminHome/adminHomeScreen.js`
- **Origem**: `AdminHomeScreen.jsx`
- **Alterações**:
  - Convertido de `.jsx` para `.js`.
  - Removido `@react-spring/native` (usava animação externa incompatível); agora usa `TouchableOpacity` com feedback tátil nativo.
  - Substituído `lucide-react-native` por `@expo/vector-icons` (`Ionicons`, `Feather`, `MaterialCommunityIcons`).
  - Substituído `react-native-gifted-charts` pelo componente nativo e leve `donutChart.js`.
  - Integradas as 4 sub-seções de Ações Rápidas:
    - `0`: Métricas financeiras e quilometragem da frota.
    - `1`: Formas de Pagamento (`admFormaPag.js`).
    - `2`: Gerenciador de Usuários (`userControlSection.js`).
    - `3`: Rotas e Veículos (`rotasSection.js`).

### 2. `src/screens/gestorHome/gestorHomeScreen.js`
- **Origem**: `GestorHomeScreen.jsx`
- **Alterações**:
  - Convertido para `.js`.
  - Substituição de emojis/ícones estáticos por `@expo/vector-icons` (`MaterialCommunityIcons`, `Ionicons`).
  - Cards de status da frota (Em rota, Em manutenção, Disponíveis).
  - Ações rápidas operacionais (Cadastrar Veículo, Atribuir Motorista, Agendar Revisão).
  - Alertas críticos e resumo de desempenho da semana.

### 3. `src/screens/financeiroHome/financeiroHomeScreen.js`
- **Origem**: `FinanceiroHomeScreen.jsx`
- **Alterações**:
  - Convertido para `.js`.
  - Substituídos emojis por ícones vetoriais profissionais do `@expo/vector-icons`.
  - Gráfico de donut nativo embutido para Balanço Atual e Despesas.
  - Ações Rápidas conectadas à tela de `admFormaPag.js` via estado interno ou navegação.
  - Indicadores de custo por quilômetro e despesas registradas.

### 4. `src/screens/motoristaHome/motoristaHomeScreen.js`
- **Origem**: `MotoristaHomeScreen.jsx`
- **Alterações**:
  - Convertido para `.js`.
  - Substituição de emojis por ícones vetoriais.
  - Timeline visual da viagem em curso (Origem -> Destino).
  - Visualização de mapa e rota ativa.
  - Botão interativo para **Registrar Hodômetro** com alerta nativo de confirmação.

### 5. `src/screens/admFormaPag/admFormaPag.js`
- **Origem**: `AdmFormaPag.jsx`
- **Alterações**:
  - Convertido para `.js`.
  - Substituídos ícones do Lucide por `@expo/vector-icons` (`Ionicons`, `Feather`).
  - Carrossel horizontal de cartões, Pix e boletos bancários com filtro dinâmico de transações.
  - Sub-abas: **Opções** (Adicionar/Deletar cartão, registrar fluxo) vs **Atividade Recente** (histórico).
  - Modal nativo completo para registrar novas entradas e saídas financeiras.
  - Botão de voltar integrado com `navigation.goBack()`.

---

## 🧩 4. Novos Componentes Integrados (`src/components/`)

### 1. `src/components/donutChart/donutChart.js`
- **Novo componente**: Desenvolvido do zero para substituir bibliotecas pesadas de SVG/gráficos.
- **Funcionamento**: Utiliza anéis circulares concêntricos com bordas coloridas em proporções nativas do React Native. Leve, rápido e não requer nenhuma dependência externa.

### 2. `src/components/rotasSection/rotasSection.js`
- **Origem**: `RotasSection.jsx`
- **Alterações**: Convertido para `.js`, usa ícone de pin do `@expo/vector-icons`, linha de trajeto entre cidades e disparador de registro de hodômetro.

### 3. `src/components/userControlSection/userControlSection.js`
- **Origem**: `UserControlSection.jsx`
- **Alterações**: Convertido para `.js`, gerencia a transição de visualização entre o menu inicial, o formulário de cadastro e a grade de usuários.

### 4. `src/components/cadastrarUsuario/cadastrarUsuario.js`
- **Origem**: `CadastrarUsuario.jsx`
- **Alterações**: Convertido para `.js`, ícones `@expo/vector-icons`, modal de seleção de perfil com as 4 categorias do FrotiX (Administrador, Gestor de Frota, Financeiro, Motorista).

### 5. `src/components/gerenciarUsuariosGrid/gerenciarUsuariosGrid.js`
- **Origem**: `GerenciarUsuariosGrid.jsx`
- **Alterações**: Convertido para `.js`, grade de usuários com legenda de cores por perfil e ícones de usuário do `@expo/vector-icons`.

### 6. `src/components/actionGrid/actionGrid.js`
- **Origem**: `ActionGrid.jsx`
- **Alterações**: Convertido para `.js`, botões com ícones vetoriais de ações rápidas.

### 7. `src/components/metricCard/metricCard.js`
- **Origem**: `MetricCard.jsx`
- **Alterações**: Convertido para `.js`, card reutilizável de métricas com título, valor e subtítulo.

---

## 🎨 5. Constantes de Estilização (`src/constants/theme.js`)

Centraliza os tons do modo escuro e as cores oficiais do FrotiX:
- `background`: `#121212` (Fundo dark padrão)
- `primaryBlue`: `#3B56FF` (Azul principal de botões)
- `cardBlue`: `#2541FF` (Azul de destaque dos cartões)
- `cardBg`: `#1E1E1E` (Fundo dos cards)
- `redDanger`, `greenSuccess`, `yellowWarning` (Cores de status)

---

## 🚀 6. Como Rodar e Testar

1. No terminal do seu projeto:
   ```bash
   npx expo start
   ```
2. Ao abrir o aplicativo e efetuar login:
   - Se logar com um usuário do banco ou Google, a tela inicial abrirá com o perfil correspondente dele.
   - Você verá uma barra no topo: **"FrotiX - Alternar Perfil: [1. ADM] [2. Gestor] [3. Finan] [4. Motor.]"**.
   - Clicando em qualquer um dos botões, você testa as telas e funcionalidades de cada perfil na hora!
   - Clicando em **"Ocultar"**, a barra desaparece para simular a visão real de produção.
