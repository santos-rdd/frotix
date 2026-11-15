import supabase from '../database/db.js';

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

    const { data, error } = await supabase
      .from('lancamentos_financeiros')
      .select('*');
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
      mensagem: 'Erro interno ao consultar atividades recentes.',
      erro: error.message
    });
  }
};

const cadastrarTransacao = async (req, res) => {
  try {
    const {
      tipo,
      actionType,
      descricao,
      categoria,
      formaPagamento,
      data,
      clienteOuVeiculo,
      estadoOuStatus,
      credor,
      valorParcela,
      quantidadeParcelas,
      vencimentoPrimeira,
      valorQuitacaoAntecipada,
      anexos
    } = req.body;

    const tipoBruto = tipo || actionType;

    if (!tipoBruto) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'O campo tipo ou actionType é obrigatório.'
      });
    }

    const tipoTransacao = tipoBruto.toUpperCase();
    const usuarioIdFixo = 'cf92dbb6-88d5-4403-8629-f4d52d1fd91f';

    const valorParcelaNum = parseValor(valorParcela);
    const valorQuitacaoNum = parseValor(valorQuitacaoAntecipada);

    let categoriaId = null;
    if (categoria) {
      const { data: catData } = await supabase
        .from('categorias_financeiras')
        .select('id')
        .ilike('nome', categoria)
        .single();

      if (catData) {
        categoriaId = catData.id;
      }
    }

    let formaPagamentoId = null;
    if (formaPagamento) {
      const { data: formaData } = await supabase
        .from('formas_pagamento')
        .select('id')
        .ilike('nome', formaPagamento)
        .single();

      if (formaData) {
        formaPagamentoId = formaData.id;
      }
    }

    const dataAtual = new Date().toISOString().split('T')[0];

    if (tipoTransacao === 'DIVIDA') {
      const primeiraDataValida = vencimentoPrimeira || data || dataAtual;

      const { data: financiamentoCriado, error: erroFinanciamento } = await supabase
        .from('financiamentos')
        .insert([{
          descricao,
          valor_total: valorParcelaNum * (Number(quantidadeParcelas) || 1),
          valor_parcela: valorParcelaNum,
          quantidade_parcelas: Number(quantidadeParcelas) || 1,
          data_primeiro_vencimento: primeiraDataValida,
          valor_quitacao_antecipada: valorQuitacaoAntecipada ? valorQuitacaoNum : null,
          credor: credor || null
        }])
        .select()
        .single();

      if (erroFinanciamento) throw erroFinanciamento;

      const financiamentoId = financiamentoCriado.id;
      const parcelasArray = [];
      const qtd = parseInt(quantidadeParcelas) || 1;
      let dataBase = new Date(primeiraDataValida);

      for (let i = 1; i <= qtd; i++) {
        parcelasArray.push({
          descricao: `${descricao} Parcela ${i}/${qtd}`,
          valor: valorParcelaNum,
          tipo: 'DIVIDA',
          id_categoria: categoriaId,
          id_forma_pagamento: formaPagamentoId,
          id_usuario: usuarioIdFixo,
          id_viagem: null,
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

      if (erroParcelas) throw erroParcelas;

      return res.status(201).json({
        sucesso: true,
        mensagem: 'Dívida e parcelas cadastradas com sucesso!',
        financiamentoId
      });
    }

    const { data: lancamentoCriado, error: erroLancamento } = await supabase
      .from('lancamentos_financeiros')
      .insert([{
        descricao,
        valor: valorParcelaNum,
        tipo: tipoTransacao,
        id_categoria: categoriaId,
        id_forma_pagamento: formaPagamentoId,
        id_usuario: usuarioIdFixo,
        id_viagem: null,
        data_lancamento: data || dataAtual,
        data_vencimento: data || dataAtual,
        status: estadoOuStatus ? estadoOuStatus.toUpperCase() : 'PAGO',
        comprovante_url: anexos?.comprovantes?.[0] || null,
        foto_url: anexos?.fotos?.[0] || null,
        documento_url: anexos?.documentos?.[0] || null
      }])
      .select()
      .single();

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
      mensagem: 'Erro interno ao salvar no banco de dados.',
      erro: error.message
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
    return res.status(500).json({ sucesso: false, erro: error.message });
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
      mensagem: 'Erro interno ao consultar resumo financeiro.',
      erro: error.message
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
    const veiculosEmRota = viagensEmAndamento.length;
    const kmRodados = viagensEmAndamento.reduce(
      (acc, v) => acc + (Number(v.km_inicial) || 0),
      0
    );

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
      const dataRef =
        item.data_lancamento ||
        item.data_pagamento ||
        item.created_at ||
        item.atualizado_em;
      if (!dataRef) return false;
      return String(dataRef).split('T')[0] >= seteDiasAtrasStr;
    });

    const despesasBase = despesas7Dias.length > 0 ? despesas7Dias : todasDespesas;

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

    const somaTop5 = categoriasOrdenadas.reduce((acc, c) => acc + c.valor, 0);
    const totalDespesas = despesasBase.reduce((acc, i) => acc + (Number(i.valor) || 0), 0);
    const baseCalculo = somaTop5 > 0 ? somaTop5 : (totalDespesas > 0 ? totalDespesas : 1);

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

    const isCombustivel = (item) => {
      const cat = catMap[item.id_categoria];
      const catNome = (cat?.nome || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const desc = (item.descricao || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      return catNome.includes('combustivel') || desc.includes('combustivel') || desc.includes('abastecimento');
    };

    const comb7Dias = despesas7Dias.filter(isCombustivel);
    const combGeral = todasDespesas.filter(isCombustivel);
    const combUsado = comb7Dias.length > 0 ? comb7Dias : combGeral;

    const totalCombustivel = combUsado.reduce((acc, item) => acc + (Number(item.valor) || 0), 0);
    const custoPorKm = kmRodados > 0 ? (totalCombustivel / kmRodados) : 0;

    const kmFormatado = Math.round(kmRodados).toLocaleString('pt-BR');
    const custoKmFormatado = `R$${custoPorKm.toFixed(2).replace('.', ',')}`;

    res.set('Cache-Control', 'no-store');
    return res.status(200).json({
      sucesso: true,
      periodoDias: 7,
      veiculosEmRota,
      kmRodados,
      kmRodadosFormatado: kmFormatado,
      totalCombustivel: Number(totalCombustivel.toFixed(2)),
      custoPorKm: Number(custoPorKm.toFixed(2)),
      custoPorKmFormatado: custoKmFormatado,
      totalDespesas: Number(totalDespesas.toFixed(2)),
      despesas: top5
    });
  } catch (error) {
    console.error('Erro ao obter visão geral da frota:', error);
    return res.status(500).json({
      sucesso: false,
      mensagem: 'Erro interno ao consultar dados da frota.',
      erro: error.message
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
