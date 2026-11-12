import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Modal,
  FlatList
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';

export default function UserDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  
  const usuario = route.params?.usuario || {
    id: '1',
    nome: 'Carlos Silva',
    email: 'carlos.silva@frotix.com',
    role: 'Motorista',
    foto: null,
    accessType: 'email'
  };

  const [nome, setNome] = useState(usuario.nome);
  const [email, setEmail] = useState(usuario.email);
  const [perfil, setPerfil] = useState(usuario.role || 'Motorista');
  const [modalVisible, setModalVisible] = useState(false);

  const perfisDisponíveis = [
    'Motorista',
    'Gestor de Frota',
    'Financeiro',
    'Administrador'
  ];

  const handleSave = () => {
    const updatedUser = {
      id: usuario.id,
      nome,
      email,
      perfil,
    };
    console.log('USUÁRIO ATUALIZADO:', updatedUser);
    navigation.goBack();
  };

  const handleDelete = () => {
    console.log('REMOVER USUÁRIO ID:', usuario.id);
    navigation.goBack();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Feather name="arrow-left" size={22} color="#FFF" />
      </TouchableOpacity>

      <Text style={styles.title}>Gerenciar Usuário</Text>

      <View style={styles.avatarContainer}>
        {usuario.foto ? (
          <Image source={{ uri: usuario.foto }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Feather name="user" size={40} color="#2541ff" />
          </View>
        )}
      </View>

      <View style={styles.inputGroup}>
        <TextInput
          style={styles.inputLine}
          placeholder="Name"
          placeholderTextColor="#888"
          value={nome}
          onChangeText={setNome}
        />
      </View>

      <View style={styles.inputGroup}>
        <TextInput
          style={styles.inputLine}
          placeholder="e-mail"
          placeholderTextColor="#888"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      <TouchableOpacity style={styles.accessButtonDark}>
        <Ionicons name="logo-google" size={18} color="#4285F4" style={{ marginRight: 8 }} />
        <Text style={styles.accessButtonDarkText}>Entrar com Gmail</Text>
      </TouchableOpacity>

      <Text style={styles.sectionLabel}>Perfil:</Text>

      <TouchableOpacity style={styles.selectBox} onPress={() => setModalVisible(true)}>
        <Text style={styles.selectBoxText}>{perfil}</Text>
        <Feather name="chevron-down" size={20} color="#121212" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.removeButton} onPress={handleDelete}>
        <Text style={styles.removeButtonText}>Remover usuário</Text>
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
    marginBottom: 10,
  },
  title: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 25,
  },
  avatarImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  avatarPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLine: {
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 25,
    color: '#FFF',
    fontSize: 14,
    paddingHorizontal: 20,
    height: 50,
    backgroundColor: '#1a1a1a',
  },
  sectionLabel: {
    color: '#FFF',
    fontSize: 14,
    marginBottom: 8,
  },
  accessButtonDark: {
    width: '100%',
    height: 50,
    borderRadius: 25,
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  selectBoxText: {
    color: '#121212',
    fontSize: 15,
    fontWeight: '600',
  },
  removeButton: {
    width: '100%',
    height: 50,
    borderRadius: 14,
    backgroundColor: '#b22222',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  removeButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  saveButton: {
    width: '100%',
    height: 50,
    borderRadius: 14,
    backgroundColor: '#2541ff',
    justifyContent: 'center',
    alignItems: 'center',
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