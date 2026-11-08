import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

// Perfis: 1 = Admin, 2 = Gestor de Frota, 3 = Financeiro, 4 = Motorista (mesmo mapeamento da HomePage).
export default function BottomNavigation({ navigation, userRole, usuario }) {
  const abrirCaminhao = () => {
    if (userRole === 2) return navigation.navigate('Veiculos', { usuario });
    if (userRole === 4) return navigation.navigate('Viagens', { usuario, modo: 'motorista' });
    return navigation.navigate('uploadProof', { usuario });
  };

  const abrirFerramenta = () => {
    if (userRole === 2) return navigation.navigate('Rotas', { usuario });
    if (userRole === 1 || userRole === 3) return navigation.navigate('Relatorios', { usuario });
    // Motorista: enviar comprovante de despesa da viagem.
    return navigation.navigate('uploadProof', { usuario });
  };

  // Volta para a HomePage já aberta mantendo os dados do login (auth/bankUser).
  // O popTo troca os parâmetros da tela pelos que receber; sem passar nada,
  // a Home ficava sem usuário e sem perfil. Por isso reenviamos os mesmos dados.
  const voltarParaHome = () => {
    const home = navigation.getState()?.routes?.find((r) => r.name === 'HomePage');
    navigation.popTo('HomePage', home?.params);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.navButton}
        onPress={abrirCaminhao}
      >
        <MaterialCommunityIcons name="truck-delivery-outline" size={24} color="#2541ff" />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.navButton}
        onPress={voltarParaHome}
      >
        <Feather name="home" size={24} color="#2541ff" />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.navButton}
        onPress={abrirFerramenta}
      >
        <Feather name="tool" size={24} color="#2541ff" />
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.navButton} 
        onPress={() => navigation.navigate('userProfile', { usuario })}
      >
        <Feather name="user" size={24} color="#2541ff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 110,
    backgroundColor: '#1a1a1a',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 10,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    paddingTop: 8
  },
  navButton: {
    justifyContent: 'center',
    alignItems: 'center',
    height: 50,
    width: 50,
  },
});