import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
  'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const dataPorExtenso = (d) => `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;

/**
 * Medidor semicircular de quilometragem (valor x meta), com a data do dia no topo.
 */
export default function KmGauge({ valor, meta, largura = 260, data = new Date() }) {
  const espessura = 34;
  const r = (largura - espessura) / 2;
  const cx = largura / 2;
  const cy = r + espessura / 2;
  const fracao = meta > 0 ? Math.min(valor / meta, 1) : 0;

  // Ponto no arco para um ângulo (π = esquerda, 0 = direita).
  const ponto = (angulo) => `${cx + r * Math.cos(angulo)} ${cy - r * Math.sin(angulo)}`;
  const arco = (de, ate) =>
    `M ${ponto(Math.PI - Math.PI * de)} A ${r} ${r} 0 0 1 ${ponto(Math.PI - Math.PI * ate)}`;

  return (
    <View style={styles.card}>
      <Text style={styles.data}>{dataPorExtenso(data)}</Text>
      <View style={styles.medidor}>
        <Svg width={largura} height={cy}>
          {fracao < 1 ? <Path d={arco(fracao, 1)} stroke="#3A3F47" strokeWidth={espessura} fill="none" /> : null}
          {fracao > 0 ? <Path d={arco(0, fracao)} stroke="#3B56FF" strokeWidth={espessura} fill="none" /> : null}
        </Svg>
        <View style={styles.centro}>
          <MaterialCommunityIcons name="fire" size={24} color="#3B56FF" />
          <Text style={styles.valor}>
            {valor.toLocaleString('pt-BR')} <Text style={styles.unidade}>km</Text>
          </Text>
          <Text style={styles.meta}>de {meta.toLocaleString('pt-BR')} km</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#22252A',
    borderRadius: 12,
    padding: 18,
    marginHorizontal: 8,
  },
  data: { color: '#3B56FF', fontSize: 13, marginBottom: 16 },
  medidor: { alignItems: 'center', paddingBottom: 16 },
  centro: { position: 'absolute', bottom: 16, alignItems: 'center' },
  valor: { color: '#FFF', fontSize: 26, fontWeight: 'bold' },
  unidade: { fontSize: 16 },
  meta: { color: '#3B56FF', fontSize: 14 },
});
