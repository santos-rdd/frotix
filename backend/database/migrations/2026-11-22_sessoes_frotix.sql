begin;

create table public.auth_sessions (
  id uuid primary key,
  user_id uuid not null references public.usuarios(id) on delete cascade,
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoke_reason text check (
    revoke_reason is null or revoke_reason in (
      'logout', 'user_inactive', 'refresh_reuse', 'expired', 'password_reset'
    )
  ),
  constraint auth_sessions_expiry_after_creation check (expires_at > created_at)
);

create index auth_sessions_user_active_idx
  on public.auth_sessions (user_id, expires_at)
  where revoked_at is null;

create table public.auth_refresh_tokens (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.auth_sessions(id) on delete cascade,
  token_hash char(64) not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  issued_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  revoked_at timestamptz,
  constraint auth_refresh_tokens_expiry_after_issue check (expires_at > issued_at)
);

create index auth_refresh_tokens_session_idx
  on public.auth_refresh_tokens (session_id);

create unique index auth_refresh_tokens_one_current_per_session_uidx
  on public.auth_refresh_tokens (session_id)
  where consumed_at is null and revoked_at is null;

alter table public.auth_sessions enable row level security;
alter table public.auth_refresh_tokens enable row level security;

revoke all on table public.auth_sessions, public.auth_refresh_tokens
  from public, anon, authenticated;
grant select, insert, update, delete on table public.auth_sessions, public.auth_refresh_tokens
  to service_role;

create policy auth_sessions_service_role_only
  on public.auth_sessions
  for all
  to service_role
  using (true)
  with check (true);

create policy auth_refresh_tokens_service_role_only
  on public.auth_refresh_tokens
  for all
  to service_role
  using (true)
  with check (true);

create or replace function public.frotix_criar_sessao(
  p_session_id uuid,
  p_user_id uuid,
  p_refresh_token_hash text
)
returns jsonb
language plpgsql
set search_path = pg_catalog, public
as $function$
declare
  v_now timestamptz := clock_timestamp();
  v_expires_at timestamptz;
  v_usuario record;
begin
  if p_session_id is null
    or p_user_id is null
    or p_refresh_token_hash is null
    or p_refresh_token_hash !~ '^[0-9a-f]{64}$'
  then
    return jsonb_build_object('status', 'invalid');
  end if;

  select u.id, u.nome, u.email, u.id_perfil
    into v_usuario
    from public.usuarios as u
   where u.id = p_user_id
     and u.ativo is true;

  if not found then
    return jsonb_build_object('status', 'user_inactive');
  end if;

  v_expires_at := v_now + interval '30 days';

  insert into public.auth_sessions (id, user_id, created_at, expires_at)
  values (p_session_id, p_user_id, v_now, v_expires_at);

  insert into public.auth_refresh_tokens (session_id, token_hash, issued_at, expires_at)
  values (p_session_id, p_refresh_token_hash, v_now, v_expires_at);

  return jsonb_build_object(
    'status', 'active',
    'session_id', p_session_id,
    'user_id', v_usuario.id,
    'perfil', v_usuario.id_perfil,
    'nome', v_usuario.nome,
    'email', v_usuario.email,
    'expires_at', v_expires_at
  );
end;
$function$;

create or replace function public.frotix_validar_sessao(
  p_session_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
set search_path = pg_catalog, public
as $function$
declare
  v_session public.auth_sessions%rowtype;
  v_usuario record;
  v_now timestamptz := clock_timestamp();
begin
  if p_session_id is null or p_user_id is null then
    return jsonb_build_object('status', 'invalid');
  end if;

  select s.*
    into v_session
    from public.auth_sessions as s
   where s.id = p_session_id
     and s.user_id = p_user_id;

  if not found or v_session.revoked_at is not null then
    return jsonb_build_object('status', 'invalid');
  end if;

  if v_session.expires_at <= v_now then
    select s.*
      into v_session
      from public.auth_sessions as s
     where s.id = p_session_id
       and s.user_id = p_user_id
     for update;

    if not found or v_session.revoked_at is not null then
      return jsonb_build_object('status', 'invalid');
    end if;

    update public.auth_sessions
       set revoked_at = coalesce(revoked_at, v_now),
           revoke_reason = coalesce(revoke_reason, 'expired')
     where id = p_session_id
       and user_id = p_user_id;
    update public.auth_refresh_tokens
       set revoked_at = coalesce(revoked_at, v_now)
     where session_id = p_session_id;
    return jsonb_build_object('status', 'invalid');
  end if;

  select u.id, u.nome, u.email, u.id_perfil
    into v_usuario
    from public.usuarios as u
   where u.id = p_user_id
     and u.ativo is true;

  if not found then
    select s.*
      into v_session
      from public.auth_sessions as s
     where s.id = p_session_id
       and s.user_id = p_user_id
     for update;

    if not found or v_session.revoked_at is not null then
      return jsonb_build_object('status', 'invalid');
    end if;

    update public.auth_sessions
       set revoked_at = coalesce(revoked_at, v_now),
           revoke_reason = coalesce(revoke_reason, 'user_inactive')
     where id = p_session_id
       and user_id = p_user_id;
    update public.auth_refresh_tokens
       set revoked_at = coalesce(revoked_at, v_now)
     where session_id = p_session_id;
    return jsonb_build_object('status', 'invalid');
  end if;

  return jsonb_build_object(
    'status', 'active',
    'session_id', v_session.id,
    'user_id', v_usuario.id,
    'perfil', v_usuario.id_perfil,
    'nome', v_usuario.nome,
    'email', v_usuario.email,
    'expires_at', v_session.expires_at
  );
end;
$function$;

create or replace function public.frotix_rotacionar_refresh(
  p_refresh_token_hash text,
  p_novo_refresh_token_hash text
)
returns jsonb
language plpgsql
set search_path = pg_catalog, public
as $function$
declare
  v_token public.auth_refresh_tokens%rowtype;
  v_session public.auth_sessions%rowtype;
  v_session_id uuid;
  v_usuario record;
  v_now timestamptz := clock_timestamp();
begin
  if p_refresh_token_hash is null
    or p_novo_refresh_token_hash is null
    or p_refresh_token_hash !~ '^[0-9a-f]{64}$'
    or p_novo_refresh_token_hash !~ '^[0-9a-f]{64}$'
    or p_refresh_token_hash = p_novo_refresh_token_hash
  then
    return jsonb_build_object('status', 'invalid');
  end if;

  select t.session_id
    into v_session_id
    from public.auth_refresh_tokens as t
   where t.token_hash = p_refresh_token_hash;

  if not found then
    return jsonb_build_object('status', 'invalid');
  end if;

  select s.*
    into v_session
    from public.auth_sessions as s
   where s.id = v_session_id
   for update;

  if not found then
    return jsonb_build_object('status', 'invalid');
  end if;

  select t.*
    into v_token
    from public.auth_refresh_tokens as t
   where t.token_hash = p_refresh_token_hash
     and t.session_id = v_session.id
   for update;

  if not found then
    return jsonb_build_object('status', 'invalid');
  end if;

  if v_token.consumed_at is not null then
    update public.auth_sessions
       set revoked_at = coalesce(revoked_at, v_now),
           revoke_reason = coalesce(revoke_reason, 'refresh_reuse')
     where id = v_session.id;
    update public.auth_refresh_tokens
       set revoked_at = coalesce(revoked_at, v_now)
     where session_id = v_session.id;
    return jsonb_build_object('status', 'reuse');
  end if;

  if v_token.revoked_at is not null
    or v_session.revoked_at is not null
  then
    return jsonb_build_object('status', 'invalid');
  end if;

  if v_session.expires_at <= v_now or v_token.expires_at <= v_now then
    update public.auth_sessions
       set revoked_at = coalesce(revoked_at, v_now),
           revoke_reason = coalesce(revoke_reason, 'expired')
     where id = v_session.id;
    update public.auth_refresh_tokens
       set revoked_at = coalesce(revoked_at, v_now)
     where session_id = v_session.id;
    return jsonb_build_object('status', 'expired');
  end if;

  select u.id, u.nome, u.email, u.id_perfil
    into v_usuario
    from public.usuarios as u
   where u.id = v_session.user_id
     and u.ativo is true;

  if not found then
    update public.auth_sessions
       set revoked_at = coalesce(revoked_at, v_now),
           revoke_reason = coalesce(revoke_reason, 'user_inactive')
     where id = v_session.id;
    update public.auth_refresh_tokens
       set revoked_at = coalesce(revoked_at, v_now)
     where session_id = v_session.id;
    return jsonb_build_object('status', 'invalid');
  end if;

  update public.auth_refresh_tokens
     set consumed_at = v_now
   where id = v_token.id;

  insert into public.auth_refresh_tokens (session_id, token_hash, issued_at, expires_at)
  values (v_session.id, p_novo_refresh_token_hash, v_now, v_session.expires_at);

  return jsonb_build_object(
    'status', 'active',
    'session_id', v_session.id,
    'user_id', v_usuario.id,
    'perfil', v_usuario.id_perfil,
    'nome', v_usuario.nome,
    'email', v_usuario.email,
    'expires_at', v_session.expires_at
  );
end;
$function$;

create or replace function public.frotix_revogar_sessao(
  p_session_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
set search_path = pg_catalog, public
as $function$
declare
  v_session public.auth_sessions%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if p_session_id is null or p_user_id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  select s.*
    into v_session
    from public.auth_sessions as s
   where s.id = p_session_id
     and s.user_id = p_user_id
   for update;

  if not found then
    return jsonb_build_object('status', 'revoked');
  end if;

  update public.auth_sessions
     set revoked_at = coalesce(revoked_at, v_now),
         revoke_reason = coalesce(revoke_reason, 'logout')
   where id = p_session_id
     and user_id = p_user_id;

  update public.auth_refresh_tokens
     set revoked_at = coalesce(revoked_at, v_now)
   where session_id = p_session_id;

  return jsonb_build_object('status', 'revoked');
end;
$function$;

create or replace function public.frotix_revogar_sessoes_usuario(
  p_user_id uuid
)
returns jsonb
language plpgsql
set search_path = pg_catalog, public
as $function$
declare
  v_now timestamptz := clock_timestamp();
begin
  if p_user_id is null then
    return jsonb_build_object('status', 'invalid');
  end if;

  perform s.id
    from public.auth_sessions as s
   where s.user_id = p_user_id
   order by s.id
   for update;

  update public.auth_sessions
     set revoked_at = coalesce(revoked_at, v_now),
         revoke_reason = case
           when revoked_at is null then 'password_reset'
           else revoke_reason
         end
   where user_id = p_user_id
     and revoked_at is null;

  update public.auth_refresh_tokens as t
     set revoked_at = coalesce(t.revoked_at, v_now)
   where exists (
     select 1
       from public.auth_sessions as s
      where s.id = t.session_id
        and s.user_id = p_user_id
   );

  return jsonb_build_object('status', 'revoked');
end;
$function$;

revoke all on function public.frotix_criar_sessao(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.frotix_validar_sessao(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.frotix_rotacionar_refresh(text, text)
  from public, anon, authenticated;
revoke all on function public.frotix_revogar_sessao(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.frotix_revogar_sessoes_usuario(uuid)
  from public, anon, authenticated;

grant execute on function public.frotix_criar_sessao(uuid, uuid, text)
  to service_role;
grant execute on function public.frotix_validar_sessao(uuid, uuid)
  to service_role;
grant execute on function public.frotix_rotacionar_refresh(text, text)
  to service_role;
grant execute on function public.frotix_revogar_sessao(uuid, uuid)
  to service_role;
grant execute on function public.frotix_revogar_sessoes_usuario(uuid)
  to service_role;

commit;
