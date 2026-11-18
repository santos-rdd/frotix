import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

export default function UserControlPanel() {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      <View style={styles.paginationDots}>
        <View style={[styles.dot, styles.dotActive]} />
        <View style={[styles.dot, styles.dotInactive]} />
      </View>

      <Text style={styles.title}>Controle de usuários</Text>

      <TouchableOpacity 
        style={styles.actionButton}
        onPress={() => navigation.navigate('RegisterUser')}
      >
        <Ionicons name="add-circle-outline" size={20} color="#121212" style={{ marginRight: 8 }} />
        <Text style={styles.actionButtonText}>Cadastrar Novo Usuário</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.actionButton}
        onPress={() => navigation.navigate('ManageUser')}
      >
        <Ionicons name="add-circle-outline" size={20} color="#121212" style={{ marginRight: 8 }} />
        <Text style={styles.actionButtonText}>Gerenciar Usuário</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    padding: 20,
  },
  paginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 24,
    backgroundColor: '#2541ff',
  },
  dotInactive: {
    backgroundColor: '#555',
  },
  title: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
  },
  actionButton: {
    width: '100%',
    height: 50,
    borderRadius: 14,
    backgroundColor: '#FFF',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  actionButtonText: {
    color: '#121212',
    fontSize: 15,
    fontWeight: '600',
  },
});