-- =============================================================================
-- Frotix · Migração da distância prevista para rotas planejadas (20/11/2026)
-- Branch: fix/correcoes-testes
--
-- NÃO foi aplicada no Supabase. Revisar e rodar no SQL Editor do Supabase
-- quando aprovado.
-- Tudo roda dentro de uma transação: se algum comando falhar, nada é aplicado.
-- =============================================================================

begin;

-- Adiciona a coluna para a distância rodoviária prevista informada no cadastro da rota.
-- Permanece isolada dos campos km_inicial e km_final do hodômetro.
alter table public.viagens
  add column if not exists distancia_prevista_km numeric(10, 1) check (distancia_prevista_km >= 0);

comment on column public.viagens.distancia_prevista_km is
  'Distância rodoviária prevista informada no planejamento da rota (km). Não substitui a quilometragem real obtida pelo hodômetro.';

commit;
