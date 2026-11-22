const TELAS_MOTORISTA = new Set([
  'HomePage',
  'Viagens',
  'Veiculos',
  'Rotas',
  'DetalhesRota',
  'userProfile',
  'TransactionForm',
  'Extrato',
  'Dividas',
  'DetalheDivida',
]);

export function podeAcessarTela(perfil, tela) {
  if (Number(perfil) !== 4) return true;
  return TELAS_MOTORISTA.has(tela);
}
