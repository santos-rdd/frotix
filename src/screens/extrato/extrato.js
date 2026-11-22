import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenHeader from '../../components/screenHeader/screenHeader.js';
import BottomNavigation from '../../components/bottomNavigation/bottomNavigation.js';
import EstadoDados from '../../components/estadoDados/estadoDados.js';
import VoltarButton from '../../components/voltarButton/voltarButton.js';
import useDados from '../../hooks/useDados.js';
import { listarLancamentos } from '../../services/frotix.js';
import { formatarMoeda } from '../../constants/frota.js';

const dataBr = (data) => {
  if (!data) return 'Data não informada';
  const [ano, mes, dia] = String(data).slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
};

export default function Extrato({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const usuario = route.params?.usuario || {};
  const userRole = Number(usuario.role || usuario.id_perfil || 4);
  const { dados, carregando, erro, recarregar } = useDados(
    () => listarLancamentos({ limite: 100 }),
    { lancamentos: [], totais: { entradas: 0, saidas: 0 } }
  );
  const lancamentos = dados?.lancamentos || [];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.conteudo, { paddingBottom: 140 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <View style={{ marginTop: Math.max(0, insets.top - 50) }}>
          <ScreenHeader usuario={usuario} titulo="Meu extrato" />
        </View>

        <View style={styles.resumo}>
          <View style={styles.valorResumo}>
            <Text style={styles.rotulo}>Entradas próprias</Text>
            <Text style={styles.entrada}>{formatarMoeda(dados?.totais?.entradas || 0)}</Text>
          </View>
          <View style={styles.separador} />
          <View style={styles.valorResumo}>
            <Text style={styles.rotulo}>Saídas próprias</Text>
            <Text style={styles.saida}>{formatarMoeda(dados?.totais?.saidas || 0)}</Text>
          </View>
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          style={styles.novo}
          onPress={() => navigation.navigate('TransactionForm', { usuario, actionType: 'entrada' })}
        >
          <Text style={styles.novoTexto}>Novo lançamento</Text>
        </TouchableOpacity>

        <EstadoDados
          carregando={carregando}
          erro={erro}
          onTentarDeNovo={recarregar}
          temDados={lancamentos.length > 0}
        />
        {!carregando && !erro && lancamentos.length === 0 ? (
          <Text style={styles.vazio}>Nenhum lançamento encontrado.</Text>
        ) : null}

        {lancamentos.map((item) => {
          const entrada = item.tipo === 'entrada';
          return (
            <View key={item.id} style={styles.lancamento}>
              <View style={styles.linha}>
                <Text style={styles.descricao} numberOfLines={2}>{item.descricao || 'Lançamento'}</Text>
                <Text style={entrada ? styles.entrada : styles.saida}>
                  {entrada ? '+' : '-'} {formatarMoeda(item.valor)}
                </Text>
              </View>
              <Text style={styles.detalhe}>
                {item.categoria || 'Outros'} · {dataBr(item.data || item.vencimento)}
              </Text>
              {item.viagem?.label ? <Text style={styles.detalhe}>Viagem: {item.viagem.label}</Text> : null}
              <Text style={styles.status}>{item.status || 'sem status'}</Text>
            </View>
          );
        })}
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
  resumo: {
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 18,
    borderRadius: 16,
    backgroundColor: '#19191E',
    flexDirection: 'row',
    alignItems: 'center',
  },
  valorResumo: { flex: 1 },
  rotulo: { color: '#A1A1AA', fontSize: 12, marginBottom: 8 },
  entrada: { color: '#59D499', fontWeight: '700' },
  saida: { color: '#FF8A80', fontWeight: '700' },
  separador: { width: 1, height: 36, backgroundColor: '#36363D', marginHorizontal: 12 },
  novo: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#3B56FF',
    alignItems: 'center',
  },
  novoTexto: { color: '#FFF', fontWeight: '700' },
  vazio: { color: '#A1A1AA', textAlign: 'center', padding: 24 },
  lancamento: {
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#19191E',
  },
  linha: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  descricao: { flex: 1, color: '#FFF', fontWeight: '600' },
  detalhe: { color: '#A1A1AA', fontSize: 12, marginTop: 6 },
  status: { color: '#C4C4CC', fontSize: 11, marginTop: 8, textTransform: 'capitalize' },
});
