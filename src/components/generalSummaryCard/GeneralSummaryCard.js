import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Circle, G } from 'react-native-svg';
import { apiFetch } from '../../services/api.js';

export default function GeneralSummaryCard({ onMenuPress }) {
  const [totalEntradas, setTotalEntradas] = useState(0);
  const [totalSaidas, setTotalSaidas] = useState(0);
  const [loading, setLoading] = useState(true);
  const isFirstLoad = useRef(true);

  const carregarResumo = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent || isFirstLoad.current) {
        setLoading(true);
      }
      const response = await apiFetch('/financeiro/resumo-geral');
      if (!response.ok) {
        throw new Error(`Erro na requisição: ${response.status}`);
      }
      const data = await response.json();
      if (data && data.sucesso) {
        setTotalEntradas(Number(data.totalEntradas) || 0);
        setTotalSaidas(Number(data.totalSaidas) || 0);
      }
    } catch (err) {
      console.warn('Erro ao carregar dados do GeneralSummaryCard:', err?.message || err);
    } finally {
      isFirstLoad.current = false;
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregarResumo(true);

      const interval = setInterval(() => {
        carregarResumo(true);
      }, 5000);

      return () => clearInterval(interval);
    }, [carregarResumo])
  );

  const size = 160;
  const strokeWidth = 15;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const total = totalEntradas + totalSaidas;
  const positivePercentage = total > 0 ? (totalEntradas / total) : 0;
  const strokeDashoffset = circumference - (positivePercentage * circumference);

  const formatMoney = (val) => {
    const num = Number(val) || 0;
    return num.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <View style={styles.sectionContainer}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.title}>Balanço Atual</Text>
            <Text style={styles.subtitle}>Balanço Atual</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => carregarResumo(false)} activeOpacity={0.7}>
              {loading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Feather name="rotate-cw" size={20} color="#FFF" />
              )}
            </TouchableOpacity>
            {onMenuPress && (
              <TouchableOpacity onPress={onMenuPress} hitSlop={10}>
                <Feather name="more-horizontal" size={24} color="#FFF" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.legendContainer}>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: '#365FFF' }]} />
            <Text style={styles.legendText}>Entradas</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: '#D0D3D4' }]} />
            <Text style={styles.legendText}>Saídas</Text>
          </View>
        </View>

        <View style={styles.chartContent}>
          <View style={styles.chartWrapper}>
            <Svg width={size} height={size}>
              <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
                <Circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke="#D0D3D4"
                  strokeWidth={strokeWidth}
                  fill="transparent"
                />
                <Circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke="#365FFF"
                  strokeWidth={strokeWidth}
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </G>
            </Svg>
          </View>

          <View style={styles.valuesContainer}>
            <View>
              <Text style={styles.positiveValue} numberOfLines={2}>
                {`Entrada: +R$ ${formatMoney(totalEntradas)}`}
              </Text>
              <Text style={styles.valueDescription}>Total acumulado</Text>
            </View>
            <View style={{ marginTop: 20 }}>
              <Text style={styles.negativeValue} numberOfLines={2}>
                {`Saida: -R$ ${formatMoney(totalSaidas)}`}
              </Text>
              <Text style={styles.valueDescription}>Saídas + Parcelas do mês</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionContainer: {
    paddingHorizontal: 16,
    marginTop: 20,
  },
  card: {
    backgroundColor: '#1b2db3',
    borderRadius: 24,
    padding: 20,
    height: 360,
    width: '100%',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '600',
  },
  subtitle: {
    color: '#d0d7ff',
    fontSize: 14,
    marginTop: 2,
  },
  legendContainer: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 16,
    marginLeft: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    color: '#FFF',
    fontSize: 14,
  },
  chartContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    flex: 1,
  },
  chartWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  valuesContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingLeft: 10,
  },
  positiveValue: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  negativeValue: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  valueDescription: {
    color: '#a0aaff',
    fontSize: 12,
    marginTop: 2,
  },
});
