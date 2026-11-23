

import crypto from 'crypto';

export function criarFakeSupabase(tabelasIniciais = {}) {
  const tabelas = structuredClone(tabelasIniciais);
  const arquivos = {};
  const buckets = new Set();
  const errosRpc = new Map();
  const solicitacoesRecuperacao = [];
  const alteracoesSenha = [];

  const comparar = (a, b) => String(a ?? '').localeCompare(String(b ?? ''));
  const compararValores = (a, b) => {
    const dataA = typeof a === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(a) ? Date.parse(a) : NaN;
    const dataB = typeof b === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(b) ? Date.parse(b) : NaN;
    if (Number.isFinite(dataA) && Number.isFinite(dataB)) return dataA - dataB;
    const numeroA = Number(a);
    const numeroB = Number(b);
    if (Number.isFinite(numeroA) && Number.isFinite(numeroB)) return numeroA - numeroB;
    return String(a ?? '').localeCompare(String(b ?? ''));
  };
  const localizarUsuarioAtivo = (id) =>
    (tabelas.usuarios ||= []).find((usuario) => usuario.id === id && usuario.ativo === true);
  const dadosUsuarioSessao = (usuario, sessao) => ({
    status: 'active',
    session_id: sessao.id,
    user_id: usuario.id,
    perfil: usuario.id_perfil,
    nome: usuario.nome,
    email: usuario.email,
    expires_at: sessao.expires_at,
  });

  function consulta(nome) {
    const filtros = [];
    let acao = 'select';
    let dados = null;
    let ordem = null;
    let limite = null;
    let faixa = null;
    let unico = null;
    let conflitoUpsert = [];
    let ignorarDuplicata = false;

    const linhas = () => (tabelas[nome] ||= []);
    const passa = (l) => filtros.every((f) => f(l));

    const api = {
      select() { return api; },
      insert(v) { acao = 'insert'; dados = v; return api; },
      upsert(v, opcoes = {}) {
        acao = 'upsert';
        dados = v;
        conflitoUpsert = String(opcoes.onConflict || '').split(',').map((item) => item.trim());
        ignorarDuplicata = opcoes.ignoreDuplicates === true;
        return api;
      },
      update(v) { acao = 'update'; dados = v; return api; },
      delete() { acao = 'delete'; return api; },
      eq(c, v) { filtros.push((l) => l[c] === v); return api; },
      is(c, v) { filtros.push((l) => l[c] === v); return api; },
      lt(c, v) { filtros.push((l) => compararValores(l[c], v) < 0); return api; },
      lte(c, v) { filtros.push((l) => compararValores(l[c], v) <= 0); return api; },
      gt(c, v) { filtros.push((l) => compararValores(l[c], v) > 0); return api; },
      in(c, vs) { filtros.push((l) => vs.includes(l[c])); return api; },
      ilike(c, v) { filtros.push((l) => String(l[c] ?? '').toLowerCase() === String(v).toLowerCase()); return api; },
      order(c, o = {}) { ordem = { c, asc: o.ascending !== false }; return api; },
      limit(n) { limite = n; return api; },
      range(inicio, fim) { faixa = [inicio, fim]; return api; },
      single() { unico = 'single'; return api; },
      maybeSingle() { unico = 'maybe'; return api; },
      then(ok, falha) { return Promise.resolve(executar()).then(ok, falha); },
    };

    function executar() {
      let resultado;
      let count = null;
      if (acao === 'insert' || acao === 'upsert') {
        const novos = (Array.isArray(dados) ? dados : [dados]).map((d) => ({ id: crypto.randomUUID(), ativo: true, ...d }));
        const inseridos = [];
        const jaExiste = (predicado) => linhas().some(predicado) || inseridos.some(predicado);
        for (const n of novos) {
          if (nome === 'posicoes_viagem' && acao === 'upsert' &&
              conflitoUpsert.includes('id_viagem') &&
              conflitoUpsert.includes('registrada_em') &&
              jaExiste((l) => l.id_viagem === n.id_viagem && l.registrada_em === n.registrada_em)) {
            if (ignorarDuplicata) continue;
            return { data: null, error: { code: '23505', message: 'duplicate key' } };
          }
          if (nome === 'veiculos' && jaExiste((l) => l.placa === n.placa)) {
            return { data: null, error: { code: '23505', message: 'duplicate key' } };
          }
          if (nome === 'usuarios' && jaExiste((l) => l.email === n.email)) {
            return { data: null, error: { code: '23505', message: 'duplicate key' } };
          }
          if (n.id_local && nome === 'financiamentos' && jaExiste((l) => l.id_usuario === n.id_usuario && l.id_local === n.id_local)) {
            return { data: null, error: { code: '23505', message: 'duplicate key' } };
          }
          if (n.id_local && nome === 'lancamentos_financeiros' && jaExiste((l) => l.id_usuario === n.id_usuario && l.id_local === n.id_local)) {
            return { data: null, error: { code: '23505', message: 'duplicate key' } };
          }
          if (nome === 'posicoes_viagem' && jaExiste((l) => l.id === n.id)) {
            return { data: null, error: { code: '23505', message: 'duplicate key' } };
          }
          inseridos.push(n);
        }
        linhas().push(...inseridos);
        resultado = inseridos;
      } else if (acao === 'update') {
        resultado = linhas().filter(passa);
        for (const l of resultado) Object.assign(l, dados);
      } else if (acao === 'delete') {
        resultado = linhas().filter(passa);
        count = resultado.length;
        tabelas[nome] = linhas().filter((l) => !passa(l));
      } else {
        resultado = linhas().filter(passa);
      }
      resultado = resultado.map((l) => ({ ...l }));
      if (ordem) resultado.sort((a, b) => (ordem.asc ? 1 : -1) * comparar(a[ordem.c], b[ordem.c]));
      if (limite !== null) resultado = resultado.slice(0, limite);
      if (faixa) resultado = resultado.slice(faixa[0], faixa[1] + 1);
      if (unico === 'single') {
        return resultado.length === 1
          ? { data: resultado[0], error: null }
          : { data: null, error: { code: 'PGRST116', message: 'not single' } };
      }
      if (unico === 'maybe') return { data: resultado[0] || null, error: null };
      return { data: resultado, error: null, count };
    }

    return api;
  }

  async function rpc(nomeFuncao, parametros = {}) {
    if (errosRpc.has(nomeFuncao)) {
      return { data: null, error: errosRpc.get(nomeFuncao) };
    }

    if (nomeFuncao === 'frotix_criar_sessao') {
      const { p_session_id, p_user_id, p_refresh_token_hash } = parametros;
      const usuario = localizarUsuarioAtivo(p_user_id);
      if (!usuario) return { data: { status: 'user_inactive' }, error: null };
      if (!(tabelas.auth_sessions ||= []).some((sessao) => sessao.id === p_session_id)) {
        const agora = new Date();
        const sessao = {
          id: p_session_id,
          user_id: p_user_id,
          created_at: agora.toISOString(),
          expires_at: new Date(agora.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          revoked_at: null,
          revoke_reason: null,
        };
        tabelas.auth_sessions.push(sessao);
        (tabelas.auth_refresh_tokens ||= []).push({
          id: crypto.randomUUID(),
          session_id: p_session_id,
          token_hash: p_refresh_token_hash,
          issued_at: agora.toISOString(),
          expires_at: sessao.expires_at,
          consumed_at: null,
          revoked_at: null,
        });
        return { data: dadosUsuarioSessao(usuario, sessao), error: null };
      }
      return { data: { status: 'invalid' }, error: null };
    }

    if (nomeFuncao === 'frotix_validar_sessao') {
      const { p_session_id, p_user_id } = parametros;
      const sessao = (tabelas.auth_sessions ||= []).find(
        (item) => item.id === p_session_id && item.user_id === p_user_id
      );
      if (!sessao || sessao.revoked_at || Date.parse(sessao.expires_at) <= Date.now()) {
        return { data: { status: 'invalid' }, error: null };
      }
      const usuario = localizarUsuarioAtivo(p_user_id);
      if (!usuario) {
        const agora = new Date().toISOString();
        sessao.revoked_at ||= agora;
        sessao.revoke_reason ||= 'user_inactive';
        for (const refresh of tabelas.auth_refresh_tokens || []) {
          if (refresh.session_id === sessao.id) refresh.revoked_at ||= agora;
        }
        return { data: { status: 'invalid' }, error: null };
      }
      return { data: dadosUsuarioSessao(usuario, sessao), error: null };
    }

    if (nomeFuncao === 'frotix_rotacionar_refresh') {
      const { p_refresh_token_hash, p_novo_refresh_token_hash } = parametros;
      const refreshTokens = (tabelas.auth_refresh_tokens ||= []);
      const refresh = refreshTokens.find((item) => item.token_hash === p_refresh_token_hash);
      if (!refresh) return { data: { status: 'invalid' }, error: null };

      const sessao = (tabelas.auth_sessions ||= []).find(
        (item) => item.id === refresh.session_id
      );
      if (!sessao) return { data: { status: 'invalid' }, error: null };

      if (refresh.consumed_at) {
        const agora = new Date().toISOString();
        sessao.revoked_at ||= agora;
        sessao.revoke_reason ||= 'refresh_reuse';
        for (const item of refreshTokens) {
          if (item.session_id === sessao.id) item.revoked_at ||= agora;
        }
        return { data: { status: 'reuse' }, error: null };
      }
      if (refresh.revoked_at || sessao.revoked_at) {
        return { data: { status: 'invalid' }, error: null };
      }
      if (Date.parse(sessao.expires_at) <= Date.now() || Date.parse(refresh.expires_at) <= Date.now()) {
        const agora = new Date().toISOString();
        sessao.revoked_at ||= agora;
        sessao.revoke_reason ||= 'expired';
        for (const item of refreshTokens) {
          if (item.session_id === sessao.id) item.revoked_at ||= agora;
        }
        return { data: { status: 'expired' }, error: null };
      }

      const usuario = localizarUsuarioAtivo(sessao.user_id);
      if (!usuario) {
        const agora = new Date().toISOString();
        sessao.revoked_at ||= agora;
        sessao.revoke_reason ||= 'user_inactive';
        for (const item of refreshTokens) {
          if (item.session_id === sessao.id) item.revoked_at ||= agora;
        }
        return { data: { status: 'invalid' }, error: null };
      }

      const agora = new Date().toISOString();
      refresh.consumed_at = agora;
      refreshTokens.push({
        id: crypto.randomUUID(),
        session_id: sessao.id,
        token_hash: p_novo_refresh_token_hash,
        issued_at: agora,
        expires_at: sessao.expires_at,
        consumed_at: null,
        revoked_at: null,
      });
      return { data: dadosUsuarioSessao(usuario, sessao), error: null };
    }

    if (nomeFuncao === 'frotix_revogar_sessao') {
      const { p_session_id, p_user_id } = parametros;
      const sessao = (tabelas.auth_sessions ||= []).find(
        (item) => item.id === p_session_id && item.user_id === p_user_id
      );
      if (sessao) {
        const agora = new Date().toISOString();
        sessao.revoked_at ||= agora;
        sessao.revoke_reason ||= 'logout';
        for (const refresh of tabelas.auth_refresh_tokens || []) {
          if (refresh.session_id === sessao.id) refresh.revoked_at ||= agora;
        }
      }
      return { data: { status: 'revoked' }, error: null };
    }

    if (nomeFuncao === 'frotix_revogar_sessoes_usuario') {
      const { p_user_id } = parametros;
      const agora = new Date().toISOString();
      const sessoesUsuario = (tabelas.auth_sessions ||= []).filter(
        (sessao) => sessao.user_id === p_user_id
      );
      for (const sessao of sessoesUsuario) {
        sessao.revoked_at ||= agora;
        sessao.revoke_reason ||= 'password_reset';
        for (const refresh of tabelas.auth_refresh_tokens || []) {
          if (refresh.session_id === sessao.id) refresh.revoked_at ||= agora;
        }
      }
      return { data: { status: 'revoked' }, error: null };
    }

    if (nomeFuncao === 'cadastrar_financiamento_com_parcelas') {
      const {
        p_id_usuario,
        p_descricao,
        p_valor_total,
        p_valor_parcela,
        p_quantidade_parcelas,
        p_data_primeiro_vencimento,
        p_vencimento_inicial,
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
      const vencimentoInicial = p_data_primeiro_vencimento || p_vencimento_inicial;
      const contratoLegado = p_vencimento_inicial !== undefined;

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
        valor_total: p_valor_total ?? p_valor_parcela * p_quantidade_parcelas,
        valor_parcela: p_valor_parcela,
        quantidade_parcelas: p_quantidade_parcelas,
        data_primeiro_vencimento: vencimentoInicial,
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

      const dataBase = new Date(`${vencimentoInicial}T12:00:00`);
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
        data: contratoLegado ? fid : {
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

  const auth = {
    async resetPasswordForEmail(email, options) {
      solicitacoesRecuperacao.push({ email, options });
      if (email === 'naocadastrado@logfin.com') {
        return { data: {}, error: { status: 404, code: 'user_not_found' } };
      }
      return { data: {}, error: null };
    },
    async verifyOtp({ token_hash, type }) {
      if (token_hash !== 'recovery-token-valido' || type !== 'recovery') {
        return { data: null, error: { status: 403, code: 'otp_expired' } };
      }
      const usuario = (tabelas.usuarios ||= []).find((item) => item.id === 'a0000000-0000-0000-0000-000000000005');
      return {
        data: { user: { id: usuario.id }, session: { user: { id: usuario.id } } },
        error: null,
      };
    },
    async setSession({ access_token, refresh_token }) {
      if (access_token !== 'recovery-access-valido' || refresh_token !== 'recovery-refresh-valido') {
        return { data: null, error: { status: 401, code: 'invalid_token' } };
      }
      return {
        data: {
          user: { id: 'a0000000-0000-0000-0000-000000000005' },
          session: { user: { id: 'a0000000-0000-0000-0000-000000000005' } },
        },
        error: null,
      };
    },
    async updateUser({ password }) {
      alteracoesSenha.push(password);
      return { data: { user: { id: 'a0000000-0000-0000-0000-000000000005' } }, error: null };
    },
    async signInWithPassword({ email, password }) {
      const usuario = (tabelas.usuarios ||= []).find(
        (item) => String(item.email).toLowerCase() === String(email).toLowerCase()
      );
      if (!usuario || password !== 'senha-teste-valida') {
        return { data: null, error: { code: 'invalid_credentials' } };
      }
      return {
        data: {
          user: { id: usuario.id },
          session: {
            access_token: 'supabase-access-test',
            refresh_token: 'supabase-refresh-test',
            expires_at: Math.floor(Date.now() / 1000) + 3600,
          },
        },
        error: null,
      };
    },
  };

  return {
    from: consulta,
    rpc,
    storage,
    auth,
    tabelas,
    arquivos,
    buckets,
    solicitacoesRecuperacao,
    alteracoesSenha,
    setRpcError(nomeFuncao, error) {
      if (error) errosRpc.set(nomeFuncao, error);
      else errosRpc.delete(nomeFuncao);
    },
  };
}
