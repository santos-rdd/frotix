import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function CurrentBalanceCard({ saldoAtual, totalSaidas }) {
  return (
    <View style={styles.sectionContainer}>
      <View style={styles.mainBalanceCard}>
        <Text style={styles.mainDateText}>Segunda, 14 de setembro</Text>
        <View style={styles.walletIconContainer}>
          <MaterialCommunityIcons name="piggy-bank-outline" size={28} color="#2541ff" />
        </View>
        <Text style={styles.mainBalanceValue}>
          {saldoAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </Text>
        <Text style={styles.mainBalanceLabel}>Saldo atual</Text>
        
        <Text style={styles.mainSaidasValue}>
          {totalSaidas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </Text>
        <Text style={styles.mainSaidasLabel}>Saídas</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionContainer: {
    paddingHorizontal: 20,
    marginTop: 60,
  },
  mainBalanceCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    width: '100%',
  },
  mainDateText: {
    color: '#888',
    fontSize: 12,
    marginBottom: 15,
    alignSelf: 'flex-start',
  },
  walletIconContainer: {
    marginBottom: 10,
  },
  mainBalanceValue: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: 'bold',
  },
  mainBalanceLabel: {
    color: '#888',
    fontSize: 13,
    marginBottom: 20,
  },
  mainSaidasValue: {
    color: '#b22222',
    fontSize: 20,
    fontWeight: '600',
  },
  mainSaidasLabel: {
    color: '#b22222',
    fontSize: 12,
  },
});