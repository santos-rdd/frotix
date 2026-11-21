# 🚛 FrotiX · Gestão Financeira e Controle de Frota

Aplicativo mobile para empresas de logística: fluxo de caixa, dívidas, frota, viagens e
relatórios no mesmo lugar, com perfis de acesso e modo offline para o motorista.

> **Como configurar e rodar:** veja [CONFIGURACAO.md](CONFIGURACAO.md).

---

## 📱 Funcionalidades

### Acesso
- Login com Google (OAuth 2.0) e com e-mail e senha (Supabase Auth).
- Sessão salva no celular: com o token ainda válido (12 h), o app abre direto na Home.
- Quatro perfis, com telas e permissões próprias (o backend confere tudo):

| Perfil | Pode |
| --- | --- |
| Admin (1) | Tudo |
| Gestor de Frota (2) | Veículos, rotas, viagens, manutenções, abastecimentos, relatórios, alertas da frota |
| Financeiro (3) | Extrato, dívidas, previsão de caixa, estornos, categorias, formas de pagamento, usuários, relatórios |
| Motorista (4) | As próprias viagens, despesas, abastecimentos e comprovantes (funciona sem internet) |

### Financeiro
- Entradas, saídas e dívidas com anexo de comprovante (foto ou PDF no Storage).
- Lançamento ligado à viagem (é o que alimenta o custo por km e a rentabilidade).
- **Extrato** com filtros por período, tipo, status e busca.
- **Estorno (rollback)**: o lançamento não é apagado, fica "estornado" com motivo, quem e quando, e sai de todos os totais.
- Marcar como pago e desfazer o pagamento.
- **Dívidas**: parcelas geradas automaticamente, pagar parcela, cancelar a dívida (as pendentes são canceladas, as pagas ficam no histórico).
- **Previsão de caixa**: saldo atual + contas e parcelas pendentes + fretes agendados + manutenções previstas, mês a mês.
- **Alertas**: contas vencidas, pagamentos da semana, recebimentos atrasados, saldo previsto negativo.

### Frota
- Veículos com validação de placa (antiga e Mercosul), status, edição e desativação.
- Rotas agendadas (editar e excluir), abertura e fechamento de viagem com hodômetro (km final > inicial).
- Manutenções: agendar, iniciar, concluir, editar e excluir.
- **Abastecimentos**: geram a saída no financeiro e calculam o **consumo médio real** (km/l).
- Rentabilidade por viagem (receita − custos, margem e custo por km).
- **Alertas**: manutenção atrasada, viagem aberta há muito tempo, rota agendada não iniciada.

### Painéis e relatórios
- Home de cada perfil com os números do backend.
- Relatório com saldo, margem, km, custo por km, rotas por status, **ranking por veículo e por rota** e **gráfico mensal de entradas e saídas**.
- Exportação em **PDF** e em **Excel (.xlsx)**, com uma aba para cada parte.

### Modo offline (motorista)
- Sem internet, abrir/fechar viagem, despesas (com fotos), abastecimentos e comprovantes ficam salvos no celular.
- Quando a internet volta, tudo é enviado sozinho, na mesma ordem. Um aviso mostra o que falta enviar.
- O backend não duplica um envio repetido (campo `idCliente`).

---

## 🛠️ Tecnologias

- **App:** React Native 0.86 + Expo SDK 57, React Navigation, Google Sign-In,
  AsyncStorage + NetInfo (modo offline), expo-print / expo-sharing (exportação), fflate (.xlsx).
- **Backend:** Node.js (ES Modules) + Express 5, JWT, Multer, testes com `node:test`.
- **Banco:** PostgreSQL no Supabase (tabelas `usuarios`, `veiculos`, `viagens`, `categorias_financeiras`,
  `formas_pagamento`, `financiamentos`, `lancamentos_financeiros`, `manutencoes`, `abastecimentos`).

---

## 📡 Rotas principais da API

Todas, menos `/auth/*`, exigem `Authorization: Bearer <token>`.

| Área | Rotas |
| --- | --- |
| Login | `POST /auth/login-google`, `POST /auth/login-email`, `POST /auth/cadastro` |
| Lançamentos | `POST /financeiro/transacoes`, `GET /financeiro/lancamentos`, `POST /financeiro/lancamentos/:id/estornar`, `.../pagar`, `.../desfazer-pagamento` |
| Dívidas | `GET /financeiro/dividas`, `GET /financeiro/dividas/:id`, `POST /financeiro/dividas/:id/cancelar` |
| Painéis | `GET /financeiro/resumo-geral`, `GET /financeiro/previsao`, `GET /financeiro/fluxo-mensal`, `GET /alertas` |
| Frota | `GET/POST /frota/veiculos`, `PUT/DELETE /frota/veiculos/:id`, `GET/POST /frota/rotas`, `PUT/DELETE /frota/rotas/:id`, `POST /frota/rotas/:id/abrir`, `.../concluir` |
| Manutenção | `GET/POST /frota/manutencoes`, `PUT/DELETE /frota/manutencoes/:id`, `POST /frota/manutencoes/:id/avancar` |
| Abastecimento | `GET/POST /frota/abastecimentos` |
| Relatório | `GET /frota/resumo`, `GET /frota/relatorio` |
| Cadastros | `/categorias`, `/formas-pagamento`, `/usuarios`, `POST /comprovantes/upload` |

---

## 📁 Estrutura

```
frotix/
├── App.js                  # Navegação, sessão salva e início do modo offline
├── backend/
│   ├── controllers/        # Regras de cada área (financeiro, frota, cadastros, login)
│   ├── database/migrations # Mudanças no banco (rodar no SQL Editor do Supabase)
│   ├── routes/             # Rotas Express e permissões por perfil
│   ├── tests/              # Testes com Supabase falso em memória
│   └── utils/              # Cálculos compartilhados (km, custo por km, fluxo mensal)
└── src/
    ├── components/         # Peças reutilizáveis (cards, gráficos, formulários)
    ├── screens/            # Telas (uma pasta por tela)
    ├── services/           # api.js (token e sessão), frotix.js (chamadas), offline.js (fila)
    └── utils/xlsx.js       # Gerador de planilha Excel
```
