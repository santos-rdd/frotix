// Formas de pagamento de exemplo, usadas enquanto o backend (FORMA_PAGAMENTO) não está ligado.
// tipo: 'debito' | 'credito' | 'pix' | 'boleto' | 'dinheiro'

export const TIPOS_FORMA_PAGAMENTO = [
  { id: 'debito', label: 'Cartão de Débito' },
  { id: 'credito', label: 'Cartão de Crédito' },
  { id: 'pix', label: 'Pix' },
  { id: 'boleto', label: 'Boleto' },
  { id: 'dinheiro', label: 'Dinheiro' },
];

export const formasPagamentoIniciais = [
  { id: '1', tipo: 'debito', titular: 'Suzane', validade: '12/28' },
  { id: '2', tipo: 'debito', titular: 'Joy Laroy', validade: '12/27' },
  { id: '3', tipo: 'pix', chave: 'financeiro@frotix.com' },
];

export const labelTipo = (tipo) =>
  TIPOS_FORMA_PAGAMENTO.find((t) => t.id === tipo)?.label || 'Outros';

// Texto curto que identifica a forma de pagamento (usado nas listas e no formulário).
export const descreverForma = (forma) => {
  if (!forma) return '';
  if (forma.tipo === 'debito' || forma.tipo === 'credito') {
    return `${labelTipo(forma.tipo)} · ${forma.titular}`;
  }
  if (forma.tipo === 'pix') return forma.chave ? `Pix · ${forma.chave}` : 'Pix';
  return forma.descricao ? `${labelTipo(forma.tipo)} · ${forma.descricao}` : labelTipo(forma.tipo);
};
