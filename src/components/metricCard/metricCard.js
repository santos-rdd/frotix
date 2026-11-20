import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../../constants/theme';

export default function MetricCard({ title, value, subtitle, onPress }) {
  const CardWrapper = onPress ? TouchableOpacity : View;
  return (
    <CardWrapper style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </CardWrapper>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#F2F2F7',
    borderRadius: 16,
    padding: 16,
    flex: 1,
    marginHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
  },
  title: {
    fontSize: 12,
    color: '#666666',
    marginTop: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 10,
    color: '#999999',
    marginTop: 2,
  },
});
