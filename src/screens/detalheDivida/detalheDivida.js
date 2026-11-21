import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';

import BottomNavigation from '../../components/bottomNavigation/bottomNavigation.js';
import EstadoDados from '../../components/estadoDados/estadoDados.js';
import ModalMotivo from '../../components/modalMotivo/modalMotivo.js';
import { colors } from '../../constants/theme.js';
import { formatarMoeda } from '../../constants/frota.js';
import { STATUS_DIVIDA, STATUS_LANCAMENTO, dataIsoParaBr } from '../../constants/financeiro.js';
import { detalharDivida, pagarLancamento, desfazerPagamento, cancelarDivida } from '../../services/frotix.js';
import useDados from '../../hooks/useDados.js';

/**
 * Detalhe de uma dívida (params.id): parcelas com "Pagar" e "Desfazer pagamento",
 * e "Cancelar dívida" (rollback: as parcelas pendentes ficam canceladas, as pagas ficam no histórico).
 */
export default function DetalheDivida({ navigation, route }) {
  const usuario = route?.params?.usuario;
  const id = route?.params?.id;
  const carregar = useCallback(() => detalharDivida(id), [id]);
  const { dados: divida, carregando, erro, recarregar } = useDados(carregar);
  const [ocupado, setOcupado] = useState(null); // id da parcela em andamento
  const [cancelando, setCancelando] = useState(false);

  const executar = async (parcela, acao) => {
    if (ocupado) return;
    setOcupado(parcela.id);
    try {
      await acao();
      await recarregar();
    } catch (e) {
      Alert.alert('Não foi possível concluir', e.message);
    } finally {
      setOcupado(null);
    }
  };

  const pagar = (parcela) => {
    Alert.alert('Pagar parcela', `Registrar o pagamento da parcela ${parcela.parcela} (${formatarMoeda(parcela.valor)}) com a data de hoje?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Pagar', onPress: () => executar(parcela, () => pagarLancamento(parcela.id)) },
    ]);
  };

  const desfazer = (parcela) => {
    Alert.alert('Desfazer pagamento', `A parcela ${parcela.parcela} volta a ficar pendente.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Desfazer', style: 'destructive', onPress: () => executar(parcela, () => desfazerPagamento(parcela.id)) },
    ]);
  };

  const confirmarCancelamento = async (motivo) => {
    try {
      const r = await cancelarDivida(id, motivo);
      setCancelando(false);
      Alert.alert('Dívida cancelada', r.mensagem);
      await recarregar();
    } catch (e) {
      Alert.alert('Não foi possível cancelar', e.message);
    }
  };

  const status = divida ? STATUS_DIVIDA[divida.status] : null;
  const podeCancelar = divida && (divida.status === 'em_dia' || divida.status === 'atrasada');

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.conteudo}>
        <View style={styles.topo}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
            <Feather name="chevron-left" size={28} color="#FFF" />
          </TouchableOpacity>
          {status ? (
            <View style={[styles.selo, { backgroundColor: status.cor }]}>
              <Text style={styles.seloTexto}>{status.label}</Text>
            </View>
          ) : null}
          <View style={styles.espaco} />
        </View>

        <EstadoDados carregando={carregando} erro={erro} onTentarDeNovo={recarregar} temDados={Boolean(divida)} />

        {divida ? (
          <>
            <Text style={styles.titulo}>{divida.descricao}</Text>
            {divida.credor ? <Text style={styles.sub}>{divida.credor}</Text> : null}

            <View style={styles.cardAzul}>
              <View style={styles.linha}>
                <Text style={styles.cardTexto}>Valor total</Text>
                <Text style={styles.cardTexto}>{formatarMoeda(divida.valorTotal)}</Text>
              </View>
              <View style={styles.linha}>
                <Text style={styles.cardTexto}>Já pago</Text>
                <Text style={styles.cardTexto}>{formatarMoeda(divida.valorPago)}</Text>
              </View>
              <View style={styles.divisor} />
              <View style={styles.linha}>
                <Text style={styles.cardDestaque}>Falta pagar</Text>
                <Text style={styles.cardDestaque}>{formatarMoeda(divida.valorRestante)}</Text>
              </View>
              {divida.quitacaoAntecipada ? (
                <Text style={styles.cardNota}>Quitação antecipada combinada: {formatarMoeda(divida.quitacaoAntecipada)}</Text>
              ) : null}
              <Text style={styles.cardNota}>
                {divida.pagas} paga(s) · {divida.pendentes} pendente(s){divida.canceladas ? ` · ${divida.canceladas} cancelada(s)` : ''}
                {divida.categoria ? ` · ${divida.categoria}` : ''}
              </Text>
            </View>

            <Text style={styles.secao}>Parcelas</Text>
            {divida.parcelas.map((p) => {
              const st = p.atrasada ? { label: 'Atrasada', cor: '#D32F2F' } : STATUS_LANCAMENTO[p.status];
              return (
                <View key={p.id} style={styles.parcela}>
                  <View style={styles.parcelaNumero}>
                    <Text style={styles.parcelaNumeroTexto}>{p.parcela}</Text>
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.parcelaValor}>{formatarMoeda(p.valor)}</Text>
                    <Text style={styles.parcelaData}>
                      Vence {dataIsoParaBr(p.vencimento)}
                      {p.pagamento ? ` · pago em ${dataIsoParaBr(p.pagamento)}` : ''}
                    </Text>
                    {p.cancelamento?.motivo ? <Text style={styles.parcelaData}>Motivo: {p.cancelamento.motivo}</Text> : null}
                  </View>
                  <View style={styles.parcelaDireita}>
                    <View style={[styles.seloPequeno, { backgroundColor: st.cor }]}>
                      <Text style={styles.seloTexto}>{st.label.toUpperCase()}</Text>
                    </View>
                    {ocupado === p.id ? (
                      <ActivityIndicator color="#FFF" style={styles.acao} />
                    ) : p.status === 'pendente' ? (
                      <TouchableOpacity style={styles.acao} onPress={() => pagar(p)} hitSlop={8}>
                        <Text style={styles.acaoTexto}>Pagar</Text>
                      </TouchableOpacity>
                    ) : p.status === 'pago' ? (
                      <TouchableOpacity style={styles.acao} onPress={() => desfazer(p)} hitSlop={8}>
                        <Text style={[styles.acaoTexto, styles.acaoPerigo]}>Desfazer</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              );
            })}

            {podeCancelar ? (
              <TouchableOpacity style={styles.botaoCancelar} onPress={() => setCancelando(true)}>
                <Feather name="rotate-ccw" size={16} color="#FFF" />
                <Text style={styles.botaoCancelarTexto}>Cancelar dívida</Text>
              </TouchableOpacity>
            ) : null}
          </>
        ) : null}
      </ScrollView>

      <ModalMotivo
        visivel={cancelando}
        titulo="Cancelar dívida"
        descricao={divida ? `As ${divida.pendentes} parcela(s) pendente(s) serão canceladas. As já pagas continuam no histórico.` : ''}
        confirmarLabel="Cancelar dívida"
        onCancelar={() => setCancelando(false)}
        onConfirmar={confirmarCancelamento}
      />

      <BottomNavigation navigation={navigation} userRole={usuario?.role} usuario={usuario} />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.background },
  conteudo: { paddingBottom: 150, paddingHorizontal: 16 },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 50, marginBottom: 16 },
  espaco: { width: 28 },
  selo: { borderRadius: 8, paddingHorizontal: 18, paddingVertical: 4 },
  seloTexto: { color: '#FFF', fontSize: 10 },
  titulo: { color: '#FFF', fontSize: 22, fontWeight: '600' },
  sub: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
  cardAzul: { backgroundColor: colors.primaryBlue, borderRadius: 12, padding: 16, marginTop: 16 },
  linha: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  cardTexto: { color: 'rgba(255,255,255,0.9)', fontSize: 14 },
  cardDestaque: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  cardNota: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 6 },
  divisor: { height: 1, backgroundColor: 'rgba(255,255,255,0.5)', marginVertical: 8 },
  secao: { color: '#FFF', fontSize: 18, marginTop: 24, marginBottom: 10 },
  parcela: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  parcelaNumero: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#2A2A2A', justifyContent: 'center', alignItems: 'center' },
  parcelaNumeroTexto: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  parcelaValor: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  parcelaData: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  parcelaDireita: { alignItems: 'flex-end', gap: 6 },
  seloPequeno: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  acao: { minWidth: 60, alignItems: 'flex-end' },
  acaoTexto: { color: '#93C5FD', fontSize: 13, fontWeight: '700' },
  acaoPerigo: { color: '#FF8A80' },
  botaoCancelar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#B71C1C',
    borderRadius: 28,
    height: 54,
    marginTop: 20,
  },
  botaoCancelarTexto: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
