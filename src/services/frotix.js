// Chamadas ao backend usadas pelas telas. Substituem os antigos *Mock.js.
import { apiJson, apiFetch, erroSemConexao } from './api.js';

const post = (caminho, body) => apiJson(caminho, { method: 'POST', body });
const put = (caminho, body) => apiJson(caminho, { method: 'PUT', body });
const del = (caminho) => apiJson(caminho, { method: 'DELETE' });
const query = (params) => {
  const partes = Object.entries(params || {})
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  return partes.length ? `?${partes.join('&')}` : '';
};

// Frota ------------------------------------------------------------------------
export const listarVeiculos = async () => (await apiJson('/frota/veiculos')).veiculos;
export const cadastrarVeiculo = async (dados) => (await post('/frota/veiculos', dados)).veiculo;
export const editarVeiculo = async (id, dados) => (await put(`/frota/veiculos/${id}`, dados)).veiculo;
export const desativarVeiculo = (id) => del(`/frota/veiculos/${id}`);

export const listarRotas = async () => (await apiJson('/frota/rotas')).rotas;
export const cadastrarRota = async (dados) => (await post('/frota/rotas', dados)).rota;
export const editarRota = async (id, dados) => (await put(`/frota/rotas/${id}`, dados)).rota;
export const excluirRota = (id) => del(`/frota/rotas/${id}`);
export const abrirViagem = (rotaId, dados) => post(`/frota/rotas/${rotaId}/abrir`, dados);
export const concluirViagem = (rotaId, hodometroFinal) => post(`/frota/rotas/${rotaId}/concluir`, { hodometroFinal });
export const listarViagensEmAndamento = async () => (await apiJson('/frota/viagens-andamento')).viagens;
export const listarMotoristas = async () => (await apiJson('/frota/motoristas')).motoristas;

export const listarManutencoes = async () => (await apiJson('/frota/manutencoes')).manutencoes;
export const agendarManutencao = async (dados) => (await post('/frota/manutencoes', dados)).manutencao;
export const avancarManutencao = (id) => post(`/frota/manutencoes/${id}/avancar`);
export const editarManutencao = async (id, dados) => (await put(`/frota/manutencoes/${id}`, dados)).manutencao;
export const excluirManutencao = (id) => del(`/frota/manutencoes/${id}`);

export const listarAbastecimentos = (veiculoId) => apiJson(`/frota/abastecimentos${query({ veiculoId })}`);
export const registrarAbastecimento = (dados) => post('/frota/abastecimentos', dados);

export const resumoFrota = (dias = 7) => apiJson(`/frota/resumo?dias=${dias}`);
export const relatorio = async (dias) => (await apiJson(`/frota/relatorio?dias=${dias || 'tudo'}`)).relatorio;

// Cadastros --------------------------------------------------------------------
export const listarCategorias = async () => (await apiJson('/categorias')).categorias;
export const criarCategoria = async (nome, tipo) => (await post('/categorias', { nome, tipo })).categoria;
export const removerCategoria = (id) => apiJson(`/categorias/${id}`, { method: 'DELETE' });

export const listarFormas = async () => (await apiJson('/formas-pagamento')).formas;
export const criarForma = async (dados) => (await post('/formas-pagamento', dados)).forma;
export const removerForma = (id) => apiJson(`/formas-pagamento/${id}`, { method: 'DELETE' });

export const listarUsuarios = async () => (await apiJson('/usuarios')).usuarios;
export const criarUsuarioGoogle = async (dados) => (await post('/usuarios/google', dados)).usuario;
export const criarUsuarioEmail = (dados) => post('/auth/cadastro', dados);
export const reenviarConfirmacao = (email) => post('/auth/reenviar-confirmacao', { email });
export const atualizarUsuario = async (id, dados) => (await apiJson(`/usuarios/${id}`, { method: 'PUT', body: dados })).usuario;
export const desativarUsuario = (id) => apiJson(`/usuarios/${id}`, { method: 'DELETE' });

// Financeiro -------------------------------------------------------------------
export const registrarTransacao = (dados) => post('/financeiro/transacoes', dados);

/** Extrato. filtros: { inicio, fim, tipo, status, idCategoria, idViagem, busca, pagina, limite } */
export const listarLancamentos = (filtros) => apiJson(`/financeiro/lancamentos${query(filtros)}`);
export const estornarLancamento = (id, motivo) => post(`/financeiro/lancamentos/${id}/estornar`, { motivo });
export const pagarLancamento = (id, data) => post(`/financeiro/lancamentos/${id}/pagar`, data ? { data } : {});
export const desfazerPagamento = (id) => post(`/financeiro/lancamentos/${id}/desfazer-pagamento`);

export const listarViagensVinculo = async () => (await apiJson('/financeiro/viagens-vinculo')).viagens;

export const listarDividas = () => apiJson('/financeiro/dividas');
export const detalharDivida = async (id) => (await apiJson(`/financeiro/dividas/${id}`)).divida;
export const cancelarDivida = (id, motivo) => post(`/financeiro/dividas/${id}/cancelar`, { motivo });

export const previsaoCaixa = async (meses = 6) => (await apiJson(`/financeiro/previsao?meses=${meses}`)).previsao;
export const fluxoMensal = async (meses = 6) => (await apiJson(`/financeiro/fluxo-mensal?meses=${meses}`)).meses;
export const listarAlertas = async () => (await apiJson('/alertas')).alertas;

/** Link temporário (10 min) para abrir um comprovante salvo no Storage. */
export const linkComprovante = async (caminho) => (await apiJson(`/comprovantes/link${query({ caminho })}`)).url;

/**
 * Envia um arquivo (foto ou PDF) para o Storage e devolve o caminho salvo.
 * arquivo: { uri, name?, mimeType? } (como vem do ImagePicker / DocumentPicker).
 */
export async function enviarComprovante(arquivo, idLancamento) {
  const nome = arquivo.name || arquivo.fileName || arquivo.uri.split('/').pop() || 'comprovante.jpg';
  const extensao = (/\.(\w+)$/.exec(nome)?.[1] || 'jpg').toLowerCase();
  const tipos = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', pdf: 'application/pdf' };

  const form = new FormData();
  form.append('comprovante', { uri: arquivo.uri, name: nome, type: arquivo.mimeType || tipos[extensao] || 'image/jpeg' });
  if (idLancamento) form.append('idLancamento', idLancamento);

  let resposta;
  try {
    resposta = await apiFetch('/comprovantes/upload', { method: 'POST', body: form });
  } catch {
    throw erroSemConexao();
  }
  const json = await resposta.json().catch(() => ({}));
  if (resposta.status >= 502 && resposta.status <= 504) throw erroSemConexao();
  if (!resposta.ok) throw new Error(json.erro || 'Falha ao enviar o comprovante.');
  return json.caminho;
}
