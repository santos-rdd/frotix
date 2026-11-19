import React from 'react';
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
import { listarUsuarios } from '../../services/frotix.js';
import { corPerfil } from '../../constants/perfis.js';
import useDados from '../../hooks/useDados.js';
import EstadoDados from '../../components/estadoDados/estadoDados.js';

export default function ManageUserScreen() {
  const navigation = useNavigation();

  // Erro P4: a lista vem do banco (antes eram 9 nomes de exemplo).
  const { dados, carregando, erro, recarregar } = useDados(listarUsuarios, []);
  const usuarios = dados || [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Feather name="arrow-left" size={22} color="#FFF" />
      </TouchableOpacity>

      <Text style={styles.title}>Gerenciar usuários</Text>

      <EstadoDados carregando={carregando} erro={erro} onTentarDeNovo={recarregar} temDados={usuarios.length > 0} />

      <View style={styles.gridContainer}>
        {usuarios.map((user, i) => {
          const dotColor = corPerfil(user.perfil);
          return (
            <TouchableOpacity 
                key={user.id} 
                // 3 por linha, alinhados à esquerda (a última linha não fica com buraco no meio)
                style={[styles.userCard, i % 3 !== 2 && { marginRight: '3.5%' }]}
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
    justifyContent: 'flex-start',
  },
  userCard: {
    width: '31%',
    backgroundColor: '#2541ff',
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