import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Alert, Modal, Linking, ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import ScreenHeader from '../../components/screenHeader/screenHeader.js';
import VoltarButton from '../../components/voltarButton/voltarButton.js';
import BottomNavigation from '../../components/bottomNavigation/bottomNavigation.js';
import EstadoDados from '../../components/estadoDados/estadoDados.js';
import ModalMotivo from '../../components/modalMotivo/modalMotivo.js';
import { colors } from '../../constants/theme.js';
import { formatarMoeda } from '../../constants/frota.js';
import { STATUS_LANCAMENTO, TIPOS_LANCAMENTO, dataIsoParaBr, diasAtrasIso } from '../../constants/financeiro.js';
import {
  listarLancamentos, estornarLancamento, pagarLancamento, desfazerPagamento, linkComprovante,
} from '../../services/frotix.js';
import useDados from '../../hooks/useDados.js';

const PERIODOS = [
  { id: '7', label: '7 dias', dias: 7 },
  { id: '30', label: '30 dias', dias: 30 },
  { id: '90', label: '90 dias', dias: 90 },
  { id: 'tudo', label: 'Tudo', dias: null },
];
const TIPOS = [
  { id: '', label: 'Todos' },
  { id: 'entrada', label: 'Entradas' },
  { id: 'saida', label: 'Saídas' },
  { id: 'divida', label: 'Parcelas' },
];
const STATUS = [
  { id: '', label: 'Todos' },
  { id: 'pago', label: 'Pagos' },
  { id: 'pendente', label: 'Pendentes' },
  { id: 'cancelado', label: 'Estornados' },
];
const PASSO = 30;

function Chips({ opcoes, valor, onSelecionar }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {opcoes.map((o) => (
        <TouchableOpacity key={o.id} style={[styles.chip, valor === o.id && styles.chipAtivo]} onPress={() => onSelecionar(o.id)}>
          <Text style={[styles.chipTexto, valor === o.id && styles.chipTextoAtivo]}>{o.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

/**
 * Extrato de lançamentos com filtros (período, tipo, status, busca).
 * Admin e Financeiro veem todos e podem estornar, pagar e desfazer pagamento.
 * Os outros perfis veem só os próprios lançamentos (o backend filtra).
 * params: filtroStatus, idViagem (abre já filtrado), titulo.
 */
export default function Extrato({ navigation, route }) {
  const usuario = route?.params?.usuario;
  const idViagem = route?.params?.idViagem || null;
  const podeAlterar = usuario?.role === 1 || usuario?.role === 3;

  const [periodo, setPeriodo] = useState(idViagem ? 'tudo' : '30');
  const [tipo, setTipo] = useState('');
  const [status, setStatus] = useState(route?.params?.filtroStatus || '');
  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [limite, setLimite] = useState(PASSO);
  const [selecionado, setSelecionado] = useState(null);
  const [estornando, setEstornando] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const dias = PERIODOS.find((p) => p.id === periodo)?.dias;
  const { dados, carregando, erro, recarregar } = useDados(() =>
    listarLancamentos({
      inicio: dias ? diasAtrasIso(dias) : undefined,
      tipo,
      status,
      busca: buscaAplicada,
      idViagem,
      limite,
    })
  );

  // Recarrega quando muda um filtro (o useDados já recarrega ao voltar para a tela).
  const primeira = useRef(true);
  useEffect(() => {
    if (primeira.current) {
      primeira.current = false;
      return;
    }
    recarregar();
  }, [periodo, tipo, status, buscaAplicada, limite, recarregar]);

  const lancamentos = dados?.lancamentos || [];
  const totais = dados?.totais || { entradas: 0, saidas: 0 };
  const total = dados?.total || 0;

  const trocar = (setter) => (valor) => {
    setLimite(PASSO);
    setter(valor);
  };

  const acao = async (fn, mensagem) => {
    setOcupado(true);
    try {
      await fn();
      setSelecionado(null);
      await recarregar();
      if (mensagem) Alert.alert(mensagem);
    } catch (e) {
      Alert.alert('Não foi possível concluir', e.message);
    } finally {
      setOcupado(false);
    }
  };

  const abrirComprovante = async (caminho) => {
    try {
      const url = /^https?:/i.test(caminho) ? caminho : await linkComprovante(caminho);
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert('Não foi possível abrir o comprovante', e.message);
    }
  };

  const confirmarEstorno = async (motivo) => {
    await acao(async () => {
      await estornarLancamento(selecionado.id, motivo);
      setEstornando(false);
    }, 'Lançamento estornado');
  };

  const linhaDetalhe = (rotulo, valor) =>
    valor ? (
      <View style={styles.detalheLinha}>
        <Text style={styles.detalheRotulo}>{rotulo}</Text>
        <Text style={styles.detalheValor}>{valor}</Text>
      </View>
    ) : null;

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
        <ScreenHeader usuario={usuario} titulo={route?.params?.titulo || (podeAlterar ? 'Extrato' : 'Meus lançamentos')} />

        {!idViagem ? <Chips opcoes={PERIODOS} valor={periodo} onSelecionar={trocar(setPeriodo)} /> : null}
        <Chips opcoes={TIPOS} valor={tipo} onSelecionar={trocar(setTipo)} />
        <Chips opcoes={STATUS} valor={status} onSelecionar={trocar(setStatus)} />

        <View style={styles.busca}>
          <Feather name="search" size={18} color="#888" />
          <TextInput
            style={styles.buscaInput}
            value={busca}
            onChangeText={setBusca}
            onSubmitEditing={() => { setLimite(PASSO); setBuscaAplicada(busca.trim()); }}
            onEndEditing={() => { if (busca.trim() !== buscaAplicada) { setLimite(PASSO); setBuscaAplicada(busca.trim()); } }}
            placeholder="Buscar pela descrição..."
            placeholderTextColor="#888"
            returnKeyType="search"
          />
        </View>

        <View style={styles.totais}>
          <View style={styles.total}>
            <Text style={styles.totalRotulo}>Entradas</Text>
            <Text style={[styles.totalValor, { color: colors.greenSuccess }]}>{formatarMoeda(totais.entradas)}</Text>
          </View>
          <View style={styles.total}>
            <Text style={styles.totalRotulo}>Saídas</Text>
            <Text style={[styles.totalValor, { color: colors.redDanger }]}>{formatarMoeda(totais.saidas)}</Text>
          </View>
        </View>
        <Text style={styles.nota}>{total} lançamento(s). Estornados não entram nos totais.</Text>

        <EstadoDados carregando={carregando} erro={erro} onTentarDeNovo={recarregar} temDados={lancamentos.length > 0} />

        {lancamentos.map((l) => {
          const t = TIPOS_LANCAMENTO[l.tipo] || TIPOS_LANCAMENTO.saida;
          const st = STATUS_LANCAMENTO[l.status] || STATUS_LANCAMENTO.pago;
          const estornado = l.status === 'cancelado';
          return (
            <TouchableOpacity key={l.id} style={styles.item} onPress={() => setSelecionado(l)} activeOpacity={0.8}>
              <View style={[styles.icone, { backgroundColor: estornado ? '#333' : t.cor }]}>
                <Feather name={l.tipo === 'entrada' ? 'arrow-down-left' : 'arrow-up-right'} size={16} color="#FFF" />
              </View>
              <View style={styles.flex}>
                <Text style={[styles.itemTitulo, estornado && styles.riscado]} numberOfLines={1}>{l.descricao}</Text>
                <Text style={styles.itemSub} numberOfLines={1}>
                  {dataIsoParaBr(l.data)} · {l.categoria}{l.parcela ? ` · ${l.parcela}` : ''}
                </Text>
              </View>
              <View style={styles.itemDireita}>
                <Text style={[styles.itemValor, { color: estornado ? '#888' : t.cor }, estornado && styles.riscado]}>
                  {t.sinal} {formatarMoeda(l.valor)}
                </Text>
                <Text style={[styles.itemStatus, { color: st.cor }]}>{st.label}</Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {lancamentos.length === 0 && !carregando && !erro ? <Text style={styles.vazio}>Nenhum lançamento neste filtro.</Text> : null}

        {lancamentos.length < total ? (
          <TouchableOpacity style={styles.maisBotao} onPress={() => setLimite(limite + PASSO)} disabled={carregando}>
            {carregando ? <ActivityIndicator color="#FFF" /> : <Text style={styles.maisTexto}>Carregar mais</Text>}
          </TouchableOpacity>
        ) : null}

        <VoltarButton navigation={navigation} />
      </ScrollView>

      <Modal visible={Boolean(selecionado) && !estornando} transparent animationType="slide" onRequestClose={() => setSelecionado(null)}>
        <TouchableOpacity style={styles.modalFundo} activeOpacity={1} onPress={() => setSelecionado(null)}>
          <TouchableOpacity activeOpacity={1} style={styles.modal}>
            {selecionado ? (
              <>
                <Text style={styles.modalTitulo}>{selecionado.descricao}</Text>
                <Text style={[styles.modalValor, { color: (TIPOS_LANCAMENTO[selecionado.tipo] || TIPOS_LANCAMENTO.saida).cor }]}>
                  {formatarMoeda(selecionado.valor)}
                </Text>
                {linhaDetalhe('Tipo', (TIPOS_LANCAMENTO[selecionado.tipo] || {}).label)}
                {linhaDetalhe('Status', (STATUS_LANCAMENTO[selecionado.status] || {}).label)}
                {linhaDetalhe('Categoria', selecionado.categoria)}
                {linhaDetalhe('Forma de pagamento', selecionado.formaPagamento)}
                {linhaDetalhe('Data', dataIsoParaBr(selecionado.data))}
                {linhaDetalhe('Vencimento', selecionado.vencimento ? dataIsoParaBr(selecionado.vencimento) : null)}
                {linhaDetalhe('Pago em', selecionado.pagamento ? dataIsoParaBr(selecionado.pagamento) : null)}
                {linhaDetalhe('Parcela', selecionado.parcela)}
                {linhaDetalhe('Viagem', selecionado.viagem?.label)}
                {linhaDetalhe('Registrado por', selecionado.usuario)}
                {selecionado.cancelamento ? (
                  <View style={styles.estornoCaixa}>
                    <Text style={styles.estornoTitulo}>Estornado</Text>
                    <Text style={styles.estornoTexto}>Motivo: {selecionado.cancelamento.motivo || '-'}</Text>
                    {selecionado.cancelamento.por ? <Text style={styles.estornoTexto}>Por: {selecionado.cancelamento.por}</Text> : null}
                  </View>
                ) : null}

                <View style={styles.modalAcoes}>
                  {selecionado.comprovante ? (
                    <TouchableOpacity style={styles.modalBotao} onPress={() => abrirComprovante(selecionado.comprovante)}>
                      <Feather name="paperclip" size={16} color="#121212" />
                      <Text style={styles.modalBotaoTexto}>Ver comprovante</Text>
                    </TouchableOpacity>
                  ) : null}
                  {podeAlterar && selecionado.status === 'pendente' ? (
                    <TouchableOpacity style={styles.modalBotao} disabled={ocupado} onPress={() => acao(() => pagarLancamento(selecionado.id), 'Pagamento registrado')}>
                      <Feather name="check" size={16} color="#121212" />
                      <Text style={styles.modalBotaoTexto}>{selecionado.tipo === 'entrada' ? 'Marcar como recebido' : 'Marcar como pago'}</Text>
                    </TouchableOpacity>
                  ) : null}
                  {podeAlterar && selecionado.status === 'pago' && selecionado.tipo !== 'divida' ? (
                    <TouchableOpacity style={styles.modalBotao} disabled={ocupado} onPress={() => acao(() => desfazerPagamento(selecionado.id), 'Pagamento desfeito')}>
                      <Feather name="corner-up-left" size={16} color="#121212" />
                      <Text style={styles.modalBotaoTexto}>Voltar para pendente</Text>
                    </TouchableOpacity>
                  ) : null}
                  {podeAlterar && selecionado.status !== 'cancelado' && !selecionado.idFinanciamento ? (
                    <TouchableOpacity style={[styles.modalBotao, styles.modalBotaoPerigo]} disabled={ocupado} onPress={() => setEstornando(true)}>
                      <Feather name="rotate-ccw" size={16} color="#FFF" />
                      <Text style={[styles.modalBotaoTexto, styles.textoClaro]}>Estornar</Text>
                    </TouchableOpacity>
                  ) : null}
                  {podeAlterar && selecionado.idFinanciamento ? (
                    <TouchableOpacity
                      style={styles.modalBotao}
                      onPress={() => { const id = selecionado.idFinanciamento; setSelecionado(null); navigation.navigate('DetalheDivida', { usuario, id }); }}
                    >
                      <Feather name="layers" size={16} color="#121212" />
                      <Text style={styles.modalBotaoTexto}>Abrir a dívida</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                {ocupado ? <ActivityIndicator color="#FFF" style={styles.ocupado} /> : null}
              </>
            ) : null}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <ModalMotivo
        visivel={estornando}
        titulo="Estornar lançamento"
        descricao="O lançamento não é apagado: fica marcado como estornado e sai de todos os totais."
        confirmarLabel="Estornar"
        onCancelar={() => setEstornando(false)}
        onConfirmar={confirmarEstorno}
      />

      <BottomNavigation navigation={navigation} userRole={usuario?.role} usuario={usuario} />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.background },
  conteudo: { paddingBottom: 150 },
  chips: { paddingHorizontal: 16, gap: 8, paddingBottom: 10 },
  chip: { borderWidth: 1, borderColor: colors.primaryBlue, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 6 },
  chipAtivo: { backgroundColor: colors.primaryBlue },
  chipTexto: { color: '#DDD', fontSize: 13 },
  chipTextoAtivo: { color: '#FFF', fontWeight: '700' },
  busca: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginTop: 4,
    height: 46,
  },
  buscaInput: { flex: 1, color: '#FFF', fontSize: 14 },
  totais: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 14 },
  total: { flex: 1, backgroundColor: colors.cardBg, borderRadius: 12, padding: 12 },
  totalRotulo: { color: colors.textMuted, fontSize: 12 },
  totalValor: { fontSize: 16, fontWeight: '700', marginTop: 2 },
  nota: { color: colors.textMuted, fontSize: 11, marginHorizontal: 18, marginTop: 6, marginBottom: 12 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  icone: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  itemTitulo: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  itemSub: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  itemDireita: { alignItems: 'flex-end' },
  itemValor: { fontSize: 14, fontWeight: '700' },
  itemStatus: { fontSize: 11, marginTop: 2 },
  riscado: { textDecorationLine: 'line-through' },
  vazio: { color: colors.textMuted, textAlign: 'center', marginVertical: 20 },
  maisBotao: { borderWidth: 1, borderColor: '#FFF', borderRadius: 20, paddingVertical: 10, alignItems: 'center', marginHorizontal: 80, marginTop: 8 },
  maisTexto: { color: '#FFF', fontWeight: '600' },
  modalFundo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.cardBg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },
  modalTitulo: { color: '#FFF', fontSize: 17, fontWeight: '700' },
  modalValor: { fontSize: 24, fontWeight: '700', marginTop: 4, marginBottom: 12 },
  detalheLinha: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  detalheRotulo: { color: colors.textMuted, fontSize: 13 },
  detalheValor: { color: '#FFF', fontSize: 13, flexShrink: 1, textAlign: 'right', marginLeft: 12 },
  estornoCaixa: { backgroundColor: '#2A2A2A', borderRadius: 10, padding: 10, marginTop: 12 },
  estornoTitulo: { color: '#FF8A80', fontSize: 13, fontWeight: '700' },
  estornoTexto: { color: '#DDD', fontSize: 12, marginTop: 2 },
  modalAcoes: { gap: 10, marginTop: 18 },
  modalBotao: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: '#E5E7EB', borderRadius: 24, height: 48 },
  modalBotaoPerigo: { backgroundColor: '#B71C1C' },
  modalBotaoTexto: { color: '#121212', fontSize: 14, fontWeight: '700' },
  textoClaro: { color: '#FFF' },
  ocupado: { marginTop: 12 },
});
