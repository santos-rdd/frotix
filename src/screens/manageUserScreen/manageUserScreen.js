import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

export default function ManageUserScreen() {
  const navigation = useNavigation();

  const [usuarios] = useState([
    { id: '1', nome: 'Carlos Silva', role: 'admin', foto: null },
    { id: '2', nome: 'Ana Souza', role: 'gestor', foto: null },
    { id: '3', nome: 'Marcos Lima', role: 'financeiro', foto: null },
    { id: '4', nome: 'João Pedro', role: 'motorista', foto: null },
    { id: '5', nome: 'Lucas Mendes', role: 'motorista', foto: null },
    { id: '6', nome: 'Beatriz Costa', role: 'motorista', foto: null },
    { id: '7', nome: 'Renato Dias', role: 'motorista', foto: null },
    { id: '8', nome: 'Juliana Rocha', role: 'motorista', foto: null },
    { id: '9', nome: 'Gabriel Martins', role: 'motorista', foto: null },
  ]);

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin': return '#b22222';
      case 'gestor': return '#ff8c00';
      case 'financeiro': return '#ffd700';
      case 'motorista': return '#2ecc71';
      default: return '#2ecc71';
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Feather name="arrow-left" size={22} color="#FFF" />
      </TouchableOpacity>

      <Text style={styles.title}>Gerenciar usuários</Text>

      <View style={styles.gridContainer}>
        {usuarios.map((user) => {
          const dotColor = getRoleColor(user.role);
          return (
            <TouchableOpacity 
                key={user.id} 
                style={styles.userCard}
                onPress={() => navigation.navigate('UserDetail', { usuario: user })}
                >
              {user.foto ? (
                <Image source={{ uri: user.foto }} style={styles.userImage} />
              ) : (
                <View style={styles.placeholderCard}>
                  <Feather name="image" size={32} color="#FFF" />
                </View>
              )}
              <View style={styles.userInfoRow}>
                <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
                <Text style={styles.userName} numberOfLines={1}>{user.nome}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.legendContainer}>
        <View style={styles.legendItem}>
          <View style={[styles.statusDot, { backgroundColor: '#b22222' }]} />
          <Text style={styles.legendText}>Administrador</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.statusDot, { backgroundColor: '#ff8c00' }]} />
          <Text style={styles.legendText}>Gestor de Frota</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.statusDot, { backgroundColor: '#ffd700' }]} />
          <Text style={styles.legendText}>Financeiro</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.statusDot, { backgroundColor: '#2ecc71' }]} />
          <Text style={styles.legendText}>Motorista</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  content: {
    padding: 20,
    paddingTop: 50,
    paddingBottom: 40,
  },
  backButton: {
    marginBottom: 20,
  },
  title: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 25,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  userCard: {
    width: '31%',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 10,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  userImage: {
    width: '100%',
    height: 90,
    borderRadius: 12,
    marginBottom: 8,
  },
  placeholderCard: {
    width: '100%',
    height: 90,
    borderRadius: 12,
    backgroundColor: '#2541ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  userName: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '500',
  },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 15,
    marginTop: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendText: {
    color: '#AAA',
    fontSize: 11,
  },
});