-- =============================================================================
-- Frotix · Migração das funcionalidades que faltavam (21/11/2026)
-- Branch: feature/funcionalidades-faltando
--
-- NÃO foi aplicada no Supabase. Revisar no PR e rodar uma vez no SQL Editor,
-- DEPOIS das migrações de 19/11 e 20/11 e ANTES de publicar este backend.
-- Tudo roda dentro de uma transação: se algum comando falhar, nada é aplicado.
-- Pode rodar de novo sem problema (usa "if not exists").
--
-- Conferido no banco real em 21/11: a de 19/11 já foi aplicada; a de 20/11 ainda NÃO
-- (falta viagens.distancia_prevista_km). lancamentos_financeiros.status não tinha regra
-- (check) nenhuma e só tem PAGO/PENDENTE, então a regra nova entra sem conflito.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Estorno (rollback) de lançamentos
--    O lançamento não é apagado: fica com status CANCELADO e guarda quem,
--    quando e por quê. As contas do app ignoram os CANCELADOS.
-- -----------------------------------------------------------------------------
-- Função de apoio: cria uma coluna com o mesmo tipo do "id" da tabela referenciada
-- (assim funciona se o id for uuid, integer ou bigint). Removida no fim.
create or replace function pg_temp.coluna_ref(tabela text, coluna text, ref text) returns void
language plpgsql as $$
declare
  tipo text;
begin
  select format_type(a.atttypid, a.atttypmod) into tipo
    from pg_attribute a
   where a.attrelid = format('public.%I', ref)::regclass and a.attname = 'id';
  execute format('alter table public.%I add column if not exists %I %s references public.%I(id)', tabela, coluna, tipo, ref);
end $$;

select pg_temp.coluna_ref('lancamentos_financeiros', 'cancelado_por', 'usuarios');

alter table public.lancamentos_financeiros
  add column if not exists cancelado_em        timestamptz,
  add column if not exists motivo_cancelamento text,
  -- id gerado no celular para o envio offline não duplicar o lançamento.
  -- A coluna id_local já existe no Supabase (vazia); o "if not exists" só cria se faltar.
  add column if not exists id_local            varchar(64);

create unique index if not exists lancamentos_id_local_uidx
  on public.lancamentos_financeiros (id_local) where id_local is not null;

create index if not exists lancamentos_viagem_idx       on public.lancamentos_financeiros (id_viagem);
create index if not exists lancamentos_financiamento_idx on public.lancamentos_financeiros (id_financiamento);

-- Garante que o status aceita CANCELADO. Troca a regra (check) antiga da coluna
-- status, se ela não aceitar, por uma que aceita PENDENTE, PAGO e CANCELADO.
do $$
declare
  regra record;
begin
  for regra in
    select c.conname, pg_get_constraintdef(c.oid) as def
      from pg_constraint c
     where c.conrelid = 'public.lancamentos_financeiros'::regclass
       and c.contype = 'c'
       and pg_get_constraintdef(c.oid) ilike '%status%'
  loop
    if regra.def not ilike '%CANCELADO%' then
      execute format('alter table public.lancamentos_financeiros drop constraint %I', regra.conname);
    end if;
  end loop;

  if not exists (
    select 1 from pg_constraint c
     where c.conrelid = 'public.lancamentos_financeiros'::regclass
       and c.contype = 'c'
       and pg_get_constraintdef(c.oid) ilike '%CANCELADO%'
  ) then
    alter table public.lancamentos_financeiros
      add constraint lancamentos_status_check
      check (status in ('PENDENTE', 'PAGO', 'CANCELADO'));
  end if;
end $$;

-- Dívida cancelada (as parcelas pendentes viram CANCELADO; as pagas ficam no histórico).
alter table public.financiamentos
  add column if not exists cancelado_em timestamptz;

-- -----------------------------------------------------------------------------
-- 2. Abastecimentos (consumo médio real por veículo)
--    Cada abastecimento também gera uma saída em lancamentos_financeiros
--    (id_lancamento), ligada à viagem quando houver.
-- -----------------------------------------------------------------------------
create table if not exists public.abastecimentos (
  id             uuid primary key default gen_random_uuid(),
  id_veiculo     uuid not null references public.veiculos(id),
  data           date not null,
  litros         numeric(10,2) not null check (litros > 0),
  valor_total    numeric(12,2) not null check (valor_total >= 0),
  hodometro      numeric(12,1) not null check (hodometro >= 0),
  posto          varchar(120),
  id_local       varchar(64),
  criado_em      timestamptz not null default now()
);

select pg_temp.coluna_ref('abastecimentos', 'id_viagem', 'viagens');
select pg_temp.coluna_ref('abastecimentos', 'id_motorista', 'usuarios');
select pg_temp.coluna_ref('abastecimentos', 'id_lancamento', 'lancamentos_financeiros');

create index if not exists abastecimentos_veiculo_idx on public.abastecimentos (id_veiculo);
create unique index if not exists abastecimentos_id_local_uidx
  on public.abastecimentos (id_local) where id_local is not null;

-- Mesmo padrão das outras tabelas novas: o backend usa a chave de serviço;
-- a chave pública (anon) do app não lê nem grava direto.
alter table public.abastecimentos enable row level security;

drop function pg_temp.coluna_ref(text, text, text);

commit;
