// Supabase falso em memória, só com o que os controllers usam.
// Serve para testar o backend sem tocar no banco de verdade.
import crypto from 'crypto';

export function criarFakeSupabase(tabelasIniciais = {}) {
  const tabelas = structuredClone(tabelasIniciais);
  const arquivos = {};
  const buckets = new Set();

  const comparar = (a, b) => String(a ?? '').localeCompare(String(b ?? ''));

  function consulta(nome) {
    const filtros = [];
    let acao = 'select';
    let dados = null;
    let ordem = null;
    let limite = null;
    let unico = null;

    const linhas = () => (tabelas[nome] ||= []);
    const passa = (l) => filtros.every((f) => f(l));

    const api = {
      select() { return api; },
      insert(v) { acao = 'insert'; dados = v; return api; },
      update(v) { acao = 'update'; dados = v; return api; },
      delete() { acao = 'delete'; return api; },
      eq(c, v) { filtros.push((l) => l[c] === v); return api; },
      lt(c, v) { filtros.push((l) => Number(l[c]) < Number(v)); return api; },
      in(c, vs) { filtros.push((l) => vs.includes(l[c])); return api; },
      ilike(c, v) { filtros.push((l) => String(l[c] ?? '').toLowerCase() === String(v).toLowerCase()); return api; },
      order(c, o = {}) { ordem = { c, asc: o.ascending !== false }; return api; },
      limit(n) { limite = n; return api; },
      single() { unico = 'single'; return api; },
      maybeSingle() { unico = 'maybe'; return api; },
      then(ok, falha) { return Promise.resolve(executar()).then(ok, falha); },
    };

    function executar() {
      let resultado;
      if (acao === 'insert') {
        const novos = (Array.isArray(dados) ? dados : [dados]).map((d) => ({ id: crypto.randomUUID(), ativo: true, ...d }));
        for (const n of novos) {
          if (nome === 'veiculos' && linhas().some((l) => l.placa === n.placa)) {
            return { data: null, error: { code: '23505', message: 'duplicate key' } };
          }
          if (nome === 'usuarios' && linhas().some((l) => l.email === n.email)) {
            return { data: null, error: { code: '23505', message: 'duplicate key' } };
          }
          if (n.id_local && nome === 'financiamentos' && linhas().some((l) => l.id_usuario === n.id_usuario && l.id_local === n.id_local)) {
            return { data: null, error: { code: '23505', message: 'duplicate key' } };
          }
          if (n.id_local && nome === 'lancamentos_financeiros' && linhas().some((l) => l.id_usuario === n.id_usuario && l.id_local === n.id_local)) {
            return { data: null, error: { code: '23505', message: 'duplicate key' } };
          }
        }
        linhas().push(...novos);
        resultado = novos;
      } else if (acao === 'update') {
        resultado = linhas().filter(passa);
        for (const l of resultado) Object.assign(l, dados);
      } else if (acao === 'delete') {
        resultado = linhas().filter(passa);
        tabelas[nome] = linhas().filter((l) => !passa(l));
      } else {
        resultado = linhas().filter(passa);
      }
      resultado = resultado.map((l) => ({ ...l }));
      if (ordem) resultado.sort((a, b) => (ordem.asc ? 1 : -1) * comparar(a[ordem.c], b[ordem.c]));
      if (limite !== null) resultado = resultado.slice(0, limite);
      if (unico === 'single') {
        return resultado.length === 1
          ? { data: resultado[0], error: null }
          : { data: null, error: { code: 'PGRST116', message: 'not single' } };
      }
      if (unico === 'maybe') return { data: resultado[0] || null, error: null };
      return { data: resultado, error: null };
    }

    return api;
  }

  async function rpc(nomeFuncao, parametros = {}) {
    if (nomeFuncao === 'cadastrar_financiamento_com_parcelas') {
      const {
        p_id_usuario,
        p_descricao,
        p_valor_total,
        p_valor_parcela,
        p_quantidade_parcelas,
        p_data_primeiro_vencimento,
        p_valor_quitacao_antecipada,
        p_credor,
        p_id_categoria,
        p_id_forma_pagamento,
        p_id_viagem,
        p_id_local,
        p_data_lancamento
      } = parametros;

      const fins = (tabelas.financiamentos ||= []);
      const lancs = (tabelas.lancamentos_financeiros ||= []);

      if (p_id_local) {
        const existente = fins.find((f) => f.id_usuario === p_id_usuario && f.id_local === p_id_local);
        if (existente) {
          return {
            data: {
              sucesso: true,
              mensagem: 'Dívida e parcelas já cadastradas anteriormente.',
              financiamentoId: existente.id,
              jaExistente: true
            },
            error: null
          };
        }
      }

      const fid = crypto.randomUUID();
      const novoFin = {
        id: fid,
        descricao: p_descricao,
        valor_total: p_valor_total,
        valor_parcela: p_valor_parcela,
        quantidade_parcelas: p_quantidade_parcelas,
        data_primeiro_vencimento: p_data_primeiro_vencimento,
        valor_quitacao_antecipada: p_valor_quitacao_antecipada || null,
        credor: p_credor || null,
        id_usuario: p_id_usuario,
        id_categoria: p_id_categoria || null,
        id_forma_pagamento: p_id_forma_pagamento || null,
        id_local: p_id_local || null,
        ativo: true,
        criado_em: new Date().toISOString()
      };
      fins.push(novoFin);

      const dataBase = new Date(`${p_data_primeiro_vencimento}T12:00:00`);
      const dataLanc = p_data_lancamento || new Date().toISOString().split('T')[0];

      for (let i = 1; i <= p_quantidade_parcelas; i++) {
        lancs.push({
          id: crypto.randomUUID(),
          descricao: `${p_descricao} Parcela ${i}/${p_quantidade_parcelas}`,
          valor: p_valor_parcela,
          tipo: 'DIVIDA',
          id_categoria: p_id_categoria || null,
          id_forma_pagamento: p_id_forma_pagamento || null,
          id_usuario: p_id_usuario,
          id_viagem: p_id_viagem || null,
          data_lancamento: dataLanc,
          data_vencimento: dataBase.toISOString().split('T')[0],
          status: 'PENDENTE',
          id_financiamento: fid,
          numero_parcela: i,
          total_parcelas: p_quantidade_parcelas,
          ativo: true
        });
        dataBase.setMonth(dataBase.getMonth() + 1);
      }

      return {
        data: {
          sucesso: true,
          mensagem: 'Dívida e parcelas cadastradas com sucesso!',
          financiamentoId: fid,
          jaExistente: false
        },
        error: null
      };
    }

    return { data: null, error: { code: '42883', message: `function ${nomeFuncao} does not exist` } };
  }

  const storage = {
    async getBucket(id) { return { data: buckets.has(id) ? { id } : null, error: null }; },
    async createBucket(id) { buckets.add(id); return { data: { name: id }, error: null }; },
    from(bucket) {
      return {
        async upload(caminho, buffer) { arquivos[`${bucket}/${caminho}`] = buffer; return { data: { path: caminho }, error: null }; },
        async createSignedUrl(caminho) { return { data: { signedUrl: `https://assinado/${bucket}/${caminho}` }, error: null }; },
      };
    },
  };

  return { from: consulta, rpc, storage, tabelas, arquivos, buckets };
}
