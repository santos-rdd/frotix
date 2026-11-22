import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenHeader from '../../components/screenHeader/screenHeader.js';
import BottomNavigation from '../../components/bottomNavigation/bottomNavigation.js';
import EstadoDados from '../../components/estadoDados/estadoDados.js';
import VoltarButton from '../../components/voltarButton/voltarButton.js';
import useDados from '../../hooks/useDados.js';
import { detalharDivida } from '../../services/frotix.js';
import { formatarMoeda } from '../../constants/frota.js';

const dataBr = (data) => {
  if (!data) return 'Sem vencimento';
  const [ano, mes, dia] = String(data).slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
};

export default function DetalheDivida({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const usuario = route.params?.usuario || {};
  const userRole = Number(usuario.role || usuario.id_perfil || 4);
  const { dados, carregando, erro, recarregar } = useDados(
    () => detalharDivida(route.params?.id),
    { divida: null }
  );
  const divida = dados?.divida;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.conteudo, { paddingBottom: 140 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <View style={{ marginTop: Math.max(0, insets.top - 50) }}>
          <ScreenHeader usuario={usuario} titulo="Detalhe da dívida" />
        </View>
        <EstadoDados carregando={carregando} erro={erro} onTentarDeNovo={recarregar} temDados={Boolean(divida)} />
        {divida ? (
          <>
            <View style={styles.resumo}>
              <Text style={styles.descricao}>{divida.descricao || 'Dívida'}</Text>
              {divida.credor ? <Text style={styles.detalhe}>Credor: {divida.credor}</Text> : null}
              <Text style={styles.detalhe}>Status: {String(divida.status || '').replace('_', ' ')}</Text>
              <Text style={styles.valor}>Restante: {formatarMoeda(divida.valorRestante)}</Text>
              <Text style={styles.detalhe}>
                {divida.pagas} paga(s) · {divida.pendentes} pendente(s) · {divida.canceladas} cancelada(s)
              </Text>
            </View>
            <Text style={styles.tituloParcelas}>Parcelas</Text>
            {(divida.parcelas || []).map((parcela) => (
              <View key={parcela.id} style={styles.parcela}>
                <View style={styles.linha}>
                  <Text style={styles.descricao}>{parcela.parcela || 'Parcela'}</Text>
                  <Text style={styles.valorParcela}>{formatarMoeda(parcela.valor)}</Text>
                </View>
                <Text style={styles.detalhe}>
                  Vencimento: {dataBr(parcela.vencimento)} · {parcela.status}
                  {parcela.atrasada ? ' · Atrasada' : ''}
                </Text>
              </View>
            ))}
          </>
        ) : null}
        <VoltarButton navigation={navigation} />
      </ScrollView>
      <View style={[styles.bottomNav, { bottom: insets.bottom }]}>
        <BottomNavigation navigation={navigation} usuario={usuario} userRole={userRole} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0B0D' },
  conteudo: { paddingBottom: 140 },
  bottomNav: { position: 'absolute', left: 0, right: 0, height: 110 },
  resumo: { marginHorizontal: 16, padding: 18, borderRadius: 16, backgroundColor: '#19191E' },
  descricao: { color: '#FFF', fontWeight: '700', flex: 1 },
  detalhe: { color: '#A1A1AA', fontSize: 12, marginTop: 8 },
  valor: { color: '#FFF', fontSize: 18, fontWeight: '700', marginTop: 14 },
  tituloParcelas: { color: '#FFF', fontSize: 18, fontWeight: '700', marginHorizontal: 16, marginTop: 22, marginBottom: 10 },
  parcela: { marginHorizontal: 16, marginBottom: 9, padding: 14, borderRadius: 12, backgroundColor: '#19191E' },
  linha: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  valorParcela: { color: '#FFF', fontWeight: '600' },
});
