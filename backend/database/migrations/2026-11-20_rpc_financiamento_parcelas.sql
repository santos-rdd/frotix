-- =============================================================================
-- Frotix · Migration: Função RPC Atômica para Financiamento e Parcelas
-- Data: 2026-11-21 (Revisão Final de Segurança e Compatibilidade JWT Moderna)
--
-- Objetivo:
-- Garantir atomicidade estrita na criação de financiamentos e parcelas no PostgreSQL,
-- com controle de concorrência (ON CONFLICT), idempotência e validação de identidade
-- fail-closed contra personificação em ambientes PostgREST / Supabase.
--
-- Diretrizes de Segurança Aplicadas:
-- 1. search_path = '' (vazio) para proteção contra hijacking em SECURITY DEFINER.
-- 2. Suporte a JWT moderno (request.jwt.claims JSON) com fallback para GUCs legados.
-- 3. Autorização fail-closed: rejeita role nulo, anon ou desconhecido com erro 42501.
-- 4. Validação rigorosa de sub: vazio ou malformado rejeitado com erro 42501.
-- 5. Validação explícita de todos os parâmetros obrigatórios e nulos.
-- 6. Atomicidade integral e resolução de concorrência com ON CONFLICT parcial.
-- =============================================================================

begin;

create or replace function public.cadastrar_financiamento_com_parcelas(
  p_id_usuario                 uuid,
  p_descricao                  varchar,
  p_valor_total                numeric,
  p_valor_parcela              numeric,
  p_quantidade_parcelas        integer,
  p_data_primeiro_vencimento   date,
  p_valor_quitacao_antecipada  numeric default null,
  p_credor                     varchar default null,
  p_id_categoria               uuid default null,
  p_id_forma_pagamento         uuid default null,
  p_id_viagem                  uuid default null,
  p_id_local                   varchar default null,
  p_data_lancamento            date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claims_raw        text;
  v_claims            jsonb;
  v_jwt_role          text;
  v_jwt_sub           text;
  v_sub_uuid          uuid;
  v_financiamento_id  uuid;
  v_existente_id      uuid;
  v_vencimento        date;
  v_data_lanc         date;
  i                   integer;
begin
  -- 1. Extração de claims de autenticação (Formato moderno JSON com fallback legado)
  v_claims_raw := nullif(current_setting('request.jwt.claims', true), '');
  if v_claims_raw is not null then
    begin
      v_claims := v_claims_raw::jsonb;
      v_jwt_role := nullif(trim(v_claims ->> 'role'), '');
      v_jwt_sub  := nullif(trim(v_claims ->> 'sub'), '');
    exception
      when others then
        -- Se o JSON de claims estiver malformado, anula os campos para fail-closed
        v_jwt_role := null;
        v_jwt_sub  := null;
    end;
  end if;

  -- Fallback para GUCs legados caso request.jwt.claims não tenha definido o papel
  if v_jwt_role is null then
    v_jwt_role := nullif(trim(current_setting('request.jwt.claim.role', true)), '');
  end if;
  if v_jwt_sub is null then
    v_jwt_sub := nullif(trim(current_setting('request.jwt.claim.sub', true)), '');
  end if;

  -- 2. Autorização Fail-Closed
  -- Papel ausente, 'anon' ou desconhecido é imediatamente bloqueado com código 42501.
  if v_jwt_role is null or v_jwt_role = 'anon' or v_jwt_role not in ('authenticated', 'service_role') then
    raise exception 'Acesso negado: papel de autenticação inválido ou não autorizado (%).', coalesce(v_jwt_role, 'ausente')
      using errcode = '42501';
  end if;

  -- Para papel 'authenticated', exige sub preenchido, UUID válido e estritamente igual a p_id_usuario
  if v_jwt_role = 'authenticated' then
    if v_jwt_sub is null or trim(v_jwt_sub) = '' then
      raise exception 'Acesso negado: claim sub ausente ou vazia no token de autenticação.'
        using errcode = '42501';
    end if;

    begin
      v_sub_uuid := v_jwt_sub::uuid;
    exception
      when others then
        raise exception 'Acesso negado: identificador de usuário (sub) malformado no token de autenticação.'
          using errcode = '42501';
    end;

    if v_sub_uuid is distinct from p_id_usuario then
      raise exception 'Acesso negado: não é permitido criar lançamentos para outro usuário.'
        using errcode = '42501';
    end if;
  end if;

  -- 3. Validação rigorosa dos parâmetros obrigatórios
  if p_id_usuario is null then
    raise exception 'O identificador do usuário (p_id_usuario) é obrigatório.'
      using errcode = '23502';
  end if;

  if p_descricao is null or trim(p_descricao) = '' then
    raise exception 'A descrição da dívida é obrigatória.'
      using errcode = '23502';
  end if;

  if p_valor_total is null or p_valor_total <= 0 then
    raise exception 'O valor total do financiamento deve ser maior que zero.'
      using errcode = '22023';
  end if;

  if p_valor_parcela is null or p_valor_parcela <= 0 then
    raise exception 'O valor da parcela deve ser maior que zero.'
      using errcode = '22023';
  end if;

  if p_quantidade_parcelas is null or p_quantidade_parcelas < 2 then
    raise exception 'Uma dívida precisa ter pelo menos 2 parcelas.'
      using errcode = '22023';
  end if;

  if p_data_primeiro_vencimento is null then
    raise exception 'A data do primeiro vencimento é obrigatória.'
      using errcode = '23502';
  end if;

  if p_valor_quitacao_antecipada is not null and p_valor_quitacao_antecipada < 0 then
    raise exception 'O valor de quitação antecipada não pode ser negativo.'
      using errcode = '22023';
  end if;

  v_data_lanc := coalesce(p_data_lancamento, current_date);

  -- 4. Verificação prévia de idempotência por id_local (caminho rápido para repetições)
  if p_id_local is not null and trim(p_id_local) <> '' then
    select id into v_existente_id
      from public.financiamentos
     where id_usuario = p_id_usuario
       and id_local = trim(p_id_local)
     limit 1;

    if v_existente_id is not null then
      return jsonb_build_object(
        'sucesso', true,
        'mensagem', 'Dívida e parcelas já cadastradas anteriormente.',
        'financiamentoId', v_existente_id,
        'jaExistente', true
      );
    end if;
  end if;

  -- 5. Inserção do Financiamento com proteção contra concorrência via ON CONFLICT
  begin
    insert into public.financiamentos (
      descricao,
      valor_total,
      valor_parcela,
      quantidade_parcelas,
      data_primeiro_vencimento,
      valor_quitacao_antecipada,
      credor,
      id_usuario,
      id_categoria,
      id_forma_pagamento,
      id_local
    ) values (
      trim(p_descricao),
      p_valor_total,
      p_valor_parcela,
      p_quantidade_parcelas,
      p_data_primeiro_vencimento,
      p_valor_quitacao_antecipada,
      p_credor,
      p_id_usuario,
      p_id_categoria,
      p_id_forma_pagamento,
      nullif(trim(p_id_local), '')
    )
    on conflict (id_usuario, id_local) where id_local is not null
    do nothing
    returning id into v_financiamento_id;

  exception
    when unique_violation then
      v_financiamento_id := null;
  end;

  -- Se v_financiamento_id for nulo, outra requisição simultânea venceu a corrida
  if v_financiamento_id is null then
    if p_id_local is not null and trim(p_id_local) <> '' then
      select id into v_existente_id
        from public.financiamentos
       where id_usuario = p_id_usuario
         and id_local = trim(p_id_local)
       limit 1;

      if v_existente_id is not null then
        return jsonb_build_object(
          'sucesso', true,
          'mensagem', 'Dívida e parcelas já cadastradas anteriormente.',
          'financiamentoId', v_existente_id,
          'jaExistente', true
        );
      end if;
    end if;

    raise exception 'Erro de integridade ao cadastrar financiamento.'
      using errcode = '23505';
  end if;

  -- 6. Inserção atômica de todas as parcelas
  for i in 1..p_quantidade_parcelas loop
    v_vencimento := (p_data_primeiro_vencimento + ((i - 1) * interval '1 month'))::date;

    insert into public.lancamentos_financeiros (
      descricao,
      valor,
      tipo,
      id_categoria,
      id_forma_pagamento,
      id_usuario,
      id_viagem,
      data_lancamento,
      data_vencimento,
      status,
      id_financiamento,
      numero_parcela,
      total_parcelas
    ) values (
      trim(p_descricao) || ' Parcela ' || i || '/' || p_quantidade_parcelas,
      p_valor_parcela,
      'DIVIDA',
      p_id_categoria,
      p_id_forma_pagamento,
      p_id_usuario,
      p_id_viagem,
      v_data_lanc,
      v_vencimento,
      'PENDENTE',
      v_financiamento_id,
      i,
      p_quantidade_parcelas
    );
  end loop;

  -- 7. Retorno de sucesso com o contrato esperado pelo controller
  return jsonb_build_object(
    'sucesso', true,
    'mensagem', 'Dívida e parcelas cadastradas com sucesso!',
    'financiamentoId', v_financiamento_id,
    'jaExistente', false
  );
end;
$$;

-- Aplicação condicional e segura de permissões (compatível com Supabase e instâncias PostgreSQL padrão)
do $$
begin
  -- 1. Revoga permissões de public (padrão restritivo)
  execute 'revoke execute on function public.cadastrar_financiamento_com_parcelas(uuid, varchar, numeric, numeric, integer, date, numeric, varchar, uuid, uuid, uuid, varchar, date) from public';

  -- 2. Revoga de anon se o papel existir
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke execute on function public.cadastrar_financiamento_com_parcelas(uuid, varchar, numeric, numeric, integer, date, numeric, varchar, uuid, uuid, uuid, varchar, date) from anon';
  end if;

  -- 3. Concede a service_role (backend Express) se existir
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.cadastrar_financiamento_com_parcelas(uuid, varchar, numeric, numeric, integer, date, numeric, varchar, uuid, uuid, uuid, varchar, date) to service_role';
  end if;

  -- 4. Concede a authenticated se existir
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function public.cadastrar_financiamento_com_parcelas(uuid, varchar, numeric, numeric, integer, date, numeric, varchar, uuid, uuid, uuid, varchar, date) to authenticated';
  end if;
end;
$$;

commit;
