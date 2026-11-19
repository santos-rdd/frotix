// Constantes e funções de apoio das telas de frota (status, formatação, validação).
// Os dados (veículos, rotas, viagens, manutenções) vêm do backend: src/services/frotix.js.

export const STATUS_VEICULO = {
  em_viagem: { label: 'Em viagem', cor: '#38B6E8' },
  disponivel: { label: 'Disponível', cor: '#3B56FF' },
  manutencao: { label: 'Em manutenção', cor: '#D32F2F' },
};

export const STATUS_ROTA = {
  em_transito: { label: 'Em trânsito', cor: '#38B6E8' },
  agendada: { label: 'Agendada', cor: '#A8973A' },
  concluida: { label: 'Concluída', cor: '#1E9E5A' },
};

// Meta mensal de km mostrada no medidor da Home do Gestor.
export const META_KM_MES = 20000;

export const formatarKm = (km) =>
  km === null || km === undefined ? '-' : `${Number(km).toLocaleString('pt-BR')} km`;

export const formatarMoeda = (valor) =>
  `R$ ${Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Placa antiga (ABC-1234) ou Mercosul (ABC1D23), com ou sem hífen.
export const placaValida = (placa) => /^[A-Z]{3}-?\d[A-Z0-9]\d{2}$/.test(placa.toUpperCase());

// Padroniza a placa: maiúsculas e hífen só no padrão antigo (ABC-1234 / ABC1D23).
export const formatarPlaca = (placa) => {
  const limpa = placa.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
  return /^[A-Z]{3}\d{4}$/.test(limpa) ? `${limpa.slice(0, 3)}-${limpa.slice(3)}` : limpa;
};

// Data no formato DD/MM/AAAA, conferindo se o dia existe.
export const dataValida = (texto) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);
  if (!m) return false;
  const [, d, mes, a] = m.map(Number);
  const data = new Date(a, mes - 1, d);
  return data.getFullYear() === a && data.getMonth() === mes - 1 && data.getDate() === d;
};

// Coloca as barras enquanto digita: "08112026" -> "08/11/2026".
export const formatarData = (texto) => {
  const n = texto.replace(/\D/g, '').slice(0, 8);
  if (n.length > 4) return `${n.slice(0, 2)}/${n.slice(2, 4)}/${n.slice(4)}`;
  if (n.length > 2) return `${n.slice(0, 2)}/${n.slice(2)}`;
  return n;
};

// Manutenções / ordens de serviço.
export const TIPOS_MANUTENCAO = [
  { id: 'preventiva', label: 'Preventiva' },
  { id: 'corretiva', label: 'Corretiva' },
  { id: 'troca_oleo', label: 'Troca de óleo' },
  { id: 'pneus', label: 'Pneus' },
  { id: 'freios', label: 'Freios' },
  { id: 'revisao', label: 'Revisão geral' },
];

export const STATUS_MANUTENCAO = {
  agendada: { label: 'Agendada', cor: '#A8973A' },
  em_andamento: { label: 'Em andamento', cor: '#38B6E8' },
  concluida: { label: 'Concluída', cor: '#1E9E5A' },
};

export const labelTipoManutencao = (id) => TIPOS_MANUTENCAO.find((t) => t.id === id)?.label || id;
