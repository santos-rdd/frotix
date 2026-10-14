import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';

export default function RecentActivity({ atividades }) {
  return (
    <View style={styles.sectionContainer}>
      <View style={styles.activityHeaderRow}>
        <Text style={styles.sectionTitle}>Atividade Recente</Text>
        <TouchableOpacity>
          <Feather name="more-horizontal" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>

      {atividades.map((item) => (
        <View key={item.id} style={styles.activityCard}>
          <View style={styles.activityLeft}>
            <View style={styles.activityIconBox}>
              <Feather 
                name={item.tipo === 'entrada' ? 'arrow-up' : 'arrow-down'} 
                size={16} 
                color={item.tipo === 'entrada' ? '#2541ff' : '#b22222'} 
              />
            </View>
            <View>
              <Text style={styles.activityTitle}>{item.titulo}</Text>
              <Text style={styles.activityDate}>{item.data}</Text>
            </View>
          </View>
          <View style={styles.activityRight}>
            <Text style={[styles.activityValueText, { color: item.tipo === 'entrada' ? '#2541ff' : 'black' }]}>
              {item.valor}
            </Text>
            <Text style={styles.activitySaldoApos}>{item.saldoApos}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionContainer: {
    paddingHorizontal: 30,
    marginLeft: 20,
    marginTop: 20,
    width: '100%', 
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 18,
    marginBottom: 15,
  },
  activityHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activityCard: {
    backgroundColor: '#CBD0DC',
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderRadius: 16,
  },
  activityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  activityIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent'
  },
  activityTitle: {
    color: 'black',
    fontSize: 14,
    fontWeight: '500',
  },
  activityDate: {
    color: '#888',
    fontSize: 11,
    marginTop: 2,
  },
  activityRight: {
    alignItems: 'flex-end',
  },
  activityValueText: {
    fontSize: 14,
    fontWeight: '600',
  },
  activitySaldoApos: {
    color: '#888',
    fontSize: 10,
    marginTop: 2,
  },
});