-- =============================================================================
-- Frotix · Rastreamento do motorista durante a viagem (22/11/2026)
-- Branch: feature/localizacao-motorista
--
-- NÃO foi aplicada no Supabase. Revisar e rodar no SQL Editor do Supabase
-- quando aprovado.
-- Tudo roda dentro de uma transação: se algum comando falhar, nada é aplicado.
--
-- O app do motorista envia a posição GPS enquanto a viagem está EM_ANDAMENTO.
-- O mapa da Home (Admin/Gestor) lê a última posição para mostrar em que ponto
-- da rota o motorista está.
-- =============================================================================

begin;

create table if not exists public.posicoes_viagem (
  id             uuid primary key default gen_random_uuid(),
  id_viagem      uuid not null references public.viagens(id) on delete cascade,
  id_motorista   uuid not null references public.usuarios(id),
  latitude       double precision not null check (latitude between -90 and 90),
  longitude      double precision not null check (longitude between -180 and 180),
  precisao_m     real check (precisao_m >= 0),
  velocidade_ms  real check (velocidade_ms >= 0),
  registrada_em  timestamptz not null,
  recebida_em    timestamptz not null default now(),
  -- Evita gravar a mesma leitura duas vezes quando o app reenvia a fila offline.
  unique (id_viagem, registrada_em)
);

comment on table public.posicoes_viagem is
  'Leituras de GPS enviadas pelo app do motorista durante uma viagem em andamento.';
comment on column public.posicoes_viagem.registrada_em is
  'Momento em que o celular leu o GPS (pode ser anterior a recebida_em se o envio ficou na fila offline).';

-- Consulta principal: "última posição desta viagem".
create index if not exists posicoes_viagem_viagem_data_idx
  on public.posicoes_viagem (id_viagem, registrada_em desc);

-- O backend acessa com a service_role; ninguém lê direto pelo client.
alter table public.posicoes_viagem enable row level security;

commit;
