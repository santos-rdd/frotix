import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

/**
 * Card azul de viagem/rota: título, selo de status, Origem → Destino
 * e caixa com placa, motorista e hodômetro.
 * `children` aparece abaixo da caixa (ex.: campo de hodômetro final + Fechar).
 * Com `onPress`, o card inteiro vira um botão.
 */
export default function TripCard({
  titulo,
  status, // { label, cor }
  origem,
  destino,
  placa,
  motorista,
  infoDireita, // texto do canto inferior direito (hodômetro / km rodados)
  onPress,
  children,
}) {
  const Conteiner = onPress ? TouchableOpacity : View;

  return (
    <Conteiner style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.topo}>
        <Text style={styles.titulo}>{titulo}</Text>
        {status ? (
          <View style={[styles.selo, { backgroundColor: status.cor }]}>
            <Text style={styles.seloTexto}>{status.label}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.trajeto}>
        <View style={styles.pontoVazado} />
        <View style={styles.linha} />
        <View style={styles.seta} />
        <View style={styles.pontoCheio} />
      </View>
      <View style={styles.cidades}>
        <View>
          <Text style={styles.cidadeTitulo}>Origem</Text>
          <Text style={styles.cidadeNome}>{origem}</Text>
        </View>
        <View style={styles.alinhaDireita}>
          <Text style={styles.cidadeTitulo}>Destino</Text>
          <Text style={styles.cidadeNome}>{destino}</Text>
        </View>
      </View>

      <View style={styles.divisor} />

      <View style={styles.caixa}>
        <View style={styles.caixaLinha}>
          <Text style={styles.caixaRotulo}>Licença do{'\n'}veículo</Text>
          <View style={styles.caixaTraco} />
          <Text style={styles.placa}>{placa}</Text>
        </View>
        <View style={styles.caixaLinha}>
          <Text style={[styles.detalhe, styles.motorista]}>Motorista:{'\n'}{motorista}</Text>
          <Text style={[styles.detalhe, styles.alinhaTextoDireita]}>{infoDireita}</Text>
        </View>
      </View>

      {children}
    </Conteiner>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#3B56FF',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 8,
    marginBottom: 16,
    elevation: 6,
  },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  titulo: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  selo: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 3 },
  seloTexto: { color: '#FFF', fontSize: 12 },
  trajeto: { flexDirection: 'row', alignItems: 'center' },
  pontoVazado: { width: 14, height: 14, borderRadius: 7, borderWidth: 3, borderColor: '#FFF' },
  linha: { flex: 1, height: 2, backgroundColor: '#FFF', marginLeft: 8 },
  seta: {
    width: 10,
    height: 10,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: '#FFF',
    transform: [{ rotate: '45deg' }],
    marginLeft: -9,
    marginRight: 10,
  },
  pontoCheio: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#FFF' },
  cidades: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  alinhaDireita: { alignItems: 'flex-end' },
  cidadeTitulo: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  cidadeNome: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  divisor: { height: 1, backgroundColor: 'rgba(255,255,255,0.4)', marginVertical: 22 },
  caixa: { backgroundColor: '#2A3BC9', borderRadius: 10, padding: 14, gap: 10 },
  caixaLinha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  caixaRotulo: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  caixaTraco: { flex: 1, height: 1, backgroundColor: '#FFF', marginHorizontal: 10 },
  placa: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  detalhe: { color: 'rgba(255,255,255,0.85)', fontSize: 12 },
  motorista: { flex: 1, marginRight: 8 },
  alinhaTextoDireita: { textAlign: 'right' },
});
