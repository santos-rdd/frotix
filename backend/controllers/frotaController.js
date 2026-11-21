import supabase from '../database/db.js';
import { PERFIS } from '../middleware/auth.js';
import {
  inicioDoPeriodo, dentroDoPeriodo, kmDaViagem, viagensConcluidasNoPeriodo, somarKm,
  ehDespesa, ehReceita, ehCancelado, dataDoLancamento, somarValores, custoPorKm, arredondar, fluxoMensal,
} from '../utils/calculos.js';

// -----------------------------------------------------------------------------
// Conversões entre o banco (MAIÚSCULAS, AAAA-MM-DD) e o app (minúsculas, DD/MM/AAAA)
// -----------------------------------------------------------------------------

const STATUS_VEICULO = { DISPONIVEL: 'disponivel', EM_VIAGEM: 'em_viagem', MANUTENCAO: 'manutencao' };
const STATUS_ROTA = { PLANEJADA: 'agendada', EM_ANDAMENTO: 'em_transito', CONCLUIDA: 'concluida' };
const STATUS_MANUTENCAO = { AGENDADA: 'agendada', EM_ANDAMENTO: 'em_andamento', CONCLUIDA: 'concluida' };
const TIPOS_MANUTENCAO = ['preventiva', 'corretiva', 'troca_oleo', 'pneus', 'freios', 'revisao'];

/** "DD/MM/AAAA" -> "AAAA-MM-DD" (null se a data não existir). */
export function dataParaIso(texto) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(texto || '').trim());
  if (!m) return null;
  const [, d, mes, a] = m.map(Number);
  const data = new Date(Date.UTC(a, mes - 1, d));
  if (data.getUTCFullYear() !== a || data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== d) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** "AAAA-MM-DD" ou timestamp -> "DD/MM/AAAA" no fuso de São Paulo. */
export function dataParaBr(valor) {
  if (!valor) return null;
  const texto = String(valor);
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    const [a, m, d] = texto.split('-');
    return `${d}/${m}/${a}`;
  }
  return new Date(texto).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

const hojeIso = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); // AAAA-MM-DD

const numero = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const placaValida = (placa) => /^[A-Z]{3}-?\d[A-Z0-9]\d{2}$/.test(String(placa || '').toUpperCase());
const formatarPlaca = (placa) => {
  const limpa = String(placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
  return /^[A-Z]{3}\d{4}$/.test(limpa) ? `${limpa.slice(0, 3)}-${limpa.slice(3)}` : limpa;
};

const ehMotorista = (req) => req.usuario.perfil === PERFIS.MOTORISTA;

function erroInterno(res, contexto, erro) {
  console.error(`Erro ao ${contexto}:`, erro);
  return res.status(500).json({ sucesso: false, erro: `Erro interno ao ${contexto}.` });
}

// -----------------------------------------------------------------------------
// Leitura em lote (poucas consultas, junta tudo em memória)
// -----------------------------------------------------------------------------

// Tabela que ainda não existe no banco (migração não aplicada): segue sem ela.
const tabelaInexistente = (erro) => ['42P01', 'PGRST205'].includes(erro?.code);

async function carregarAbastecimentos() {
  const { data, error } = await supabase.from('abastecimentos').select('*');
  if (error) {
    if (tabelaInexistente(error)) return [];
    throw error;
  }
  return data || [];
}

async function carregarBase({ apenasMotorista } = {}) {
  let consultaViagens = supabase.from('viagens').select('*');
  if (apenasMotorista) consultaViagens = consultaViagens.eq('id_motorista', apenasMotorista);

  const [veiculos, viagens, lancamentos, usuarios, abastecimentos] = await Promise.all([
    supabase.from('veiculos').select('*').eq('ativo', true).order('modelo'),
    consultaViagens,
    supabase
      .from('lancamentos_financeiros')
      .select('id, descricao, valor, tipo, status, id_viagem, comprovante_url, data_lancamento, data_pagamento, data_vencimento'),
    supabase.from('usuarios').select('id, nome'),
    carregarAbastecimentos(),
  ]);

  for (const r of [veiculos, viagens, lancamentos, usuarios]) {
    if (r.error) throw r.error;
  }

  return {
    veiculos: veiculos.data || [],
    viagens: viagens.data || [],
    lancamentos: lancamentos.data || [],
    abastecimentos,
    nomes: Object.fromEntries((usuarios.data || []).map((u) => [u.id, u.nome])),
  };
}

/**
 * Consumo médio real (km/l) pelo método do tanque cheio: km entre o primeiro e o
 * último abastecimento ÷ litros abastecidos depois do primeiro. Precisa de 2 ou mais.
 */
export function consumoCalculado(abastecimentos) {
  const lista = (abastecimentos || [])
    .filter((a) => Number(a.hodometro) > 0 && Number(a.litros) > 0)
    .sort((a, b) => Number(a.hodometro) - Number(b.hodometro));
  if (lista.length < 2) return null;
  const km = Number(lista[lista.length - 1].hodometro) - Number(lista[0].hodometro);
  const litros = lista.slice(1).reduce((s, a) => s + Number(a.litros), 0);
  if (!(km > 0) || !(litros > 0)) return null;
  return arredondar(km / litros);
}

function montarVeiculos({ veiculos, viagens, lancamentos, abastecimentos = [] }) {
  return veiculos.map((v) => {
    const daFrota = viagens.filter((t) => t.id_veiculo === v.id);
    const ids = new Set(daFrota.map((t) => t.id));
    const gastos = somarValores(lancamentos.filter((l) => ids.has(l.id_viagem) && ehDespesa(l)));
    const km = somarKm(daFrota.filter((t) => String(t.status).toUpperCase() === 'CONCLUIDA'));
    const doVeiculo = abastecimentos.filter((a) => a.id_veiculo === v.id);
    const calculado = consumoCalculado(doVeiculo);
    return {
      id: v.id,
      modelo: v.modelo,
      placa: v.placa,
      ano: v.ano,
      hodometro: numero(v.hodometro) ?? 0,
      // Consumo real dos abastecimentos; sem dados suficientes, o informado no cadastro.
      consumoMedio: calculado ?? numero(v.consumo_medio),
      consumoInformado: numero(v.consumo_medio),
      consumoCalculado: calculado,
      litrosAbastecidos: arredondar(doVeiculo.reduce((s, a) => s + Number(a.litros || 0), 0)),
      viagensConcluidas: daFrota.filter((t) => String(t.status).toUpperCase() === 'CONCLUIDA').length,
      kmRodados: arredondar(km),
      gastos: arredondar(gastos),
      status: STATUS_VEICULO[v.status] || 'disponivel',
      custoKm: arredondar(custoPorKm(gastos, km)),
    };
  });
}

function montarRota(viagem, { veiculosPorId, lancamentos, nomes }) {
  const veiculo = veiculosPorId[viagem.id_veiculo];
  const despesas = lancamentos
    .filter((l) => l.id_viagem === viagem.id && ehDespesa(l))
    .map((l) => ({
      id: l.id,
      descricao: l.descricao,
      valor: Number(l.valor) || 0,
      comprovante: l.comprovante_url ? 'Comprovante anexado' : 'Sem comprovante',
    }));

  // Rentabilidade da viagem: receita (entradas ligadas à viagem ou, sem elas, a prevista) − custos.
  const entradas = lancamentos.filter((l) => l.id_viagem === viagem.id && ehReceita(l));
  const receitaLancada = somarValores(entradas);
  const receita = entradas.length ? receitaLancada : (numero(viagem.receita_prevista) ?? 0);
  const custos = despesas.reduce((s, d) => s + d.valor, 0);
  const km = kmDaViagem(viagem);
  const saldo = receita - custos;

  return {
    id: viagem.id,
    origem: viagem.origem,
    destino: viagem.destino,
    status: STATUS_ROTA[String(viagem.status).toUpperCase()] || 'agendada',
    veiculoId: viagem.id_veiculo || null,
    placa: veiculo?.placa || null,
    veiculoModelo: veiculo?.modelo || null,
    motoristaId: viagem.id_motorista,
    motorista: nomes[viagem.id_motorista] || 'Motorista',
    hodometroInicial: numero(viagem.km_inicial),
    hodometroFinal: numero(viagem.km_final),
    kmRodados: kmDaViagem(viagem),
    distanciaPrevistaKm: numero(viagem.distancia_prevista_km),
    dataInicial: dataParaBr(viagem.data_saida || viagem.iniciada_em),
    dataFinal: dataParaBr(viagem.concluida_em),
    dataSaidaIso: viagem.data_saida || null,
    receita: arredondar(receita),
    receitaPrevista: numero(viagem.receita_prevista) ?? 0,
    receitaLancada: arredondar(receitaLancada),
    custos: arredondar(custos),
    saldo: arredondar(saldo),
    margem: receita > 0 ? Math.round((saldo / receita) * 100) : 0,
    custoKm: arredondar(custoPorKm(custos, km)),
    despesas,
  };
}

function montarRotas(base) {
  const veiculosPorId = Object.fromEntries(base.veiculos.map((v) => [v.id, v]));
  return base.viagens
    .map((t) => montarRota(t, { ...base, veiculosPorId }))
    .sort((a, b) => String(b.dataInicial || '').localeCompare(String(a.dataInicial || '')));
}

// -----------------------------------------------------------------------------
// Veículos
// -----------------------------------------------------------------------------

export async function listarVeiculos(req, res) {
  try {
    const apenasMotorista = ehMotorista(req) ? req.usuario.id : null;
    const base = await carregarBase({ apenasMotorista });
    if (apenasMotorista) {
      const veiculosIds = new Set(base.viagens.map((t) => t.id_veiculo).filter(Boolean));
      base.veiculos = base.veiculos.filter((v) => veiculosIds.has(v.id));
    }
    return res.json({ sucesso: true, veiculos: montarVeiculos(base) });
  } catch (e) {
    return erroInterno(res, 'listar os veículos', e);
  }
}

export async function cadastrarVeiculo(req, res) {
  try {
    const { modelo, placa, ano, hodometro, consumoMedio, status } = req.body || {};
    const anoAtual = new Date().getFullYear();

    if (!modelo || !String(modelo).trim()) return res.status(400).json({ sucesso: false, erro: 'Informe o modelo do veículo.' });
    if (!placaValida(placa)) return res.status(400).json({ sucesso: false, erro: 'Placa inválida. Use ABC-1234 ou ABC1D23.' });
    if (ano && (Number(ano) < 1980 || Number(ano) > anoAtual + 1)) {
      return res.status(400).json({ sucesso: false, erro: `Informe um ano entre 1980 e ${anoAtual + 1}.` });
    }
    if (!(Number(hodometro) >= 0)) return res.status(400).json({ sucesso: false, erro: 'Informe o hodômetro atual.' });
    if (consumoMedio !== null && consumoMedio !== undefined && consumoMedio !== '' && !(Number(consumoMedio) > 0)) {
      return res.status(400).json({ sucesso: false, erro: 'O consumo médio precisa ser maior que zero.' });
    }

    const statusBanco = status === 'manutencao' ? 'MANUTENCAO' : 'DISPONIVEL';
    const { data, error } = await supabase
      .from('veiculos')
      .insert([{
        modelo: String(modelo).trim(),
        placa: formatarPlaca(placa),
        ano: ano ? Number(ano) : null,
        hodometro: Number(hodometro),
        consumo_medio: consumoMedio ? Number(consumoMedio) : null,
        status: statusBanco,
      }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return res.status(409).json({ sucesso: false, erro: 'Já existe um veículo com essa placa.' });
      throw error;
    }

    return res.status(201).json({
      sucesso: true,
      veiculo: montarVeiculos({ veiculos: [data], viagens: [], lancamentos: [] })[0],
    });
  } catch (e) {
    return erroInterno(res, 'cadastrar o veículo', e);
  }
}

// -----------------------------------------------------------------------------
// Rotas e viagens (a mesma tabela "viagens": PLANEJADA -> EM_ANDAMENTO -> CONCLUIDA)
// -----------------------------------------------------------------------------

export async function listarRotas(req, res) {
  try {
    // Erro P10/P11: o motorista só vê as próprias viagens.
    const base = await carregarBase({ apenasMotorista: ehMotorista(req) ? req.usuario.id : null });
    return res.json({ sucesso: true, rotas: montarRotas(base) });
  } catch (e) {
    return erroInterno(res, 'listar as rotas', e);
  }
}

export async function listarMotoristas(req, res) {
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nome, email')
      .eq('id_perfil', PERFIS.MOTORISTA)
      .eq('ativo', true)
      .order('nome');
    if (error) throw error;
    return res.json({ sucesso: true, motoristas: data || [] });
  } catch (e) {
    return erroInterno(res, 'listar os motoristas', e);
  }
}

export async function cadastrarRota(req, res) {
  try {
    const { origem, destino, veiculoId, motoristaId, dataSaida, hodometroInicial, receita, distanciaPrevistaKm } = req.body || {};

    if (!origem || !String(origem).trim()) return res.status(400).json({ sucesso: false, erro: 'Informe a cidade de origem.' });
    if (!destino || !String(destino).trim()) return res.status(400).json({ sucesso: false, erro: 'Informe a cidade de destino.' });
    if (!veiculoId) return res.status(400).json({ sucesso: false, erro: 'Selecione o veículo.' });
    if (!motoristaId) return res.status(400).json({ sucesso: false, erro: 'Selecione o motorista.' });
    const dataIso = dataParaIso(dataSaida);
    if (!dataIso) return res.status(400).json({ sucesso: false, erro: 'Data inválida. Use DD/MM/AAAA.' });
    if (dataIso < hojeIso()) return res.status(400).json({ sucesso: false, erro: 'A data não pode estar no passado.' });
    if (!(Number(receita) > 0)) return res.status(400).json({ sucesso: false, erro: 'Informe a receita prevista do frete.' });

    if (distanciaPrevistaKm !== undefined && distanciaPrevistaKm !== null && distanciaPrevistaKm !== '') {
      const distNum = Number(distanciaPrevistaKm);
      if (Number.isNaN(distNum) || distNum < 0) {
        return res.status(400).json({ sucesso: false, erro: 'Distância prevista inválida.' });
      }
    }

    const [{ data: veiculo, error: eV }, { data: motorista, error: eM }] = await Promise.all([
      supabase.from('veiculos').select('id, hodometro, status').eq('id', veiculoId).eq('ativo', true).maybeSingle(),
      supabase.from('usuarios').select('id, id_perfil, ativo').eq('id', motoristaId).maybeSingle(),
    ]);
    if (eV) throw eV;
    if (eM) throw eM;
    if (!veiculo) return res.status(400).json({ sucesso: false, erro: 'Veículo não encontrado.' });
    if (veiculo.status === 'MANUTENCAO') return res.status(400).json({ sucesso: false, erro: 'Veículo em manutenção não pode receber rota.' });
    if (!motorista || motorista.id_perfil !== PERFIS.MOTORISTA || motorista.ativo === false) {
      return res.status(400).json({ sucesso: false, erro: 'Escolha um usuário com perfil Motorista.' });
    }
    if (hodometroInicial !== undefined && hodometroInicial !== null && hodometroInicial !== ''
        && Number(hodometroInicial) < Number(veiculo.hodometro)) {
      return res.status(400).json({ sucesso: false, erro: `O veículo já marca ${Number(veiculo.hodometro).toLocaleString('pt-BR')} km.` });
    }

    const { data, error } = await supabase
      .from('viagens')
      .insert([{
        origem: String(origem).trim(),
        destino: String(destino).trim(),
        id_veiculo: veiculoId,
        id_motorista: motoristaId,
        data_saida: dataIso,
        km_inicial: hodometroInicial !== '' && hodometroInicial !== undefined ? Number(hodometroInicial) : Number(veiculo.hodometro),
        receita_prevista: Number(receita),
        distancia_prevista_km: (distanciaPrevistaKm !== undefined && distanciaPrevistaKm !== null && distanciaPrevistaKm !== '')
          ? Number(distanciaPrevistaKm)
          : null,
        status: 'PLANEJADA',
        iniciada_em: null,
      }])
      .select()
      .single();
    if (error) throw error;

    return res.status(201).json({
      sucesso: true,
      rota: {
        id: data.id,
        origem: data.origem,
        destino: data.destino,
        dataInicial: dataParaBr(data.data_saida),
        distanciaPrevistaKm: numero(data.distancia_prevista_km),
        status: 'agendada',
      },
    });
  } catch (e) {
    return erroInterno(res, 'cadastrar a rota', e);
  }
}

async function buscarViagemPermitida(req, res) {
  const { data: viagem, error } = await supabase.from('viagens').select('*').eq('id', req.params.id).maybeSingle();
  if (error) throw error;
  if (!viagem) {
    res.status(404).json({ sucesso: false, erro: 'Rota não encontrada.' });
    return null;
  }
  if (ehMotorista(req) && viagem.id_motorista !== req.usuario.id) {
    res.status(403).json({ sucesso: false, erro: 'Esta rota é de outro motorista.' });
    return null;
  }
  return viagem;
}

/** POST /frota/rotas/:id/abrir  { veiculoId?, hodometroInicial } — PLANEJADA -> EM_ANDAMENTO */
export async function abrirViagem(req, res) {
  try {
    const viagem = await buscarViagemPermitida(req, res);
    if (!viagem) return null;
    if (viagem.status !== 'PLANEJADA') return res.status(400).json({ sucesso: false, erro: 'Só é possível abrir uma rota agendada.' });

    const veiculoId = req.body?.veiculoId || viagem.id_veiculo;
    if (!veiculoId) return res.status(400).json({ sucesso: false, erro: 'Selecione o veículo.' });

    const { data: veiculo, error: eV } = await supabase.from('veiculos').select('*').eq('id', veiculoId).maybeSingle();
    if (eV) throw eV;
    if (!veiculo) return res.status(400).json({ sucesso: false, erro: 'Veículo não encontrado.' });
    if (veiculo.status !== 'DISPONIVEL') return res.status(400).json({ sucesso: false, erro: 'O veículo não está disponível.' });

    const inicial = Number(req.body?.hodometroInicial);
    if (!(inicial >= 0)) return res.status(400).json({ sucesso: false, erro: 'Informe o hodômetro inicial.' });
    if (inicial < Number(veiculo.hodometro)) {
      return res.status(400).json({ sucesso: false, erro: `O hodômetro do veículo já marca ${Number(veiculo.hodometro).toLocaleString('pt-BR')} km.` });
    }

    // Só abre se ainda estiver PLANEJADA (evita abrir duas vezes ao mesmo tempo).
    const { data: aberta, error } = await supabase
      .from('viagens')
      .update({ status: 'EM_ANDAMENTO', id_veiculo: veiculoId, km_inicial: inicial, iniciada_em: new Date().toISOString() })
      .eq('id', viagem.id)
      .eq('status', 'PLANEJADA')
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!aberta) return res.status(409).json({ sucesso: false, erro: 'Essa rota acabou de ser aberta por outra pessoa.' });

    const { error: eAtualiza } = await supabase.from('veiculos').update({ status: 'EM_VIAGEM' }).eq('id', veiculoId);
    if (eAtualiza) throw eAtualiza;

    return res.json({ sucesso: true });
  } catch (e) {
    return erroInterno(res, 'abrir a viagem', e);
  }
}

/** POST /frota/rotas/:id/concluir  { hodometroFinal } — PLANEJADA/EM_ANDAMENTO -> CONCLUIDA */
export async function concluirViagem(req, res) {
  try {
    const viagem = await buscarViagemPermitida(req, res);
    if (!viagem) return null;
    if (viagem.status === 'CONCLUIDA') return res.status(400).json({ sucesso: false, erro: 'Essa rota já foi concluída.' });

    const final = Number(req.body?.hodometroFinal);
    const inicial = Number(viagem.km_inicial) || 0;
    if (!(final > inicial)) {
      return res.status(400).json({ sucesso: false, erro: `Informe um valor maior que ${inicial.toLocaleString('pt-BR')} km.` });
    }

    const agora = new Date().toISOString();
    const { error } = await supabase
      .from('viagens')
      .update({ status: 'CONCLUIDA', km_final: final, concluida_em: agora, iniciada_em: viagem.iniciada_em || agora })
      .eq('id', viagem.id);
    if (error) throw error;

    if (viagem.id_veiculo) {
      const { error: eV } = await supabase
        .from('veiculos')
        .update({ status: 'DISPONIVEL', hodometro: final })
        .eq('id', viagem.id_veiculo)
        .eq('status', 'EM_VIAGEM');
      if (eV) throw eV;
      // Se estava disponível (rota concluída direto da agenda), só atualiza o hodômetro.
      const { error: eH } = await supabase
        .from('veiculos')
        .update({ hodometro: final })
        .eq('id', viagem.id_veiculo)
        .lt('hodometro', final);
      if (eH) throw eH;
    }

    return res.json({ sucesso: true, kmRodados: final - inicial });
  } catch (e) {
    return erroInterno(res, 'concluir a viagem', e);
  }
}

/** Viagens em andamento da Home (substitui /usuarios/viagens-andamento). */
export async function listarViagensEmAndamento(req, res) {
  try {
    const base = await carregarBase({ apenasMotorista: ehMotorista(req) ? req.usuario.id : null });
    const emAndamento = montarRotas(base).filter((r) => r.status === 'em_transito');
    res.set('Cache-Control', 'no-store');
    return res.json({
      sucesso: true,
      viagens: emAndamento.map((r) => ({
        id: r.id,
        origem: r.origem,
        destino: r.destino,
        status: 'EM_ANDAMENTO',
        km_inicial: r.hodometroInicial,
        id_motorista: r.motoristaId,
        motorista: r.motorista,
        placa: r.placa || 'Sem veículo',
      })),
    });
  } catch (e) {
    return erroInterno(res, 'consultar as viagens em andamento', e);
  }
}

// -----------------------------------------------------------------------------
// Manutenções
// -----------------------------------------------------------------------------

const montarManutencao = (m) => ({
  id: m.id,
  veiculoId: m.id_veiculo,
  tipo: m.tipo,
  data: dataParaBr(m.data),
  dataIso: m.data,
  oficina: m.oficina,
  custo: Number(m.custo) || 0,
  observacoes: m.observacoes || '',
  status: STATUS_MANUTENCAO[m.status] || 'agendada',
});

export async function listarManutencoes(req, res) {
  try {
    const { data, error } = await supabase.from('manutencoes').select('*').order('data', { ascending: false });
    if (error) throw error;
    return res.json({ sucesso: true, manutencoes: (data || []).map(montarManutencao) });
  } catch (e) {
    return erroInterno(res, 'listar as manutenções', e);
  }
}

export async function agendarManutencao(req, res) {
  try {
    const { veiculoId, tipo, data, oficina, custo, observacoes } = req.body || {};
    if (!veiculoId) return res.status(400).json({ sucesso: false, erro: 'Selecione o veículo.' });
    if (!TIPOS_MANUTENCAO.includes(tipo)) return res.status(400).json({ sucesso: false, erro: 'Tipo de serviço inválido.' });
    const dataIso = dataParaIso(data);
    if (!dataIso) return res.status(400).json({ sucesso: false, erro: 'Data inválida. Use DD/MM/AAAA.' });
    if (!oficina || !String(oficina).trim()) return res.status(400).json({ sucesso: false, erro: 'Informe a oficina ou o responsável.' });
    if (custo !== undefined && custo !== null && custo !== '' && !(Number(custo) >= 0)) {
      return res.status(400).json({ sucesso: false, erro: 'Informe um custo válido.' });
    }

    const { data: criada, error } = await supabase
      .from('manutencoes')
      .insert([{
        id_veiculo: veiculoId,
        tipo,
        data: dataIso,
        oficina: String(oficina).trim(),
        custo: custo ? Number(custo) : 0,
        observacoes: observacoes ? String(observacoes).trim() : null,
        status: 'AGENDADA',
      }])
      .select()
      .single();
    if (error) {
      if (error.code === '23503') return res.status(400).json({ sucesso: false, erro: 'Veículo não encontrado.' });
      throw error;
    }
    return res.status(201).json({ sucesso: true, manutencao: montarManutencao(criada) });
  } catch (e) {
    return erroInterno(res, 'agendar a manutenção', e);
  }
}

/** Agendada -> em andamento (veículo fica em manutenção) -> concluída (veículo disponível). */
export async function avancarManutencao(req, res) {
  try {
    const { data: ordem, error } = await supabase.from('manutencoes').select('*').eq('id', req.params.id).maybeSingle();
    if (error) throw error;
    if (!ordem) return res.status(404).json({ sucesso: false, erro: 'Ordem de serviço não encontrada.' });
    if (ordem.status === 'CONCLUIDA') return res.status(400).json({ sucesso: false, erro: 'Essa manutenção já foi concluída.' });

    const proximo = ordem.status === 'AGENDADA' ? 'EM_ANDAMENTO' : 'CONCLUIDA';
    const { data: veiculo, error: eV } = await supabase.from('veiculos').select('id, status').eq('id', ordem.id_veiculo).maybeSingle();
    if (eV) throw eV;
    if (proximo === 'EM_ANDAMENTO' && veiculo?.status === 'EM_VIAGEM') {
      return res.status(400).json({ sucesso: false, erro: 'Feche a viagem atual antes de iniciar a manutenção.' });
    }

    const { error: eU } = await supabase.from('manutencoes').update({ status: proximo }).eq('id', ordem.id);
    if (eU) throw eU;
    if (veiculo) {
      const { error: eS } = await supabase
        .from('veiculos')
        .update({ status: proximo === 'EM_ANDAMENTO' ? 'MANUTENCAO' : 'DISPONIVEL' })
        .eq('id', veiculo.id);
      if (eS) throw eS;
    }
    return res.json({ sucesso: true, status: STATUS_MANUTENCAO[proximo] });
  } catch (e) {
    return erroInterno(res, 'atualizar a manutenção', e);
  }
}

// -----------------------------------------------------------------------------
// Resumo da Home do Gestor e Relatórios
// -----------------------------------------------------------------------------

export async function resumoFrota(req, res) {
  try {
    const dias = Math.max(1, parseInt(req.query.dias, 10) || 7);
    const base = await carregarBase();
    const veiculos = montarVeiculos(base);
    const contar = (s) => veiculos.filter((v) => v.status === s).length;

    const inicio = inicioDoPeriodo(dias);
    const concluidas = viagensConcluidasNoPeriodo(base.viagens, inicio);
    const km = somarKm(concluidas);
    const gastos = somarValores(base.lancamentos.filter((l) => ehDespesa(l) && dentroDoPeriodo(dataDoLancamento(l), inicio)));
    const kmMes = somarKm(viagensConcluidasNoPeriodo(base.viagens, inicioDoPeriodo(30)));

    return res.json({
      sucesso: true,
      periodoDias: dias,
      totalVeiculos: veiculos.length,
      porStatus: { disponivel: contar('disponivel'), em_viagem: contar('em_viagem'), manutencao: contar('manutencao') },
      kmRodados: arredondar(km),
      custoPorKm: arredondar(custoPorKm(gastos, km)),
      kmRodadosMes: arredondar(kmMes),
    });
  } catch (e) {
    return erroInterno(res, 'montar o resumo da frota', e);
  }
}

const chaveCidade = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

/** Ranking por trajeto (origem → destino): margem, saldo e custo por km das viagens concluídas. */
export function rankingPorRota(rotasConcluidas) {
  const grupos = {};
  for (const r of rotasConcluidas) {
    const chave = `${chaveCidade(r.origem)}|${chaveCidade(r.destino)}`;
    const g = (grupos[chave] ||= { trajeto: `${r.origem} → ${r.destino}`, viagens: 0, km: 0, receita: 0, custos: 0 });
    g.viagens += 1;
    g.km += r.kmRodados || 0;
    g.receita += r.receita || 0;
    g.custos += r.custos || 0;
  }
  return Object.values(grupos)
    .map((g) => {
      const saldo = g.receita - g.custos;
      return {
        trajeto: g.trajeto,
        viagens: g.viagens,
        km: arredondar(g.km),
        receita: arredondar(g.receita),
        custos: arredondar(g.custos),
        saldo: arredondar(saldo),
        margem: g.receita > 0 ? Math.round((saldo / g.receita) * 100) : 0,
        custoKm: arredondar(custoPorKm(g.custos, g.km)),
      };
    })
    .sort((a, b) => b.margem - a.margem || b.saldo - a.saldo)
    .slice(0, 5);
}

export async function relatorio(req, res) {
  try {
    const dias = req.query.dias === 'tudo' ? null : Math.max(1, parseInt(req.query.dias, 10) || 30);
    const inicio = inicioDoPeriodo(dias);

    const [base, { data: manut, error: eM }] = await Promise.all([
      carregarBase(),
      supabase.from('manutencoes').select('*'),
    ]);
    if (eM) throw eM;

    const veiculos = montarVeiculos(base);
    const rotas = montarRotas(base);
    const porId = Object.fromEntries(base.viagens.map((v) => [v.id, v]));

    // Rotas do período: agendadas para o período em diante, ou iniciadas/concluídas nele.
    const rotasPeriodo = rotas.filter((r) => {
      const v = porId[r.id];
      return dentroDoPeriodo(v.data_saida || v.iniciada_em || v.concluida_em, inicio)
        || dentroDoPeriodo(v.concluida_em, inicio);
    });
    const manutencoesPeriodo = (manut || []).filter((m) => dentroDoPeriodo(m.data, inicio)).map(montarManutencao);

    // Erro P3: os números financeiros vêm dos mesmos lançamentos da Home.
    const lancPeriodo = base.lancamentos.filter((l) => dentroDoPeriodo(dataDoLancamento(l), inicio));
    const receita = somarValores(lancPeriodo.filter(ehReceita));
    const despesasLancadas = somarValores(lancPeriodo.filter(ehDespesa));
    const custoManutencao = manutencoesPeriodo.reduce((s, m) => s + m.custo, 0);
    const despesas = despesasLancadas + custoManutencao;
    const saldo = receita - despesas;

    const km = somarKm(viagensConcluidasNoPeriodo(base.viagens, inicio));

    const porStatus = ['em_transito', 'agendada', 'concluida'].map((id) => ({
      id,
      total: rotasPeriodo.filter((r) => r.status === id).length,
    }));

    const ranking = veiculos
      .filter((v) => v.custoKm > 0)
      .sort((a, b) => a.custoKm - b.custoKm)
      .slice(0, 5);

    const rankingRotas = rankingPorRota(rotas.filter((r) => r.status === 'concluida' && rotasPeriodo.some((p) => p.id === r.id)));

    return res.json({
      sucesso: true,
      relatorio: {
        rotasPeriodo,
        manutencoesPeriodo,
        receita: arredondar(receita),
        despesasViagem: arredondar(despesasLancadas),
        custoManutencao: arredondar(custoManutencao),
        despesas: arredondar(despesas),
        saldo: arredondar(saldo),
        margem: receita > 0 ? Math.round((saldo / receita) * 100) : 0,
        kmRodados: arredondar(km),
        custoKm: arredondar(custoPorKm(despesasLancadas, km)),
        porStatus,
        ranking,
        rankingRotas,
        porMes: fluxoMensal(base.lancamentos, 6),
      },
    });
  } catch (e) {
    return erroInterno(res, 'gerar o relatório', e);
  }
}

// -----------------------------------------------------------------------------
// Edição e exclusão (veículos, rotas agendadas e manutenções)
// -----------------------------------------------------------------------------

const vazio = (v) => v === undefined || v === null || v === '';

/** PUT /frota/veiculos/:id  { modelo?, placa?, ano?, hodometro?, consumoMedio?, status? } */
export async function editarVeiculo(req, res) {
  try {
    const { data: atual, error: eA } = await supabase.from('veiculos').select('*').eq('id', req.params.id).eq('ativo', true).maybeSingle();
    if (eA) throw eA;
    if (!atual) return res.status(404).json({ sucesso: false, erro: 'Veículo não encontrado.' });

    const { modelo, placa, ano, hodometro, consumoMedio, status } = req.body || {};
    const mudancas = {};
    const anoAtual = new Date().getFullYear();

    if (modelo !== undefined) {
      if (!String(modelo).trim()) return res.status(400).json({ sucesso: false, erro: 'Informe o modelo do veículo.' });
      mudancas.modelo = String(modelo).trim();
    }
    if (placa !== undefined) {
      if (!placaValida(placa)) return res.status(400).json({ sucesso: false, erro: 'Placa inválida. Use ABC-1234 ou ABC1D23.' });
      mudancas.placa = formatarPlaca(placa);
      const { data: mesmaPlaca, error: eP } = await supabase.from('veiculos').select('id').eq('placa', mudancas.placa).neq('id', atual.id).limit(1);
      if (eP) throw eP;
      if (mesmaPlaca?.length) return res.status(409).json({ sucesso: false, erro: 'Já existe um veículo com essa placa.' });
    }
    if (ano !== undefined) {
      if (!vazio(ano) && (Number(ano) < 1980 || Number(ano) > anoAtual + 1)) {
        return res.status(400).json({ sucesso: false, erro: `Informe um ano entre 1980 e ${anoAtual + 1}.` });
      }
      mudancas.ano = vazio(ano) ? null : Number(ano);
    }
    if (consumoMedio !== undefined) {
      if (!vazio(consumoMedio) && !(Number(consumoMedio) > 0)) {
        return res.status(400).json({ sucesso: false, erro: 'O consumo médio precisa ser maior que zero.' });
      }
      mudancas.consumo_medio = vazio(consumoMedio) ? null : Number(consumoMedio);
    }
    if (hodometro !== undefined) {
      const km = Number(hodometro);
      if (!(km >= 0)) return res.status(400).json({ sucesso: false, erro: 'Informe o hodômetro atual.' });
      // Não deixa voltar para trás de uma leitura já registrada em viagem.
      const { data: viagens, error: eV } = await supabase.from('viagens').select('km_inicial, km_final').eq('id_veiculo', atual.id);
      if (eV) throw eV;
      const maior = Math.max(0, ...(viagens || []).map((v) => Math.max(Number(v.km_final) || 0, Number(v.km_inicial) || 0)));
      if (km < maior) {
        return res.status(400).json({ sucesso: false, erro: `Já existe viagem registrada com ${maior.toLocaleString('pt-BR')} km neste veículo.` });
      }
      mudancas.hodometro = km;
    }
    if (status !== undefined) {
      if (!['disponivel', 'manutencao'].includes(status)) {
        return res.status(400).json({ sucesso: false, erro: 'Status inválido. Use disponivel ou manutencao.' });
      }
      if (atual.status === 'EM_VIAGEM') {
        return res.status(400).json({ sucesso: false, erro: 'Feche a viagem atual antes de mudar o status do veículo.' });
      }
      mudancas.status = status === 'manutencao' ? 'MANUTENCAO' : 'DISPONIVEL';
    }

    if (Object.keys(mudancas).length === 0) return res.status(400).json({ sucesso: false, erro: 'Nada para alterar.' });

    const { data, error } = await supabase.from('veiculos').update(mudancas).eq('id', atual.id).select().single();
    if (error) {
      if (error.code === '23505') return res.status(409).json({ sucesso: false, erro: 'Já existe um veículo com essa placa.' });
      throw error;
    }
    return res.json({ sucesso: true, veiculo: montarVeiculos({ veiculos: [data], viagens: [], lancamentos: [] })[0] });
  } catch (e) {
    return erroInterno(res, 'editar o veículo', e);
  }
}

/** DELETE /frota/veiculos/:id — desativa (ativo = false); o histórico de viagens continua. */
export async function desativarVeiculo(req, res) {
  try {
    const { data: atual, error: eA } = await supabase.from('veiculos').select('*').eq('id', req.params.id).eq('ativo', true).maybeSingle();
    if (eA) throw eA;
    if (!atual) return res.status(404).json({ sucesso: false, erro: 'Veículo não encontrado.' });
    if (atual.status === 'EM_VIAGEM') return res.status(400).json({ sucesso: false, erro: 'O veículo está em viagem. Feche a viagem antes.' });

    const { data: agendadas, error: eV } = await supabase
      .from('viagens').select('id').eq('id_veiculo', atual.id).eq('status', 'PLANEJADA');
    if (eV) throw eV;
    if (agendadas?.length) {
      return res.status(400).json({ sucesso: false, erro: `O veículo tem ${agendadas.length} rota(s) agendada(s). Troque o veículo delas ou exclua as rotas antes.` });
    }

    const { error } = await supabase.from('veiculos').update({ ativo: false }).eq('id', atual.id);
    if (error) throw error;
    return res.json({ sucesso: true, mensagem: 'Veículo desativado.' });
  } catch (e) {
    return erroInterno(res, 'desativar o veículo', e);
  }
}

/** PUT /frota/rotas/:id — só rotas agendadas (PLANEJADA). */
export async function editarRota(req, res) {
  try {
    const { data: viagem, error: eA } = await supabase.from('viagens').select('*').eq('id', req.params.id).maybeSingle();
    if (eA) throw eA;
    if (!viagem) return res.status(404).json({ sucesso: false, erro: 'Rota não encontrada.' });
    if (viagem.status !== 'PLANEJADA') return res.status(400).json({ sucesso: false, erro: 'Só é possível editar uma rota agendada.' });

    const { origem, destino, veiculoId, motoristaId, dataSaida, hodometroInicial, receita, distanciaPrevistaKm } = req.body || {};
    const mudancas = {};

    if (origem !== undefined) {
      if (!String(origem).trim()) return res.status(400).json({ sucesso: false, erro: 'Informe a cidade de origem.' });
      mudancas.origem = String(origem).trim();
    }
    if (destino !== undefined) {
      if (!String(destino).trim()) return res.status(400).json({ sucesso: false, erro: 'Informe a cidade de destino.' });
      mudancas.destino = String(destino).trim();
    }
    if (dataSaida !== undefined) {
      const dataIso = dataParaIso(dataSaida);
      if (!dataIso) return res.status(400).json({ sucesso: false, erro: 'Data inválida. Use DD/MM/AAAA.' });
      if (dataIso < hojeIso()) return res.status(400).json({ sucesso: false, erro: 'A data não pode estar no passado.' });
      mudancas.data_saida = dataIso;
    }
    if (receita !== undefined) {
      if (!(Number(receita) > 0)) return res.status(400).json({ sucesso: false, erro: 'Informe a receita prevista do frete.' });
      mudancas.receita_prevista = Number(receita);
    }
    if (distanciaPrevistaKm !== undefined) {
      if (!vazio(distanciaPrevistaKm) && !(Number(distanciaPrevistaKm) >= 0)) {
        return res.status(400).json({ sucesso: false, erro: 'Distância prevista inválida.' });
      }
      mudancas.distancia_prevista_km = vazio(distanciaPrevistaKm) ? null : Number(distanciaPrevistaKm);
    }
    if (motoristaId !== undefined) {
      const { data: motorista, error: eM } = await supabase.from('usuarios').select('id, id_perfil, ativo').eq('id', motoristaId).maybeSingle();
      if (eM) throw eM;
      if (!motorista || motorista.id_perfil !== PERFIS.MOTORISTA || motorista.ativo === false) {
        return res.status(400).json({ sucesso: false, erro: 'Escolha um usuário com perfil Motorista.' });
      }
      mudancas.id_motorista = motoristaId;
    }

    let hodometroVeiculo = null;
    if (veiculoId !== undefined) {
      const { data: veiculo, error: eV } = await supabase.from('veiculos').select('id, hodometro, status').eq('id', veiculoId).eq('ativo', true).maybeSingle();
      if (eV) throw eV;
      if (!veiculo) return res.status(400).json({ sucesso: false, erro: 'Veículo não encontrado.' });
      if (veiculo.status === 'MANUTENCAO') return res.status(400).json({ sucesso: false, erro: 'Veículo em manutenção não pode receber rota.' });
      mudancas.id_veiculo = veiculoId;
      hodometroVeiculo = Number(veiculo.hodometro);
    }
    if (hodometroInicial !== undefined && !vazio(hodometroInicial)) {
      const km = Number(hodometroInicial);
      if (!(km >= 0)) return res.status(400).json({ sucesso: false, erro: 'Informe o hodômetro inicial.' });
      if (hodometroVeiculo === null && (mudancas.id_veiculo || viagem.id_veiculo)) {
        const { data: v } = await supabase.from('veiculos').select('hodometro').eq('id', mudancas.id_veiculo || viagem.id_veiculo).maybeSingle();
        hodometroVeiculo = Number(v?.hodometro) || 0;
      }
      if (km < (hodometroVeiculo || 0)) {
        return res.status(400).json({ sucesso: false, erro: `O veículo já marca ${hodometroVeiculo.toLocaleString('pt-BR')} km.` });
      }
      mudancas.km_inicial = km;
    } else if (hodometroVeiculo !== null) {
      mudancas.km_inicial = hodometroVeiculo;
    }

    const origemFinal = mudancas.origem ?? viagem.origem;
    const destinoFinal = mudancas.destino ?? viagem.destino;
    if (chaveCidade(origemFinal) === chaveCidade(destinoFinal)) {
      return res.status(400).json({ sucesso: false, erro: 'O destino precisa ser diferente da origem.' });
    }
    if (Object.keys(mudancas).length === 0) return res.status(400).json({ sucesso: false, erro: 'Nada para alterar.' });

    const { data, error } = await supabase
      .from('viagens').update(mudancas).eq('id', viagem.id).eq('status', 'PLANEJADA').select().maybeSingle();
    if (error) throw error;
    if (!data) return res.status(409).json({ sucesso: false, erro: 'Essa rota acabou de ser aberta por outra pessoa.' });
    return res.json({ sucesso: true, rota: { id: data.id, origem: data.origem, destino: data.destino, dataInicial: dataParaBr(data.data_saida), status: 'agendada' } });
  } catch (e) {
    return erroInterno(res, 'editar a rota', e);
  }
}

/** DELETE /frota/rotas/:id — exclui rota agendada que ainda não tem lançamentos ligados. */
export async function excluirRota(req, res) {
  try {
    const { data: viagem, error: eA } = await supabase.from('viagens').select('*').eq('id', req.params.id).maybeSingle();
    if (eA) throw eA;
    if (!viagem) return res.status(404).json({ sucesso: false, erro: 'Rota não encontrada.' });
    if (viagem.status !== 'PLANEJADA') {
      return res.status(400).json({ sucesso: false, erro: 'Só é possível excluir uma rota agendada. Viagens abertas ou concluídas ficam no histórico.' });
    }
    const { data: lancs, error: eL } = await supabase.from('lancamentos_financeiros').select('id, status').eq('id_viagem', viagem.id);
    if (eL) throw eL;
    const ativos = (lancs || []).filter((l) => !ehCancelado(l));
    if (ativos.length) {
      return res.status(400).json({ sucesso: false, erro: `A rota tem ${ativos.length} lançamento(s) ligado(s). Estorne os lançamentos antes de excluir.` });
    }
    const { error } = await supabase.from('viagens').delete().eq('id', viagem.id).eq('status', 'PLANEJADA');
    if (error) {
      if (error.code === '23503') return res.status(400).json({ sucesso: false, erro: 'A rota tem registros ligados e não pode ser excluída.' });
      throw error;
    }
    return res.json({ sucesso: true, mensagem: 'Rota excluída.' });
  } catch (e) {
    return erroInterno(res, 'excluir a rota', e);
  }
}

/** PUT /frota/manutencoes/:id — custo e observações sempre; os outros campos só antes de concluir. */
export async function editarManutencao(req, res) {
  try {
    const { data: ordem, error: eA } = await supabase.from('manutencoes').select('*').eq('id', req.params.id).maybeSingle();
    if (eA) throw eA;
    if (!ordem) return res.status(404).json({ sucesso: false, erro: 'Ordem de serviço não encontrada.' });

    const { tipo, data, oficina, custo, observacoes } = req.body || {};
    const concluida = ordem.status === 'CONCLUIDA';
    if (concluida && (tipo !== undefined || data !== undefined || oficina !== undefined)) {
      return res.status(400).json({ sucesso: false, erro: 'Manutenção concluída: só é possível alterar o custo e as observações.' });
    }

    const mudancas = {};
    if (tipo !== undefined) {
      if (!TIPOS_MANUTENCAO.includes(tipo)) return res.status(400).json({ sucesso: false, erro: 'Tipo de serviço inválido.' });
      mudancas.tipo = tipo;
    }
    if (data !== undefined) {
      const dataIso = dataParaIso(data);
      if (!dataIso) return res.status(400).json({ sucesso: false, erro: 'Data inválida. Use DD/MM/AAAA.' });
      mudancas.data = dataIso;
    }
    if (oficina !== undefined) {
      if (!String(oficina).trim()) return res.status(400).json({ sucesso: false, erro: 'Informe a oficina ou o responsável.' });
      mudancas.oficina = String(oficina).trim();
    }
    if (custo !== undefined) {
      if (!vazio(custo) && !(Number(custo) >= 0)) return res.status(400).json({ sucesso: false, erro: 'Informe um custo válido.' });
      mudancas.custo = vazio(custo) ? 0 : Number(custo);
    }
    if (observacoes !== undefined) mudancas.observacoes = String(observacoes || '').trim() || null;
    if (Object.keys(mudancas).length === 0) return res.status(400).json({ sucesso: false, erro: 'Nada para alterar.' });

    const { data: atualizada, error } = await supabase.from('manutencoes').update(mudancas).eq('id', ordem.id).select().single();
    if (error) throw error;
    return res.json({ sucesso: true, manutencao: montarManutencao(atualizada) });
  } catch (e) {
    return erroInterno(res, 'editar a manutenção', e);
  }
}

/** DELETE /frota/manutencoes/:id — só ordens ainda agendadas (não iniciadas). */
export async function excluirManutencao(req, res) {
  try {
    const { data: ordem, error: eA } = await supabase.from('manutencoes').select('*').eq('id', req.params.id).maybeSingle();
    if (eA) throw eA;
    if (!ordem) return res.status(404).json({ sucesso: false, erro: 'Ordem de serviço não encontrada.' });
    if (ordem.status !== 'AGENDADA') {
      return res.status(400).json({ sucesso: false, erro: 'Só é possível excluir uma manutenção agendada (ainda não iniciada).' });
    }
    const { error } = await supabase.from('manutencoes').delete().eq('id', ordem.id).eq('status', 'AGENDADA');
    if (error) throw error;
    return res.json({ sucesso: true, mensagem: 'Manutenção excluída.' });
  } catch (e) {
    return erroInterno(res, 'excluir a manutenção', e);
  }
}

// -----------------------------------------------------------------------------
// Abastecimentos (consumo médio real)
// -----------------------------------------------------------------------------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const montarAbastecimento = (a, { veiculosPorId = {}, nomes = {} } = {}) => ({
  id: a.id,
  veiculoId: a.id_veiculo,
  veiculo: veiculosPorId[a.id_veiculo] ? `${veiculosPorId[a.id_veiculo].modelo} · ${veiculosPorId[a.id_veiculo].placa}` : null,
  viagemId: a.id_viagem || null,
  motorista: nomes[a.id_motorista] || null,
  data: dataParaBr(a.data),
  dataIso: a.data,
  litros: Number(a.litros) || 0,
  valor: Number(a.valor_total) || 0,
  precoLitro: Number(a.litros) > 0 ? arredondar(Number(a.valor_total) / Number(a.litros)) : 0,
  hodometro: numero(a.hodometro),
  posto: a.posto || null,
});

/** GET /frota/abastecimentos?veiculoId= — o motorista vê só os dele. */
export async function listarAbastecimentos(req, res) {
  try {
    const base = await carregarBase();
    let lista = base.abastecimentos;
    if (ehMotorista(req)) lista = lista.filter((a) => a.id_motorista === req.usuario.id);
    if (req.query.veiculoId) lista = lista.filter((a) => a.id_veiculo === req.query.veiculoId);
    lista.sort((a, b) => String(b.data).localeCompare(String(a.data)) || Number(b.hodometro) - Number(a.hodometro));

    const veiculosPorId = Object.fromEntries(base.veiculos.map((v) => [v.id, v]));
    return res.json({
      sucesso: true,
      abastecimentos: lista.map((a) => montarAbastecimento(a, { veiculosPorId, nomes: base.nomes })),
      consumoMedio: req.query.veiculoId ? consumoCalculado(lista) : null,
    });
  } catch (e) {
    return erroInterno(res, 'listar os abastecimentos', e);
  }
}

/**
 * POST /frota/abastecimentos  { veiculoId, viagemId?, data, litros, valor, hodometro, posto?, idFormaPagamento?, idCliente? }
 * Grava o abastecimento e a saída financeira correspondente (ligada à viagem, se houver).
 */
export async function registrarAbastecimento(req, res) {
  try {
    const { veiculoId, viagemId, data, litros, valor, hodometro, posto, idFormaPagamento, idCliente } = req.body || {};
    const litrosNum = Number(String(litros ?? '').replace(',', '.'));
    const valorNum = Number(String(valor ?? '').replace(',', '.'));
    const kmNum = Number(hodometro);

    if (!veiculoId) return res.status(400).json({ sucesso: false, erro: 'Selecione o veículo.' });
    const dataIso = dataParaIso(data);
    if (!dataIso) return res.status(400).json({ sucesso: false, erro: 'Data inválida. Use DD/MM/AAAA.' });
    if (dataIso > hojeIso()) return res.status(400).json({ sucesso: false, erro: 'A data não pode estar no futuro.' });
    if (!(litrosNum > 0) || litrosNum > 2000) return res.status(400).json({ sucesso: false, erro: 'Informe os litros (entre 0 e 2.000).' });
    if (!(valorNum > 0)) return res.status(400).json({ sucesso: false, erro: 'Informe o valor pago.' });
    if (!(kmNum > 0)) return res.status(400).json({ sucesso: false, erro: 'Informe o hodômetro no abastecimento.' });
    if (idCliente && !UUID.test(String(idCliente))) return res.status(400).json({ sucesso: false, erro: 'idCliente inválido.' });

    // Reenvio do modo offline: não duplica.
    if (idCliente) {
      const { data: existe, error: eE } = await supabase.from('abastecimentos').select('*').eq('id_local', idCliente).limit(1);
      if (eE) throw eE;
      if (existe?.length) return res.status(200).json({ sucesso: true, abastecimento: montarAbastecimento(existe[0]), duplicado: true });
    }

    const { data: veiculo, error: eV } = await supabase.from('veiculos').select('*').eq('id', veiculoId).eq('ativo', true).maybeSingle();
    if (eV) throw eV;
    if (!veiculo) return res.status(400).json({ sucesso: false, erro: 'Veículo não encontrado.' });

    let viagem = null;
    if (viagemId) {
      const { data: v, error: eT } = await supabase.from('viagens').select('*').eq('id', viagemId).maybeSingle();
      if (eT) throw eT;
      if (!v) return res.status(400).json({ sucesso: false, erro: 'Viagem não encontrada.' });
      if (v.id_veiculo && v.id_veiculo !== veiculoId) return res.status(400).json({ sucesso: false, erro: 'Essa viagem é de outro veículo.' });
      viagem = v;
    }
    if (ehMotorista(req)) {
      if (viagem && viagem.id_motorista !== req.usuario.id) return res.status(403).json({ sucesso: false, erro: 'Essa viagem é de outro motorista.' });
      if (!viagem) {
        const { data: minhas, error: eM } = await supabase.from('viagens').select('id').eq('id_motorista', req.usuario.id).eq('id_veiculo', veiculoId).limit(1);
        if (eM) throw eM;
        if (!minhas?.length) return res.status(403).json({ sucesso: false, erro: 'Esse veículo não está em nenhuma viagem sua.' });
      }
    }

    // O hodômetro não pode voltar em relação ao último abastecimento do veículo.
    const anteriores = (await carregarAbastecimentos()).filter((a) => a.id_veiculo === veiculoId);
    const ultimo = Math.max(0, ...anteriores.map((a) => Number(a.hodometro) || 0));
    if (kmNum < ultimo) {
      return res.status(400).json({ sucesso: false, erro: `O último abastecimento deste veículo foi com ${ultimo.toLocaleString('pt-BR')} km.` });
    }

    // Saída financeira do combustível (categoria de combustível, se existir).
    const { data: cats, error: eC } = await supabase.from('categorias_financeiras').select('id, nome, tipo').eq('tipo', 'SAIDA').eq('ativo', true);
    if (eC) throw eC;
    const categoria = (cats || []).find((c) => /combust|diesel|gasolina|abastec/i.test(c.nome));

    const descricao = `Abastecimento ${veiculo.placa}${posto ? ` · ${String(posto).trim()}` : ''}`;
    const { data: lancamento, error: eL } = await supabase
      .from('lancamentos_financeiros')
      .insert([{
        descricao,
        valor: arredondar(valorNum),
        tipo: 'SAIDA',
        status: 'PAGO',
        id_categoria: categoria?.id || null,
        id_forma_pagamento: idFormaPagamento || null,
        id_usuario: req.usuario.id,
        id_viagem: viagem?.id || null,
        data_lancamento: dataIso,
        data_vencimento: dataIso,
        data_pagamento: dataIso,
      }])
      .select()
      .single();
    if (eL) throw eL;

    const { data: criado, error } = await supabase
      .from('abastecimentos')
      .insert([{
        id_veiculo: veiculoId,
        id_viagem: viagem?.id || null,
        id_motorista: req.usuario.id,
        id_lancamento: lancamento.id,
        data: dataIso,
        litros: litrosNum,
        valor_total: arredondar(valorNum),
        hodometro: kmNum,
        posto: posto ? String(posto).trim() : null,
        ...(idCliente ? { id_local: idCliente } : {}),
      }])
      .select()
      .single();
    if (error) {
      // Desfaz a saída para não ficar gasto sem abastecimento.
      await supabase.from('lancamentos_financeiros').delete().eq('id', lancamento.id);
      if (tabelaInexistente(error)) {
        return res.status(503).json({ sucesso: false, erro: 'O banco ainda não tem a tabela de abastecimentos. Peça para aplicar a migração 2026-11-21.' });
      }
      throw error;
    }

    // Atualiza o hodômetro do veículo se o abastecimento passou dele.
    if (kmNum > Number(veiculo.hodometro)) {
      const { error: eH } = await supabase.from('veiculos').update({ hodometro: kmNum }).eq('id', veiculoId).lt('hodometro', kmNum);
      if (eH) throw eH;
    }

    const todos = [...anteriores, criado];
    return res.status(201).json({
      sucesso: true,
      abastecimento: montarAbastecimento(criado),
      consumoMedio: consumoCalculado(todos),
    });
  } catch (e) {
    return erroInterno(res, 'registrar o abastecimento', e);
  }
}
