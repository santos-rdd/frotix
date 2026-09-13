import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
} from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons'; 

export default function HomePage() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Boa Tarde</Text>
          <Text style={styles.username}>Usuário</Text>
        </View>
        <Image
          source={{ uri: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop' }} 
          style={styles.avatar}
        />
      </View>

      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Resumo Geral</Text>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.balanceValue}>+ R$ 394.23</Text>
              <Text style={styles.balanceLabel}>Balanço Atual</Text>
            </View>
            <TouchableOpacity>
              <Feather name="more-horizontal" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.legendContainer}>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: '#000' }]} />
              <Text style={styles.legendText}>Entradas</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: '#FFF' }]} />
              <Text style={styles.legendText}>Saídas</Text>
            </View>
          </View>

          <View style={styles.chartPlaceholder}>
            <Text style={styles.placeholderText}>[ Espaço para o Gráfico / Imagem ]</Text>
          </View>
        </View>
      </View>

      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="home-outline" size={24} color="#3b59ff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="car-outline" size={24} color="#3b59ff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="logo-usd" size={24} color="#3b59ff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="construct-outline" size={24} color="#3b59ff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="person-outline" size={24} color="#3b59ff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212', 
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
  },
  greeting: {
    color: '#888',
    fontSize: 14,
  },
  username: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
  avatar: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
  },
  sectionContainer: {
    paddingHorizontal: 20,
    flex: 1,
    marginTop: 20,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 18,
    marginBottom: 15,
  },
  card: {
    backgroundColor: '#2541ff',
    borderRadius: 20,
    padding: 20,
    height: 409,
    width: 345,
    justifyContent: 'space-between',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  balanceValue: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  balanceLabel: {
    color: '#d0d7ff',
    fontSize: 12,
    marginTop: 2,
  },
  legendContainer: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: '#FFF',
    fontSize: 12,
  },
  chartPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderStyle: 'dashed',
    borderRadius: 12,
    marginTop: 15,
  },
  placeholderText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    textAlign: 'center',
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 15,
    backgroundColor: '#121212',
    borderTopWidth: 1,
    borderTopColor: '#1e1e1e',
    paddingBottom: 60
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});