import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/theme';

const usuariosMock = [
  { id: '1', role: 'admin', color: '#DC2626', name: 'Admin 1' },
  { id: '2', role: 'gestor', color: '#F97316', name: 'Gestor 1' },
  { id: '3', role: 'financeiro', color: '#EAB308', name: 'Finan 1' },
  { id: '4', role: 'motorista', color: '#22C55E', name: 'Motorista 1' },
  { id: '5', role: 'motorista', color: '#22C55E', name: 'Motorista 2' },
  { id: '6', role: 'motorista', color: '#22C55E', name: 'Motorista 3' },
  { id: '7', role: 'motorista', color: '#22C55E', name: 'Motorista 4' },
  { id: '8', role: 'motorista', color: '#22C55E', name: 'Motorista 5' },
  { id: '9', role: 'motorista', color: '#22C55E', name: 'Motorista 6' },
];

export default function GerenciarUsuariosGrid({ onBack, onSelectUser }) {
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
        <Feather name="chevron-left" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      <Text style={styles.title}>Gerenciar usuários</Text>

      {/* Grid de Usuários */}
      <View style={styles.gridContainer}>
        {usuariosMock.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.userCard}
            activeOpacity={0.8}
            onPress={() => onSelectUser && onSelectUser(item)}
          >
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={32} color="#FFFFFF" />
            </View>
            <View style={styles.roleIndicator}>
              <View style={[styles.dot, { backgroundColor: item.color }]} />
              <Text style={styles.roleText}>{item.name}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Legenda dos Perfis */}
      <View style={styles.legendContainer}>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: '#DC2626' }]} />
          <Text style={styles.legendText}>Administrador</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: '#F97316' }]} />
          <Text style={styles.legendText}>Gestor de Frota</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: '#EAB308' }]} />
          <Text style={styles.legendText}>Financeiro</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: '#22C55E' }]} />
          <Text style={styles.legendText}>Motorista</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    marginTop: 10 
  },
  backBtn: { 
    marginBottom: 12,
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  title: { 
    fontSize: 22, 
    fontWeight: 'bold', 
    color: '#FFFFFF', 
    textAlign: 'center', 
    marginBottom: 20 
  },
  gridContainer: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'space-between', 
    gap: 12 
  },
  userCard: { 
    width: '30%', 
    height: 110, 
    backgroundColor: '#2541FF', 
    borderRadius: 16, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 8 
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleIndicator: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginTop: 8 
  },
  dot: { 
    width: 10, 
    height: 10, 
    borderRadius: 5, 
    marginRight: 4 
  },
  roleText: { 
    color: '#FFFFFF', 
    fontSize: 11, 
    fontWeight: '500' 
  },
  legendContainer: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'space-between', 
    marginTop: 24, 
    paddingHorizontal: 4 
  },
  legendItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 8, 
    width: '48%' 
  },
  legendText: { 
    color: '#FFFFFF', 
    fontSize: 11 
  }
});
