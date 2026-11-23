import supabase from '../database/db.js';

const RETENCAO_DIAS = 90;
const TAMANHO_LOTE = 500;
const INTERVALO_LIMPEZA_MS = 24 * 60 * 60 * 1000;

export async function limparPosicoesGpsAntigas(agora = new Date()) {
  const limite = new Date(agora.getTime() - RETENCAO_DIAS * 24 * 60 * 60 * 1000).toISOString();
  const { data: viagensAtivas, error: erroViagens } = await supabase
    .from('viagens')
    .select('id')
    .eq('status', 'EM_ANDAMENTO');
  if (erroViagens) throw erroViagens;

  const viagensAtivasIds = new Set((viagensAtivas || []).map((viagem) => viagem.id));
  let cursor = null;
  let removidas = 0;

  while (true) {
    let consulta = supabase
      .from('posicoes_viagem')
      .select('id, id_viagem')
      .lt('registrada_em', limite)
      .order('id', { ascending: true })
      .limit(TAMANHO_LOTE);

    if (cursor) consulta = consulta.gt('id', cursor);
    const { data: lote, error } = await consulta;
    if (error) throw error;
    if (!lote?.length) break;

    cursor = lote[lote.length - 1].id;
    const idsRemoviveis = lote
      .filter((posicao) => !viagensAtivasIds.has(posicao.id_viagem))
      .map((posicao) => posicao.id);

    if (idsRemoviveis.length > 0) {
      const { error: erroExclusao, count } = await supabase
        .from('posicoes_viagem')
        .delete({ count: 'exact' })
        .in('id', idsRemoviveis);
      if (erroExclusao) throw erroExclusao;
      removidas += count ?? idsRemoviveis.length;
    }

    if (lote.length < TAMANHO_LOTE) break;
  }

  return removidas;
}

export function iniciarRotinaRetencaoPosicoes() {
  let ativa = true;
  const executar = async () => {
    if (!ativa) return;
    try {
      const removidas = await limparPosicoesGpsAntigas();
      if (removidas > 0) console.info(`Retenção GPS: ${removidas} posições antigas removidas.`);
    } catch (erro) {
      console.error('Falha ao executar a retenção de posições GPS:', erro);
    }
  };

  executar();
  const timer = setInterval(executar, INTERVALO_LIMPEZA_MS);
  timer.unref?.();

  return () => {
    ativa = false;
    clearInterval(timer);
  };
}
