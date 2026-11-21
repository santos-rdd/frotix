// Constantes e formatação do módulo financeiro (extrato, dívidas, estornos).
import { colors } from './theme.js';

export const STATUS_DIVIDA = {
  em_dia: { label: 'Em dia', cor: '#3B56FF' },
  atrasada: { label: 'Atrasada', cor: '#D32F2F' },
  quitada: { label: 'Quitada', cor: '#1E9E5A' },
  cancelada: { label: 'Cancelada', cor: '#6B7280' },
};

export const STATUS_LANCAMENTO = {
  pago: { label: 'Pago', cor: '#1E9E5A' },
  pendente: { label: 'Pendente', cor: '#A8973A' },
  cancelado: { label: 'Estornado', cor: '#6B7280' },
};

export const TIPOS_LANCAMENTO = {
  entrada: { label: 'Entrada', cor: colors.greenSuccess, sinal: '+' },
  saida: { label: 'Saída', cor: colors.redDanger, sinal: '-' },
  divida: { label: 'Parcela', cor: colors.redDanger, sinal: '-' },
};

/** "2026-11-21" -> "21/11/2026" */
export const dataIsoParaBr = (iso) => {
  if (!iso) return '--/--/----';
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
};

/** "21/11/2026" -> "2026-11-21" (null se inválida) */
export const dataBrParaIso = (texto) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(texto || '').trim());
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
};

/** Data de hoje em AAAA-MM-DD no fuso do aparelho. */
export const hojeIsoLocal = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};

/** Primeiro dia de N dias atrás (AAAA-MM-DD). */
export const diasAtrasIso = (dias) => {
  const d = new Date(Date.now() - dias * 86400000);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};
