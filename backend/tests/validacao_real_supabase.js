/**
 * Script de Validação Real de Idempotência Financeira contra o Supabase.
 *
 * Cenários contemplados:
 * - Cenário A: Lançamento financeiro (receita/despesa) com reenvio do mesmo idLocal.
 * - Cenário B: Dívida parcelada com reenvio do mesmo idLocal (sem duplicação de parcelas).
 * - Cenário C: Concorrência simultânea com o mesmo idLocal (Promise.all).
 *
 * Recuperação de Falhas e Manifesto Local:
 * - Os IDs criados são persistidos em disco em backend/tests/.manifestos/manifesto_<RUN_ID>.json a cada criação.
 * - Respostas inconclusivas ou timeouts são recuperados via busca pontual exata (id_usuario + id_local).
 * - Limpeza interrompida pode ser retomada com:
 *     node backend/tests/validacao_real_supabase.js --retomar-limpeza=<RUN_ID_OU_CAMINHO> --confirmar-conta-teste
 * - Antes de qualquer exclusão, o script verifica se os registros pertencem estritamente ao usuário e ao idLocal do teste.
 * - Confere pós-limpeza para certificar que nada sobrou antes de marcar status=LIMPO.
 *
 * Modos de operação:
 * 1. Simulação (DRY-RUN) - PADRÃO:
 *    Comando: node backend/tests/validacao_real_supabase.js
 *
 * 2. Execução Real (apenas com autorização e parâmetros explícitos):
 *    Comando: node backend/tests/validacao_real_supabase.js --executar-real --confirmar-conta-teste --usuario-id=<UUID>
 *
 * 3. Retomada de Limpeza de Execução Interrompida:
 *    Comando: node backend/tests/validacao_real_supabase.js --retomar-limpeza=<RUN_ID_OU_CAMINHO> --confirmar-conta-teste
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIR_MANIFESTOS = path.join(__dirname, '.manifestos');

// Leitura de parâmetros de linha de comando e variáveis de ambiente
const args = process.argv.slice(2);
const flagExecutarReal = args.includes('--executar-real') || process.env.EXECUTAR_REAL === 'true';
const flagConfirmarContaTeste = args.includes('--confirmar-conta-teste') || process.env.CONFIRMAR_CONTA_TESTE === 'true';
const argUsuarioId = (args.find((a) => a.startsWith('--usuario-id=')) || '').split('=')[1] || process.env.TEST_USUARIO_ID || null;
const argRetomarLimpeza = (args.find((a) => a.startsWith('--retomar-limpeza=')) || '').split('=')[1] || null;
const flagPularLimpeza = args.includes('--manter-dados') || process.env.MANTER_DADOS === 'true';

// O modo padrão é SEMPRE Dry-Run (simulação) a menos que explicitamente solicitado executar-real ou retomar-limpeza
const MODO_RETOMAR_LIMPEZA = Boolean(argRetomarLimpeza);
const MODO_DRY_RUN = !flagExecutarReal && !MODO_RETOMAR_LIMPEZA;

const RUN_ID = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
const PREFIXO_AUDITORIA = `AUDITORIA_TESTE_IDEMP_${RUN_ID}`;
const CAMINHO_MANIFESTO = path.join(DIR_MANIFESTOS, `manifesto_${RUN_ID}.json`);

/**
 * Estrutura do Manifesto em disco
 */
let manifesto = {
  runId: RUN_ID,
  prefixo: PREFIXO_AUDITORIA,
  usuarioId: argUsuarioId,
  criadoEm: new Date().toISOString(),
  atualizadoEm: new Date().toISOString(),
  status: 'EM_ANDAMENTO', // EM_ANDAMENTO | CONCLUIDO | FALHA | LIMPO
  passos: {
    cenarioA: {
      idLocal: `${PREFIXO_AUDITORIA}_TX_1`,
      idLancamento: null,
      status: 'PENDENTE',
    },
    cenarioB: {
      idLocal: `${PREFIXO_AUDITORIA}_DIV_1`,
      idFinanciamento: null,
      idsParcelas: [],
      status: 'PENDENTE',
    },
    cenarioC: {
      idLocal: `${PREFIXO_AUDITORIA}_CONC_1`,
      idLancamento: null,
      status: 'PENDENTE',
    },
  },
  registrosParaLimpeza: {
    lancamentosIds: [],
    financiamentosIds: [],
    parcelasIds: [],
  },
};

/**
 * Salva o estado atual do manifesto em disco de forma síncrona
 */
function salvarManifestoEmDisco(m = manifesto, caminho = CAMINHO_MANIFESTO) {
  try {
    if (!fs.existsSync(DIR_MANIFESTOS)) {
      fs.mkdirSync(DIR_MANIFESTOS, { recursive: true });
    }
    m.atualizadoEm = new Date().toISOString();
    fs.writeFileSync(caminho, JSON.stringify(m, null, 2), 'utf-8');
  } catch (err) {
    console.error(`[ALERTA MANIFESTO] Falha ao persistir manifesto em disco (${caminho}):`, err.message);
  }
}

/**
 * Registra novo ID para limpeza e atualiza o manifesto em disco imediatamente
 */
function registrarIdLimpeza(tipo, id) {
  if (!id) return;
  const lista = manifesto.registrosParaLimpeza[tipo];
  if (Array.isArray(lista) && !lista.includes(id)) {
    lista.push(id);
    salvarManifestoEmDisco();
  }
}

/**
 * Utilitário HTTP local
 */
async function fazerRequisicaoHttp(urlBase, caminho, { metodo = 'POST', token, corpo } = {}) {
  const url = `${urlBase}${caminho}`;
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const resposta = await fetch(url, {
    method: metodo,
    headers,
    body: corpo ? JSON.stringify(corpo) : undefined,
  });

  const json = await resposta.json().catch(() => null);
  return { status: resposta.status, ok: resposta.ok, json };
}

/**
 * Localiza registro no Supabase por combinação exata de id_usuario e id_local (sem buscas por prefixo)
 */
async function localizarRegistroPorIdLocal(supabase, tabela, usuarioId, idLocal) {
  const { data, error } = await supabase
    .from(tabela)
    .select('id, id_usuario, id_local')
    .eq('id_usuario', usuarioId)
    .eq('id_local', idLocal)
    .maybeSingle();

  if (error) {
    console.warn(`[AVISO RECUPERACAO] Erro ao buscar em ${tabela} por id_local=${idLocal}:`, error.message);
    return null;
  }
  return data;
}

/**
 * Validação pré-exclusão rigorosa: garante que os registros realmente pertencem ao usuário e ao teste
 */
async function validarRegistrosAntesDeExcluir(supabase, usuarioId, manifestoAlvo) {
  const idsValidados = {
    parcelas: [],
    financiamentos: [],
    lancamentos: [],
  };

  const { parcelasIds, financiamentosIds, lancamentosIds } = manifestoAlvo.registrosParaLimpeza;

  // 1. Validar financiamentos
  if (financiamentosIds.length > 0) {
    const { data: fins, error } = await supabase
      .from('financiamentos')
      .select('id, id_usuario, id_local')
      .in('id', financiamentosIds);

    if (!error && Array.isArray(fins)) {
      for (const f of fins) {
        const idLocalEsperado = manifestoAlvo.passos.cenarioB.idLocal;
        if (f.id_usuario === usuarioId && f.id_local === idLocalEsperado) {
          idsValidados.financiamentos.push(f.id);
        } else {
          console.warn(`[SEGURANÇA] Financiamento ${f.id} NÃO passou na validação de propriedade. Exclusão abortada para este ID.`);
        }
      }
    }
  }

  // 2. Validar parcelas vinculadas aos financiamentos da execução
  if (parcelasIds.length > 0) {
    const { data: parcs, error } = await supabase
      .from('lancamentos_financeiros')
      .select('id, id_usuario, id_financiamento')
      .in('id', parcelasIds);

    if (!error && Array.isArray(parcs)) {
      for (const p of parcs) {
        if (p.id_usuario === usuarioId && idsValidados.financiamentos.includes(p.id_financiamento)) {
          idsValidados.parcelas.push(p.id);
        } else {
          console.warn(`[SEGURANÇA] Parcela ${p.id} NÃO pertence aos financiamentos auditados. Exclusão abortada para este ID.`);
        }
      }
    }
  }

  // 3. Validar lançamentos avulsos
  if (lancamentosIds.length > 0) {
    const { data: lancs, error } = await supabase
      .from('lancamentos_financeiros')
      .select('id, id_usuario, id_local')
      .in('id', lancamentosIds);

    if (!error && Array.isArray(lancs)) {
      const idsLocaisValidos = [
        manifestoAlvo.passos.cenarioA.idLocal,
        manifestoAlvo.passos.cenarioC.idLocal,
      ];
      for (const l of lancs) {
        if (l.id_usuario === usuarioId && idsLocaisValidos.includes(l.id_local)) {
          idsValidados.lancamentos.push(l.id);
        } else {
          console.warn(`[SEGURANÇA] Lançamento ${l.id} NÃO confere com os idLocais da sessão. Exclusão abortada para este ID.`);
        }
      }
    }
  }

  return idsValidados;
}

/**
 * Teardown seguro com verificação de integridade referencial e checagem pós-exclusão
 */
async function executarTeardownSeguro(supabase, usuarioId, manifestoAlvo, caminhoManifestoAlvo) {
  if (flagPularLimpeza) {
    console.log('\n[TEARDOWN] Flag --manter-dados ativada. Registros preservados no Supabase remoto.');
    return;
  }

  console.log('\n================================================================');
  console.log('   LIMPEZA SEGURA DE REGISTROS DE TESTE (TEARDOWN RESILIENTE)');
  console.log('================================================================');

  const { parcelasIds, financiamentosIds, lancamentosIds } = manifestoAlvo.registrosParaLimpeza;
  const totalRastreado = parcelasIds.length + financiamentosIds.length + lancamentosIds.length;

  if (totalRastreado === 0) {
    console.log('[TEARDOWN] Nenhum registro registrado no manifesto para exclusão.');
    manifestoAlvo.status = 'LIMPO';
    salvarManifestoEmDisco(manifestoAlvo, caminhoManifestoAlvo);
    return;
  }

  console.log(`[TEARDOWN] Validando propriedade dos registros antes da exclusão...`);
  const validados = await validarRegistrosAntesDeExcluir(supabase, usuarioId, manifestoAlvo);

  console.log(` - Parcelas validadas: ${validados.parcelas.length} de ${parcelasIds.length}`);
  console.log(` - Financiamentos validados: ${validados.financiamentos.length} de ${financiamentosIds.length}`);
  console.log(` - Lançamentos avulsos validados: ${validados.lancamentos.length} de ${lancamentosIds.length}`);

  // Passo 1: Excluir parcelas vinculadas em lancamentos_financeiros
  if (validados.parcelas.length > 0) {
    console.log(`[TEARDOWN] Excluindo ${validados.parcelas.length} parcelas vinculadas...`);
    const { error } = await supabase
      .from('lancamentos_financeiros')
      .delete()
      .in('id', validados.parcelas);
    if (error) console.error('[ERRO TEARDOWN] Falha ao excluir parcelas:', error);
    else console.log('✔ Parcelas excluídas com sucesso.');
  }

  // Passo 2: Excluir financiamentos em financiamentos
  if (validados.financiamentos.length > 0) {
    console.log(`[TEARDOWN] Excluindo ${validados.financiamentos.length} financiamentos...`);
    const { error } = await supabase
      .from('financiamentos')
      .delete()
      .in('id', validados.financiamentos);
    if (error) console.error('[ERRO TEARDOWN] Falha ao excluir financiamentos:', error);
    else console.log('✔ Financiamentos excluídos com sucesso.');
  }

  // Passo 3: Excluir lançamentos avulsos em lancamentos_financeiros
  if (validados.lancamentos.length > 0) {
    console.log(`[TEARDOWN] Excluindo ${validados.lancamentos.length} lançamentos avulsos...`);
    const { error } = await supabase
      .from('lancamentos_financeiros')
      .delete()
      .in('id', validados.lancamentos);
    if (error) console.error('[ERRO TEARDOWN] Falha ao excluir lançamentos avulsos:', error);
    else console.log('✔ Lançamentos avulsos excluídos com sucesso.');
  }

  // Conferência Pós-Limpeza no Supabase
  console.log('\n[CONFERÊNCIA PÓS-LIMPEZA] Verificando se os registros foram 100% removidos...');
  const todosIdsExcluidos = [...validados.parcelas, ...validados.lancamentos];
  let resquicioDetectado = false;

  if (todosIdsExcluidos.length > 0) {
    const { data: resLanc } = await supabase
      .from('lancamentos_financeiros')
      .select('id')
      .in('id', todosIdsExcluidos);
    if (resLanc && resLanc.length > 0) {
      console.error(`[ALERTA] ${resLanc.length} lançamentos ainda presentes no banco!`);
      resquicioDetectado = true;
    }
  }

  if (validados.financiamentos.length > 0) {
    const { data: resFin } = await supabase
      .from('financiamentos')
      .select('id')
      .in('id', validados.financiamentos);
    if (resFin && resFin.length > 0) {
      console.error(`[ALERTA] ${resFin.length} financiamentos ainda presentes no banco!`);
      resquicioDetectado = true;
    }
  }

  if (!resquicioDetectado) {
    console.log('✔ Verificação pós-limpeza aprovada: 0 registros residuais no Supabase.');
    manifestoAlvo.status = 'LIMPO';
  } else {
    console.error('✖ Limpeza incompleta. O manifesto permanecerá com status de atenção.');
  }

  salvarManifestoEmDisco(manifestoAlvo, caminhoManifestoAlvo);
  console.log('================================================================');
  console.log(`✔ TEARDOWN CONCLUÍDO: Status do manifesto = ${manifestoAlvo.status}`);
  console.log('================================================================');
}

/**
 * Retomada de limpeza de uma execução interrompida
 */
async function executarRetomadaLimpeza() {
  console.log('================================================================');
  console.log('   RETOMADA DE LIMPEZA DE EXECUÇÃO ANTERIOR');
  console.log('================================================================');

  if (!flagConfirmarContaTeste) {
    console.error('\n[BLOQUEIO DE SEGURANÇA]');
    console.error('A retomada de limpeza exige a flag explícita --confirmar-conta-teste.');
    process.exit(1);
  }

  let caminhoAlvo = argRetomarLimpeza;
  if (!fs.existsSync(caminhoAlvo)) {
    caminhoAlvo = path.join(DIR_MANIFESTOS, `manifesto_${argRetomarLimpeza}.json`);
    if (!fs.existsSync(caminhoAlvo)) {
      console.error(`[ERRO] Manifesto não encontrado: ${argRetomarLimpeza} nem em ${caminhoAlvo}`);
      process.exit(1);
    }
  }

  console.log(`[INFO] Carregando manifesto: ${caminhoAlvo}`);
  const conteudo = fs.readFileSync(caminhoAlvo, 'utf-8');
  const manifestoCarregado = JSON.parse(conteudo);

  const usuarioId = manifestoCarregado.usuarioId;
  if (!usuarioId) {
    console.error('[ERRO] O manifesto carregado não contém usuarioId registrado.');
    process.exit(1);
  }

  const { default: supabase } = await import('../database/db.js');
  await executarTeardownSeguro(supabase, usuarioId, manifestoCarregado, caminhoAlvo);
}

/**
 * Modo de Simulação (Dry-Run)
 */
async function executarDryRun() {
  console.log('================================================================');
  console.log('   VALIDAÇÃO REAL DE IDEMPOTÊNCIA — FROTIX (MODO DRY-RUN)');
  console.log('================================================================');
  console.log(`[INFO] Prefixo da simulação: ${PREFIXO_AUDITORIA}`);
  console.log(`[INFO] Arquivo de manifesto simulado: ${CAMINHO_MANIFESTO}`);
  console.log('[INFO] Modo atual: SIMULAÇÃO (DRY-RUN)');
  console.log('[INFO] Nenhuma requisição de escrita (POST, UPDATE, DELETE) será enviada ao Supabase remoto.');
  console.log('----------------------------------------------------------------');

  console.log('\n[RECURSO DE RESILIÊNCIA E MANIFESTO LOCAL]');
  console.log('1. Durante a execução real, cada ID criado é gravado em disco no manifesto em tempo real.');
  console.log('2. Em caso de queda do processo, a limpeza pode ser retomada a qualquer momento com:');
  console.log(`   node backend/tests/validacao_real_supabase.js --retomar-limpeza=${RUN_ID} --confirmar-conta-teste`);
  console.log('3. Se uma requisição sofrer timeout, o script consulta por (id_usuario, id_local) e captura o ID antes de prosseguir.');
  console.log('4. A exclusão valida rigorosamente a propriedade dos registros antes de qualquer DELETE.');

  console.log('\n[CENÁRIO A — SIMULAÇÃO] Lançamento Financeiro');
  console.log(' - Payload simulado com idLocal estável.');
  console.log(' - Verificação simulada de HTTP 201 no envio 1 e HTTP 200 (jaExistente: true) no envio 2.');

  console.log('\n[CENÁRIO B — SIMULAÇÃO] Dívida Parcelada');
  console.log(' - Payload simulado de dívida com 2 parcelas.');
  console.log(' - Verificação simulada de reenvio com mesmo financiamentoId e sem duplicação de parcelas.');

  console.log('\n[CENÁRIO C — SIMULAÇÃO] Concorrência Simultânea');
  console.log(' - Disparo concorrente simulado via Promise.all.');
  console.log(' - Verificação de absorção da concorrência e garantia de unicidade.');

  console.log('\n----------------------------------------------------------------');
  console.log('[CONCLUÍDO] Simulação DRY-RUN concluída com sucesso!');
  console.log('NENHUM DADO FOI ALTERADO OU GRAVADO NO BANCO REMOTO.');
  console.log('----------------------------------------------------------------');
  console.log('Para executar a validação real após autorização expressa, forneça:');
  console.log('  node backend/tests/validacao_real_supabase.js --executar-real --confirmar-conta-teste --usuario-id=<UUID>');
  console.log('================================================================');
}

/**
 * Execução Real contra o Supabase Remoto
 */
async function executarValidacaoReal() {
  console.log('================================================================');
  console.log('   VALIDAÇÃO REAL DE IDEMPOTÊNCIA CONTRA O SUPABASE');
  console.log('================================================================');
  console.log(`[INFO] RUN_ID exclusivo: ${RUN_ID}`);
  console.log(`[INFO] Prefixo da execução: ${PREFIXO_AUDITORIA}`);
  console.log(`[INFO] Usuário de teste informado: ${argUsuarioId}`);
  console.log(`[INFO] Manifesto local em: ${CAMINHO_MANIFESTO}`);

  const { default: supabase } = await import('../database/db.js');
  const { default: app } = await import('../app.js');
  const { gerarToken } = await import('../middleware/auth.js');

  // 1. Confirmar projeto Supabase de destino (mascarado)
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const urlMascarada = supabaseUrl.replace(/https:\/\/(.{4}).*(\.supabase\.co.*)/, 'https://$1***$2');
  console.log(`[CHECK PREVIO] Projeto Supabase destino: ${urlMascarada}`);

  // 2. Confirmar existência e status do usuário escolhido
  console.log(`[CHECK PREVIO] Verificando existência do usuário no banco remoto...`);
  const { data: usuarioDb, error: erroUsuario } = await supabase
    .from('usuarios')
    .select('id, nome, ativo, id_perfil')
    .eq('id', argUsuarioId)
    .maybeSingle();

  if (erroUsuario || !usuarioDb) {
    throw new Error(`Usuário ${argUsuarioId} não encontrado no Supabase remoto: ${erroUsuario?.message || 'Inexistente'}`);
  }
  if (!usuarioDb.ativo) {
    throw new Error(`O usuário ${argUsuarioId} está inativo no banco de dados.`);
  }
  console.log(`✔ Usuário confirmado: id=${usuarioDb.id}, perfil=${usuarioDb.id_perfil}, ativo=${usuarioDb.ativo}`);

  // 3. Confirmar que os identificadores locais específicos dessa execução ainda não existem no banco
  console.log(`[CHECK PREVIO] Verificando se os idLocais já existem no Supabase...`);
  const idsParaChecar = [
    manifesto.passos.cenarioA.idLocal,
    manifesto.passos.cenarioB.idLocal,
    manifesto.passos.cenarioC.idLocal,
  ];

  const { data: conflitoLanc } = await supabase
    .from('lancamentos_financeiros')
    .select('id, id_local')
    .in('id_local', idsParaChecar);

  const { data: conflitoFin } = await supabase
    .from('financiamentos')
    .select('id, id_local')
    .in('id_local', idsParaChecar);

  if ((conflitoLanc && conflitoLanc.length > 0) || (conflitoFin && conflitoFin.length > 0)) {
    throw new Error(`Conflito: idLocal já existente no banco de dados. Abortando para garantir RUN_ID inédito.`);
  }
  console.log(`✔ Identificadores locais inéditos confirmados.`);

  // 4. Inicializa o manifesto no disco antes de qualquer chamada remota de escrita
  manifesto.usuarioId = argUsuarioId;
  salvarManifestoEmDisco();
  console.log(`✔ Manifesto inicializado e persistido em disco com sucesso.`);
  console.log('----------------------------------------------------------------');

  const servidor = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const porta = servidor.address().port;
  const urlBase = `http://127.0.0.1:${porta}`;
  console.log(`[INFO] Servidor backend Express rodando localmente na porta ${porta}.`);

  const token = gerarToken({ id: argUsuarioId, id_perfil: Number(usuarioDb.id_perfil) || 1, nome: usuarioDb.nome || 'Auditoria' });

  let falhaOcorrida = null;

  try {
    // -------------------------------------------------------------
    // CENÁRIO A: Lançamento Financeiro
    // -------------------------------------------------------------
    console.log('\n--- [CENÁRIO A] Lançamento Financeiro (Receita/Despesa) ---');
    const idLocalA = manifesto.passos.cenarioA.idLocal;
    const payloadA = {
      idLocal: idLocalA,
      tipo: 'saida',
      descricao: `${PREFIXO_AUDITORIA} Despesa Combustivel Teste`,
      valorParcela: 75.5,
      estadoOuStatus: 'PAGO',
    };

    console.log('1. Enviando primeira requisição...');
    let idLancamentoA = null;
    try {
      const r1A = await fazerRequisicaoHttp(urlBase, '/financeiro/transacoes', { token, corpo: payloadA });
      if (r1A.status === 201 && r1A.json?.lancamento?.id) {
        idLancamentoA = r1A.json.lancamento.id;
      } else {
        throw new Error(`Status inesperado: ${r1A.status}`);
      }
    } catch (errEnvioA) {
      console.warn('[TIMEOUT / RESPOSTA INCONCLUSIVA] Verificando recuperação pontual por (id_usuario, id_local)...');
      const rec = await localizarRegistroPorIdLocal(supabase, 'lancamentos_financeiros', argUsuarioId, idLocalA);
      if (rec?.id) {
        idLancamentoA = rec.id;
        console.log(`✔ Registro recuperado com sucesso pelo id_local: ID=${idLancamentoA}`);
      } else {
        throw errEnvioA;
      }
    }

    manifesto.passos.cenarioA.idLancamento = idLancamentoA;
    registrarIdLimpeza('lancamentosIds', idLancamentoA);
    console.log(`✔ Primeira requisição aprovada: ID=${idLancamentoA} persistido no manifesto.`);

    console.log('2. Reenviando a mesma requisição (mesmo idLocal)...');
    const r2A = await fazerRequisicaoHttp(urlBase, '/financeiro/transacoes', { token, corpo: payloadA });
    if (r2A.status !== 200 || !r2A.json?.jaExistente || r2A.json?.lancamento?.id !== idLancamentoA) {
      throw new Error(`Falha na idempotência do Cenário A: status=${r2A.status}, resp=${JSON.stringify(r2A.json)}`);
    }
    manifesto.passos.cenarioA.status = 'CONCLUIDO';
    salvarManifestoEmDisco();
    console.log(`✔ Segunda requisição aprovada: HTTP 200, jaExistente=true, mesmo ID=${r2A.json.lancamento.id}`);

    console.log('3. Conferindo integridade diretamente no Supabase remoto...');
    const { data: dadosA, error: erroA } = await supabase
      .from('lancamentos_financeiros')
      .select('id, id_local')
      .eq('id_usuario', argUsuarioId)
      .eq('id_local', idLocalA);
    if (erroA) throw erroA;
    if (dadosA.length !== 1) {
      throw new Error(`Inconsistência no banco: esperado 1 registro para o idLocal, encontrados ${dadosA.length}`);
    }
    console.log('✔ Verificação no Supabase confirmada: exatamente 1 registro persistido.');

    // -------------------------------------------------------------
    // CENÁRIO B: Dívida Parcelada
    // -------------------------------------------------------------
    console.log('\n--- [CENÁRIO B] Dívida Parcelada (Financiamento + Parcelas) ---');
    const idLocalB = manifesto.passos.cenarioB.idLocal;
    const payloadB = {
      idLocal: idLocalB,
      tipo: 'divida',
      descricao: `${PREFIXO_AUDITORIA} Manutencao Parcelada Teste`,
      valorParcela: 150.0,
      quantidadeParcelas: 2,
      vencimentoPrimeira: new Date().toISOString().split('T')[0],
    };

    console.log('1. Enviando primeira requisição de dívida (2 parcelas)...');
    let idFinanciamentoB = null;
    try {
      const r1B = await fazerRequisicaoHttp(urlBase, '/financeiro/transacoes', { token, corpo: payloadB });
      if (r1B.status === 201 && r1B.json?.financiamentoId) {
        idFinanciamentoB = r1B.json.financiamentoId;
      } else {
        throw new Error(`Status inesperado: ${r1B.status}`);
      }
    } catch (errEnvioB) {
      console.warn('[TIMEOUT / RESPOSTA INCONCLUSIVA] Verificando recuperação pontual por (id_usuario, id_local)...');
      const rec = await localizarRegistroPorIdLocal(supabase, 'financiamentos', argUsuarioId, idLocalB);
      if (rec?.id) {
        idFinanciamentoB = rec.id;
        console.log(`✔ Financiamento recuperado com sucesso pelo id_local: ID=${idFinanciamentoB}`);
      } else {
        throw errEnvioB;
      }
    }

    manifesto.passos.cenarioB.idFinanciamento = idFinanciamentoB;
    registrarIdLimpeza('financiamentosIds', idFinanciamentoB);
    console.log(`✔ Primeira requisição aprovada: FinanciamentoID=${idFinanciamentoB} persistido no manifesto.`);

    console.log('2. Reenviando a mesma requisição de dívida (mesmo idLocal)...');
    const r2B = await fazerRequisicaoHttp(urlBase, '/financeiro/transacoes', { token, corpo: payloadB });
    if (r2B.status !== 200 || !r2B.json?.jaExistente || r2B.json?.financiamentoId !== idFinanciamentoB) {
      throw new Error(`Falha na idempotência do Cenário B: status=${r2B.status}, resp=${JSON.stringify(r2B.json)}`);
    }
    console.log(`✔ Segunda requisição aprovada: HTTP 200, jaExistente=true, mesmo FinanciamentoID=${r2B.json.financiamentoId}`);

    console.log('3. Conferindo integridade e capturando parcelas no Supabase remoto...');
    const { data: dadosFinB, error: erroFinB } = await supabase
      .from('financiamentos')
      .select('id, id_local')
      .eq('id_usuario', argUsuarioId)
      .eq('id_local', idLocalB);
    if (erroFinB) throw erroFinB;
    if (dadosFinB.length !== 1) {
      throw new Error(`Inconsistência de financiamentos no banco: encontrados ${dadosFinB.length}`);
    }

    const { data: dadosParcelasB, error: erroParcelasB } = await supabase
      .from('lancamentos_financeiros')
      .select('id, numero_parcela')
      .eq('id_financiamento', idFinanciamentoB);
    if (erroParcelasB) throw erroParcelasB;
    if (dadosParcelasB.length !== 2) {
      throw new Error(`Inconsistência de parcelas no banco: esperado 2, encontrados ${dadosParcelasB.length}`);
    }

    for (const p of dadosParcelasB) {
      manifesto.passos.cenarioB.idsParcelas.push(p.id);
      registrarIdLimpeza('parcelasIds', p.id);
    }
    manifesto.passos.cenarioB.status = 'CONCLUIDO';
    salvarManifestoEmDisco();
    console.log(`✔ Verificação no Supabase confirmada: exatamente 1 financiamento e exatamente 2 parcelas registradas.`);

    // -------------------------------------------------------------
    // CENÁRIO C: Concorrência Simultânea
    // -------------------------------------------------------------
    console.log('\n--- [CENÁRIO C] Concorrência Simultânea (Promise.all) ---');
    const idLocalC = manifesto.passos.cenarioC.idLocal;
    const payloadC = {
      idLocal: idLocalC,
      tipo: 'entrada',
      descricao: `${PREFIXO_AUDITORIA} Adiantamento Concorrente Teste`,
      valorParcela: 300.0,
    };

    console.log('1. Disparando 2 requisições paralelas simultâneas com mesmo idLocal...');
    const [resConc1, resConc2] = await Promise.all([
      fazerRequisicaoHttp(urlBase, '/financeiro/transacoes', { token, corpo: payloadC }),
      fazerRequisicaoHttp(urlBase, '/financeiro/transacoes', { token, corpo: payloadC }),
    ]);

    const statuses = [resConc1.status, resConc2.status].sort();
    console.log(`Status recebidos: [${resConc1.status}, ${resConc2.status}]`);

    const ehValido = statuses[0] === 200 && [200, 201].includes(statuses[1]);
    if (!ehValido) {
      throw new Error(`Comportamento inesperado na concorrência: status=[${statuses.join(', ')}]`);
    }

    let idLancamentoC = resConc1.json?.lancamento?.id || resConc2.json?.lancamento?.id;
    if (!idLancamentoC) {
      console.warn('[AVISO] ID da concorrência não veio no corpo; recuperando pontualmente por id_local...');
      const recC = await localizarRegistroPorIdLocal(supabase, 'lancamentos_financeiros', argUsuarioId, idLocalC);
      idLancamentoC = recC?.id;
    }

    if (idLancamentoC) {
      manifesto.passos.cenarioC.idLancamento = idLancamentoC;
      registrarIdLimpeza('lancamentosIds', idLancamentoC);
    }
    manifesto.passos.cenarioC.status = 'CONCLUIDO';
    salvarManifestoEmDisco();
    console.log(`✔ Concorrência tratada com sucesso! ID=${idLancamentoC} registrado no manifesto.`);

    console.log('2. Conferindo unicidade diretamente no Supabase remoto...');
    const { data: dadosC, error: erroC } = await supabase
      .from('lancamentos_financeiros')
      .select('id, id_local')
      .eq('id_usuario', argUsuarioId)
      .eq('id_local', idLocalC);
    if (erroC) throw erroC;
    if (dadosC.length !== 1) {
      throw new Error(`Inconsistência de concorrência: duplicidade detectada no banco! Encontrados ${dadosC.length}`);
    }
    console.log('✔ Verificação no Supabase confirmada: exatamente 1 registro gravado no banco.');

    manifesto.status = 'CONCLUIDO';
    salvarManifestoEmDisco();

    console.log('\n================================================================');
    console.log('✔ TODOS OS 3 CENÁRIOS FORAM VALIDADOS COM SUCESSO NO SUPABASE REAL!');
    console.log('================================================================');
  } catch (erro) {
    falhaOcorrida = erro;
    manifesto.status = 'FALHA';
    salvarManifestoEmDisco();
    console.error('\n✖ [FALHA NA VALIDAÇÃO REAL]:', erro.message);
  } finally {
    await new Promise((resolve) => servidor.close(resolve));

    // Teardown resiliente usando o manifesto persistido
    try {
      await executarTeardownSeguro(supabase, argUsuarioId, manifesto, CAMINHO_MANIFESTO);
    } catch (erroLimpeza) {
      console.error('[ERRO NO TEARDOWN]:', erroLimpeza);
    }

    if (falhaOcorrida) {
      process.exit(1);
    }
  }
}

/**
 * Ponto de Entrada Principal
 */
async function main() {
  if (MODO_RETOMAR_LIMPEZA) {
    await executarRetomadaLimpeza();
    return;
  }

  if (MODO_DRY_RUN) {
    await executarDryRun();
    return;
  }

  // Validação estrita de segurança antes de permitir modo real
  if (!flagConfirmarContaTeste) {
    console.error('\n[BLOQUEIO DE SEGURANÇA]');
    console.error('A execução real exige a flag explícita --confirmar-conta-teste.');
    console.error('Abortando sem realizar alterações.\n');
    process.exit(1);
  }

  if (!argUsuarioId || !/^[0-9a-f-]{36}$/i.test(argUsuarioId)) {
    console.error('\n[BLOQUEIO DE SEGURANÇA]');
    console.error('A execução real exige um UUID de usuário válido fornecido via --usuario-id=<UUID>.');
    console.error('Nenhum ID fixo é aceito no código para evitar contaminação de dados.');
    console.error('Abortando sem realizar alterações.\n');
    process.exit(1);
  }

  await executarValidacaoReal();
}

main().catch((err) => {
  console.error('[ERRO NÃO TRATADO]:', err);
  process.exit(1);
});
