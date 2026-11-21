import supabase from '../database/db.js';
import { PERFIS } from '../middleware/auth.js';
import {
  ehCancelado, hojeIso, somarDias, mesDe, rotuloMes, listaMeses, fluxoMensal, arredondar,
} from '../utils/calculos.js';

// -----------------------------------------------------------------------------
// Módulo financeiro do app: extrato, estorno (rollback), pagamento de parcelas,
// dívidas, previsão de caixa, fluxo mensal e alertas.
// Tudo usa a tabela lancamentos_financeiros (e financiamentos para as dívidas).
// -----------------------------------------------------------------------------

const maiusculo = (v) => String(v || '').toUpperCase().trim();
const minusculo = (v) => String(v || '').toLowerCase().trim();
const veTudo = (req) => [PERFIS.ADMIN, PERFIS.FINANCEIRO].includes(req.usuario?.perfil);
const dataValidaIso = (t) => /^\d{4}-\d{2}-\d{2}$/.test(String(t || '')) && !Number.isNaN(Date.parse(`${t}T12:00:00Z`));
const vencimentoDe = (l) => l.data_vencimento || l.data_lancamento;

function erroInterno(res, contexto, erro) {
  console.error(`Erro ao ${contexto}:`, erro);
  return res.status(500).json({ sucesso: false, erro: `Erro interno ao ${contexto}.` });
}

const formatarMoeda = (n) =>
  `R$ ${Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const dataBr = (iso) => {
  if (!iso) return null;
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
};

// -----------------------------------------------------------------------------
// Leitura em lote
// -----------------------------------------------------------------------------

async function carregarLancamentos(req) {
  let consulta = supabase.from('lancamentos_financeiros').select('*');
  if (req && !veTudo(req)) consulta = consulta.eq('id_usuario', req.usuario.id);
  const { data, error } = await consulta;
  if (error) throw error;
  return data || [];
}

async function carregarNomes() {
  const [cats, formas, viagens, usuarios] = await Promise.all([
    supabase.from('categorias_financeiras').select('id, nome'),
    supabase.from('formas_pagamento').select('id, nome'),
    supabase.from('viagens').select('id, origem, destino, data_saida, iniciada_em'),
    supabase.from('usuarios').select('id, nome'),
  ]);
  for (const r of [cats, formas, viagens, usuarios]) if (r.error) throw r.error;
  const mapa = (lista, f) => Object.fromEntries((lista || []).map((i) => [i.id, f(i)]));
  return {
    categorias: mapa(cats.data, (c) => c.nome),
    formas: mapa(formas.data, (f) => f.nome),
    viagens: mapa(viagens.data, (v) => {
      const data = dataBr(v.data_saida || v.iniciada_em);
      return `${v.origem} → ${v.destino}${data ? ` · ${data}` : ''}`;
    }),
    usuarios: mapa(usuarios.data, (u) => u.nome),
  };
}

function montarLancamento(l, nomes) {
  return {
    id: l.id,
    descricao: l.descricao,
    valor: Number(l.valor) || 0,
    tipo: minusculo(l.tipo),
    status: minusculo(l.status),
    data: l.data_lancamento,
    vencimento: l.data_vencimento,
    pagamento: l.data_pagamento,
    categoria: nomes.categorias[l.id_categoria] || 'Outros',
    idCategoria: l.id_categoria || null,
    formaPagamento: nomes.formas[l.id_forma_pagamento] || null,
    viagem: l.id_viagem ? { id: l.id_viagem, label: nomes.viagens[l.id_viagem] || 'Viagem' } : null,
    usuario: nomes.usuarios[l.id_usuario] || null,
    comprovante: l.comprovante_url || l.foto_url || l.documento_url || null,
    idFinanciamento: l.id_financiamento || null,
    parcela: l.numero_parcela ? `${l.numero_parcela}/${l.total_parcelas}` : null,
    cancelamento: ehCancelado(l)
      ? { em: l.cancelado_em || null, motivo: l.motivo_cancelamento || null, por: nomes.usuarios[l.cancelado_por] || null }
      : null,
  };
}

// -----------------------------------------------------------------------------
// Extrato: GET /financeiro/lancamentos
// -----------------------------------------------------------------------------

const normalizar = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export async function listarLancamentos(req, res) {
  try {
    const q = req.query || {};
    for (const campo of ['inicio', 'fim']) {
      if (q[campo] && !dataValidaIso(q[campo])) {
        return res.status(400).json({ sucesso: false, erro: `Data "${campo}" inválida. Use AAAA-MM-DD.` });
      }
    }
    const tipo = q.tipo ? maiusculo(q.tipo) : null;
    if (tipo && !['ENTRADA', 'SAIDA', 'DIVIDA'].includes(tipo)) {
      return res.status(400).json({ sucesso: false, erro: 'Tipo inválido. Use entrada, saida ou divida.' });
    }
    const status = q.status ? maiusculo(q.status) : null;
    if (status && !['PAGO', 'PENDENTE', 'CANCELADO'].includes(status)) {
      return res.status(400).json({ sucesso: false, erro: 'Status inválido. Use pago, pendente ou cancelado.' });
    }
    const limite = Math.min(Math.max(parseInt(q.limite, 10) || 30, 1), 100);
    const pagina = Math.max(parseInt(q.pagina, 10) || 1, 1);

    const [todos, nomes] = await Promise.all([carregarLancamentos(req), carregarNomes()]);
    const termo = normalizar(q.busca || '').trim();

    const filtrados = todos.filter((l) => {
      const data = String(l.data_lancamento || l.data_vencimento || '').slice(0, 10);
      if (q.inicio && data < q.inicio) return false;
      if (q.fim && data > q.fim) return false;
      if (tipo && maiusculo(l.tipo) !== tipo) return false;
      if (status && maiusculo(l.status) !== status) return false;
      if (q.idCategoria && l.id_categoria !== q.idCategoria) return false;
      if (q.idViagem && l.id_viagem !== q.idViagem) return false;
      if (termo && !normalizar(l.descricao).includes(termo)) return false;
      return true;
    });

    // Mais recentes primeiro.
    const chave = (l) => `${l.data_lancamento || l.data_vencimento || ''}|${l.created_at || ''}|${l.numero_parcela ?? ''}`;
    filtrados.sort((a, b) => chave(b).localeCompare(chave(a)));

    const ativos = filtrados.filter((l) => !ehCancelado(l));
    const somar = (f) => arredondar(ativos.filter(f).reduce((s, l) => s + (Number(l.valor) || 0), 0));

    return res.json({
      sucesso: true,
      total: filtrados.length,
      pagina,
      limite,
      totais: {
        entradas: somar((l) => maiusculo(l.tipo) === 'ENTRADA'),
        saidas: somar((l) => maiusculo(l.tipo) !== 'ENTRADA'),
      },
      lancamentos: filtrados.slice((pagina - 1) * limite, pagina * limite).map((l) => montarLancamento(l, nomes)),
    });
  } catch (e) {
    return erroInterno(res, 'listar os lançamentos', e);
  }
}

// -----------------------------------------------------------------------------
// Estorno (rollback) e pagamento
// -----------------------------------------------------------------------------

async function buscarLancamento(id) {
  const { data, error } = await supabase.from('lancamentos_financeiros').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * POST /financeiro/lancamentos/:id/estornar  { motivo }
 * Não apaga: marca como CANCELADO e guarda quem estornou, quando e por quê.
 * Parcelas de dívida são canceladas pela dívida (POST /financeiro/dividas/:id/cancelar).
 */
export async function estornarLancamento(req, res) {
  try {
    const motivo = String(req.body?.motivo || '').trim();
    if (motivo.length < 3) return res.status(400).json({ sucesso: false, erro: 'Informe o motivo do estorno.' });

    const lanc = await buscarLancamento(req.params.id);
    if (!lanc) return res.status(404).json({ sucesso: false, erro: 'Lançamento não encontrado.' });
    if (ehCancelado(lanc)) return res.status(409).json({ sucesso: false, erro: 'Esse lançamento já foi estornado.' });
    if (lanc.id_financiamento) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Parcelas de dívida são canceladas pela própria dívida, ou use "Desfazer pagamento".',
      });
    }

    const { data, error } = await supabase
      .from('lancamentos_financeiros')
      .update({
        status: 'CANCELADO',
        cancelado_em: new Date().toISOString(),
        cancelado_por: req.usuario.id,
        motivo_cancelamento: motivo,
      })
      .eq('id', lanc.id)
      .neq('status', 'CANCELADO')
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(409).json({ sucesso: false, erro: 'Esse lançamento já foi estornado.' });

    return res.json({ sucesso: true, mensagem: 'Lançamento estornado.', lancamento: montarLancamento(data, await carregarNomes()) });
  } catch (e) {
    return erroInterno(res, 'estornar o lançamento', e);
  }
}

/** POST /financeiro/lancamentos/:id/pagar  { data? } — PENDENTE -> PAGO (paga parcela ou conta). */
export async function pagarLancamento(req, res) {
  try {
    const data = req.body?.data || hojeIso();
    if (!dataValidaIso(data)) return res.status(400).json({ sucesso: false, erro: 'Data inválida. Use AAAA-MM-DD.' });
    if (data > hojeIso()) return res.status(400).json({ sucesso: false, erro: 'A data do pagamento não pode estar no futuro.' });

    const lanc = await buscarLancamento(req.params.id);
    if (!lanc) return res.status(404).json({ sucesso: false, erro: 'Lançamento não encontrado.' });
    if (maiusculo(lanc.status) !== 'PENDENTE') {
      return res.status(409).json({ sucesso: false, erro: `Esse lançamento está ${minusculo(lanc.status)}, não pendente.` });
    }

    const { data: pago, error } = await supabase
      .from('lancamentos_financeiros')
      .update({ status: 'PAGO', data_pagamento: data })
      .eq('id', lanc.id)
      .eq('status', 'PENDENTE')
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!pago) return res.status(409).json({ sucesso: false, erro: 'Esse lançamento acabou de ser alterado por outra pessoa.' });
    return res.json({ sucesso: true, mensagem: 'Pagamento registrado.', lancamento: montarLancamento(pago, await carregarNomes()) });
  } catch (e) {
    return erroInterno(res, 'registrar o pagamento', e);
  }
}

/** POST /financeiro/lancamentos/:id/desfazer-pagamento — PAGO -> PENDENTE (rollback do pagamento). */
export async function desfazerPagamento(req, res) {
  try {
    const lanc = await buscarLancamento(req.params.id);
    if (!lanc) return res.status(404).json({ sucesso: false, erro: 'Lançamento não encontrado.' });
    if (maiusculo(lanc.status) !== 'PAGO') {
      return res.status(409).json({ sucesso: false, erro: 'Só é possível desfazer o pagamento de um lançamento pago.' });
    }
    const { data, error } = await supabase
      .from('lancamentos_financeiros')
      .update({ status: 'PENDENTE', data_pagamento: null })
      .eq('id', lanc.id)
      .eq('status', 'PAGO')
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(409).json({ sucesso: false, erro: 'Esse lançamento acabou de ser alterado por outra pessoa.' });
    return res.json({ sucesso: true, mensagem: 'Pagamento desfeito.', lancamento: montarLancamento(data, await carregarNomes()) });
  } catch (e) {
    return erroInterno(res, 'desfazer o pagamento', e);
  }
}

// -----------------------------------------------------------------------------
// Dívidas (financiamentos + parcelas)
// -----------------------------------------------------------------------------

function resumirDivida(fin, parcelas, hoje) {
  const ativas = parcelas.filter((p) => !ehCancelado(p));
  const pagas = ativas.filter((p) => maiusculo(p.status) === 'PAGO');
  const pendentes = ativas.filter((p) => maiusculo(p.status) === 'PENDENTE');
  const atrasadas = pendentes.filter((p) => vencimentoDe(p) < hoje);
  const proxima = [...pendentes].sort((a, b) => String(vencimentoDe(a)).localeCompare(String(vencimentoDe(b))))[0];
  const somar = (lista) => arredondar(lista.reduce((s, p) => s + (Number(p.valor) || 0), 0));

  let status = 'em_dia';
  if (fin.cancelado_em || (ativas.length === 0 && parcelas.length > 0)) status = 'cancelada';
  else if (pendentes.length === 0) status = 'quitada';
  else if (atrasadas.length > 0) status = 'atrasada';

  return {
    id: fin.id,
    descricao: fin.descricao,
    credor: fin.credor || null,
    valorTotal: Number(fin.valor_total) || somar(parcelas),
    valorParcela: Number(fin.valor_parcela) || 0,
    quantidadeParcelas: Number(fin.quantidade_parcelas) || parcelas.length,
    quitacaoAntecipada: fin.valor_quitacao_antecipada === null || fin.valor_quitacao_antecipada === undefined
      ? null : Number(fin.valor_quitacao_antecipada),
    pagas: pagas.length,
    pendentes: pendentes.length,
    canceladas: parcelas.length - ativas.length,
    atrasadas: atrasadas.length,
    valorPago: somar(pagas),
    valorRestante: somar(pendentes),
    proximoVencimento: proxima ? vencimentoDe(proxima) : null,
    status,
  };
}

async function carregarDividas(idFinanciamento) {
  let consultaFin = supabase.from('financiamentos').select('*');
  if (idFinanciamento) consultaFin = consultaFin.eq('id', idFinanciamento);
  const [fins, parcelas] = await Promise.all([
    consultaFin,
    supabase.from('lancamentos_financeiros').select('*').eq('tipo', 'DIVIDA'),
  ]);
  if (fins.error) throw fins.error;
  if (parcelas.error) throw parcelas.error;
  const porFin = {};
  for (const p of parcelas.data || []) {
    if (!p.id_financiamento) continue;
    (porFin[p.id_financiamento] ||= []).push(p);
  }
  for (const lista of Object.values(porFin)) lista.sort((a, b) => (a.numero_parcela || 0) - (b.numero_parcela || 0));
  return { financiamentos: fins.data || [], porFin };
}

/** GET /financeiro/dividas */
export async function listarDividas(req, res) {
  try {
    const hoje = hojeIso();
    const { financiamentos, porFin } = await carregarDividas();
    const ordem = { atrasada: 0, em_dia: 1, quitada: 2, cancelada: 3 };
    const dividas = financiamentos
      .map((f) => resumirDivida(f, porFin[f.id] || [], hoje))
      .sort((a, b) => ordem[a.status] - ordem[b.status]
        || String(a.proximoVencimento || '9999').localeCompare(String(b.proximoVencimento || '9999')));

    const abertas = dividas.filter((d) => d.status === 'em_dia' || d.status === 'atrasada');
    return res.json({
      sucesso: true,
      totais: {
        abertas: abertas.length,
        valorRestante: arredondar(abertas.reduce((s, d) => s + d.valorRestante, 0)),
        parcelasAtrasadas: abertas.reduce((s, d) => s + d.atrasadas, 0),
      },
      dividas,
    });
  } catch (e) {
    return erroInterno(res, 'listar as dívidas', e);
  }
}

/** GET /financeiro/dividas/:id */
export async function detalharDivida(req, res) {
  try {
    const hoje = hojeIso();
    const [{ financiamentos, porFin }, nomes] = await Promise.all([carregarDividas(req.params.id), carregarNomes()]);
    const fin = financiamentos[0];
    if (!fin) return res.status(404).json({ sucesso: false, erro: 'Dívida não encontrada.' });
    const parcelas = porFin[fin.id] || [];
    return res.json({
      sucesso: true,
      divida: {
        ...resumirDivida(fin, parcelas, hoje),
        categoria: nomes.categorias[fin.id_categoria] || null,
        formaPagamento: nomes.formas[fin.id_forma_pagamento] || null,
        parcelas: parcelas.map((p) => ({
          ...montarLancamento(p, nomes),
          atrasada: maiusculo(p.status) === 'PENDENTE' && vencimentoDe(p) < hoje,
        })),
      },
    });
  } catch (e) {
    return erroInterno(res, 'consultar a dívida', e);
  }
}

/**
 * POST /financeiro/dividas/:id/cancelar  { motivo }
 * Rollback da dívida: as parcelas pendentes ficam CANCELADAS; as pagas continuam no histórico.
 */
export async function cancelarDivida(req, res) {
  try {
    const motivo = String(req.body?.motivo || '').trim();
    if (motivo.length < 3) return res.status(400).json({ sucesso: false, erro: 'Informe o motivo do cancelamento.' });

    const { financiamentos, porFin } = await carregarDividas(req.params.id);
    const fin = financiamentos[0];
    if (!fin) return res.status(404).json({ sucesso: false, erro: 'Dívida não encontrada.' });
    if (fin.cancelado_em) return res.status(409).json({ sucesso: false, erro: 'Essa dívida já foi cancelada.' });

    const pendentes = (porFin[fin.id] || []).filter((p) => maiusculo(p.status) === 'PENDENTE');
    if (pendentes.length === 0) {
      return res.status(400).json({ sucesso: false, erro: 'Essa dívida não tem parcelas pendentes para cancelar.' });
    }

    const agora = new Date().toISOString();
    const { error } = await supabase
      .from('lancamentos_financeiros')
      .update({ status: 'CANCELADO', cancelado_em: agora, cancelado_por: req.usuario.id, motivo_cancelamento: motivo })
      .eq('id_financiamento', fin.id)
      .eq('status', 'PENDENTE');
    if (error) throw error;

    const { error: eF } = await supabase.from('financiamentos').update({ cancelado_em: agora }).eq('id', fin.id);
    if (eF) throw eF;

    return res.json({
      sucesso: true,
      mensagem: `${pendentes.length} parcela(s) cancelada(s).`,
      parcelasCanceladas: pendentes.length,
    });
  } catch (e) {
    return erroInterno(res, 'cancelar a dívida', e);
  }
}

// -----------------------------------------------------------------------------
// Previsão de caixa (motor de saldo)
// -----------------------------------------------------------------------------

/**
 * Saldo atual = tudo que já foi recebido − tudo que já foi pago (sem estornos).
 * Para os próximos meses soma o que está pendente (lançamentos, parcelas, receitas
 * previstas das viagens ainda não faturadas e manutenções agendadas).
 * Vencidos e não pagos entram no mês atual.
 */
export async function calcularPrevisao(meses = 6, agora = new Date()) {
  const hoje = hojeIso(agora);
  const mesAtual = mesDe(hoje);
  const lista = listaMeses(mesAtual, meses);

  const [lanc, viagens, manut] = await Promise.all([
    supabase.from('lancamentos_financeiros').select('*'),
    supabase.from('viagens').select('*'),
    supabase.from('manutencoes').select('*'),
  ]);
  if (lanc.error) throw lanc.error;
  if (viagens.error) throw viagens.error;
  // Sem a tabela de manutenções (migração antiga não aplicada) a previsão continua funcionando.
  const manutencoes = manut.error ? [] : manut.data || [];

  const lancamentos = (lanc.data || []).filter((l) => !ehCancelado(l));
  const previsto = Object.fromEntries(lista.map((m) => [m, { entradas: 0, saidas: 0 }]));
  const mesPrevisto = (data) => {
    const mes = mesDe(data) || mesAtual;
    return mes < mesAtual ? mesAtual : mes;
  };
  const somarPrevisto = (data, campo, valor) => {
    const mes = mesPrevisto(data);
    if (previsto[mes]) previsto[mes][campo] += Number(valor) || 0;
  };

  let saldoAtual = 0;
  for (const l of lancamentos) {
    const valor = Number(l.valor) || 0;
    const entrada = maiusculo(l.tipo) === 'ENTRADA';
    if (maiusculo(l.status) === 'PAGO') saldoAtual += entrada ? valor : -valor;
    else if (maiusculo(l.status) === 'PENDENTE') somarPrevisto(vencimentoDe(l), entrada ? 'entradas' : 'saidas', valor);
  }

  // Receita prevista das viagens que ainda não têm entrada lançada.
  const viagensFaturadas = new Set(
    lancamentos.filter((l) => maiusculo(l.tipo) === 'ENTRADA' && l.id_viagem).map((l) => l.id_viagem)
  );
  for (const v of viagens.data || []) {
    if (!['PLANEJADA', 'EM_ANDAMENTO'].includes(maiusculo(v.status))) continue;
    if (viagensFaturadas.has(v.id) || !(Number(v.receita_prevista) > 0)) continue;
    somarPrevisto(v.data_saida || v.iniciada_em, 'entradas', v.receita_prevista);
  }

  for (const m of manutencoes) {
    if (maiusculo(m.status) === 'CONCLUIDA' || !(Number(m.custo) > 0)) continue;
    somarPrevisto(m.data, 'saidas', m.custo);
  }

  let saldo = saldoAtual;
  const porMes = lista.map((mes) => {
    const { entradas, saidas } = previsto[mes];
    saldo += entradas - saidas;
    return {
      mes,
      rotulo: rotuloMes(mes),
      entradasPrevistas: arredondar(entradas),
      saidasPrevistas: arredondar(saidas),
      resultado: arredondar(entradas - saidas),
      saldoProjetado: arredondar(saldo),
    };
  });

  const primeiroNegativo = porMes.find((m) => m.saldoProjetado < 0) || null;
  return {
    saldoAtual: arredondar(saldoAtual),
    saldoFinal: porMes.length ? porMes[porMes.length - 1].saldoProjetado : arredondar(saldoAtual),
    menorSaldo: arredondar(Math.min(saldoAtual, ...porMes.map((m) => m.saldoProjetado))),
    primeiroMesNegativo: primeiroNegativo ? primeiroNegativo.rotulo : null,
    meses: porMes,
  };
}

/** GET /financeiro/previsao?meses=6 */
export async function obterPrevisao(req, res) {
  try {
    const meses = Math.min(Math.max(parseInt(req.query.meses, 10) || 6, 1), 24);
    return res.json({ sucesso: true, previsao: await calcularPrevisao(meses) });
  } catch (e) {
    return erroInterno(res, 'calcular a previsão de caixa', e);
  }
}

/** GET /financeiro/fluxo-mensal?meses=6 — entradas e saídas realizadas por mês (gráfico). */
export async function obterFluxoMensal(req, res) {
  try {
    const meses = Math.min(Math.max(parseInt(req.query.meses, 10) || 6, 1), 24);
    return res.json({ sucesso: true, meses: fluxoMensal(await carregarLancamentos(), meses) });
  } catch (e) {
    return erroInterno(res, 'montar o fluxo mensal', e);
  }
}

// -----------------------------------------------------------------------------
// Alertas: GET /alertas
// -----------------------------------------------------------------------------

const NIVEL = { critico: 0, atencao: 1, info: 2 };

async function alertasFinanceiros(hoje) {
  const alertas = [];
  const lancamentos = (await carregarLancamentos()).filter((l) => maiusculo(l.status) === 'PENDENTE');
  const em7dias = somarDias(hoje, 7);
  const soma = (lista) => lista.reduce((s, l) => s + (Number(l.valor) || 0), 0);

  const saidas = lancamentos.filter((l) => maiusculo(l.tipo) !== 'ENTRADA');
  const vencidas = saidas.filter((l) => vencimentoDe(l) < hoje);
  if (vencidas.length) {
    alertas.push({
      id: 'contas-vencidas',
      nivel: 'critico',
      area: 'financeiro',
      titulo: `${vencidas.length} conta(s) ou parcela(s) vencida(s)`,
      descricao: `${formatarMoeda(soma(vencidas))} em aberto com vencimento já passado.`,
      tela: 'Dividas',
    });
  }
  const proximas = saidas.filter((l) => vencimentoDe(l) >= hoje && vencimentoDe(l) <= em7dias);
  if (proximas.length) {
    alertas.push({
      id: 'contas-proximas',
      nivel: 'atencao',
      area: 'financeiro',
      titulo: `${proximas.length} pagamento(s) nos próximos 7 dias`,
      descricao: `${formatarMoeda(soma(proximas))} a pagar até ${dataBr(em7dias)}.`,
      tela: 'Dividas',
    });
  }
  const aReceber = lancamentos.filter((l) => maiusculo(l.tipo) === 'ENTRADA' && vencimentoDe(l) < hoje);
  if (aReceber.length) {
    alertas.push({
      id: 'recebimentos-atrasados',
      nivel: 'atencao',
      area: 'financeiro',
      titulo: `${aReceber.length} recebimento(s) atrasado(s)`,
      descricao: `${formatarMoeda(soma(aReceber))} de clientes com data já passada.`,
      tela: 'Extrato',
      params: { filtroStatus: 'pendente' },
    });
  }

  const previsao = await calcularPrevisao(6);
  if (previsao.primeiroMesNegativo) {
    alertas.push({
      id: 'saldo-negativo',
      nivel: 'critico',
      area: 'financeiro',
      titulo: `Saldo previsto fica negativo em ${previsao.primeiroMesNegativo}`,
      descricao: `Menor saldo projetado: ${formatarMoeda(previsao.menorSaldo)}. Revise os pagamentos futuros.`,
      tela: 'Dividas',
    });
  }
  return alertas;
}

async function alertasFrota(hoje) {
  const alertas = [];
  const [viagens, manut, veiculos] = await Promise.all([
    supabase.from('viagens').select('*'),
    supabase.from('manutencoes').select('*'),
    supabase.from('veiculos').select('id, modelo, placa').eq('ativo', true),
  ]);
  if (viagens.error) throw viagens.error;
  const placas = Object.fromEntries((veiculos.data || []).map((v) => [v.id, `${v.modelo} (${v.placa})`]));
  const manutencoes = manut.error ? [] : manut.data || [];

  for (const m of manutencoes) {
    if (maiusculo(m.status) !== 'AGENDADA') continue;
    if (m.data < hoje) {
      alertas.push({
        id: `manutencao-atrasada-${m.id}`,
        nivel: 'atencao',
        area: 'frota',
        titulo: 'Manutenção atrasada',
        descricao: `${placas[m.id_veiculo] || 'Veículo'} estava agendado para ${dataBr(m.data)} (${m.oficina}).`,
        tela: 'Manutencao',
        params: { veiculoId: m.id_veiculo },
      });
    } else if (m.data <= somarDias(hoje, 3)) {
      alertas.push({
        id: `manutencao-proxima-${m.id}`,
        nivel: 'info',
        area: 'frota',
        titulo: 'Manutenção nos próximos dias',
        descricao: `${placas[m.id_veiculo] || 'Veículo'} em ${dataBr(m.data)} (${m.oficina}).`,
        tela: 'Manutencao',
        params: { veiculoId: m.id_veiculo },
      });
    }
  }

  const limiteViagem = somarDias(hoje, -3);
  for (const v of viagens.data || []) {
    const status = maiusculo(v.status);
    if (status === 'EM_ANDAMENTO' && v.iniciada_em && String(v.iniciada_em).slice(0, 10) < limiteViagem) {
      alertas.push({
        id: `viagem-longa-${v.id}`,
        nivel: 'atencao',
        area: 'frota',
        titulo: 'Viagem aberta há mais de 3 dias',
        descricao: `${v.origem} → ${v.destino}, iniciada em ${dataBr(String(v.iniciada_em).slice(0, 10))}. Confira se falta fechar.`,
        tela: 'Viagens',
      });
    }
    if (status === 'PLANEJADA' && v.data_saida && v.data_saida < hoje) {
      alertas.push({
        id: `rota-nao-iniciada-${v.id}`,
        nivel: 'atencao',
        area: 'frota',
        titulo: 'Rota agendada não iniciada',
        descricao: `${v.origem} → ${v.destino} estava marcada para ${dataBr(v.data_saida)}.`,
        tela: 'Rotas',
      });
    }
  }
  return alertas;
}

export async function listarAlertas(req, res) {
  try {
    const hoje = hojeIso();
    const perfil = req.usuario.perfil;
    const alertas = [];
    if ([PERFIS.ADMIN, PERFIS.FINANCEIRO].includes(perfil)) alertas.push(...(await alertasFinanceiros(hoje)));
    if ([PERFIS.ADMIN, PERFIS.GESTOR].includes(perfil)) alertas.push(...(await alertasFrota(hoje)));
    alertas.sort((a, b) => NIVEL[a.nivel] - NIVEL[b.nivel]);
    res.set('Cache-Control', 'no-store');
    return res.json({ sucesso: true, alertas });
  } catch (e) {
    return erroInterno(res, 'montar os alertas', e);
  }
}

// -----------------------------------------------------------------------------
// Viagens que podem ser ligadas a um lançamento (campo "Viagem" do formulário)
// -----------------------------------------------------------------------------

/** GET /financeiro/viagens-vinculo — o motorista recebe só as dele; os outros perfis, todas. */
export async function listarViagensParaVinculo(req, res) {
  try {
    let consulta = supabase.from('viagens').select('id, origem, destino, status, data_saida, iniciada_em, id_motorista, id_veiculo');
    if (req.usuario.perfil === PERFIS.MOTORISTA) consulta = consulta.eq('id_motorista', req.usuario.id);
    const { data, error } = await consulta;
    if (error) throw error;
    const ordem = { EM_ANDAMENTO: 0, PLANEJADA: 1, CONCLUIDA: 2 };
    const viagens = (data || [])
      .sort((a, b) => (ordem[maiusculo(a.status)] ?? 3) - (ordem[maiusculo(b.status)] ?? 3)
        || String(b.data_saida || b.iniciada_em || '').localeCompare(String(a.data_saida || a.iniciada_em || '')))
      .slice(0, 60)
      .map((v) => {
        const quando = dataBr(v.data_saida || String(v.iniciada_em || '').slice(0, 10));
        const situacao = { EM_ANDAMENTO: 'em andamento', PLANEJADA: 'agendada', CONCLUIDA: 'concluída' }[maiusculo(v.status)] || '';
        return {
          id: v.id,
          label: `${v.origem} → ${v.destino}${quando ? ` · ${quando}` : ''}${situacao ? ` (${situacao})` : ''}`,
          status: minusculo(v.status),
          veiculoId: v.id_veiculo || null,
        };
      });
    return res.json({ sucesso: true, viagens });
  } catch (e) {
    return erroInterno(res, 'listar as viagens', e);
  }
}
