import supabase from '../database/db.js';
import { PERFIS } from '../middleware/auth.js';
import { viagensConcluidasNoPeriodo, somarKm, custoPorKm, arredondar, dataDoLancamento } from '../utils/calculos.js';

const parseValor = (val) => {
  if (typeof val === 'string') {
    return parseFloat(val.replace(',', '.')) || 0;
  }
  return Number(val) || 0;
};

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const formatarData = (valor) => {
  if (!valor) return '';
  const texto = String(valor);
  const temHorario = /[T ]\d{2}:\d{2}/.test(texto);

  if (!temHorario) {
    const [ano, mes, dia] = texto.split('T')[0].split('-').map(Number);
    if (!ano || !mes || !dia) return texto;
    return `${dia} ${MESES[mes - 1]}`;
  }

  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(new Date(texto));
  const p = Object.fromEntries(partes.map((x) => [x.type, x.value]));
  return `${Number(p.day)} ${MESES[Number(p.month) - 1]} ${p.hour}:${p.minute}`;
};

const formatarMoeda = (n) =>
  'R$ ' + Math.abs(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const listarAtividadesRecentes = async (req, res) => {
  try {
    const limite = Math.min(Math.max(parseInt(req.query.limite, 10) || 4, 1), 50);

    // Admin e Financeiro veem a empresa toda; Gestor e Motorista, só os próprios lançamentos.
    let consulta = supabase.from('lancamentos_financeiros').select('*');
    if (![PERFIS.ADMIN, PERFIS.FINANCEIRO].includes(req.usuario?.perfil)) {
      consulta = consulta.eq('id_usuario', req.usuario.id);
    }
    const { data, error } = await consulta;
    if (error) throw error;

    const lancamentos = (data || []).filter((item) => {
      const tipo = (item.tipo || '').toUpperCase().trim();
      const status = (item.status || '').toUpperCase().trim();
      if (tipo === 'DIVIDA') return status === 'PAGO';
      return tipo === 'ENTRADA' || tipo === 'SAIDA';
    });

    const chave = (i) => `${i.data_lancamento || ''}|${i.created_at || ''}|${i.id}`;
    lancamentos.sort((a, b) => chave(a).localeCompare(chave(b)));

    const idsCategoria = [...new Set(lancamentos.map((i) => i.id_categoria).filter(Boolean))];
    const nomesCategoria = {};
    if (idsCategoria.length) {
      const { data: cats, error: erroCat } = await supabase
        .from('categorias_financeiras')
        .select('id, nome')
        .in('id', idsCategoria);
      if (erroCat) throw erroCat;
      for (const c of cats || []) nomesCategoria[c.id] = c.nome;
    }

    let saldo = 0;
    const atividades = lancamentos.map((item) => {
      const tipo = (item.tipo || '').toUpperCase().trim();
      const valor = Number(item.valor) || 0;
      const ehEntrada = tipo === 'ENTRADA';
      saldo += ehEntrada ? valor : -valor;

      return {
        id: item.id,
        titulo: nomesCategoria[item.id_categoria] || 'Outro',
        tipo: tipo.toLowerCase(),
        data: formatarData(item.data_lancamento),
        valor: `${ehEntrada ? '+' : '-'} ${formatarMoeda(valor)}`,
        saldoApos: `${saldo < 0 ? '- ' : ''}${formatarMoeda(saldo)}`
      };
    });

    const recencia = (i) => `${i.created_at || ''}|${i.data_lancamento || ''}|${i.id}`;
    const porId = Object.fromEntries(lancamentos.map((i) => [i.id, i]));

    const recentes = atividades
      .sort((a, b) => recencia(porId[b.id]).localeCompare(recencia(porId[a.id])))
      .slice(0, limite);

    res.set('Cache-Control', 'no-store');
    return res.status(200).json({ sucesso: true, atividades: recentes });
  } catch (error) {
    console.error('Erro ao listar atividades recentes:', error);
    return res.status(500).json({
      sucesso: false,
      mensagem: 'Erro interno ao consultar atividades recentes.'
    });
  }
};

// Procura o id pelo nome quando o app antigo manda só o nome (C5: antes usava
// .single(), que dá erro se não achar e o erro era ignorado).
async function idPorNome(tabela, nome) {
  if (!nome) return null;
  const { data, error } = await supabase
    .from(tabela)
    .select('id')
    .ilike('nome', String(nome).trim())
    .eq('ativo', true)
    .limit(1);
  if (error) throw error;
  return data?.[0]?.id || null;
}

// Só aceita anexos já enviados ao Storage (caminho devolvido por POST /comprovantes/upload).
// Caminhos locais do celular (file://, content://) não servem para ninguém (erro I4).
const anexoValido = (valor) =>
  typeof valor === 'string' && valor.length > 0 && !/^(file|content|ph|assets-library):/i.test(valor);

const primeiroAnexo = (lista) => (Array.isArray(lista) ? lista.find(anexoValido) : null) || null;

const cadastrarTransacao = async (req, res) => {
  try {
    const {
      tipo,
      actionType,
      descricao,
      categoria,
      idCategoria,
      formaPagamento,
      idFormaPagamento,
      idViagem,
      data,
      estadoOuStatus,
      credor,
      valorParcela,
      quantidadeParcelas,
      vencimentoPrimeira,
      valorQuitacaoAntecipada,
      anexos,
      idLocal
    } = req.body || {};

    const tipoTransacao = String(tipo || actionType || '').toUpperCase().trim();
    if (!['ENTRADA', 'SAIDA', 'DIVIDA'].includes(tipoTransacao)) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'Informe o tipo: entrada, saida ou divida.'
      });
    }

    if (!descricao || !String(descricao).trim()) {
      return res.status(400).json({ sucesso: false, mensagem: 'Informe a descrição.' });
    }

    const valorParcelaNum = parseValor(valorParcela);
    if (!(valorParcelaNum > 0)) {
      return res.status(400).json({ sucesso: false, mensagem: 'Informe um valor maior que zero.' });
    }

    const usuarioId = req.usuario.id;

    if (idViagem) {
      const { data: viagem, error: erroViagem } = await supabase
        .from('viagens')
        .select('id, id_motorista')
        .eq('id', idViagem)
        .maybeSingle();
      if (erroViagem) throw erroViagem;
      if (!viagem) return res.status(400).json({ sucesso: false, mensagem: 'Viagem não encontrada.' });
      if (req.usuario.perfil === PERFIS.MOTORISTA && viagem.id_motorista !== usuarioId) {
        return res.status(403).json({ sucesso: false, mensagem: 'Essa viagem é de outro motorista.' });
      }
    }

    const categoriaId = idCategoria || (await idPorNome('categorias_financeiras', categoria));
    const formaPagamentoId = idFormaPagamento || (await idPorNome('formas_pagamento', formaPagamento));
    const dataAtual = new Date().toISOString().split('T')[0];

    if (tipoTransacao === 'DIVIDA') {
      const qtd = parseInt(quantidadeParcelas, 10);
      if (!(qtd >= 2)) {
        return res.status(400).json({
          sucesso: false,
          mensagem: 'Uma dívida precisa ter pelo menos 2 parcelas. Para pagamento único, registre uma saída.'
        });
      }

      if (idLocal) {
        try {
          const { data: existente } = await supabase
            .from('financiamentos')
            .select('id')
            .eq('id_usuario', usuarioId)
            .eq('id_local', String(idLocal))
            .maybeSingle();

          if (existente) {
            return res.status(200).json({
              sucesso: true,
              mensagem: 'Dívida e parcelas já cadastradas anteriormente.',
              financiamentoId: existente.id,
              jaExistente: true
            });
          }
        } catch {}
      }

      const valorQuitacaoNum = parseValor(valorQuitacaoAntecipada);
      const primeiraDataValida = vencimentoPrimeira || data || dataAtual;

      // 1. Tentativa de criação atômica via RPC PostgreSQL (se a função existir no Supabase)
      if (typeof supabase.rpc === 'function') {
        try {
          const { data: rpcResp, error: erroRpc } = await supabase.rpc('cadastrar_financiamento_com_parcelas', {
            p_id_usuario: usuarioId,
            p_descricao: descricao,
            p_valor_total: Number((valorParcelaNum * qtd).toFixed(2)),
            p_valor_parcela: valorParcelaNum,
            p_quantidade_parcelas: qtd,
            p_data_primeiro_vencimento: primeiraDataValida,
            p_valor_quitacao_antecipada: valorQuitacaoAntecipada ? valorQuitacaoNum : null,
            p_credor: credor || null,
            p_id_categoria: categoriaId || null,
            p_id_forma_pagamento: formaPagamentoId || null,
            p_id_viagem: idViagem || null,
            p_id_local: idLocal ? String(idLocal) : null,
            p_data_lancamento: dataAtual
          });

          if (!erroRpc && rpcResp) {
            const statusHttp = rpcResp.jaExistente ? 200 : 201;
            return res.status(statusHttp).json({
              sucesso: true,
              mensagem: rpcResp.mensagem || (rpcResp.jaExistente ? 'Dívida e parcelas já cadastradas anteriormente.' : 'Dívida e parcelas cadastradas com sucesso!'),
              financiamentoId: rpcResp.financiamentoId,
              jaExistente: Boolean(rpcResp.jaExistente)
            });
          }

          const codigoErro = erroRpc?.code;
          const msgErro = erroRpc?.message || '';
          const funcaoNaoExiste = codigoErro === '42883' || codigoErro === 'PGRST202' || /function.*does not exist/i.test(msgErro);
          if (!funcaoNaoExiste && erroRpc) {
            throw erroRpc;
          }
        } catch (eRpc) {
          const codigoErro = eRpc?.code;
          const msgErro = eRpc?.message || '';
          const funcaoNaoExiste = codigoErro === '42883' || codigoErro === 'PGRST202' || /function.*does not exist/i.test(msgErro);
          if (!funcaoNaoExiste) throw eRpc;
        }
      }

      // 2. Fallback de compatibilidade (inserção sequencial com compensação de erro)
      const payloadFinanciamento = {
        descricao,
        valor_total: Number((valorParcelaNum * qtd).toFixed(2)),
        valor_parcela: valorParcelaNum,
        quantidade_parcelas: qtd,
        data_primeiro_vencimento: primeiraDataValida,
        valor_quitacao_antecipada: valorQuitacaoAntecipada ? valorQuitacaoNum : null,
        credor: credor || null,
        id_usuario: usuarioId,
        id_categoria: categoriaId,
        id_forma_pagamento: formaPagamentoId,
        ...(idLocal ? { id_local: String(idLocal) } : {})
      };

      let { data: financiamentoCriado, error: erroFinanciamento } = await supabase
        .from('financiamentos')
        .insert([payloadFinanciamento])
        .select()
        .single();

      if (erroFinanciamento && idLocal && erroFinanciamento.code === '23505') {
        const { data: existente } = await supabase
          .from('financiamentos')
          .select('id')
          .eq('id_usuario', usuarioId)
          .eq('id_local', String(idLocal))
          .maybeSingle();

        if (existente) {
          return res.status(200).json({
            sucesso: true,
            mensagem: 'Dívida e parcelas já cadastradas anteriormente.',
            financiamentoId: existente.id,
            jaExistente: true
          });
        }
      }

      if (erroFinanciamento && erroFinanciamento.code === '42703' && idLocal) {
        delete payloadFinanciamento.id_local;
        const retry = await supabase.from('financiamentos').insert([payloadFinanciamento]).select().single();
        financiamentoCriado = retry.data;
        erroFinanciamento = retry.error;
      }

      if (erroFinanciamento) throw erroFinanciamento;

      const financiamentoId = financiamentoCriado.id;
      const parcelasArray = [];
      const dataBase = new Date(`${primeiraDataValida}T12:00:00`);

      for (let i = 1; i <= qtd; i++) {
        parcelasArray.push({
          descricao: `${descricao} Parcela ${i}/${qtd}`,
          valor: valorParcelaNum,
          tipo: 'DIVIDA',
          id_categoria: categoriaId,
          id_forma_pagamento: formaPagamentoId,
          id_usuario: usuarioId,
          id_viagem: idViagem || null,
          data_lancamento: dataAtual,
          data_vencimento: dataBase.toISOString().split('T')[0],
          status: 'PENDENTE',
          id_financiamento: financiamentoId,
          numero_parcela: i,
          total_parcelas: qtd
        });

        dataBase.setMonth(dataBase.getMonth() + 1);
      }

      const { error: erroParcelas } = await supabase
        .from('lancamentos_financeiros')
        .insert(parcelasArray);

      if (erroParcelas) {
        await supabase.from('financiamentos').delete().eq('id', financiamentoId);
        throw erroParcelas;
      }

      return res.status(201).json({
        sucesso: true,
        mensagem: 'Dívida e parcelas cadastradas com sucesso!',
        financiamentoId
      });
    }

    const status = estadoOuStatus ? String(estadoOuStatus).toUpperCase() : 'PAGO';

    if (idLocal) {
      try {
        const { data: existente } = await supabase
          .from('lancamentos_financeiros')
          .select('*')
          .eq('id_usuario', usuarioId)
          .eq('id_local', String(idLocal))
          .maybeSingle();

        if (existente) {
          return res.status(200).json({
            sucesso: true,
            mensagem: `${tipoTransacao === 'ENTRADA' ? 'Entrada' : 'Saída'} já cadastrada anteriormente.`,
            lancamento: existente,
            jaExistente: true
          });
        }
      } catch {}
    }

    const payloadLancamento = {
      descricao,
      valor: valorParcelaNum,
      tipo: tipoTransacao,
      id_categoria: categoriaId,
      id_forma_pagamento: formaPagamentoId,
      id_usuario: usuarioId,
      id_viagem: idViagem || null,
      data_lancamento: data || dataAtual,
      data_vencimento: data || dataAtual,
      data_pagamento: status === 'PAGO' ? (data || dataAtual) : null,
      status,
      comprovante_url: primeiroAnexo(anexos?.comprovantes),
      foto_url: primeiroAnexo(anexos?.fotos),
      documento_url: primeiroAnexo(anexos?.documentos),
      ...(idLocal ? { id_local: String(idLocal) } : {})
    };

    let { data: lancamentoCriado, error: erroLancamento } = await supabase
      .from('lancamentos_financeiros')
      .insert([payloadLancamento])
      .select()
      .single();

    if (erroLancamento && idLocal && erroLancamento.code === '23505') {
      const { data: existente } = await supabase
        .from('lancamentos_financeiros')
        .select('*')
        .eq('id_usuario', usuarioId)
        .eq('id_local', String(idLocal))
        .maybeSingle();

      if (existente) {
        return res.status(200).json({
          sucesso: true,
          mensagem: `${tipoTransacao === 'ENTRADA' ? 'Entrada' : 'Saída'} já cadastrada anteriormente.`,
          lancamento: existente,
          jaExistente: true
        });
      }
    }

    if (erroLancamento && erroLancamento.code === '42703' && idLocal) {
      delete payloadLancamento.id_local;
      const retry = await supabase.from('lancamentos_financeiros').insert([payloadLancamento]).select().single();
      lancamentoCriado = retry.data;
      erroLancamento = retry.error;
    }

    if (erroLancamento) throw erroLancamento;

    return res.status(201).json({
      sucesso: true,
      mensagem: `${tipoTransacao === 'ENTRADA' ? 'Entrada' : 'Saída'} cadastrada com sucesso!`,
      lancamento: lancamentoCriado
    });
  } catch (error) {
    console.error('Erro ao cadastrar transação:', error);
    return res.status(500).json({
      sucesso: false,
      mensagem: 'Erro interno ao salvar no banco de dados.'
    });
  }
};

const listarParcelasPendentes = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('lancamentos_financeiros')
      .select('*')
      .eq('id_financiamento', id)
      .eq('status', 'PENDENTE')
      .order('numero_parcela', { ascending: true });

    if (error) throw error;

    return res.status(200).json({ sucesso: true, parcelasPendentes: data });
  } catch (error) {
    console.error('Erro ao listar parcelas pendentes:', error);
    return res.status(500).json({ sucesso: false, erro: 'Erro interno ao consultar parcelas.' });
  }
};

const obterResumoGeral = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('lancamentos_financeiros')
      .select('*');

    if (error) throw error;

    const now = new Date();
    const mesAtual = req.query.mes ? parseInt(req.query.mes, 10) : (now.getMonth() + 1);
    const anoAtual = req.query.ano ? parseInt(req.query.ano, 10) : now.getFullYear();

    let somaTotalEntradas = 0;
    let somaTotalSaidas = 0;
    let somaParcelasDivida = 0;

    let dividasPendentes = 0;
    let dividasPagas = 0;

    const itensDetalhados = [];

    for (const item of (data || [])) {
      const tipo = (item.tipo || '').toUpperCase().trim();
      const status = (item.status || '').toUpperCase().trim();
      const valor = Number(item.valor) || 0;
      const totalParcelas = Number(item.total_parcelas) > 0 ? Number(item.total_parcelas) : 1;

      const dataRef = item.data_pagamento || item.data_vencimento || item.data_lancamento;
      let itemAno = null;
      let itemMes = null;
      if (dataRef) {
        const parts = String(dataRef).split('T')[0].split('-');
        if (parts.length >= 2) {
          itemAno = parseInt(parts[0], 10);
          itemMes = parseInt(parts[1], 10);
        }
      }

      const isMesAtual = (itemMes === mesAtual && itemAno === anoAtual);

      if (tipo === 'ENTRADA') {
        somaTotalEntradas += valor;
        itensDetalhados.push({
          id: item.id,
          descricao: item.descricao,
          tipo: 'ENTRADA',
          valor,
          status,
          data: dataRef
        });
      } else if (tipo === 'SAIDA') {
        somaTotalSaidas += valor;
        itensDetalhados.push({
          id: item.id,
          descricao: item.descricao,
          tipo: 'SAIDA',
          valor,
          status,
          data: dataRef
        });
      } else if (tipo === 'DIVIDA') {
        const valorParcela = valor / totalParcelas;

        if (status === 'PENDENTE') {
          somaParcelasDivida += valorParcela;
          dividasPendentes += valorParcela;
          itensDetalhados.push({
            id: item.id,
            descricao: item.descricao,
            tipo: 'DIVIDA',
            status: 'PENDENTE',
            valorTotal: valor,
            totalParcelas,
            numeroParcela: item.numero_parcela,
            valorParcela,
            data: dataRef,
            contabilizado: true
          });
        } else if (status === 'PAGO') {
          if (isMesAtual) {
            somaParcelasDivida += valorParcela;
            dividasPagas += valorParcela;
            itensDetalhados.push({
              id: item.id,
              descricao: item.descricao,
              tipo: 'DIVIDA',
              status: 'PAGO',
              valorTotal: valor,
              totalParcelas,
              numeroParcela: item.numero_parcela,
              valorParcela,
              data: dataRef,
              contabilizado: true
            });
          }
        }
      }
    }

    const totalEntradas = Number(somaTotalEntradas.toFixed(2));
    const totalSaidasCalculado = Number((somaTotalSaidas + somaParcelasDivida).toFixed(2));

    return res.status(200).json({
      sucesso: true,
      mes: mesAtual,
      ano: anoAtual,
      totalEntradas,
      totalSaidas: totalSaidasCalculado,
      detalhes: {
        somaEntradas: Number(somaTotalEntradas.toFixed(2)),
        somaSaidas: Number(somaTotalSaidas.toFixed(2)),
        somaParcelasDivida: Number(somaParcelasDivida.toFixed(2)),
        dividasPendentes: Number(dividasPendentes.toFixed(2)),
        dividasPagas: Number(dividasPagas.toFixed(2))
      },
      itens: itensDetalhados
    });
  } catch (error) {
    console.error('Erro ao obter resumo financeiro:', error);
    return res.status(500).json({
      sucesso: false,
      mensagem: 'Erro interno ao consultar resumo financeiro.'
    });
  }
};

const obterVisaoGeralFrota = async (req, res) => {
  try {
    const [{ data: lancamentos, error: erroLanc }, { data: categorias, error: erroCats }, { data: viagens, error: erroViag }] =
      await Promise.all([
        supabase.from('lancamentos_financeiros').select('*'),
        supabase.from('categorias_financeiras').select('*'),
        supabase.from('viagens').select('*')
      ]);

    if (erroLanc) throw erroLanc;
    if (erroCats) throw erroCats;
    if (erroViag) throw erroViag;

    const catMap = Object.fromEntries((categorias || []).map((c) => [c.id, c]));

    const viagensEmAndamento = (viagens || []).filter(
      (v) => (v.status || '').toUpperCase().trim() === 'EM_ANDAMENTO'
    );
    const veiculosEmRota = new Set(
      viagensEmAndamento.map((viagem) => viagem.id_veiculo).filter(Boolean)
    ).size;

    const agora = new Date();
    const diasParam = Math.max(1, parseInt(req.query.dias || req.query.periodo, 10) || 7);
    const seteDiasAtras = new Date(agora.getTime() - diasParam * 24 * 60 * 60 * 1000);
    const seteDiasAtrasStr = seteDiasAtras.toISOString().split('T')[0];

    const todasDespesas = (lancamentos || []).filter((item) => {
      const tipo = (item.tipo || '').toUpperCase().trim();
      const status = (item.status || '').toUpperCase().trim();
      if (tipo === 'DIVIDA') return status === 'PAGO';
      return tipo === 'SAIDA';
    });

    const despesas7Dias = todasDespesas.filter((item) => {
      const dataRef = dataDoLancamento(item);
      if (!dataRef) return false;
      return String(dataRef).split('T')[0] >= seteDiasAtrasStr;
    });

    const despesasBase = despesas7Dias;

    const grupos = {};
    for (const item of despesasBase) {
      const cat = catMap[item.id_categoria];
      let nome = 'Outros';
      if (cat && cat.nome) {
        nome = cat.nome.split('/')[0].trim();
      } 
      // else if(item.descricao){
      //   nome = item.descricao
      // }
      if (nome.length > 18) {
        nome = nome.substring(0, 18).trim() + '...';
      }

      const valor = Number(item.valor) || 0;
      if (!grupos[nome]) {
        grupos[nome] = { nome, valor: 0 };
      }
      grupos[nome].valor += valor;
    }

    const categoriasOrdenadas = Object.values(grupos)
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 5);

    const totalDespesas = despesasBase.reduce((acc, i) => acc + (Number(i.valor) || 0), 0);
    const baseCalculo = totalDespesas > 0 ? totalDespesas : 1;

    const top5 = categoriasOrdenadas.map((cat, idx) => {
      const pctExata = (cat.valor / baseCalculo) * 100;
      return {
        id: idx + 1,
        nome: cat.nome,
        valor: Number(cat.valor.toFixed(2)),
        porcentagem: Math.round(pctExata),
        porcentagemExata: Number(pctExata.toFixed(2))
      };
    });

    // Km rodados e despesas usam o mesmo período para que o custo por km não
    // misture valores recentes com viagens históricas.
    const concluidasPeriodo = viagensConcluidasNoPeriodo(viagens, seteDiasAtrasStr);
    const kmRodados = somarKm(concluidasPeriodo);
    const custoKm = custoPorKm(totalDespesas, kmRodados);

    const kmFormatado = Math.round(kmRodados).toLocaleString('pt-BR');
    const custoKmFormatado = `R$${custoKm.toFixed(2).replace('.', ',')}`;

    res.set('Cache-Control', 'no-store');
    return res.status(200).json({
      sucesso: true,
      periodoDias: diasParam,
      veiculosEmRota,
      kmRodados: arredondar(kmRodados),
      kmRodadosFormatado: kmFormatado,
      custoPorKm: arredondar(custoKm),
      custoPorKmFormatado: custoKmFormatado,
      totalDespesas: Number(totalDespesas.toFixed(2)),
      despesas: top5
    });
  } catch (error) {
    console.error('Erro ao obter visão geral da frota:', error);
    return res.status(500).json({
      sucesso: false,
      mensagem: 'Erro interno ao consultar dados da frota.'
    });
  }
};

export {
  cadastrarTransacao,
  listarParcelasPendentes,
  obterResumoGeral,
  listarAtividadesRecentes,
  obterVisaoGeralFrota
};

export default {
  cadastrarTransacao,
  listarParcelasPendentes,
  obterResumoGeral,
  listarAtividadesRecentes,
  obterVisaoGeralFrota
};
