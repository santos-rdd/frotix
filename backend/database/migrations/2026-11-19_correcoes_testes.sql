-- =============================================================================
-- Frotix · Migração das correções dos testes de 19/11/2026
-- Branch: fix/correcoes-testes
--
-- NÃO foi aplicada no Supabase. Revisar no PR e rodar uma vez no SQL Editor
-- do projeto, ANTES de publicar o backend desta branch no Render.
-- Tudo roda dentro de uma transação: se algum comando falhar, nada é aplicado.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Veículos (erro P6: a tela de veículos usava dados de exemplo)
-- -----------------------------------------------------------------------------
create table if not exists public.veiculos (
  id             uuid primary key default gen_random_uuid(),
  modelo         varchar(80)  not null,
  placa          varchar(8)   not null unique,
  ano            integer      check (ano between 1980 and 2100),
  hodometro      numeric(12,1) not null default 0 check (hodometro >= 0),
  consumo_medio  numeric(6,2) check (consumo_medio > 0),
  status         varchar(20)  not null default 'DISPONIVEL'
                 check (status in ('DISPONIVEL', 'EM_VIAGEM', 'MANUTENCAO')),
  ativo          boolean      not null default true,
  criado_em      timestamptz  not null default now()
);

-- -----------------------------------------------------------------------------
-- 2. Rotas = viagens planejadas (erros P6, P10, P11)
--    A tabela viagens já aceita o status PLANEJADA. Uma "rota agendada" do app
--    é uma viagem PLANEJADA; ao abrir a viagem ela vira EM_ANDAMENTO e, ao
--    fechar, CONCLUIDA. Assim não é preciso uma tabela de rotas separada.
-- -----------------------------------------------------------------------------
alter table public.viagens
  add column if not exists id_veiculo       uuid references public.veiculos(id),
  add column if not exists data_saida       date,
  add column if not exists receita_prevista numeric(12,2) check (receita_prevista >= 0);

-- iniciada_em hoje é preenchida na criação; para viagens planejadas ela só
-- deve ser preenchida quando a viagem abrir.
alter table public.viagens alter column iniciada_em drop default;

create index if not exists viagens_motorista_idx on public.viagens (id_motorista);
create index if not exists viagens_status_idx    on public.viagens (status);

-- -----------------------------------------------------------------------------
-- 3. Manutenções / ordens de serviço (erro P6)
-- -----------------------------------------------------------------------------
create table if not exists public.manutencoes (
  id           uuid primary key default gen_random_uuid(),
  id_veiculo   uuid not null references public.veiculos(id),
  tipo         varchar(20) not null
               check (tipo in ('preventiva', 'corretiva', 'troca_oleo', 'pneus', 'freios', 'revisao')),
  data         date not null,
  oficina      varchar(120) not null,
  custo        numeric(12,2) not null default 0 check (custo >= 0),
  observacoes  text,
  status       varchar(20) not null default 'AGENDADA'
               check (status in ('AGENDADA', 'EM_ANDAMENTO', 'CONCLUIDA')),
  criado_em    timestamptz not null default now()
);

create index if not exists manutencoes_veiculo_idx on public.manutencoes (id_veiculo);

-- -----------------------------------------------------------------------------
-- 4. Formas de pagamento com tipo e dados do cartão/Pix (erro P4)
--    O carrossel do app mostra o tipo (débito, crédito, Pix...) e o titular.
-- -----------------------------------------------------------------------------
alter table public.formas_pagamento
  add column if not exists tipo     varchar(20) not null default 'outros'
           check (tipo in ('debito', 'credito', 'pix', 'boleto', 'dinheiro', 'outros')),
  add column if not exists titular  varchar(80),
  add column if not exists validade varchar(5),
  add column if not exists chave    varchar(120);

-- Preenche o tipo das formas que já existem, pelo nome.
update public.formas_pagamento set tipo = 'pix'      where tipo = 'outros' and nome ilike '%pix%';
update public.formas_pagamento set tipo = 'credito'  where tipo = 'outros' and nome ilike '%crédito%';
update public.formas_pagamento set tipo = 'debito'   where tipo = 'outros' and nome ilike '%débito%';
update public.formas_pagamento set tipo = 'boleto'   where tipo = 'outros' and nome ilike '%boleto%';
update public.formas_pagamento set tipo = 'dinheiro' where tipo = 'outros' and nome ilike '%dinheiro%';

-- -----------------------------------------------------------------------------
-- 5. Senhas em texto puro (erro C3)
--    O login por e-mail usa o Supabase Auth; a coluna password não é mais usada
--    pelo backend. Duas contas antigas tinham senha salva em texto puro.
--    ATENÇÃO: não tem volta. Essas duas contas (Andre Silva e joao.silva@email.com)
--    precisam de cadastro pelo Supabase Auth se ainda forem usadas.
-- -----------------------------------------------------------------------------
alter table public.usuarios drop column if exists password;

-- -----------------------------------------------------------------------------
-- 6. Segurança das tabelas novas (erro C2)
--    O backend usa a chave de serviço, que ignora o RLS. Com RLS ligado e sem
--    políticas, a chave pública (anon) do app não lê nem grava nada direto.
-- -----------------------------------------------------------------------------
alter table public.veiculos    enable row level security;
alter table public.manutencoes enable row level security;

commit;

-- -----------------------------------------------------------------------------
-- O bucket de comprovantes (erro I1) NÃO é criado aqui: o Supabase bloqueia
-- inserts diretos em storage.buckets. O backend cria o bucket privado
-- "comprovantes" sozinho no primeiro upload.
-- -----------------------------------------------------------------------------
