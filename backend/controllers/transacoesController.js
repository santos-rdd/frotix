import supabase from '../database/db.js';

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
        mensagem: "O campo tipo ou actionType é obrigatório."
      });
    }

    const tipoTransacao = tipoBruto.toUpperCase();
    const usuarioIdFixo = 'cf92dbb6-88d5-4403-8629-f4d52d1fd91f';

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
      // Garante uma data válida caso venha vazia para não estourar o banco de dados
      const primeiraDataValida = vencimentoPrimeira || data || dataAtual;

      const { data: financiamentoCriado, error: erroFinanciamento } = await supabase
        .from('financiamentos')
        .insert([{
          descricao,
          valor_total: Number(valorParcela) * (Number(quantidadeParcelas) || 1),
          valor_parcela: Number(valorParcela),
          quantidade_parcelas: Number(quantidadeParcelas) || 1,
          data_primeiro_vencimento: primeiraDataValida,
          valor_quitacao_antecipada: valorQuitacaoAntecipada ? Number(valorQuitacaoAntecipada) : null,
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
          descricao: `${descricao} - Parcela ${i}/${qtd}`,
          valor: Number(valorParcela),
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
        valor: Number(valorParcela),
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

export default {
  cadastrarTransacao,
  listarParcelasPendentes
};