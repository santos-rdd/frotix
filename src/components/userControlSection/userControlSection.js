import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import CadastrarUsuario from '../cadastrarUsuario/cadastrarUsuario';
import GerenciarUsuariosGrid from '../gerenciarUsuariosGrid/gerenciarUsuariosGrid';

export default function UserControlSection() {
  const [currentScreen, setCurrentScreen] = useState('menu');

  if (currentScreen === 'cadastrar') {
    return <CadastrarUsuario onBack={() => setCurrentScreen('menu')} />;
  }

  if (currentScreen === 'gerenciar') {
    return <GerenciarUsuariosGrid onBack={() => setCurrentScreen('menu')} />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Controle de usuários</Text>

      <TouchableOpacity 
        style={styles.userOptionBtn} 
        onPress={() => setCurrentScreen('cadastrar')} 
        activeOpacity={0.8}
      >
        <View style={styles.btnIconCircle}>
          <Feather name="plus" size={18} color="#000000" />
        </View>
        <Text style={styles.userOptionText}>Cadastrar Novo Usuário</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.userOptionBtn} 
        onPress={() => setCurrentScreen('gerenciar')} 
        activeOpacity={0.8}
      >
        <View style={styles.btnIconCircle}>
          <Feather name="plus" size={18} color="#000000" />
        </View>
        <Text style={styles.userOptionText}>Gerenciar Usuário</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    marginTop: 16 
  },
  sectionTitle: { 
    fontSize: 22, 
    fontWeight: '600', 
    color: '#FFFFFF', 
    marginBottom: 16 
  },
  userOptionBtn: { 
    backgroundColor: '#F8FAFC', 
    borderRadius: 20, 
    paddingVertical: 18, 
    paddingHorizontal: 20, 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 12 
  },
  btnIconCircle: { 
    width: 32, 
    height: 32, 
    borderRadius: 16, 
    borderWidth: 1.5, 
    borderColor: '#000000', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 12 
  },
  userOptionText: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: '#0F172A' 
  }
});
