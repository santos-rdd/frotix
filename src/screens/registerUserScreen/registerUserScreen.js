import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  FlatList
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

export default function RegisterUserScreen() {
  const navigation = useNavigation();

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [accessMethod, setAccessMethod] = useState('email');
  const [perfil, setPerfil] = useState('Motorista');
  const [modalVisible, setModalVisible] = useState(false);

  const perfisDisponíveis = [
    'Motorista',
    'Gestor de Frota',
    'Financeiro',
    'Admin'
  ];

  const handleSave = () => {
    const userData = {
      nome,
      email,
      accessMethod,
      perfil,
    };
    console.log('DADOS DO NOVO USUÁRIO:', userData);
    navigation.goBack();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Feather name="arrow-left" size={22} color="#FFF" />
      </TouchableOpacity>

      <Text style={styles.title}>
        Cadastrar usuário no Froti<Text style={{ color: '#2541ff' }}>X</Text>
      </Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Nome</Text>
        <TextInput
          style={styles.inputLine}
          placeholderTextColor="#888"
          value={nome}
          onChangeText={setNome}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>E-mail</Text>
        <TextInput
          style={styles.inputLine}
          placeholderTextColor="#888"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      <Text style={styles.sectionLabel}>Forma de acesso:</Text>

      <TouchableOpacity
        style={[
          styles.accessButtonBlue,
          accessMethod === 'email' && styles.accessButtonActive
        ]}
        onPress={() => setAccessMethod('email')}
      >
        <Text style={styles.accessButtonBlueText}>E-mail e Senha</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.accessButtonDark,
          accessMethod === 'gmail' && styles.accessButtonActive
        ]}
        onPress={() => setAccessMethod('gmail')}
      >
        <Ionicons name="logo-google" size={18} color="#4285F4" style={{ marginRight: 8 }} />
        <Text style={styles.accessButtonDarkText}>Entrar com Gmail</Text>
      </TouchableOpacity>

      <Text style={styles.sectionLabel}>Perfil:</Text>

      <TouchableOpacity style={styles.selectBox} onPress={() => setModalVisible(true)}>
        <Text style={styles.selectBoxText}>{perfil}</Text>
        <Feather name="chevron-down" size={20} color="#121212" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Salvar</Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Selecione o Perfil</Text>
            <FlatList
              data={perfisDisponíveis}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setPerfil(item);
                    setModalVisible(false);
                  }}
                >
                  <Text style={[styles.modalItemText, perfil === item && styles.modalItemTextActive]}>
                    {item}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
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
    marginBottom: 30,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    color: '#FFF',
    fontSize: 14,
    marginBottom: 6,
  },
  inputLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#555',
    color: '#FFF',
    fontSize: 14,
    paddingBottom: 4,
  },
  sectionLabel: {
    color: '#FFF',
    fontSize: 14,
    marginBottom: 12,
    marginTop: 5,
  },
  accessButtonBlue: {
    width: '100%',
    height: 50,
    borderRadius: 14,
    backgroundColor: '#2541ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  accessButtonBlueText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  accessButtonDark: {
    width: '100%',
    height: 50,
    borderRadius: 14,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2541ff',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  accessButtonDarkText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  selectBox: {
    width: '100%',
    height: 50,
    borderRadius: 14,
    backgroundColor: '#FFF',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 30,
  },
  selectBoxText: {
    color: '#121212',
    fontSize: 15,
    fontWeight: '600',
  },
  saveButton: {
    width: '80%',
    height: 50,
    borderRadius: 14,
    backgroundColor: '#2541ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 35
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  modalTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalItem: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  modalItemText: {
    color: '#AAA',
    fontSize: 16,
    textAlign: 'center',
  },
  modalItemTextActive: {
    color: '#2541ff',
    fontWeight: 'bold',
  },
});