// Dados de exemplo das telas do Gestor de Frota.
// O backend de veículos, rotas e viagens ainda não existe; quando existir,
// basta trocar estas constantes por chamadas à API (src/config/api.js).

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

export const veiculos = [
  { id: 'v1', modelo: 'Scania R450', placa: 'ABC-1234', status: 'em_viagem', hodometro: 123456, custoKm: 3.45 },
  { id: 'v2', modelo: 'Volvo FH 540', placa: 'DEF-4567', status: 'disponivel', hodometro: 98210, custoKm: 3.2 },
  { id: 'v3', modelo: 'Mercedes Axor', placa: 'GHI-7890', status: 'manutencao', hodometro: 201330, custoKm: 3.9 },
  { id: 'v4', modelo: 'Scania R450', placa: 'JKL-1122', status: 'em_viagem', hodometro: 154870, custoKm: 3.4 },
  { id: 'v5', modelo: 'Volvo FH 540', placa: 'MNO-3344', status: 'disponivel', hodometro: 67450, custoKm: 3.1 },
  { id: 'v6', modelo: 'Mercedes Axor', placa: 'PQR-5566', status: 'manutencao', hodometro: 188020, custoKm: 3.75 },
  { id: 'v7', modelo: 'Volvo FH 540', placa: 'STU-7788', status: 'disponivel', hodometro: 45900, custoKm: 3.05 },
];

export const rotas = [
  {
    id: 'r1',
    origem: 'Campinas',
    destino: 'São Paulo',
    status: 'concluida',
    veiculoId: 'v2',
    motorista: 'John Wick',
    hodometroInicial: 97800,
    hodometroFinal: 98210,
    dataInicial: '22/09/2026',
    dataFinal: '22/09/2026',
    receita: 5200,
    despesas: [
      { id: 'd1', descricao: 'Diesel', valor: 1850, comprovante: 'Recibo de combustível' },
      { id: 'd2', descricao: 'Pedágio', valor: 270, comprovante: 'Recibo de comprovante' },
    ],
  },
  {
    id: 'r2',
    origem: 'Ribeirão Preto',
    destino: 'Santos',
    status: 'em_transito',
    veiculoId: 'v1',
    motorista: 'John Wick',
    hodometroInicial: 123100,
    hodometroFinal: null,
    dataInicial: '02/11/2026',
    dataFinal: null,
    receita: 6800,
    despesas: [
      { id: 'd3', descricao: 'Diesel', valor: 1240, comprovante: 'Recibo de combustível' },
    ],
  },
  {
    id: 'r3',
    origem: 'Sorocaba',
    destino: 'Curitiba',
    status: 'agendada',
    veiculoId: 'v5',
    motorista: 'Ana Souza',
    hodometroInicial: 67450,
    hodometroFinal: null,
    dataInicial: '05/11/2026',
    dataFinal: null,
    receita: 7400,
    despesas: [
      { id: 'd4', descricao: 'Diesel', valor: 1850, comprovante: 'Recibo de combustível' },
      { id: 'd5', descricao: 'Pedágio', valor: 270, comprovante: 'Recibo de comprovante' },
    ],
  },
  {
    id: 'r4',
    origem: 'Jundiaí',
    destino: 'Belo Horizonte',
    status: 'agendada',
    veiculoId: 'v7',
    motorista: 'Carlos Lima',
    hodometroInicial: 45900,
    hodometroFinal: null,
    dataInicial: '08/11/2026',
    dataFinal: null,
    receita: 8100,
    despesas: [],
  },
];

export const viagens = [
  { id: 't1', rotaId: 'r2', veiculoId: 'v1', motorista: 'John Wick', hodometroInicial: 123100, hodometroFinal: null, status: 'em_andamento' },
  { id: 't2', rotaId: 'r1', veiculoId: 'v2', motorista: 'John Wick', hodometroInicial: 97800, hodometroFinal: 98210, status: 'concluida' },
];

// Indicadores da Home do Gestor (viriam de um endpoint de resumo).
export const resumoFrota = {
  kmRodadosMes: 12480,
  metaKmMes: 20000,
};

export const buscarVeiculo = (id) => veiculos.find((v) => v.id === id);
export const buscarRota = (id) => rotas.find((r) => r.id === id);

export const formatarKm = (km) =>
  km === null || km === undefined ? '-' : `${Number(km).toLocaleString('pt-BR')} km`;

export const formatarMoeda = (valor) =>
  `R$ ${Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ---------------------------------------------------------------------------
// Cadastros feitos no app (ficam na memória até o backend existir).
// As telas de lista releem estes arrays ao ganhar foco.
// ---------------------------------------------------------------------------

// Placa antiga (ABC-1234) ou Mercosul (ABC1D23), com ou sem hífen.
export const placaValida = (placa) => /^[A-Z]{3}-?\d[A-Z0-9]\d{2}$/.test(placa.toUpperCase());

// Padroniza a placa: maiúsculas e hífen só no padrão antigo (ABC-1234 / ABC1D23).
export const formatarPlaca = (placa) => {
  const limpa = placa.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
  return /^[A-Z]{3}\d{4}$/.test(limpa) ? `${limpa.slice(0, 3)}-${limpa.slice(3)}` : limpa;
};

export const adicionarVeiculo = (dados) => {
  const novo = { id: `v${Date.now()}`, status: 'disponivel', custoKm: 0, ...dados };
  veiculos.push(novo);
  return novo;
};

export const adicionarRota = (dados) => {
  const nova = {
    id: `r${Date.now()}`,
    status: 'agendada',
    hodometroFinal: null,
    dataFinal: null,
    despesas: [],
    ...dados,
  };
  rotas.push(nova);
  return nova;
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

export const manutencoes = [
  { id: 'm1', veiculoId: 'v3', tipo: 'freios', data: '04/11/2026', oficina: 'Oficina Central', custo: 2350, observacoes: 'Troca de pastilhas e discos', status: 'em_andamento' },
  { id: 'm2', veiculoId: 'v6', tipo: 'corretiva', data: '06/11/2026', oficina: 'Diesel Truck', custo: 4100, observacoes: 'Vazamento no radiador', status: 'em_andamento' },
  { id: 'm3', veiculoId: 'v2', tipo: 'troca_oleo', data: '15/10/2026', oficina: 'Oficina Central', custo: 680, observacoes: '', status: 'concluida' },
  { id: 'm4', veiculoId: 'v5', tipo: 'revisao', data: '20/11/2026', oficina: 'Concessionária Volvo', custo: 1900, observacoes: 'Revisão dos 70.000 km', status: 'agendada' },
];

export const adicionarManutencao = (dados) => {
  const nova = { id: `m${Date.now()}`, status: 'agendada', ...dados };
  manutencoes.unshift(nova);
  return nova;
};

export const labelTipoManutencao = (id) => TIPOS_MANUTENCAO.find((t) => t.id === id)?.label || id;
