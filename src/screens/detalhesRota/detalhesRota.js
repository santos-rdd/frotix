import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

import BottomNavigation from '../../components/bottomNavigation/bottomNavigation.js';
import { colors } from '../../constants/theme.js';
import { STATUS_ROTA, formatarMoeda } from '../../constants/frotaMock.js';

const hoje = () => new Date().toLocaleDateString('pt-BR');

/**
 * Detalhes de uma rota (params.rota).
 * Agendada: hodômetro final editável + Salvar (sem rentabilidade, como no Figma).
 * Em trânsito / concluída: somente leitura + card de rentabilidade.
 */
export default function DetalhesRota({ navigation, route }) {
  const usuario = route?.params?.usuario;
  const rota = route?.params?.rota;
  const editavel = rota?.status === 'agendada';
  const [hodometroFinal, setHodometroFinal] = useState(rota?.hodometroFinal ? String(rota.hodometroFinal) : '');

  if (!rota) {
    return (
      <View style={[styles.container, styles.centro]}>
        <Text style={styles.textoClaro}>Rota não encontrada.</Text>
      </View>
    );
  }

  const status = STATUS_ROTA[rota.status];
  const final = hodometroFinal ? Number(hodometroFinal) : null;
  const total = final !== null && final > rota.hodometroInicial ? final - rota.hodometroInicial : null;

  const custos = rota.despesas.reduce((soma, d) => soma + d.valor, 0);
  const saldo = rota.receita - custos;
  const margem = rota.receita > 0 ? Math.round((saldo / rota.receita) * 100) : 0;

  const salvar = () => {
    if (total === null) {
      Alert.alert(
        'Hodômetro final inválido',
        `Informe um valor maior que ${rota.hodometroInicial.toLocaleString('pt-BR')} km.`
      );
      return;
    }
    // Com o hodômetro final registrado, a rota é dada como concluída hoje.
    const rotaAtualizada = { ...rota, hodometroFinal: final, dataFinal: hoje(), status: 'concluida' };
    Alert.alert('Rota atualizada', `Total percorrido: ${total.toLocaleString('pt-BR')} km.`);
    navigation.popTo('Rotas', { usuario, rotaAtualizada });
  };

  return (
    <>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.container} contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
          <View style={styles.topo}>
            <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
              <Feather name="chevron-left" size={28} color="#FFF" />
            </TouchableOpacity>
            <View style={[styles.selo, { backgroundColor: status.cor }]}>
              <Text style={styles.seloTexto}>{status.label}</Text>
            </View>
            <View style={styles.espaco} />
          </View>

          <Text style={styles.secao}>Hodômetro e Km totais</Text>
          <View style={styles.hodometros}>
            <View style={styles.caixaKm}>
              <Text style={styles.km}>{rota.hodometroInicial.toLocaleString('pt-BR')} km</Text>
            </View>
            <View style={[styles.caixaKm, editavel && styles.caixaEditavel]}>
              {editavel ? (
                <View style={styles.inputLinha}>
                  <TextInput
                    style={styles.inputKm}
                    value={hodometroFinal}
                    onChangeText={(t) => setHodometroFinal(t.replace(/\D/g, ''))}
                    keyboardType="numeric"
                    placeholder="-"
                    placeholderTextColor="#FFF"
                  />
                  <Text style={styles.km}> km</Text>
                </View>
              ) : (
                <Text style={styles.km}>
                  {rota.hodometroFinal ? `${rota.hodometroFinal.toLocaleString('pt-BR')} km` : '- km'}
                </Text>
              )}
            </View>
          </View>
          <View style={styles.total}>
            <Text style={styles.totalTexto}>
              TOTAL: {total !== null ? `${total.toLocaleString('pt-BR')} KM` : '- KM'}
            </Text>
          </View>

          <View style={styles.datas}>
            {[
              { rotulo: 'Data inicial', valor: rota.dataInicial },
              { rotulo: 'Data final', valor: rota.dataFinal },
            ].map((d) => (
              <View key={d.rotulo} style={styles.data}>
                <MaterialCommunityIcons name="calendar-blank-outline" size={24} color="#FFF" />
                <View style={styles.dataTextos}>
                  <Text style={styles.dataRotulo}>{d.rotulo}</Text>
                  <Text style={styles.dataValor}>{d.valor || '--/--/----'}</Text>
                </View>
              </View>
            ))}
          </View>

          {editavel ? (
            <TouchableOpacity style={styles.salvar} onPress={salvar}>
              <Text style={styles.salvarTexto}>Salvar</Text>
            </TouchableOpacity>
          ) : null}

          <Text style={styles.secao}>Despesas Associadas</Text>
          <View style={styles.despesas}>
            {rota.despesas.length === 0 ? (
              <Text style={styles.vazio}>Nenhuma despesa registrada.</Text>
            ) : (
              rota.despesas.map((d) => (
                <View key={d.id} style={styles.despesa}>
                  <Feather name="file-text" size={18} color="#FFF" />
                  <View>
                    <Text style={styles.despesaTitulo}>{d.descricao} - {formatarMoeda(d.valor)}</Text>
                    <Text style={styles.despesaSub}>{d.comprovante}</Text>
                  </View>
                </View>
              ))
            )}
          </View>

          {!editavel ? (
            <>
              <Text style={[styles.secao, styles.secaoRentabilidade]}>Rentabilidade</Text>
              <View style={styles.rentabilidade}>
                <Text style={styles.rentTitulo}>Rentabilidade da Viagem</Text>
                <Text style={styles.rentLinha}>Receita: {formatarMoeda(rota.receita)}</Text>
                <Text style={styles.rentLinha}>Custos: {formatarMoeda(custos)}</Text>
                <View style={styles.rentDivisor} />
                <Text style={styles.rentSaldo}>SALDO LÍQUIDO: {formatarMoeda(saldo)}</Text>
                <Text style={styles.rentLinha}>({margem}%) Margem</Text>
              </View>
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <BottomNavigation navigation={navigation} userRole={usuario?.role} usuario={usuario} />
    </>
  );
}

const caixaBase = {
  backgroundColor: '#3A3A3A',
  borderWidth: 1,
  borderColor: '#BDBDBD',
  borderRadius: 8,
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.background },
  centro: { justifyContent: 'center', alignItems: 'center' },
  textoClaro: { color: '#FFF' },
  conteudo: { paddingBottom: 150, paddingHorizontal: 16 },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 50 },
  espaco: { width: 28 },
  selo: { borderRadius: 8, paddingHorizontal: 18, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  seloTexto: { color: '#FFF', fontSize: 13 },
  secao: { color: '#FFF', fontSize: 22, marginTop: 28, marginBottom: 14 },
  secaoRentabilidade: { marginTop: 48 },
  hodometros: { flexDirection: 'row', gap: 8, zIndex: 1 },
  caixaKm: { ...caixaBase, flex: 1, height: 64, justifyContent: 'center', alignItems: 'center' },
  caixaEditavel: { borderColor: colors.primaryBlue },
  inputLinha: { flexDirection: 'row', alignItems: 'center' },
  inputKm: { color: '#FFF', fontSize: 22, minWidth: 40, textAlign: 'right', paddingVertical: 0 },
  km: { color: '#FFF', fontSize: 22 },
  total: {
    borderWidth: 1,
    borderColor: '#BDBDBD',
    borderTopWidth: 0,
    borderRadius: 8,
    marginTop: -8,
    paddingTop: 22,
    paddingBottom: 18,
    alignItems: 'center',
  },
  totalTexto: { color: colors.primaryBlue, fontSize: 22, fontWeight: '600' },
  datas: { flexDirection: 'row', gap: 8, marginTop: 20, paddingHorizontal: 16 },
  data: { ...caixaBase, flex: 1, flexDirection: 'row', alignItems: 'center', padding: 10, gap: 6 },
  dataTextos: { flex: 1 },
  dataRotulo: { color: '#FFF', fontSize: 12 },
  dataValor: { color: '#AAA', fontSize: 10 },
  salvar: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
    marginHorizontal: 12,
  },
  salvarTexto: { color: '#121212', fontSize: 16, fontWeight: '600' },
  despesas: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  despesa: { ...caixaBase, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 10 },
  despesaTitulo: { color: '#FFF', fontSize: 12 },
  despesaSub: { color: '#AAA', fontSize: 10 },
  vazio: { color: colors.textMuted },
  rentabilidade: { backgroundColor: colors.primaryBlue, borderRadius: 8, padding: 16 },
  rentTitulo: { color: '#FFF', fontSize: 14, fontWeight: '600', marginBottom: 8 },
  rentLinha: { color: 'rgba(255,255,255,0.85)', fontSize: 13 },
  rentDivisor: { height: 1, backgroundColor: '#FFF', marginVertical: 8 },
  rentSaldo: { color: '#FFF', fontSize: 13, fontWeight: '700' },
});
