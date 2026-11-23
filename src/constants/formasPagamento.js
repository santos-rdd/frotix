



export const TIPOS_FORMA_PAGAMENTO = [
  { id: 'debito', label: 'Cartão de Débito' },
  { id: 'credito', label: 'Cartão de Crédito' },
  { id: 'pix', label: 'Pix' },
  { id: 'boleto', label: 'Boleto' },
  { id: 'dinheiro', label: 'Dinheiro' },
];

export const labelTipo = (tipo) =>
  TIPOS_FORMA_PAGAMENTO.find((t) => t.id === tipo)?.label || 'Outros';


export const descreverForma = (forma) => {
  if (!forma) return '';
  if (forma.nome) return forma.nome;
  if (forma.tipo === 'debito' || forma.tipo === 'credito') {
    return `${labelTipo(forma.tipo)} · ${forma.titular}`;
  }
  if (forma.tipo === 'pix') return forma.chave ? `Pix · ${forma.chave}` : 'Pix';
  return forma.descricao ? `${labelTipo(forma.tipo)} · ${forma.descricao}` : labelTipo(forma.tipo);
};
