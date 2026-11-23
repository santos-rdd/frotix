


const maiusculo = (v) => String(v || '').toUpperCase().trim();


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






export function kmDaViagem(viagem) {
  const inicial = Number(viagem.km_inicial);
  const final = Number(viagem.km_final);
  if (viagem.km_final === null || viagem.km_final === undefined) return 0;
  if (!Number.isFinite(inicial) || !Number.isFinite(final) || final < inicial) return 0;
  return final - inicial;
}


export function viagensConcluidasNoPeriodo(viagens, inicio) {
  return (viagens || []).filter(
    (v) => maiusculo(v.status) === 'CONCLUIDA' && dentroDoPeriodo(v.concluida_em || v.iniciada_em, inicio)
  );
}

export function somarKm(viagens) {
  return (viagens || []).reduce((soma, v) => soma + kmDaViagem(v), 0);
}


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


export const custoPorKm = (gastos, km) => (km > 0 ? gastos / km : 0);

export const arredondar = (n) => Number((Number(n) || 0).toFixed(2));
