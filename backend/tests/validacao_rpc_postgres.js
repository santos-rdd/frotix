
















import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORTA_TESTE = 54329;
const DIR_TEMP_PG = path.join(process.env.TEMP || 'C:\\Windows\\Temp', `pg_frotix_rpc_${Date.now()}`);
const PG_BIN_DIR = 'C:\\Program Files\\PostgreSQL\\18\\bin';
const INITDB_EXE = path.join(PG_BIN_DIR, 'initdb.exe');
const PG_CTL_EXE = path.join(PG_BIN_DIR, 'pg_ctl.exe');

let pool = null;

function log(msg) {
  console.log(`[TESTE-RPC-PG] ${msg}`);
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function inicializarClusterEfêmero() {
  log(`Criando cluster PostgreSQL efêmero em ${DIR_TEMP_PG}...`);
  if (fs.existsSync(DIR_TEMP_PG)) {
    fs.rmSync(DIR_TEMP_PG, { recursive: true, force: true });
  }

  execSync(`"${INITDB_EXE}" -D "${DIR_TEMP_PG}" -U postgres -A trust --no-locale --encoding=UTF8`, {
    stdio: 'ignore'
  });

  const confPath = path.join(DIR_TEMP_PG, 'postgresql.conf');
  let conf = fs.readFileSync(confPath, 'utf8');
  conf += `\nport = ${PORTA_TESTE}\nlisten_addresses = '127.0.0.1'\nmax_connections = 25\n`;
  fs.writeFileSync(confPath, conf, 'utf8');

  log(`Iniciando PostgreSQL efêmero na porta ${PORTA_TESTE}...`);
  const logServer = path.join(DIR_TEMP_PG, 'server.log');
  execSync(`"${PG_CTL_EXE}" -D "${DIR_TEMP_PG}" -l "${logServer}" start`, {
    stdio: 'ignore'
  });
}

function finalizarClusterEfêmero() {
  log('Finalizando cluster PostgreSQL efêmero...');
  try {
    execSync(`"${PG_CTL_EXE}" -D "${DIR_TEMP_PG}" -m immediate stop`, {
      stdio: 'ignore'
    });
  } catch {}

  try {
    fs.rmSync(DIR_TEMP_PG, { recursive: true, force: true });
    log('Diretório efêmero limpo com sucesso.');
  } catch {}
}

async function aguardarConexao(maxTentativas = 15) {
  for (let i = 1; i <= maxTentativas; i++) {
    try {
      const client = new pg.Client({
        host: '127.0.0.1',
        port: PORTA_TESTE,
        user: 'postgres',
        database: 'postgres'
      });
      await client.connect();
      await client.query('SELECT 1;');
      await client.end();
      log('Conexão com PostgreSQL efêmero estabelecida.');
      return;
    } catch {
      await sleep(500);
    }
  }
  throw new Error('Não foi possível conectar ao PostgreSQL efêmero após várias tentativas.');
}

async function prepararSchema() {
  log('Criando tabelas e índices necessários para o teste...');
  const ddl = `
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";

    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN;
      END IF;
    END $$;

    DROP TABLE IF EXISTS public.lancamentos_financeiros CASCADE;
    DROP TABLE IF EXISTS public.financiamentos CASCADE;
    DROP TABLE IF EXISTS public.usuarios CASCADE;

    CREATE TABLE public.usuarios (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      nome VARCHAR(100) NOT NULL,
      email VARCHAR(100) NOT NULL UNIQUE
    );

    CREATE TABLE public.financiamentos (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      descricao VARCHAR(255) NOT NULL,
      valor_total NUMERIC(12,2) NOT NULL,
      valor_parcela NUMERIC(12,2) NOT NULL,
      quantidade_parcelas INTEGER NOT NULL,
      data_primeiro_vencimento DATE NOT NULL,
      valor_quitacao_antecipada NUMERIC(12,2),
      credor VARCHAR(120),
      id_usuario UUID NOT NULL REFERENCES public.usuarios(id),
      id_categoria UUID,
      id_forma_pagamento UUID,
      id_local VARCHAR(64),
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE UNIQUE INDEX financiamentos_usuario_id_local_uidx
      ON public.financiamentos (id_usuario, id_local)
      WHERE id_local IS NOT NULL;

    CREATE TABLE public.lancamentos_financeiros (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      descricao VARCHAR(255) NOT NULL,
      valor NUMERIC(12,2) NOT NULL,
      tipo VARCHAR(20) NOT NULL,
      id_categoria UUID,
      id_forma_pagamento UUID,
      id_usuario UUID NOT NULL REFERENCES public.usuarios(id),
      id_viagem UUID,
      data_lancamento DATE NOT NULL DEFAULT CURRENT_DATE,
      data_vencimento DATE NOT NULL,
      data_pagamento DATE,
      status VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
      id_financiamento UUID REFERENCES public.financiamentos(id) ON DELETE CASCADE,
      numero_parcela INTEGER,
      total_parcelas INTEGER,
      id_local VARCHAR(64),
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE UNIQUE INDEX lancamentos_usuario_id_local_uidx
      ON public.lancamentos_financeiros (id_usuario, id_local)
      WHERE id_local IS NOT NULL;
  `;
  await pool.query(ddl);

  const caminhoMigration = path.join(__dirname, '../database/migrations/2026-11-20_rpc_financiamento_parcelas.sql');
  const sqlMigration = fs.readFileSync(caminhoMigration, 'utf8');
  log('Aplicando migration 2026-11-20_rpc_financiamento_parcelas.sql...');
  await pool.query(sqlMigration);
  log('Migration aplicada com sucesso no PostgreSQL de teste.');
}




async function chamarRpc(client, params, jwtOptions = { claims: { role: 'service_role' } }) {
  await client.query('BEGIN;');
  try {

    if (jwtOptions.claims !== undefined) {
      if (jwtOptions.claims === null) {
        await client.query("SET LOCAL request.jwt.claims = '';");
      } else if (typeof jwtOptions.claims === 'string') {
        await client.query(`SET LOCAL request.jwt.claims = '${jwtOptions.claims.replace(/'/g, "''")}';`);
      } else {
        await client.query(`SET LOCAL request.jwt.claims = '${JSON.stringify(jwtOptions.claims).replace(/'/g, "''")}';`);
      }
    } else {
      await client.query("SET LOCAL request.jwt.claims = '';");
    }


    if (jwtOptions.legacyRole !== undefined) {
      await client.query(`SET LOCAL request.jwt.claim.role = '${jwtOptions.legacyRole}';`);
    } else {
      await client.query("SET LOCAL request.jwt.claim.role = '';");
    }

    if (jwtOptions.legacySub !== undefined) {
      await client.query(`SET LOCAL request.jwt.claim.sub = '${jwtOptions.legacySub}';`);
    } else {
      await client.query("SET LOCAL request.jwt.claim.sub = '';");
    }

    const res = await client.query(
      `SELECT public.cadastrar_financiamento_com_parcelas(
        $1::uuid, $2, $3, $4, $5, $6::date, $7, $8, $9, $10, $11, $12, $13::date
      ) as resultado;`,
      params
    );
    await client.query('COMMIT;');
    return res.rows[0].resultado;
  } catch (err) {
    await client.query('ROLLBACK;').catch(() => {});
    throw err;
  }
}

async function executarTestes() {
  let erros = 0;
  const userA = (await pool.query("INSERT INTO public.usuarios (nome, email) VALUES ('User Teste A', 'usera@teste.com') RETURNING id;")).rows[0].id;
  const userB = (await pool.query("INSERT INTO public.usuarios (nome, email) VALUES ('User Teste B', 'userb@teste.com') RETURNING id;")).rows[0].id;

  const clientPadrao = await pool.connect();

  try {



    log('\n=== TESTE 1: Criação de financiamento e parcelas (search_path vazio) ===');
    try {
      const r1 = await chamarRpc(clientPadrao, [
        userA, 'Financiamento Van 01', 3000, 1000, 3, '2026-12-10', null, 'Banco X', null, null, null, 'ID_LOCAL_T1', '2026-11-20'
      ], { claims: { role: 'service_role' } });

      if (!r1.sucesso || r1.jaExistente !== false || !r1.financiamentoId) {
        throw new Error(`Retorno inesperado: ${JSON.stringify(r1)}`);
      }

      const { rows: fins } = await pool.query('SELECT * FROM public.financiamentos WHERE id = $1;', [r1.financiamentoId]);
      if (fins.length !== 1 || fins[0].id_local !== 'ID_LOCAL_T1') {
        throw new Error(`Financiamento não encontrado no banco ou id_local divergente.`);
      }

      const { rows: parcs } = await pool.query('SELECT * FROM public.lancamentos_financeiros WHERE id_financiamento = $1 ORDER BY numero_parcela ASC;', [r1.financiamentoId]);
      if (parcs.length !== 3) {
        throw new Error(`Esperado 3 parcelas, encontrado: ${parcs.length}`);
      }
      if (parcs[0].data_vencimento.toISOString().slice(0, 10) !== '2026-12-10' ||
          parcs[1].data_vencimento.toISOString().slice(0, 10) !== '2027-01-10' ||
          parcs[2].data_vencimento.toISOString().slice(0, 10) !== '2027-02-10') {
        throw new Error(`Cálculo de vencimento de parcelas divergente: ${JSON.stringify(parcs.map(p => p.data_vencimento))}`);
      }
      if (parcs.some(p => p.id_local !== null)) {
        throw new Error(`Parcelas não devem ter id_local preenchido.`);
      }

      log('✔ TESTE 1 APROVADO: Financiamento criado com 3 parcelas corretas sob search_path vazio.');
    } catch (err) {
      erros++;
      log(`✖ TESTE 1 FALHOU: ${err.message}`);
    }




    log('\n=== TESTE 2: Reenvio com mesmo id_local (Idempotência) ===');
    try {
      const r2 = await chamarRpc(clientPadrao, [
        userA, 'Financiamento Van 01', 3000, 1000, 3, '2026-12-10', null, 'Banco X', null, null, null, 'ID_LOCAL_T1', '2026-11-20'
      ], { claims: { role: 'service_role' } });

      if (!r2.sucesso || r2.jaExistente !== true || !r2.financiamentoId) {
        throw new Error(`Esperado jaExistente=true: ${JSON.stringify(r2)}`);
      }

      const { rows: finsTotal } = await pool.query('SELECT count(*) FROM public.financiamentos WHERE id_local = $1;', ['ID_LOCAL_T1']);
      const { rows: parcsTotal } = await pool.query('SELECT count(*) FROM public.lancamentos_financeiros WHERE id_financiamento = $1;', [r2.financiamentoId]);

      if (parseInt(finsTotal[0].count, 10) !== 1) {
        throw new Error(`Duplicação de financiamento detectada: count=${finsTotal[0].count}`);
      }
      if (parseInt(parcsTotal[0].count, 10) !== 3) {
        throw new Error(`Duplicação de parcelas detectada: count=${parcsTotal[0].count}`);
      }

      log('✔ TESTE 2 APROVADO: Reenvio idempotente retornou jaExistente=true sem duplicar nada.');
    } catch (err) {
      erros++;
      log(`✖ TESTE 2 FALHOU: ${err.message}`);
    }




    log('\n=== TESTE 3: Concorrência simultânea (2 conexões) ===');
    try {
      const client1 = await pool.connect();
      const client2 = await pool.connect();

      const paramsConc = [userA, 'Dívida Concorrente', 2000, 1000, 2, '2026-12-01', null, 'Credor Y', null, null, null, 'ID_LOCAL_CONC_1', '2026-11-20'];

      const [rA, rB] = await Promise.all([
        chamarRpc(client1, paramsConc, { claims: { role: 'service_role' } }),
        chamarRpc(client2, paramsConc, { claims: { role: 'service_role' } })
      ]);

      client1.release();
      client2.release();

      const umCriou = (rA.jaExistente === false && rB.jaExistente === true) || (rA.jaExistente === true && rB.jaExistente === false);
      if (!umCriou) {
        throw new Error(`Concorrência falhou: rA=${JSON.stringify(rA)}, rB=${JSON.stringify(rB)}`);
      }
      if (rA.financiamentoId !== rB.financiamentoId) {
        throw new Error(`IDs divergentes entre as chamadas concorrentes: ${rA.financiamentoId} vs ${rB.financiamentoId}`);
      }

      const { rows: finsConc } = await pool.query('SELECT count(*) FROM public.financiamentos WHERE id_local = $1;', ['ID_LOCAL_CONC_1']);
      const { rows: parcsConc } = await pool.query('SELECT count(*) FROM public.lancamentos_financeiros WHERE id_financiamento = $1;', [rA.financiamentoId]);

      if (parseInt(finsConc[0].count, 10) !== 1) {
        throw new Error(`Esperado 1 financiamento, encontrado: ${finsConc[0].count}`);
      }
      if (parseInt(parcsConc[0].count, 10) !== 2) {
        throw new Error(`Esperado 2 parcelas, encontrado: ${parcsConc[0].count}`);
      }

      log('✔ TESTE 3 APROVADO: Concorrência simultânea resolvida por ON CONFLICT.');
    } catch (err) {
      erros++;
      log(`✖ TESTE 3 FALHOU: ${err.message}`);
    }




    log('\n=== TESTE 4: Rollback integral em falha de parcela ===');
    try {
      await pool.query(`
        CREATE OR REPLACE FUNCTION trigger_teste_falha_parcela()
        RETURNS trigger AS $$
        BEGIN
          IF NEW.descricao LIKE '%FalhaRollback Parcela 2%' THEN
            RAISE EXCEPTION 'Falha intencional para teste de rollback!';
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS trg_teste_falha ON public.lancamentos_financeiros;
        CREATE TRIGGER trg_teste_falha
        BEFORE INSERT ON public.lancamentos_financeiros
        FOR EACH ROW EXECUTE FUNCTION trigger_teste_falha_parcela();
      `);

      let falhouComoEsperado = false;
      try {
        await chamarRpc(clientPadrao, [
          userA, 'FalhaRollback', 2000, 1000, 2, '2026-12-01', null, null, null, null, null, 'ID_LOCAL_ROLLBACK', '2026-11-20'
        ], { claims: { role: 'service_role' } });
      } catch (e) {
        if (e.message.includes('Falha intencional para teste de rollback')) {
          falhouComoEsperado = true;
        } else {
          throw e;
        }
      } finally {
        await pool.query('DROP TRIGGER IF EXISTS trg_teste_falha ON public.lancamentos_financeiros;');
      }

      if (!falhouComoEsperado) {
        throw new Error('A chamada deveria ter falhado!');
      }

      const { rows: finOrfao } = await pool.query('SELECT * FROM public.financiamentos WHERE id_local = $1;', ['ID_LOCAL_ROLLBACK']);
      const { rows: parcOrfa } = await pool.query("SELECT * FROM public.lancamentos_financeiros WHERE descricao LIKE '%FalhaRollback%';");

      if (finOrfao.length !== 0) {
        throw new Error(`Falha de atomicidade: financiamento órfão persistido no banco! Total=${finOrfao.length}`);
      }
      if (parcOrfa.length !== 0) {
        throw new Error(`Falha de atomicidade: parcelas residuais encontradas no banco! Total=${parcOrfa.length}`);
      }

      log('✔ TESTE 4 APROVADO: Rollback integral comprovado. Zero registros órfãos.');
    } catch (err) {
      erros++;
      log(`✖ TESTE 4 FALHOU: ${err.message}`);
    }




    log('\n=== TESTE 5: Segurança, Identidade e Fail-Closed ===');
    const clientSec = await pool.connect();
    try {

      const r51 = await chamarRpc(clientSec, [
        userA, 'Dívida Própria User A', 200, 100, 2, '2026-12-01', null, null, null, null, null, 'ID_SEC_5_1', '2026-11-20'
      ], { claims: { role: 'authenticated', sub: userA } });
      if (!r51.sucesso) throw new Error('Falha ao autorizar authenticated com sub válido.');
      log('✔ 5.1 Aprovado: JWT Moderno (claims JSON) com authenticated e sub legítimo autorizado.');


      let per52 = false;
      try {
        await chamarRpc(clientSec, [
          userA, 'Tentativa Personificação', 200, 100, 2, '2026-12-01', null, null, null, null, null, 'ID_SEC_5_2', '2026-11-20'
        ], { claims: { role: 'authenticated', sub: userB } });
      } catch (e) {
        if (e.code === '42501') per52 = true;
        else throw e;
      }
      if (!per52) throw new Error('Personificação não foi bloqueada com 42501!');
      log('✔ 5.2 Aprovado: Personificação rejeitada com código 42501.');


      let semSub53 = false;
      try {
        await chamarRpc(clientSec, [
          userA, 'Dívida Sem Sub', 200, 100, 2, '2026-12-01', null, null, null, null, null, 'ID_SEC_5_3', '2026-11-20'
        ], { claims: { role: 'authenticated' } });
      } catch (e) {
        if (e.code === '42501') semSub53 = true;
        else throw e;
      }
      if (!semSub53) throw new Error('Claim sub ausente não foi bloqueada com 42501!');
      log('✔ 5.3 Aprovado: Claim sub ausente no JSON moderno bloqueada com código 42501.');


      let subVazio54 = false;
      try {
        await chamarRpc(clientSec, [
          userA, 'Dívida Sub Vazio', 200, 100, 2, '2026-12-01', null, null, null, null, null, 'ID_SEC_5_4', '2026-11-20'
        ], { claims: { role: 'authenticated', sub: '' } });
      } catch (e) {
        if (e.code === '42501') subVazio54 = true;
        else throw e;
      }
      if (!subVazio54) throw new Error('Claim sub vazia não foi bloqueada com 42501!');
      log('✔ 5.4 Aprovado: Claim sub vazia bloqueada com código 42501.');


      let subMalformado55 = false;
      try {
        await chamarRpc(clientSec, [
          userA, 'Dívida Sub Malformado', 200, 100, 2, '2026-12-01', null, null, null, null, null, 'ID_SEC_5_5', '2026-11-20'
        ], { claims: { role: 'authenticated', sub: 'usuario-malicioso-nao-uuid' } });
      } catch (e) {
        if (e.code === '42501') subMalformado55 = true;
        else throw e;
      }
      if (!subMalformado55) throw new Error('Claim sub malformada não foi bloqueada com 42501!');
      log('✔ 5.5 Aprovado: Claim sub malformada capturada e rejeitada com código 42501.');


      let anon56 = false;
      try {
        await chamarRpc(clientSec, [
          userA, 'Dívida Anon', 200, 100, 2, '2026-12-01', null, null, null, null, null, 'ID_SEC_5_6', '2026-11-20'
        ], { claims: { role: 'anon' } });
      } catch (e) {
        if (e.code === '42501') anon56 = true;
        else throw e;
      }
      if (!anon56) throw new Error('Papel anon não foi bloqueado com 42501!');
      log('✔ 5.6 Aprovado: Papel anon bloqueado com código 42501.');


      let semRole57 = false;
      try {
        await chamarRpc(clientSec, [
          userA, 'Dívida Sem Role', 200, 100, 2, '2026-12-01', null, null, null, null, null, 'ID_SEC_5_7', '2026-11-20'
        ], { claims: { sub: userA } });
      } catch (e) {
        if (e.code === '42501') semRole57 = true;
        else throw e;
      }
      if (!semRole57) throw new Error('Role ausente não foi bloqueada com 42501!');
      log('✔ 5.7 Aprovado: Role ausente no JSON (fail-closed) bloqueada com código 42501.');


      let roleDesconhecida58 = false;
      try {
        await chamarRpc(clientSec, [
          userA, 'Dívida Fake Role', 200, 100, 2, '2026-12-01', null, null, null, null, null, 'ID_SEC_5_8', '2026-11-20'
        ], { claims: { role: 'gestor_financeiro_forjado', sub: userA } });
      } catch (e) {
        if (e.code === '42501') roleDesconhecida58 = true;
        else throw e;
      }
      if (!roleDesconhecida58) throw new Error('Role desconhecida não foi bloqueada com 42501!');
      log('✔ 5.8 Aprovado: Role desconhecida bloqueada com código 42501.');


      let semGuc59 = false;
      try {
        await chamarRpc(clientSec, [
          userA, 'Dívida Sem Auth', 200, 100, 2, '2026-12-01', null, null, null, null, null, 'ID_SEC_5_9', '2026-11-20'
        ], { claims: null });
      } catch (e) {
        if (e.code === '42501') semGuc59 = true;
        else throw e;
      }
      if (!semGuc59) throw new Error('Chamada sem contexto de auth não foi bloqueada!');
      log('✔ 5.9 Aprovado: Chamada sem contexto de autenticação (fail-closed) bloqueada com código 42501.');


      let jsonMalformado510 = false;
      try {
        await chamarRpc(clientSec, [
          userA, 'Dívida Json Ruim', 200, 100, 2, '2026-12-01', null, null, null, null, null, 'ID_SEC_5_10', '2026-11-20'
        ], { claims: '{role: "sem_aspas_json_invalido"' });
      } catch (e) {
        if (e.code === '42501') jsonMalformado510 = true;
        else throw e;
      }
      if (!jsonMalformado510) throw new Error('JSON malformado em claims não foi tratado como fail-closed!');
      log('✔ 5.10 Aprovado: JSON malformado em claims tratado com segurança (fail-closed 42501).');


      const r511 = await chamarRpc(clientSec, [
        userA, 'Dívida Backend Moderno', 400, 200, 2, '2026-12-01', null, null, null, null, null, 'ID_SEC_5_11', '2026-11-20'
      ], { claims: { role: 'service_role' } });
      if (!r511.sucesso) throw new Error('Falha ao autorizar service_role em formato JSON moderno.');
      log('✔ 5.11 Aprovado: service_role autorizado no formato JSON moderno.');


      const r512 = await chamarRpc(clientSec, [
        userB, 'Dívida Legada User B', 300, 150, 2, '2026-12-01', null, null, null, null, null, 'ID_SEC_5_12', '2026-11-20'
      ], { claims: null, legacyRole: 'authenticated', legacySub: userB });
      if (!r512.sucesso) throw new Error('Falha na compatibilidade com GUCs legados.');
      log('✔ 5.12 Aprovado: Compatibilidade com GUCs legados (request.jwt.claim.role/sub) preservada.');


      const r513 = await chamarRpc(clientSec, [
        userA, 'Dívida Legada Backend', 300, 150, 2, '2026-12-01', null, null, null, null, null, 'ID_SEC_5_13', '2026-11-20'
      ], { claims: null, legacyRole: 'service_role' });
      if (!r513.sucesso) throw new Error('Falha ao autorizar service_role legado.');
      log('✔ 5.13 Aprovado: service_role autorizado via GUC legado.');


      let anonLegado514 = false;
      try {
        await chamarRpc(clientSec, [
          userA, 'Dívida Legada Anon', 300, 150, 2, '2026-12-01', null, null, null, null, null, 'ID_SEC_5_14', '2026-11-20'
        ], { claims: null, legacyRole: 'anon' });
      } catch (e) {
        if (e.code === '42501') anonLegado514 = true;
        else throw e;
      }
      if (!anonLegado514) throw new Error('Anon em GUC legado não foi bloqueado!');
      log('✔ 5.14 Aprovado: Papel anon em GUC legado bloqueado com código 42501.');

    } catch (err) {
      erros++;
      log(`✖ TESTE 5 FALHOU: ${err.message}`);
    } finally {
      clientSec.release();
    }




    log('\n=== TESTE 6: Compatibilidade de Contrato JSON ===');
    try {
      const r = await chamarRpc(clientPadrao, [
        userA, 'Contrato Check', 500, 250, 2, '2026-12-01', null, null, null, null, null, 'ID_LOCAL_CONTRATO', '2026-11-20'
      ], { claims: { role: 'service_role' } });

      const chavesEsperadas = ['sucesso', 'mensagem', 'financiamentoId', 'jaExistente'];
      for (const c of chavesEsperadas) {
        if (!(c in r)) {
          throw new Error(`Chave obrigatória '${c}' ausente no retorno JSON.`);
        }
      }
      if (typeof r.sucesso !== 'boolean') throw new Error('Campo sucesso deve ser booleano.');
      if (typeof r.jaExistente !== 'boolean') throw new Error('Campo jaExistente deve ser booleano.');
      if (typeof r.mensagem !== 'string') throw new Error('Campo mensagem deve ser string.');
      if (typeof r.financiamentoId !== 'string' || r.financiamentoId.length < 32) {
        throw new Error('Campo financiamentoId deve ser UUID válido.');
      }

      log('✔ TESTE 6 APROVADO: Todos os campos correspondem estritamente ao contrato do controller.');
    } catch (err) {
      erros++;
      log(`✖ TESTE 6 FALHOU: ${err.message}`);
    }




    log('\n=== TESTE 7: Validação de Parâmetros Obrigatórios Nulos ===');
    try {
      const clientVal = await pool.connect();
      try {
        const testarParam = async (nome, params, codigoEsperado) => {
          let falhou = false;
          try {
            await chamarRpc(clientVal, params, { claims: { role: 'service_role' } });
          } catch (e) {
            if (e.code === codigoEsperado) {
              falhou = true;
            } else {
              throw new Error(`[${nome}] Código retornado ${e.code} diferente do esperado ${codigoEsperado}: ${e.message}`);
            }
          }
          if (!falhou) throw new Error(`[${nome}] Chamada com parâmetro inválido deveria ter falhado com código ${codigoEsperado}!`);
          log(`✔ 7.${nome} Aprovado: Rejeição correta com código ${codigoEsperado}.`);
        };


        await testarParam('p_id_usuario_nulo', [
          null, 'Desc', 1000, 500, 2, '2026-12-01', null, null, null, null, null, 'ID_P1', '2026-11-20'
        ], '23502');


        await testarParam('p_descricao_nula', [
          userA, null, 1000, 500, 2, '2026-12-01', null, null, null, null, null, 'ID_P2', '2026-11-20'
        ], '23502');
        await testarParam('p_descricao_vazia', [
          userA, '   ', 1000, 500, 2, '2026-12-01', null, null, null, null, null, 'ID_P2B', '2026-11-20'
        ], '23502');


        await testarParam('p_valor_total_nulo', [
          userA, 'Desc', null, 500, 2, '2026-12-01', null, null, null, null, null, 'ID_P3', '2026-11-20'
        ], '22023');
        await testarParam('p_valor_total_zero', [
          userA, 'Desc', 0, 500, 2, '2026-12-01', null, null, null, null, null, 'ID_P3B', '2026-11-20'
        ], '22023');


        await testarParam('p_valor_parcela_nulo', [
          userA, 'Desc', 1000, null, 2, '2026-12-01', null, null, null, null, null, 'ID_P4', '2026-11-20'
        ], '22023');
        await testarParam('p_valor_parcela_zero', [
          userA, 'Desc', 1000, 0, 2, '2026-12-01', null, null, null, null, null, 'ID_P4B', '2026-11-20'
        ], '22023');


        await testarParam('p_quantidade_parcelas_nula', [
          userA, 'Desc', 1000, 500, null, '2026-12-01', null, null, null, null, null, 'ID_P5', '2026-11-20'
        ], '22023');
        await testarParam('p_quantidade_parcelas_um', [
          userA, 'Desc', 1000, 1000, 1, '2026-12-01', null, null, null, null, null, 'ID_P5B', '2026-11-20'
        ], '22023');


        await testarParam('p_data_primeiro_vencimento_nula', [
          userA, 'Desc', 1000, 500, 2, null, null, null, null, null, null, 'ID_P6', '2026-11-20'
        ], '23502');


        await testarParam('p_valor_quitacao_negativo', [
          userA, 'Desc', 1000, 500, 2, '2026-12-01', -50, null, null, null, null, 'ID_P7', '2026-11-20'
        ], '22023');

        log('✔ TESTE 7 APROVADO: Todas as validações explícitas de parâmetros nulos e inválidos foram comprovadas.');
      } finally {
        clientVal.release();
      }
    } catch (err) {
      erros++;
      log(`✖ TESTE 7 FALHOU: ${err.message}`);
    }

  } finally {
    clientPadrao.release();
  }

  return erros;
}

async function main() {
  log('Iniciando bateria completa de validação técnica e segurança da RPC no PostgreSQL...');
  try {
    inicializarClusterEfêmero();
    await aguardarConexao();

    pool = new Pool({
      host: '127.0.0.1',
      port: PORTA_TESTE,
      user: 'postgres',
      database: 'postgres',
      max: 10
    });

    await prepararSchema();
    const erros = await executarTestes();

    if (erros === 0) {
      log('\n=================================================================================');
      log('✔ TODOS OS TESTES DE SEGURANÇA E ATOMICIDADE NO POSTGRESQL FORAM APROVADOS (0 FALHAS)!');
      log('=================================================================================');
    } else {
      log(`\n✖ TOTAL DE FALHAS: ${erros}`);
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('[ERRO FATAL NA EXECUÇÃO DOS TESTES]', err);
    process.exitCode = 1;
  } finally {
    if (pool) {
      await pool.end().catch(() => {});
    }
    finalizarClusterEfêmero();
  }
}

main();
