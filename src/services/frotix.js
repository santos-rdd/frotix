import { apiJson, apiFetch } from './api.js';

const post = (caminho, body) => apiJson(caminho, { method: 'POST', body });
const query = (params) => {
  const partes = Object.entries(params || {})
    .filter(([, valor]) => valor !== undefined && valor !== null && valor !== '')
    .map(([chave, valor]) => `${encodeURIComponent(chave)}=${encodeURIComponent(valor)}`);
  return partes.length ? `?${partes.join('&')}` : '';
};

export const listarVeiculos = async () => (await apiJson('/frota/veiculos')).veiculos;
export const cadastrarVeiculo = async (dados) => (await post('/frota/veiculos', dados)).veiculo;

export const listarRotas = async () => (await apiJson('/frota/rotas')).rotas;
export const cadastrarRota = async (dados) => (await post('/frota/rotas', dados)).rota;
export const abrirViagem = (rotaId, dados) => post(`/frota/rotas/${rotaId}/abrir`, dados);
export const concluirViagem = (rotaId, hodometroFinal) => post(`/frota/rotas/${rotaId}/concluir`, { hodometroFinal });
export const listarViagensEmAndamento = async () => (await apiJson('/frota/viagens-andamento')).viagens;
export const obterPosicaoViagem = (rotaId) => apiJson(`/frota/rotas/${encodeURIComponent(rotaId)}/posicao`);
export const listarMotoristas = async () => (await apiJson('/frota/motoristas')).motoristas;

export const listarManutencoes = async () => (await apiJson('/frota/manutencoes')).manutencoes; 
export const agendarManutencao = async (dados) => (await post('/frota/manutencoes', dados)).manutencao;
export const avancarManutencao = (id) => post(`/frota/manutencoes/${id}/avancar`);

export const resumoFrota = (dias = 7) => apiJson(`/frota/resumo?dias=${dias}`);
export const relatorio = async (dias) => (await apiJson(`/frota/relatorio?dias=${dias || 'tudo'}`)).relatorio;

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

export const registrarTransacao = (dados) => post('/financeiro/transacoes', dados);
export const listarLancamentos = (filtros) => apiJson(`/financeiro/lancamentos${query(filtros)}`);
export const listarDividas = () => apiJson('/financeiro/dividas');
export const detalharDivida = (id) => apiJson(`/financeiro/dividas/${encodeURIComponent(id)}`);

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
    throw new Error('Sem conexão com o servidor. Verifique a internet e tente de novo.');
  }
  const json = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(json.erro || 'Falha ao enviar o comprovante.');
  return json.caminho;
}
