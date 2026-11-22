import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenHeader from '../../components/screenHeader/screenHeader.js';
import BottomNavigation from '../../components/bottomNavigation/bottomNavigation.js';
import EstadoDados from '../../components/estadoDados/estadoDados.js';
import VoltarButton from '../../components/voltarButton/voltarButton.js';
import useDados from '../../hooks/useDados.js';
import { listarDividas } from '../../services/frotix.js';
import { formatarMoeda } from '../../constants/frota.js';

const statusLabel = (status) => ({
  em_dia: 'Em dia',
  atrasada: 'Atrasada',
  quitada: 'Quitada',
  cancelada: 'Cancelada',
}[status] || status);

export default function Dividas({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const usuario = route.params?.usuario || {};
  const userRole = Number(usuario.role || usuario.id_perfil || 4);
  const { dados, carregando, erro, recarregar } = useDados(
    listarDividas,
    { dividas: [], totais: { abertas: 0, valorRestante: 0, parcelasAtrasadas: 0 } }
  );
  const dividas = dados?.dividas || [];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.conteudo, { paddingBottom: 140 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <View style={{ marginTop: Math.max(0, insets.top - 50) }}>
          <ScreenHeader usuario={usuario} titulo="Minhas dívidas" />
        </View>

        <View style={styles.resumo}>
          <Text style={styles.rotulo}>Saldo das dívidas abertas</Text>
          <Text style={styles.valor}>{formatarMoeda(dados?.totais?.valorRestante || 0)}</Text>
          <Text style={styles.detalhe}>
            {dados?.totais?.abertas || 0} em aberto · {dados?.totais?.parcelasAtrasadas || 0} parcelas atrasadas
          </Text>
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          style={styles.nova}
          onPress={() => navigation.navigate('TransactionForm', { usuario, actionType: 'divida' })}
        >
          <Text style={styles.novaTexto}>Registrar dívida</Text>
        </TouchableOpacity>

        <EstadoDados carregando={carregando} erro={erro} onTentarDeNovo={recarregar} temDados={dividas.length > 0} />
        {!carregando && !erro && dividas.length === 0 ? (
          <Text style={styles.vazio}>Nenhuma dívida cadastrada.</Text>
        ) : null}
        {dividas.map((divida) => (
          <TouchableOpacity
            key={divida.id}
            accessibilityRole="button"
            style={styles.divida}
            onPress={() => navigation.navigate('DetalheDivida', { id: divida.id, usuario })}
          >
            <View style={styles.linha}>
              <Text style={styles.descricao} numberOfLines={2}>{divida.descricao || 'Dívida'}</Text>
              <Text style={styles.status}>{statusLabel(divida.status)}</Text>
            </View>
            {divida.credor ? <Text style={styles.detalhe}>Credor: {divida.credor}</Text> : null}
            <Text style={styles.detalhe}>
              Restante: {formatarMoeda(divida.valorRestante)} · {divida.pendentes} parcela(s) pendente(s)
            </Text>
          </TouchableOpacity>
        ))}
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
  resumo: { marginHorizontal: 16, marginBottom: 14, padding: 18, borderRadius: 16, backgroundColor: '#19191E' },
  rotulo: { color: '#A1A1AA', fontSize: 12 },
  valor: { color: '#FFF', fontSize: 22, fontWeight: '700', marginTop: 8 },
  detalhe: { color: '#A1A1AA', fontSize: 12, marginTop: 7 },
  nova: { marginHorizontal: 16, marginBottom: 12, padding: 14, borderRadius: 12, backgroundColor: '#3B56FF', alignItems: 'center' },
  novaTexto: { color: '#FFF', fontWeight: '700' },
  vazio: { color: '#A1A1AA', textAlign: 'center', padding: 24 },
  divida: { marginHorizontal: 16, marginBottom: 10, padding: 14, borderRadius: 14, backgroundColor: '#19191E' },
  linha: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  descricao: { flex: 1, color: '#FFF', fontWeight: '600' },
  status: { color: '#AFC1FF', fontSize: 12, fontWeight: '700' },
});
