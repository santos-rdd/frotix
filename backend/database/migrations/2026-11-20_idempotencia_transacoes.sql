begin;

alter table public.financiamentos
  add column if not exists id_local varchar(64);

create unique index if not exists financiamentos_usuario_id_local_uidx
  on public.financiamentos (id_usuario, id_local)
  where id_local is not null;

alter table public.lancamentos_financeiros
  add column if not exists id_local varchar(64);

create unique index if not exists lancamentos_usuario_id_local_uidx
  on public.lancamentos_financeiros (id_usuario, id_local)
  where id_local is not null;

commit;
