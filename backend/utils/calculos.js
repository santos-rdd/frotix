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

/** Lançamentos que contam como gasto: saídas e parcelas de dívida já pagas. */
export function ehDespesa(lancamento) {
  const tipo = maiusculo(lancamento.tipo);
  if (tipo === 'DIVIDA') return maiusculo(lancamento.status) === 'PAGO';
  return tipo === 'SAIDA';
}

export const ehReceita = (lancamento) => maiusculo(lancamento.tipo) === 'ENTRADA';

export function dataDoLancamento(l) {
  return l.data_pagamento || l.data_lancamento || l.data_vencimento || l.atualizado_em;
}

export const somarValores = (lista) => (lista || []).reduce((s, i) => s + (Number(i.valor) || 0), 0);

/** Custo por km = gastos ÷ km rodados (0 quando não houve km). */
export const custoPorKm = (gastos, km) => (km > 0 ? gastos / km : 0);

export const arredondar = (n) => Number((Number(n) || 0).toFixed(2));
