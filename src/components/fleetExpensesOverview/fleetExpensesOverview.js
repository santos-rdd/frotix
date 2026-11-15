import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Svg, { Circle, G } from 'react-native-svg';
import { useFocusEffect } from '@react-navigation/native';
import { API_URL } from '../../config/api.js';

const SLICE_COLORS = [
  '#1E293B', 
  '#E2E8F0', 
  '#DC2626', 
  '#F59E0B', 
  '#10B981', 
];

export default function FleetExpensesOverview({ onFilterPress, onMenuPress }) {
  const [loading, setLoading] = useState(false);
  const [veiculosEmRota, setVeiculosEmRota] = useState(0);
  const [kmRodados, setKmRodados] = useState('0');
  const [custoPorKm, setCustoPorKm] = useState('R$0,00');
  const [despesas, setDespesas] = useState([]);
  const isFirstLoad = useRef(true);

  const size = 150;
  const strokeWidth = 26;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const carregarDados = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent || isFirstLoad.current) {
        setLoading(true);
      }
      const response = await fetch(`${API_URL}/financeiro/visao-geral-frota?dias=7`);
      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }
      const data = await response.json();
      if (data && data.sucesso) {
        setVeiculosEmRota(data.veiculosEmRota ?? 0);
        setKmRodados(data.kmRodadosFormatado || '0');
        setCustoPorKm(data.custoPorKmFormatado || 'R$0,00');

        const lista = data.despesas || [];
        let anguloAcumulado = -90;
        const fatiasProcessadas = lista.map((item, index) => {
          const cor = SLICE_COLORS[index % SLICE_COLORS.length];
          const pctExata = Number(item.porcentagemExata) || Number(item.porcentagem) || 0;
          const angulo = (pctExata / 100) * 360;
          const rotacao = anguloAcumulado;
          anguloAcumulado += angulo;

          return {
            ...item,
            color: cor,
            rotacao,
            strokeDash: (pctExata / 100) * circumference
          };
        });
        setDespesas(fatiasProcessadas);
      }
    } catch (err) {
      console.warn('Erro ao carregar dados do fleetExpensesOverview:', err?.message || err);
    } finally {
      isFirstLoad.current = false;
      setLoading(false);
    }
  }, [circumference]);

  useFocusEffect(
    useCallback(() => {
      carregarDados(true);

      const interval = setInterval(() => {
        carregarDados(true);
      }, 60000);

      return () => clearInterval(interval);
    }, [carregarDados])
  );

  const handleReload = () => {
    carregarDados(false);
    if (onMenuPress) onMenuPress();
  };

  return (
    <View style={styles.container}>
      <View style={styles.mainCard}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Despesas</Text>
            <Text style={styles.subtitle}>percentgem atual</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.filterContainer} onPress={onFilterPress}>
              <Text style={styles.filterText}>últimos 7 dias</Text>
              <Feather name="sliders" size={14} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleReload} style={styles.menuButton} activeOpacity={0.7}>
              {loading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Feather name="rotate-cw" size={20} color="#FFF" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.legendRow}>
          {despesas.length > 0 ? (
            despesas.map((item, index) => (
              <View key={item.id || index} style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: item.color }]} />
                <Text style={styles.legendText} numberOfLines={1}>{item.nome}</Text>
              </View>
            ))
          ) : (
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: '#E2E8F0' }]} />
              <Text style={styles.legendText}>Sem despesas recentes</Text>
            </View>
          )}
        </View>

        <View style={styles.chartSection}>
          <View style={styles.donutContainer}>
            <Svg width={size} height={size}>
              <G origin={`${size / 2}, ${size / 2}`}>
                <Circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke="rgba(255, 255, 255, 0.15)"
                  strokeWidth={strokeWidth}
                  fill="transparent"
                />
                {despesas.map((item, index) => (
                  <Circle
                    key={item.id || index}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={item.color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${item.strokeDash} ${circumference}`}
                    strokeDashoffset={0}
                    rotation={item.rotacao}
                    origin={`${size / 2}, ${size / 2}`}
                    fill="transparent"
                  />
                ))}
              </G>
            </Svg>
          </View>

          <View style={styles.percentagesColumn}>
            {despesas.length > 0 ? (
              despesas.map((item, index) => (
                <View key={item.id || index} style={styles.percentageItem}>
                  <View style={[styles.smallDot, { backgroundColor: item.color }]} />
                  <Text style={styles.percentageText}>{item.porcentagem}%</Text>
                </View>
              ))
            ) : (
              <View style={styles.percentageItem}>
                <View style={[styles.smallDot, { backgroundColor: '#E2E8F0' }]} />
                <Text style={styles.percentageText}>0%</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <View style={styles.bottomCardsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{veiculosEmRota}</Text>
          <Text style={styles.statLabel}>Veículos em{'\n'}rota</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statNumberMedium}>{kmRodados}</Text>
          <Text style={styles.statUnit}>km</Text>
          <Text style={styles.statLabel}>rodados</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statPrice}>{custoPorKm}</Text>
          <Text style={styles.statLabel}>Custo por km</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    marginTop: 60,
    width: '100%',
  },
  mainCard: {
    backgroundColor: '#2541ff',
    borderRadius: 24,
    padding: 20,
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  title: {
    color: '#FFF',
    fontSize: 26,
    fontWeight: 'bold',
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginTop: 2,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  filterText: {
    color: '#FFF',
    fontSize: 12,
  },
  menuButton: {
    padding: 2,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
    paddingHorizontal: 5,
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
    fontSize: 12,
  },
  chartSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  donutContainer: {
    width: 170,
    height: 170,
    justifyContent: 'center',
    alignItems: 'center',
  },
  percentagesColumn: {
    justifyContent: 'center',
    gap: 12,
    paddingRight: 20,
  },
  percentageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  smallDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  percentageText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomCardsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#EAEAEA',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 125,
  },
  statNumber: {
    color: '#121212',
    fontSize: 32,
    fontWeight: 'bold',
  },
  statNumberMedium: {
    color: '#121212',
    fontSize: 26,
    fontWeight: 'bold',
    lineHeight: 30,
  },
  statUnit: {
    color: '#121212',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  statPrice: {
    color: '#121212',
    fontSize: 24,
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#333',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
  },
});