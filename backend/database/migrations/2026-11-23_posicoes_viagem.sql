begin;

create table if not exists public.posicoes_viagem (
  id uuid primary key default gen_random_uuid(),
  id_viagem uuid not null references public.viagens(id) on delete restrict,
  id_motorista uuid not null references public.usuarios(id) on delete restrict,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  precisao_m real check (precisao_m is null or precisao_m >= 0),
  velocidade_ms real check (velocidade_ms is null or velocidade_ms >= 0),
  registrada_em timestamptz not null,
  recebida_em timestamptz not null default now(),
  constraint posicoes_viagem_id_viagem_registrada_em_key
    unique (id_viagem, registrada_em)
);

alter table public.posicoes_viagem
  add column if not exists precisao_m real,
  add column if not exists velocidade_ms real,
  add column if not exists recebida_em timestamptz not null default now();

do $migration$
declare
  v_tabela regclass := 'public.posicoes_viagem'::regclass;
  v_attnum smallint;
  v_refattnum smallint;
  v_tem_indice boolean;
  v_constraint record;
begin
  for v_constraint in
    select column_name
      from (values ('latitude'), ('longitude'), ('precisao_m'), ('velocidade_ms'))
        as columns_to_check(column_name)
  loop
    select attnum into v_attnum
      from pg_attribute
     where attrelid = v_tabela
       and attname = v_constraint.column_name
       and not attisdropped;

    if not exists (
      select 1
        from pg_constraint c
       where c.conrelid = v_tabela
         and c.contype = 'c'
         and c.conkey @> array[v_attnum]::smallint[]
    ) then
      if v_constraint.column_name = 'latitude' then
        alter table public.posicoes_viagem
          add constraint posicoes_viagem_latitude_range_check
          check (latitude between -90 and 90) not valid;
      elsif v_constraint.column_name = 'longitude' then
        alter table public.posicoes_viagem
          add constraint posicoes_viagem_longitude_range_check
          check (longitude between -180 and 180) not valid;
      elsif v_constraint.column_name = 'precisao_m' then
        alter table public.posicoes_viagem
          add constraint posicoes_viagem_precisao_m_check
          check (precisao_m is null or precisao_m >= 0) not valid;
      else
        alter table public.posicoes_viagem
          add constraint posicoes_viagem_velocidade_ms_check
          check (velocidade_ms is null or velocidade_ms >= 0) not valid;
      end if;
    end if;
  end loop;

  select exists (
    select 1
      from pg_index i
     where i.indrelid = v_tabela
       and i.indisunique
       and i.indisvalid
       and i.indpred is null
       and i.indnkeyatts = 2
       and (
         select array_agg(a.attname::text order by k.ordinality)
           from unnest(i.indkey) with ordinality as k(attnum, ordinality)
           join pg_attribute a
             on a.attrelid = i.indrelid and a.attnum = k.attnum
          where k.ordinality <= i.indnkeyatts
       ) = array['id_viagem', 'registrada_em']::text[]
  ) into v_tem_indice;
  if not v_tem_indice then
    if exists (
      select 1
        from public.posicoes_viagem
       group by id_viagem, registrada_em
      having count(*) > 1
    ) then
      raise exception 'Não foi criada a unicidade GPS: há posições com viagem e data duplicadas.';
    end if;
    create unique index posicoes_viagem_id_viagem_registrada_em_uidx
      on public.posicoes_viagem (id_viagem, registrada_em);
  end if;

  select attnum into v_attnum
    from pg_attribute
   where attrelid = v_tabela and attname = 'id_motorista' and not attisdropped;
  select attnum into v_refattnum
    from pg_attribute
   where attrelid = 'public.usuarios'::regclass and attname = 'id' and not attisdropped;
  if not exists (
    select 1
      from pg_constraint c
     where c.conrelid = v_tabela
       and c.contype = 'f'
       and c.conkey = array[v_attnum]::smallint[]
       and c.confrelid = 'public.usuarios'::regclass
       and c.confkey = array[v_refattnum]::smallint[]
  ) then
    alter table public.posicoes_viagem
      add constraint posicoes_viagem_id_motorista_fkey
      foreign key (id_motorista) references public.usuarios(id)
      on delete restrict not valid;
  end if;

  select attnum into v_attnum
    from pg_attribute
   where attrelid = v_tabela and attname = 'id_viagem' and not attisdropped;
  select attnum into v_refattnum
    from pg_attribute
   where attrelid = 'public.viagens'::regclass and attname = 'id' and not attisdropped;

  for v_constraint in
    select c.conname, c.confdeltype
      from pg_constraint c
     where c.conrelid = v_tabela
       and c.contype = 'f'
       and c.conkey = array[v_attnum]::smallint[]
       and c.confrelid = 'public.viagens'::regclass
       and c.confkey = array[v_refattnum]::smallint[]
  loop
    if v_constraint.confdeltype <> 'r' then
      execute format(
        'alter table public.posicoes_viagem drop constraint %I',
        v_constraint.conname
      );
    end if;
  end loop;

  if not exists (
    select 1
      from pg_constraint c
     where c.conrelid = v_tabela
       and c.contype = 'f'
       and c.conkey = array[v_attnum]::smallint[]
       and c.confrelid = 'public.viagens'::regclass
       and c.confkey = array[v_refattnum]::smallint[]
       and c.confdeltype = 'r'
  ) then
    alter table public.posicoes_viagem
      add constraint posicoes_viagem_id_viagem_fkey
      foreign key (id_viagem) references public.viagens(id)
      on delete restrict not valid;
  end if;

  select exists (
    select 1
      from pg_index i
     where i.indrelid = v_tabela
       and i.indisvalid
       and i.indpred is null
       and i.indnkeyatts = 2
       and (
         select array_agg(a.attname::text order by k.ordinality)
           from unnest(i.indkey) with ordinality as k(attnum, ordinality)
           join pg_attribute a
             on a.attrelid = i.indrelid and a.attnum = k.attnum
          where k.ordinality <= i.indnkeyatts
       ) = array['id_viagem', 'registrada_em']::text[]
  ) into v_tem_indice;
  if not v_tem_indice then
    create index posicoes_viagem_ultima_idx
      on public.posicoes_viagem (id_viagem, registrada_em desc);
  end if;

  select exists (
    select 1
      from pg_index i
     where i.indrelid = v_tabela
       and i.indisvalid
       and i.indpred is null
       and i.indnkeyatts = 2
       and (
         select array_agg(a.attname::text order by k.ordinality)
           from unnest(i.indkey) with ordinality as k(attnum, ordinality)
           join pg_attribute a
             on a.attrelid = i.indrelid and a.attnum = k.attnum
          where k.ordinality <= i.indnkeyatts
       ) = array['registrada_em', 'id']::text[]
  ) into v_tem_indice;
  if not v_tem_indice then
    create index posicoes_viagem_retencao_idx
      on public.posicoes_viagem (registrada_em, id);
  end if;
end;
$migration$;

create or replace function public.frotix_validar_posicao_viagem()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_viagem public.viagens%rowtype;
begin
  select *
    into v_viagem
    from public.viagens
   where id = new.id_viagem
   for share;

  if not found
    or v_viagem.id_motorista <> new.id_motorista
    or v_viagem.id_veiculo is null
    or v_viagem.iniciada_em is null
    or new.registrada_em < v_viagem.iniciada_em - interval '5 minutes'
  then
    raise exception 'Posição não corresponde à viagem atribuída.'
      using errcode = '23514';
  end if;

  if v_viagem.status = 'EM_ANDAMENTO' then
    if new.registrada_em > clock_timestamp() + interval '5 minutes' then
      raise exception 'Data da posição fora do período da viagem.'
        using errcode = '23514';
    end if;
  elsif v_viagem.status = 'CONCLUIDA' then
    if v_viagem.concluida_em is null or new.registrada_em > v_viagem.concluida_em then
      raise exception 'Posição posterior à conclusão da viagem.'
        using errcode = '23514';
    end if;
  else
    raise exception 'A viagem não está ativa.'
      using errcode = '23514';
  end if;

  return new;
end;
$function$;

revoke all on function public.frotix_validar_posicao_viagem() from public, anon, authenticated;

do $migration$
begin
  if exists (
    select 1
      from pg_trigger t
     where t.tgrelid = 'public.posicoes_viagem'::regclass
       and t.tgname = 'posicoes_viagem_validar_periodo'
       and not t.tgisinternal
       and t.tgfoid <> 'public.frotix_validar_posicao_viagem()'::regprocedure
  ) then
    raise exception 'O trigger posicoes_viagem_validar_periodo já existe com outra função associada.';
  end if;

  if not exists (
    select 1
      from pg_trigger t
     where t.tgrelid = 'public.posicoes_viagem'::regclass
       and not t.tgisinternal
       and (t.tgtype & 2) = 2
       and (t.tgtype & 4) = 4
       and t.tgfoid = 'public.frotix_validar_posicao_viagem()'::regprocedure
  ) then
    create trigger posicoes_viagem_validar_periodo
      before insert on public.posicoes_viagem
      for each row execute function public.frotix_validar_posicao_viagem();
  end if;
end;
$migration$;

alter table public.posicoes_viagem enable row level security;
revoke all on table public.posicoes_viagem from public, anon, authenticated;
grant usage on schema public to service_role;
grant select, insert, delete on table public.posicoes_viagem to service_role;

do $migration$
begin
  if exists (
    select 1
      from pg_policy p
     where p.polrelid = 'public.posicoes_viagem'::regclass
       and p.polname = 'posicoes_viagem_service_role_only'
       and (
         p.polcmd <> '*'
         or not exists (
           select 1
             from unnest(p.polroles) as policy_role(role_oid)
             join pg_roles r on r.oid = policy_role.role_oid
            where r.rolname = 'service_role'
         )
       )
  ) then
    raise exception 'A policy posicoes_viagem_service_role_only já existe com outra configuração.';
  end if;

  if not exists (
    select 1
      from pg_policy p
     where p.polrelid = 'public.posicoes_viagem'::regclass
       and p.polcmd = '*'
       and exists (
         select 1
           from unnest(p.polroles) as policy_role(role_oid)
           join pg_roles r on r.oid = policy_role.role_oid
          where r.rolname = 'service_role'
       )
  ) then
    create policy posicoes_viagem_service_role_only
      on public.posicoes_viagem
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end;
$migration$;

comment on table public.posicoes_viagem is
  'Localizações vinculadas a viagens; retenção de 90 dias calculada por registrada_em.';

commit;
