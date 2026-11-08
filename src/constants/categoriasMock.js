// Categorias financeiras de exemplo (entidade CATEGORIA), até o backend ficar pronto.
// tipo: 'entrada' | 'saida'

export const categorias = [
  { id: 'c1', nome: 'Frete', tipo: 'entrada' },
  { id: 'c2', nome: 'Serviço Extra', tipo: 'entrada' },
  { id: 'c3', nome: 'Reembolso', tipo: 'entrada' },
  { id: 'c4', nome: 'Combustível', tipo: 'saida' },
  { id: 'c5', nome: 'Manutenção', tipo: 'saida' },
  { id: 'c6', nome: 'Pedágio', tipo: 'saida' },
  { id: 'c7', nome: 'Alimentação', tipo: 'saida' },
];

export const adicionarCategoria = (dados) => {
  const nova = { id: `c${Date.now()}`, ...dados };
  categorias.push(nova);
  return nova;
};

export const removerCategoria = (id) => {
  const indice = categorias.findIndex((c) => c.id === id);
  if (indice >= 0) categorias.splice(indice, 1);
};

// Nomes das categorias de um tipo, com "Outros" no fim (usado no formulário de lançamento).
export const nomesCategorias = (tipo) => [
  ...categorias.filter((c) => c.tipo === tipo).map((c) => c.nome),
  'Outros',
];
