import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Svg, { Circle, G } from 'react-native-svg';

export default function GeneralSummaryCard() {
  const size = 160;
  const strokeWidth = 15;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const total = 694.23 + 554.15;
  const positivePercentage = 694.23 / total;
  const strokeDashoffset = circumference - positivePercentage * circumference;

  return (
    <View style={styles.sectionContainer}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.title}>Balanço Atual</Text>
            <Text style={styles.subtitle}>Balanço Atual</Text>
          </View>
          <TouchableOpacity>
            <Feather name="more-horizontal" size={24} color="#FFF" />
          </TouchableOpacity>
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
              <Text style={styles.positiveValue}>+ R$ 694.23</Text>
              <Text style={styles.valueDescription}>nos últimos 7 dias</Text>
            </View>
            <View style={{ marginTop: 20 }}>
              <Text style={styles.negativeValue}>- R$ 554.15</Text>
              <Text style={styles.valueDescription}>nos últimos 7 dias</Text>
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