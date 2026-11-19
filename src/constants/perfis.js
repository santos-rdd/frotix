// Perfis da tabela "perfis" do banco.
export const PERFIS = [
  { id: 1, nome: 'Administrador', cor: '#b22222' },
  { id: 2, nome: 'Gestor de Frota', cor: '#ff8c00' },
  { id: 3, nome: 'Financeiro', cor: '#ffd700' },
  { id: 4, nome: 'Motorista', cor: '#2ecc71' },
];

export const nomePerfil = (id) => PERFIS.find((p) => p.id === Number(id))?.nome || 'Motorista';
export const corPerfil = (id) => PERFIS.find((p) => p.id === Number(id))?.cor || '#2ecc71';
export const idPerfil = (nome) => PERFIS.find((p) => p.nome === nome)?.id || 4;
