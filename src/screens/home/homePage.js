import React, { useState } from 'react';
import { View, StyleSheet, SafeAreaView, Text, TouchableOpacity } from 'react-native';

import AdminHomeScreen from '../adminHome/adminHomeScreen';
import GestorHomeScreen from '../gestorHome/gestorHomeScreen';
import FinanceiroHomeScreen from '../financeiroHome/financeiroHomeScreen';
import MotoristaHomeScreen from '../motoristaHome/motoristaHomeScreen';
import BottomNavigation from '../../components/bottomNavigation/bottomNavigation';

// Mapeamento dos perfis numéricos e textuais conforme a lógica original do FrotiX
// 1 = Admin, 2 = Gestor de Frota, 3 = Financeiro, 4 = Motorista
const normalizeRole = (role) => {
  if (role === 1 || role === '1' || role === 'Admin' || role === 'ADMIN') return 'ADMIN';
  if (role === 2 || role === '2' || role === 'Gestor de Frota' || role === 'GESTOR') return 'GESTOR';
  if (role === 3 || role === '3' || role === 'Financeiro' || role === 'FINANCEIRO') return 'FINANCEIRO';
  if (role === 4 || role === '4' || role === 'Motorista' || role === 'MOTORISTA') return 'MOTORISTA';
  return 'ADMIN'; // Padrão
};

export default function HomePage(props) {
  const authGoogle = props.route?.params?.auth || null;
  const bankUser = props.route?.params?.bankUser || null;

  const userName = authGoogle?.user?.givenName || bankUser?.name || 'Usuário';
  const userPhoto = authGoogle?.user?.photo || null; 
  const userRoleFromBackend = bankUser?.role || authGoogle?.user?.role || 1;

  const [activeRole, setActiveRole] = useState(normalizeRole(userRoleFromBackend));
  const [showTesterBar, setShowTesterBar] = useState(true);

  const screenProps = {
    ...props,
    userName,
    userPhoto,
    userRole: activeRole,
  };

  const renderRoleScreen = () => {
    switch (activeRole) {
      case 'ADMIN':
        return <AdminHomeScreen {...screenProps} />;
      case 'GESTOR':
        return <GestorHomeScreen {...screenProps} />;
      case 'FINANCEIRO':
        return <FinanceiroHomeScreen {...screenProps} />;
      case 'MOTORISTA':
        return <MotoristaHomeScreen {...screenProps} />;
      default:
        return <AdminHomeScreen {...screenProps} />;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* SELETOR DE PERFIL PARA TESTES E DESENVOLVIMENTO (pode ser ocultado com 1 toque) */}
      {showTesterBar && (
        <View style={styles.testerBar}>
          <View style={styles.testerHeader}>
            <Text style={styles.testerLabel}>FrotiX - Alternar Perfil:</Text>
            <TouchableOpacity onPress={() => setShowTesterBar(false)}>
              <Text style={styles.hideText}>Ocultar</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.btnRow}>
            <TouchableOpacity 
              style={[styles.btn, activeRole === 'ADMIN' && styles.btnActive]} 
              onPress={() => setActiveRole('ADMIN')}
              activeOpacity={0.8}
            >
              <Text style={styles.btnText}>1. ADM</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.btn, activeRole === 'GESTOR' && styles.btnActive]} 
              onPress={() => setActiveRole('GESTOR')}
              activeOpacity={0.8}
            >
              <Text style={styles.btnText}>2. Gestor</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.btn, activeRole === 'FINANCEIRO' && styles.btnActive]} 
              onPress={() => setActiveRole('FINANCEIRO')}
              activeOpacity={0.8}
            >
              <Text style={styles.btnText}>3. Finan</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.btn, activeRole === 'MOTORISTA' && styles.btnActive]} 
              onPress={() => setActiveRole('MOTORISTA')}
              activeOpacity={0.8}
            >
              <Text style={styles.btnText}>4. Motor.</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Tela ativa do perfil */}
      <View style={{ flex: 1 }}>
        {renderRoleScreen()}
      </View>

      {/* Barra de Navegação Inferior Padrão do FrotiX */}
      <BottomNavigation />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  testerBar: {
    backgroundColor: '#1E1E22',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  testerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  testerLabel: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: 'bold',
  },
  hideText: {
    color: '#3B56FF',
    fontSize: 11,
    fontWeight: '600',
  },
  btnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  btn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#27272A',
    alignItems: 'center',
  },
  btnActive: {
    backgroundColor: '#3B56FF',
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
});