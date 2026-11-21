// Cálculos compartilhados entre a Home (visão geral da frota) e os Relatórios,
// para os dois mostrarem os mesmos números.

const maiusculo = (v) => String(v || '').toUpperCase().trim();

/** "AAAA-MM-DD" de N dias atrás (null = sem limite). */
export function inicioDoPeriodo(dias, agora = new Date()) {
  if (!dias) return null;
  const inicio = new Date(agora.getTime() - dias * 24 * 60 * 60 * 1000);
  return inicio.toISOString().split('T')[0];
}

const dataIso = (valor) => (valor ? String(valor).split('T')[0] : null);

export function dentroDoPeriodo(valor, inicio) {
  if (!inicio) return true;
  const data = dataIso(valor);
  return Boolean(data) && data >= inicio;
}

/**
 * Km de uma viagem concluída: km_final − km_inicial (erro I7: antes somava o
 * km_inicial, que é a leitura do hodômetro, e dava 134.910 km).
 * Viagem sem km_final, ou com km_final menor que o inicial, conta 0.
 */
export function kmDaViagem(viagem) {
  const inicial = Number(viagem.km_inicial);
  const final = Number(viagem.km_final);
  if (viagem.km_final === null || viagem.km_final === undefined) return 0;
  if (!Number.isFinite(inicial) || !Number.isFinite(final) || final < inicial) return 0;
  return final - inicial;
}

/** Viagens CONCLUIDAS no período (pela data de conclusão). */
export function viagensConcluidasNoPeriodo(viagens, inicio) {
  return (viagens || []).filter(
    (v) => maiusculo(v.status) === 'CONCLUIDA' && dentroDoPeriodo(v.concluida_em || v.iniciada_em, inicio)
  );
}

export function somarKm(viagens) {
  return (viagens || []).reduce((soma, v) => soma + kmDaViagem(v), 0);
}

/** Lançamento estornado (rollback): fica guardado, mas não entra em nenhuma conta. */
export const ehCancelado = (lancamento) => maiusculo(lancamento.status) === 'CANCELADO';

/** Lançamentos que contam como gasto: saídas e parcelas de dívida já pagas (sem os estornados). */
export function ehDespesa(lancamento) {
  if (ehCancelado(lancamento)) return false;
  const tipo = maiusculo(lancamento.tipo);
  if (tipo === 'DIVIDA') return maiusculo(lancamento.status) === 'PAGO';
  return tipo === 'SAIDA';
}

export const ehReceita = (lancamento) => !ehCancelado(lancamento) && maiusculo(lancamento.tipo) === 'ENTRADA';

export function dataDoLancamento(l) {
  return l.data_pagamento || l.data_lancamento || l.data_vencimento || l.atualizado_em;
}

export const somarValores = (lista) => (lista || []).reduce((s, i) => s + (Number(i.valor) || 0), 0);

/** Custo por km = gastos ÷ km rodados (0 quando não houve km). */
export const custoPorKm = (gastos, km) => (km > 0 ? gastos / km : 0);

export const arredondar = (n) => Number((Number(n) || 0).toFixed(2));

/** Data de hoje (AAAA-MM-DD) no fuso de São Paulo. */
export const hojeIso = (agora = new Date()) => agora.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

/** Soma N dias a uma data AAAA-MM-DD. */
export function somarDias(dataIso, dias) {
  const d = new Date(`${dataIso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** "AAAA-MM" de uma data (ou null). */
export const mesDe = (valor) => (valor ? String(valor).slice(0, 7) : null);

const NOMES_MES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/** "2026-11" -> "Nov/26" */
export function rotuloMes(mes) {
  const [a, m] = String(mes).split('-').map(Number);
  return `${NOMES_MES[m - 1]}/${String(a).slice(2)}`;
}

/** Lista de meses "AAAA-MM" a partir de `inicio`, andando `quantidade` meses (negativo = para trás). */
export function listaMeses(inicio, quantidade) {
  const [a, m] = inicio.split('-').map(Number);
  const total = Math.abs(quantidade);
  const passo = quantidade < 0 ? -1 : 1;
  const meses = [];
  for (let i = 0; i < total; i++) {
    const d = new Date(Date.UTC(a, m - 1 + i * passo, 1));
    meses.push(d.toISOString().slice(0, 7));
  }
  return passo < 0 ? meses.reverse() : meses;
}

/**
 * Fluxo de caixa realizado por mês (só o que foi pago/recebido, sem estornos).
 * Devolve [{ mes, rotulo, entradas, saidas, resultado }] dos últimos `meses` meses.
 */
export function fluxoMensal(lancamentos, meses = 6, agora = new Date()) {
  const lista = listaMeses(mesDe(hojeIso(agora)), -meses);
  const porMes = Object.fromEntries(lista.map((m) => [m, { entradas: 0, saidas: 0 }]));
  for (const l of lancamentos || []) {
    if (ehCancelado(l) || maiusculo(l.status) !== 'PAGO') continue;
    const mes = mesDe(l.data_pagamento || l.data_lancamento);
    if (!porMes[mes]) continue;
    const valor = Number(l.valor) || 0;
    if (maiusculo(l.tipo) === 'ENTRADA') porMes[mes].entradas += valor;
    else porMes[mes].saidas += valor;
  }
  return lista.map((mes) => ({
    mes,
    rotulo: rotuloMes(mes),
    entradas: arredondar(porMes[mes].entradas),
    saidas: arredondar(porMes[mes].saidas),
    resultado: arredondar(porMes[mes].entradas - porMes[mes].saidas),
  }));
}
