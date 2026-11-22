import supabase from '../database/db.js';
import { PERFIS } from '../middleware/auth.js';
import {
  inicioDoPeriodo, dentroDoPeriodo, kmDaViagem, viagensConcluidasNoPeriodo, somarKm,
  ehDespesa, ehReceita, dataDoLancamento, somarValores, custoPorKm, arredondar,
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

async function carregarBase({ apenasMotorista, incluirDisponiveis = false } = {}) {
  let consultaViagens = supabase.from('viagens').select('*');
  if (apenasMotorista && !incluirDisponiveis) {
    consultaViagens = consultaViagens.eq('id_motorista', apenasMotorista);
  }
  let consultaLancamentos = supabase
    .from('lancamentos_financeiros')
    .select('id, descricao, valor, tipo, status, id_viagem, comprovante_url, data_lancamento, data_pagamento, data_vencimento');
  if (apenasMotorista) {
    consultaLancamentos = consultaLancamentos.eq('id_usuario', apenasMotorista);
  }

  const [veiculos, viagens, lancamentos, usuarios, manutencoes] = await Promise.all([
    supabase.from('veiculos').select('*').eq('ativo', true).order('modelo'),
    consultaViagens,
    consultaLancamentos,
    supabase.from('usuarios').select('id, nome'),
    supabase.from('manutencoes').select('*'),
  ]);

  for (const r of [veiculos, viagens, lancamentos, usuarios, manutencoes]) {
    if (r.error) throw r.error;
  }

  let viagensFiltradas = viagens.data || [];
  if (apenasMotorista && incluirDisponiveis) {
    viagensFiltradas = viagensFiltradas.filter(
      (t) => t.id_motorista === apenasMotorista || (!t.id_motorista && String(t.status).toUpperCase() === 'PLANEJADA')
    );
  }

  return {
    veiculos: veiculos.data || [],
    viagens: viagensFiltradas,
    lancamentos: lancamentos.data || [],
    nomes: Object.fromEntries((usuarios.data || []).map((u) => [u.id, u.nome])),
    manutencoes: manutencoes.data || [],
  };
}

function montarVeiculos({ veiculos, viagens, lancamentos, manutencoes = [] }) {
  return veiculos.map((v) => {
    const daFrota = viagens.filter((t) => t.id_veiculo === v.id);
    const ids = new Set(daFrota.map((t) => t.id));
    const gastosViagem = somarValores(lancamentos.filter((l) => ids.has(l.id_viagem) && ehDespesa(l)));
    const gastosManutencao = somarValores(
      manutencoes
        .filter((m) => m.id_veiculo === v.id && String(m.status).toUpperCase() === 'CONCLUIDA')
        .map((m) => ({ valor: m.custo }))
    );
    const gastosTotais = gastosViagem + gastosManutencao;
    const kmConcluidos = somarKm(daFrota.filter((t) => String(t.status).toUpperCase() === 'CONCLUIDA'));

    const temHistoricoViagem = kmConcluidos > 0;
    const custoKmCalculado = temHistoricoViagem ? arredondar(custoPorKm(gastosTotais, kmConcluidos)) : 0;

    return {
      id: v.id,
      modelo: v.modelo,
      placa: v.placa,
      ano: v.ano,
      hodometro: numero(v.hodometro) ?? 0,
      consumoMedio: numero(v.consumo_medio),
      status: STATUS_VEICULO[v.status] || 'disponivel',
      custoKm: custoKmCalculado,
      gastosTotais: arredondar(gastosTotais),
      kmConcluidos,
      semDadosViagem: !temHistoricoViagem,
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
    receita: numero(viagem.receita_prevista) ?? 0,
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
    const veiculos = montarVeiculos(base);
    if (apenasMotorista) {
      return res.json({
        sucesso: true,
        veiculos: veiculos.map(({ gastosTotais, custoKm, ...veiculo }) => veiculo),
      });
    }
    return res.json({ sucesso: true, veiculos });
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

    const veiculoId = req.body?.veiculoId || viagem.id_veiculo;
    if (!veiculoId) return res.status(400).json({ sucesso: false, erro: 'Selecione o veículo.' });
    const inicial = Number(req.body?.hodometroInicial);

    if (viagem.status === 'EM_ANDAMENTO') {
      if (veiculoId === viagem.id_veiculo && inicial === Number(viagem.km_inicial)) {
        return res.json({ sucesso: true, jaExistente: true });
      }
      return res.status(409).json({ sucesso: false, erro: 'A viagem já foi iniciada com outros dados.' });
    }
    if (viagem.status !== 'PLANEJADA') {
      return res.status(400).json({ sucesso: false, erro: 'Só é possível iniciar uma rota agendada.' });
    }

    if (ehMotorista(req)) {
      const { data: veiculosPermitidos, error: erroPermissoes } = await supabase
        .from('viagens')
        .select('id_veiculo')
        .eq('id_motorista', req.usuario.id);
      if (erroPermissoes) throw erroPermissoes;
      if (!(veiculosPermitidos || []).some((rota) => rota.id_veiculo === veiculoId)) {
        return res.status(403).json({ sucesso: false, erro: 'Este veículo não está associado às suas rotas.' });
      }
    }

    const { data: veiculo, error: eV } = await supabase.from('veiculos').select('*').eq('id', veiculoId).maybeSingle();
    if (eV) throw eV;
    if (!veiculo) return res.status(400).json({ sucesso: false, erro: 'Veículo não encontrado.' });
    if (veiculo.status !== 'DISPONIVEL') return res.status(400).json({ sucesso: false, erro: 'O veículo não está disponível.' });

    if (!Number.isFinite(inicial) || inicial < 0) {
      return res.status(400).json({ sucesso: false, erro: 'Informe um hodômetro inicial válido.' });
    }
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

    const final = Number(req.body?.hodometroFinal);
    const inicial = Number(viagem.km_inicial) || 0;
    if (viagem.status === 'CONCLUIDA') {
      if (final === Number(viagem.km_final)) {
        return res.json({ sucesso: true, jaExistente: true, kmRodados: final - inicial });
      }
      return res.status(409).json({ sucesso: false, erro: 'A viagem já foi concluída com outro hodômetro final.' });
    }
    if (viagem.status !== 'EM_ANDAMENTO') {
      return res.status(400).json({ sucesso: false, erro: 'Só é possível concluir uma viagem em andamento.' });
    }
    if (!(final > inicial)) {
      return res.status(400).json({ sucesso: false, erro: `Informe um valor maior que ${inicial.toLocaleString('pt-BR')} km.` });
    }

    const agora = new Date().toISOString();
    const { data: concluida, error } = await supabase
      .from('viagens')
      .update({ status: 'CONCLUIDA', km_final: final, concluida_em: agora, iniciada_em: viagem.iniciada_em || agora })
      .eq('id', viagem.id)
      .eq('status', 'EM_ANDAMENTO')
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!concluida) {
      return res.status(409).json({ sucesso: false, erro: 'A viagem foi alterada por outra operação.' });
    }

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
      viagens: emAndamento,
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
      },
    });
  } catch (e) {
    return erroInterno(res, 'gerar o relatório', e);
  }
}
