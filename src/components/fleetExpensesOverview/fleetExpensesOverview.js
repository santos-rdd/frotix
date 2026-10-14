import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';

export default function FleetExpensesOverview({ onFilterPress, onMenuPress }) {
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
            <TouchableOpacity onPress={onMenuPress} style={styles.menuButton}>
              <Feather name="more-horizontal" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: '#1E293B' }]} />
            <Text style={styles.legendText}>Manutenção</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: '#E2E8F0' }]} />
            <Text style={styles.legendText}>Combustível</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: '#DC2626' }]} />
            <Text style={styles.legendText}>Pedágios</Text>
          </View>
        </View>

        <View style={styles.chartSection}>
          <View style={styles.donutContainer}>
            <View style={styles.donutRing}>
              <View style={styles.donutHole} />
            </View>
          </View>

          <View style={styles.percentagesColumn}>
            <View style={styles.percentageItem}>
              <View style={[styles.smallDot, { backgroundColor: '#1E293B' }]} />
              <Text style={styles.percentageText}>37%</Text>
            </View>
            <View style={styles.percentageItem}>
              <View style={[styles.smallDot, { backgroundColor: '#E2E8F0' }]} />
              <Text style={styles.percentageText}>44%</Text>
            </View>
            <View style={styles.percentageItem}>
              <View style={[styles.smallDot, { backgroundColor: '#DC2626' }]} />
              <Text style={styles.percentageText}>14%</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.bottomCardsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>10</Text>
          <Text style={styles.statLabel}>Veículos em{'\n'}rota</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statNumberMedium}>3.200</Text>
          <Text style={styles.statUnit}>km</Text>
          <Text style={styles.statLabel}>rodados</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statPrice}>R$6,80</Text>
          <Text style={styles.statLabel}>Custo por km</Text>
        </View>
      </View>

        <View style={styles.paginationDots}>
            <View style={styles.dotInactive} />
            <View style={styles.dotActive} />
            <View style={styles.dotInactive} />
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
  donutRing: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 26,
    borderColor: '#E2E8F0', 
    borderTopColor: '#1E293B', 
    borderLeftColor: '#DC2626', 
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '-45deg' }],
  },
  donutHole: {
    width: 98,
    height: 98,
    borderRadius: 49,
    backgroundColor: '#2541ff',
  },
  percentagesColumn: {
    justifyContent: 'center',
    gap: 16,
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
   paginationDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: '43%',
    marginTop: 30,
  },
  dotActive: {
    width: 20,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2541ff',
  },
  dotInactive: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#555',
  },
});