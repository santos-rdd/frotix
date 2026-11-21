import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

import { colors } from '../../constants/theme.js';
import { formatarMoeda } from '../../constants/frota.js';

const ALTURA = 120;

/**
 * Gráfico de barras: entradas (verde) e saídas (vermelho) por mês.
 * meses: [{ mes, rotulo, entradas, saidas, resultado }]
 * Tocar num mês mostra os valores dele embaixo do gráfico.
 */
export default function FluxoMensalChart({ meses, titulo = 'Fluxo de caixa mensal' }) {
  const lista = meses || [];
  const [selecionado, setSelecionado] = useState(null);
  const maior = Math.max(1, ...lista.flatMap((m) => [m.entradas, m.saidas]));
  const atual = lista.find((m) => m.mes === selecionado) || lista[lista.length - 1];

  return (
    <View style={styles.card}>
      <Text style={styles.titulo}>{titulo}</Text>
      <View style={styles.legenda}>
        <View style={styles.legendaItem}>
          <View style={[styles.bolinha, { backgroundColor: colors.greenSuccess }]} />
          <Text style={styles.legendaTexto}>Entradas</Text>
        </View>
        <View style={styles.legendaItem}>
          <View style={[styles.bolinha, { backgroundColor: colors.redDanger }]} />
          <Text style={styles.legendaTexto}>Saídas</Text>
        </View>
      </View>

      <View style={styles.grafico}>
        {lista.map((m) => {
          const ativo = atual?.mes === m.mes;
          return (
            <TouchableOpacity key={m.mes} style={styles.coluna} onPress={() => setSelecionado(m.mes)} activeOpacity={0.7}>
              <View style={styles.barras}>
                <View style={[styles.barra, { height: Math.max(2, (m.entradas / maior) * ALTURA), backgroundColor: colors.greenSuccess, opacity: ativo ? 1 : 0.55 }]} />
                <View style={[styles.barra, { height: Math.max(2, (m.saidas / maior) * ALTURA), backgroundColor: colors.redDanger, opacity: ativo ? 1 : 0.55 }]} />
              </View>
              <Text style={[styles.rotulo, ativo && styles.rotuloAtivo]}>{m.rotulo.split('/')[0]}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {atual ? (
        <View style={styles.detalhe}>
          <Text style={styles.detalheMes}>{atual.rotulo}</Text>
          <Text style={styles.detalheTexto}>Entradas: {formatarMoeda(atual.entradas)}</Text>
          <Text style={styles.detalheTexto}>Saídas: {formatarMoeda(atual.saidas)}</Text>
          <Text style={[styles.detalheResultado, { color: atual.resultado >= 0 ? colors.greenSuccess : colors.redDanger }]}>
            Resultado: {formatarMoeda(atual.resultado)}
          </Text>
        </View>
      ) : (
        <Text style={styles.vazio}>Sem lançamentos pagos no período.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.cardBg, borderRadius: 12, padding: 16, marginHorizontal: 20, marginTop: 16 },
  titulo: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  legenda: { flexDirection: 'row', gap: 16, marginTop: 6, marginBottom: 12 },
  legendaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bolinha: { width: 8, height: 8, borderRadius: 4 },
  legendaTexto: { color: colors.textMuted, fontSize: 12 },
  grafico: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: ALTURA + 22 },
  coluna: { flex: 1, alignItems: 'center' },
  barras: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: ALTURA },
  barra: { width: 10, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  rotulo: { color: colors.textMuted, fontSize: 11, marginTop: 6 },
  rotuloAtivo: { color: '#FFF', fontWeight: '700' },
  detalhe: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 12, paddingTop: 10 },
  detalheMes: { color: '#FFF', fontSize: 13, fontWeight: '700', marginBottom: 4 },
  detalheTexto: { color: '#DDD', fontSize: 12 },
  detalheResultado: { fontSize: 13, fontWeight: '700', marginTop: 4 },
  vazio: { color: colors.textMuted, fontSize: 12, marginTop: 10 },
});
