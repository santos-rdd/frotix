import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { colors } from '../../constants/theme.js';
import { formatarMoeda } from '../../constants/frota.js';
import { previsaoCaixa } from '../../services/frotix.js';
import useDados from '../../hooks/useDados.js';
import EstadoDados from '../estadoDados/estadoDados.js';

/**
 * Previsão de caixa (Admin e Financeiro): saldo atual e saldo projetado para os
 * próximos meses, somando o que está pendente (contas, parcelas, fretes agendados
 * e manutenções). Mês com saldo negativo aparece em vermelho.
 */
export default function PrevisaoCaixaCard({ meses = 6, onVerDividas }) {
  const { dados, carregando, erro, recarregar } = useDados(() => previsaoCaixa(meses));

  if (!dados) {
    return (
      <View style={styles.card}>
        <Text style={styles.titulo}>Previsão de caixa</Text>
        <EstadoDados carregando={carregando} erro={erro} onTentarDeNovo={recarregar} temDados={false} />
      </View>
    );
  }

  const maior = Math.max(1, ...dados.meses.map((m) => Math.abs(m.saldoProjetado)), Math.abs(dados.saldoAtual));

  return (
    <View style={styles.card}>
      <View style={styles.topo}>
        <View>
          <Text style={styles.titulo}>Previsão de caixa</Text>
          <Text style={styles.subtitulo}>próximos {dados.meses.length} meses</Text>
        </View>
        {onVerDividas ? (
          <TouchableOpacity onPress={onVerDividas} hitSlop={10}>
            <Feather name="more-horizontal" size={22} color="#FFF" />
          </TouchableOpacity>
        ) : null}
      </View>

      <Text style={styles.rotulo}>Saldo atual</Text>
      <Text style={[styles.saldo, dados.saldoAtual < 0 && styles.negativo]}>{formatarMoeda(dados.saldoAtual)}</Text>

      {dados.meses.map((m) => {
        const negativo = m.saldoProjetado < 0;
        return (
          <View key={m.mes} style={styles.linha}>
            <Text style={styles.mes}>{m.rotulo}</Text>
            <View style={styles.trilho}>
              <View
                style={[
                  styles.barra,
                  { width: `${Math.max(3, (Math.abs(m.saldoProjetado) / maior) * 100)}%` },
                  negativo && styles.barraNegativa,
                ]}
              />
            </View>
            <Text style={[styles.valor, negativo && styles.valorNegativo]}>{formatarMoeda(m.saldoProjetado)}</Text>
          </View>
        );
      })}

      {dados.primeiroMesNegativo ? (
        <View style={styles.aviso}>
          <Feather name="alert-triangle" size={14} color="#FFF" />
          <Text style={styles.avisoTexto}>O saldo fica negativo em {dados.primeiroMesNegativo}.</Text>
        </View>
      ) : null}
      <Text style={styles.nota}>Inclui contas e parcelas pendentes, fretes agendados e manutenções previstas.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.cardBlue, borderRadius: 16, padding: 18, marginHorizontal: 20, marginTop: 20 },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  titulo: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  subtitulo: { color: 'rgba(255,255,255,0.75)', fontSize: 12 },
  rotulo: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
  saldo: { color: '#FFF', fontSize: 26, fontWeight: '700', marginBottom: 12 },
  negativo: { color: '#FFCDD2' },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  mes: { color: '#FFF', fontSize: 12, width: 48 },
  trilho: { flex: 1, height: 10, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 5, overflow: 'hidden' },
  barra: { height: 10, borderRadius: 5, backgroundColor: '#FFF' },
  barraNegativa: { backgroundColor: '#FF8A80' },
  valor: { color: '#FFF', fontSize: 12, width: 96, textAlign: 'right' },
  valorNegativo: { color: '#FFCDD2', fontWeight: '700' },
  aviso: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(183,28,28,0.6)', borderRadius: 8, padding: 8, marginTop: 6 },
  avisoTexto: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  nota: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 10 },
});
