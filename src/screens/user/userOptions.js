import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
} from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { CommonActions } from '@react-navigation/native';
import BottomNavigation from '../../components/bottomNavigation/bottomNavigation';


export default function UserProfileScreen({ navigation, route }) {
  // usuario vem da barra inferior: { nome, foto, role }.
  const { auth, bankUser, usuario } = route?.params || {};
  const userPhoto = auth?.user?.photo || bankUser?.fotoUrl || usuario?.foto;
  const PERFIS = { 1: 'Admin', 2: 'Gestor de Frota', 3: 'Financeiro', 4: 'Motorista' };

  const handleLogout = async () => {
    try {
      await GoogleSignin.signOut();
    } catch (error) {
      console.log('Erro ao deslogar do Google:', error);
    }

    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      })
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>

        <View style={styles.headerContainer}>
          <Text style={styles.title}>
            Gerenciar <Text style={styles.titleX}>Usuário</Text>
          </Text>
        </View>

        <View style={styles.avatarContainer}>
          {userPhoto ? (
            <Image source={{ uri: userPhoto }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarPlaceholderText}>👤</Text>
            </View>
          )}
        </View>

        {usuario?.nome ? <Text style={styles.nomeUsuario}>{usuario.nome}</Text> : null}
        {PERFIS[usuario?.role] ? <Text style={styles.perfilUsuario}>{PERFIS[usuario.role]}</Text> : null}

        <View style={styles.footer}>
          <TouchableOpacity 
            style={styles.logoutButton} 
            activeOpacity={0.8}
            onPress={handleLogout}
          >
            <Text style={styles.logoutButtonText}>Sair da Conta</Text>
          </TouchableOpacity>
        </View>

      </View>

      <BottomNavigation navigation={navigation} userRole={usuario?.role} usuario={usuario} />
    </View>
  );
}

const styles = StyleSheet.create({
  nomeUsuario: { color: '#FFF', fontSize: 20, fontWeight: '600', textAlign: 'center', marginTop: 16 },
  perfilUsuario: { color: '#888', fontSize: 14, textAlign: 'center', marginTop: 4 },
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 10,
    justifyContent: 'flex-start',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 35,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 60,
  },
  titleX: {
    color: '#3B56FF',
  },
  avatarContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 40,
  },
  avatarImage: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    borderColor: '#3045FF',
  },
  avatarPlaceholder: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#1A1A1A',
    borderWidth: 2,
    borderColor: '#3045FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 45,
  },
  footer: {
    marginTop: 'auto',
    marginBottom: 40,
    alignItems: 'center',
  },
  logoutButton: {
    width: '100%',
    height: 54,
    backgroundColor: '#C5221F',
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 95,
  },
  logoutButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});