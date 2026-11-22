import supabase from '../database/db.js';
import { PERFIS } from '../middleware/auth.js';
import { arredondar, ehDespesa } from '../utils/calculos.js';

const veTudo = (req) => [PERFIS.ADMIN, PERFIS.FINANCEIRO].includes(req.usuario?.perfil);
const maiusculo = (valor) => String(valor || '').toUpperCase().trim();
const minusculo = (valor) => String(valor || '').toLowerCase().trim();
const hojeIso = () => new Date().toISOString().slice(0, 10);
const ehCancelado = (item) =>
  Boolean(item.cancelado_em) || ['CANCELADO', 'CANCELADA', 'ESTORNADO', 'ESTORNADA'].includes(maiusculo(item.status));
const dataValidaIso = (valor) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(valor || ''))) return false;
  const data = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
};
const vencimentoDe = (item) => item.data_vencimento || item.data_lancamento;

function erroInterno(res, contexto, erro) {
  console.error(`Erro ao ${contexto}:`, erro);
  return res.status(500).json({ sucesso: false, erro: `Erro interno ao ${contexto}.` });
}

const dataBr = (iso) => {
  if (!iso) return null;
  const [ano, mes, dia] = String(iso).slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
};

async function carregarNomes() {
  const [categorias, formas, viagens, usuarios] = await Promise.all([
    supabase.from('categorias_financeiras').select('id, nome'),
    supabase.from('formas_pagamento').select('id, nome'),
    supabase.from('viagens').select('id, origem, destino, data_saida, iniciada_em'),
    supabase.from('usuarios').select('id, nome'),
  ]);
  for (const resultado of [categorias, formas, viagens, usuarios]) {
    if (resultado.error) throw resultado.error;
  }

  const mapa = (lista, formatar) => Object.fromEntries((lista || []).map((item) => [item.id, formatar(item)]));
  return {
    categorias: mapa(categorias.data, (item) => item.nome),
    formas: mapa(formas.data, (item) => item.nome),
    viagens: mapa(viagens.data, (item) => {
      const data = dataBr(item.data_saida || item.iniciada_em);
      return `${item.origem} → ${item.destino}${data ? ` · ${data}` : ''}`;
    }),
    usuarios: mapa(usuarios.data, (item) => item.nome),
  };
}

function montarLancamento(item, nomes) {
  return {
    id: item.id,
    descricao: item.descricao,
    valor: Number(item.valor) || 0,
    tipo: minusculo(item.tipo),
    status: minusculo(item.status),
    data: item.data_lancamento,
    vencimento: item.data_vencimento,
    pagamento: item.data_pagamento,
    categoria: nomes.categorias[item.id_categoria] || 'Outros',
    idCategoria: item.id_categoria || null,
    formaPagamento: nomes.formas[item.id_forma_pagamento] || null,
    viagem: item.id_viagem ? { id: item.id_viagem, label: nomes.viagens[item.id_viagem] || 'Viagem' } : null,
    usuario: nomes.usuarios[item.id_usuario] || null,
    comprovante: item.comprovante_url || item.foto_url || item.documento_url || null,
    idFinanciamento: item.id_financiamento || null,
    parcela: item.numero_parcela ? `${item.numero_parcela}/${item.total_parcelas}` : null,
    cancelamento: ehCancelado(item)
      ? { em: item.cancelado_em || null, motivo: item.motivo_cancelamento || null, por: nomes.usuarios[item.cancelado_por] || null }
      : null,
  };
}

async function carregarLancamentos(req) {
  let consulta = supabase.from('lancamentos_financeiros').select('*');
  if (!veTudo(req)) consulta = consulta.eq('id_usuario', req.usuario.id);
  const { data, error } = await consulta;
  if (error) throw error;
  return data || [];
}

const normalizarTexto = (valor) =>
  String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export async function listarLancamentos(req, res) {
  try {
    const filtros = req.query || {};
    for (const campo of ['inicio', 'fim']) {
      if (filtros[campo] && !dataValidaIso(filtros[campo])) {
        return res.status(400).json({ sucesso: false, erro: `Data "${campo}" inválida. Use AAAA-MM-DD.` });
      }
    }

    const tipo = filtros.tipo ? maiusculo(filtros.tipo) : null;
    if (tipo && !['ENTRADA', 'SAIDA', 'DIVIDA'].includes(tipo)) {
      return res.status(400).json({ sucesso: false, erro: 'Tipo inválido. Use entrada, saida ou divida.' });
    }
    const status = filtros.status ? maiusculo(filtros.status) : null;
    if (status && !['PAGO', 'PENDENTE', 'CANCELADO'].includes(status)) {
      return res.status(400).json({ sucesso: false, erro: 'Status inválido. Use pago, pendente ou cancelado.' });
    }

    const limite = Math.min(Math.max(parseInt(filtros.limite, 10) || 30, 1), 100);
    const pagina = Math.max(parseInt(filtros.pagina, 10) || 1, 1);
    const [lancamentos, nomes] = await Promise.all([carregarLancamentos(req), carregarNomes()]);
    const termo = normalizarTexto(filtros.busca).trim();

    const filtrados = lancamentos.filter((item) => {
      const data = String(item.data_lancamento || item.data_vencimento || '').slice(0, 10);
      if (filtros.inicio && data < filtros.inicio) return false;
      if (filtros.fim && data > filtros.fim) return false;
      if (tipo && maiusculo(item.tipo) !== tipo) return false;
      if (status && maiusculo(item.status) !== status) return false;
      if (filtros.idCategoria && item.id_categoria !== filtros.idCategoria) return false;
      if (filtros.idViagem && item.id_viagem !== filtros.idViagem) return false;
      if (termo && !normalizarTexto(item.descricao).includes(termo)) return false;
      return true;
    });

    const chave = (item) => `${item.data_lancamento || item.data_vencimento || ''}|${item.created_at || ''}|${item.numero_parcela ?? ''}`;
    filtrados.sort((a, b) => chave(b).localeCompare(chave(a)));
    const ativos = filtrados.filter((item) => !ehCancelado(item));
    const somar = (predicado) => arredondar(ativos.filter(predicado).reduce((soma, item) => soma + (Number(item.valor) || 0), 0));

    return res.json({
      sucesso: true,
      total: filtrados.length,
      pagina,
      limite,
      totais: {
        entradas: somar((item) => maiusculo(item.tipo) === 'ENTRADA'),
        saidas: somar(ehDespesa),
      },
      lancamentos: filtrados.slice((pagina - 1) * limite, pagina * limite).map((item) => montarLancamento(item, nomes)),
    });
  } catch (erro) {
    return erroInterno(res, 'listar os lançamentos', erro);
  }
}

function resumirDivida(financiamento, parcelas, hoje) {
  const ativas = parcelas.filter((parcela) => !ehCancelado(parcela));
  const pagas = ativas.filter((parcela) => maiusculo(parcela.status) === 'PAGO');
  const pendentes = ativas.filter((parcela) => maiusculo(parcela.status) === 'PENDENTE');
  const atrasadas = pendentes.filter((parcela) => vencimentoDe(parcela) < hoje);
  const proxima = [...pendentes].sort((a, b) => String(vencimentoDe(a)).localeCompare(String(vencimentoDe(b))))[0];
  const somar = (lista) => arredondar(lista.reduce((soma, parcela) => soma + (Number(parcela.valor) || 0), 0));

  let status = 'em_dia';
  if (financiamento.cancelado_em || (ativas.length === 0 && parcelas.length > 0)) status = 'cancelada';
  else if (pendentes.length === 0) status = 'quitada';
  else if (atrasadas.length > 0) status = 'atrasada';

  return {
    id: financiamento.id,
    descricao: financiamento.descricao,
    credor: financiamento.credor || null,
    valorTotal: Number(financiamento.valor_total) || somar(parcelas),
    valorParcela: Number(financiamento.valor_parcela) || 0,
    quantidadeParcelas: Number(financiamento.quantidade_parcelas) || parcelas.length,
    quitacaoAntecipada: financiamento.valor_quitacao_antecipada == null
      ? null
      : Number(financiamento.valor_quitacao_antecipada),
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

async function carregarDividas(req, idFinanciamento) {
  let consulta = supabase.from('financiamentos').select('*');
  if (idFinanciamento) consulta = consulta.eq('id', idFinanciamento);
  if (!veTudo(req)) consulta = consulta.eq('id_usuario', req.usuario.id);

  const { data: financiamentos, error } = await consulta;
  if (error) throw error;
  const ids = (financiamentos || []).map((item) => item.id);
  if (!ids.length) return { financiamentos: [], porFin: {} };

  const resultado = await supabase
    .from('lancamentos_financeiros')
    .select('*')
    .eq('tipo', 'DIVIDA')
    .in('id_financiamento', ids);
  if (resultado.error) throw resultado.error;

  const porFin = {};
  for (const parcela of resultado.data || []) {
    if (!parcela.id_financiamento) continue;
    (porFin[parcela.id_financiamento] ||= []).push(parcela);
  }
  for (const lista of Object.values(porFin)) {
    lista.sort((a, b) => (a.numero_parcela || 0) - (b.numero_parcela || 0));
  }
  return { financiamentos: financiamentos || [], porFin };
}

export async function listarDividas(req, res) {
  try {
    const hoje = hojeIso();
    const { financiamentos, porFin } = await carregarDividas(req);
    const ordem = { atrasada: 0, em_dia: 1, quitada: 2, cancelada: 3 };
    const dividas = financiamentos
      .map((item) => resumirDivida(item, porFin[item.id] || [], hoje))
      .sort((a, b) => ordem[a.status] - ordem[b.status]
        || String(a.proximoVencimento || '9999').localeCompare(String(b.proximoVencimento || '9999')));
    const abertas = dividas.filter((item) => item.status === 'em_dia' || item.status === 'atrasada');

    return res.json({
      sucesso: true,
      totais: {
        abertas: abertas.length,
        valorRestante: arredondar(abertas.reduce((soma, item) => soma + item.valorRestante, 0)),
        parcelasAtrasadas: abertas.reduce((soma, item) => soma + item.atrasadas, 0),
      },
      dividas,
    });
  } catch (erro) {
    return erroInterno(res, 'listar as dívidas', erro);
  }
}

export async function detalharDivida(req, res) {
  try {
    const [{ financiamentos, porFin }, nomes] = await Promise.all([
      carregarDividas(req, req.params.id),
      carregarNomes(),
    ]);
    const financiamento = financiamentos[0];
    if (!financiamento) return res.status(404).json({ sucesso: false, erro: 'Dívida não encontrada.' });

    const parcelas = porFin[financiamento.id] || [];
    return res.json({
      sucesso: true,
      divida: {
        ...resumirDivida(financiamento, parcelas, hojeIso()),
        categoria: nomes.categorias[financiamento.id_categoria] || null,
        formaPagamento: nomes.formas[financiamento.id_forma_pagamento] || null,
        parcelas: parcelas.map((parcela) => ({
          ...montarLancamento(parcela, nomes),
          atrasada: maiusculo(parcela.status) === 'PENDENTE' && vencimentoDe(parcela) < hojeIso(),
        })),
      },
    });
  } catch (erro) {
    return erroInterno(res, 'consultar a dívida', erro);
  }
}
