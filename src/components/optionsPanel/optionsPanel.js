import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

export default function OptionsPanel({ onOpenSlider }) {
  return (
    <View style={styles.interactiveSection}>
      <View style={styles.optionsCard}>
        <Text style={styles.optionsTitle}>Opções</Text>
        
        <View style={styles.circleButtonsRow}>
          <TouchableOpacity style={styles.circleButton}>
            <View style={styles.circleButtonMaterial}>
              <MaterialCommunityIcons name="wallet-plus-outline" size={26} color="#121212" />
            </View>
            <Text style={styles.circleButtonText}>Adicionar Forma De Pagamento</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.circleButton}>
            <View style={styles.circleButtonMaterial}>
              <Feather name="trash-2" size={24} color="#121212" />
            </View>
            <Text style={styles.circleButtonText}>Deletar Forma De Pagamento</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: '#2541ff' }]}
          onPress={() => onOpenSlider('entrada')}
        >
          <Text style={styles.actionButtonText}>Registrar Entrada</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: '#b22222' }]}
          onPress={() => onOpenSlider('saida')}
        >
          <Text style={styles.actionButtonText}>Registrar Saída</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: '#b22222' }]}
          onPress={() => onOpenSlider('divida')}
        >
          <Text style={styles.actionButtonText}>Nova Dívida</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  interactiveSection: {
    display: 'flex',
    marginRight: 40
  },
  optionsCard: {
    backgroundColor: 'none',
    borderRadius: 24,
    padding: 20,
    width: '100%',
  },
  optionsTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
  },
  circleButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 25,
  },
  circleButton: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    width: 130,
  },
  circleButtonMaterial: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    width: 74,
    height: 74,
    borderRadius: 37,
  },
  circleButtonText: {
    color: 'white',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
  },
  actionButton: {
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
});