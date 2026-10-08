import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
  ScrollView
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons'; 

import BottomNavigation from '../../components/bottomNavigation/bottomNavigation';
import QuickActions from '../../components/quickActions/quickActions';

export default function HomePage(props) {

  const authGoogle = props.route.params?.auth || null;
  const bankUser = props.route.params?.bankUser || null;

  const userName = authGoogle?.user?.givenName || bankUser?.name || 'Usuário';
  const userPhoto = authGoogle?.user?.photo || null; 
  const userRole = bankUser?.role || authGoogle?.user?.role || 'Membro';
<<<<<<< HEAD
  console.log(userPhoto)

  const reference = {
    1 : 'Admin',
    2 : 'Gestor de Frota',
    3 : 'Financeiro',
    4 : 'Motorista' 
  };
=======
>>>>>>> e110326ceb7b63258327fd89dc1b2591e7a009b4

  return (
    <>
      <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Boa Tarde</Text>
            <Text style={styles.username}> { userName } </Text>
<<<<<<< HEAD
            <Text style={styles.userRole}> { reference[userRole] } </Text>
          </View>
          <Image 
          source={userPhoto == null ? require('../../../assets/icons/user.png') : { uri: userPhoto }} 
          style={styles.avatar} />
=======
            <Text style={styles.userRole}> { userRole } </Text>
          </View>
          {userPhoto && <Image source={{ uri: userPhoto }} style={styles.avatar} />}
>>>>>>> e110326ceb7b63258327fd89dc1b2591e7a009b4
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

        <QuickActions />
      </ScrollView>

      <BottomNavigation/>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212', 
  },
  contentContainer: {
    paddingBottom: 100,
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
  userRole: {
    color: '#888',
    fontSize: 14,
  }
});