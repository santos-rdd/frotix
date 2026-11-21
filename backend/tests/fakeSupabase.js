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
      neq(c, v) { filtros.push((l) => l[c] !== v); return api; },
      gte(c, v) { filtros.push((l) => String(l[c] ?? '') >= String(v)); return api; },
      lte(c, v) { filtros.push((l) => String(l[c] ?? '') <= String(v)); return api; },
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

  return { from: consulta, storage, tabelas, arquivos, buckets };
}
