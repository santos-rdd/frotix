import React, { useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/theme';

const ROLES = [
  'Administrador',
  'Gestor de Frota',
  'Financeiro',
  'Motorista',
];

export default function CadastrarUsuario({ onBack }) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [formaAcesso, setFormaAcesso] = useState('email'); // 'email' ou 'gmail'
  const [perfil, setPerfil] = useState('Motorista');
  const [modalVisible, setModalVisible] = useState(false);

  const handleSalvar = () => {
    if (!nome.trim() || !email.trim()) {
      Alert.alert('Erro', 'Por favor, preencha todos os campos.');
      return;
    }
    Alert.alert('Sucesso', `Usuário ${nome} (${perfil}) cadastrado no FrotiX!`);
    if (onBack) onBack();
  };

  return (
    <View style={styles.container}>
      {/* Botão Voltar */}
      <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
        <Feather name="chevron-left" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      <Text style={styles.title}>
        Cadastrar usuário no <Text style={styles.brandTitle}>FrotiX</Text>
      </Text>

      {/* Input Nome */}
      <Text style={styles.label}>Nome</Text>
      <TextInput
        style={styles.input}
        value={nome}
        onChangeText={setNome}
        placeholder="Digite o nome completo"
        placeholderTextColor="#6B7280"
      />

      {/* Input E-mail */}
      <Text style={styles.label}>E-mail</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="exemplo@frotix.com.br"
        keyboardType="email-address"
        autoCapitalize="none"
        placeholderTextColor="#6B7280"
      />

      {/* Forma de Acesso */}
      <Text style={styles.labelSection}>Forma de acesso:</Text>
      
      <TouchableOpacity 
        style={[styles.accessBtn, formaAcesso === 'email' && styles.accessBtnActive]}
        onPress={() => setFormaAcesso('email')}
        activeOpacity={0.8}
      >
        <Text style={styles.accessBtnText}>E-mail e Senha</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.gmailBtn, formaAcesso === 'gmail' && styles.gmailBtnActive]}
        onPress={() => setFormaAcesso('gmail')}
        activeOpacity={0.8}
      >
        <Ionicons name="logo-google" size={18} color="#EA4335" style={{ marginRight: 8 }} />
        <Text style={styles.gmailBtnText}>Entrar com Gmail</Text>
      </TouchableOpacity>

      {/* Dropdown de Perfil */}
      <Text style={styles.labelSection}>Perfil:</Text>
      <TouchableOpacity 
        style={styles.dropdown}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.dropdownText}>{perfil}</Text>
        <Feather name="chevron-down" size={20} color="#000000" />
      </TouchableOpacity>

      {/* Modal para seleção do perfil */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Selecione o Perfil</Text>
            {ROLES.map((item) => (
              <TouchableOpacity
                key={item}
                style={[styles.modalOption, perfil === item && styles.modalOptionActive]}
                onPress={() => {
                  setPerfil(item);
                  setModalVisible(false);
                }}
              >
                <Text style={[styles.modalOptionText, perfil === item && styles.modalOptionTextActive]}>
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity 
              style={styles.modalCancelBtn} 
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.modalCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Botão Salvar */}
      <TouchableOpacity style={styles.saveBtn} onPress={handleSalvar} activeOpacity={0.8}>
        <Text style={styles.saveBtnText}>Salvar</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    marginTop: 10 
  },
  backBtn: { 
    marginBottom: 16,
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  title: { 
    fontSize: 22, 
    fontWeight: 'bold', 
    color: '#FFFFFF', 
    marginBottom: 24 
  },
  brandTitle: { 
    color: '#3B56FF' 
  },
  label: { 
    fontSize: 12, 
    color: '#D1D5DB', 
    marginTop: 12 
  },
  input: { 
    borderBottomWidth: 1, 
    borderBottomColor: '#4B5563', 
    color: '#FFFFFF', 
    fontSize: 16, 
    paddingVertical: 8, 
    marginBottom: 16 
  },
  labelSection: { 
    fontSize: 14, 
    fontWeight: '600', 
    color: '#FFFFFF', 
    marginTop: 12, 
    marginBottom: 8 
  },
  accessBtn: { 
    backgroundColor: '#2563EB', 
    paddingVertical: 14, 
    borderRadius: 16, 
    alignItems: 'center', 
    marginBottom: 10 
  },
  accessBtnActive: { 
    borderWidth: 2, 
    borderColor: '#FFFFFF' 
  },
  accessBtnText: { 
    color: '#FFFFFF', 
    fontWeight: 'bold', 
    fontSize: 15 
  },
  gmailBtn: { 
    borderWidth: 1, 
    borderColor: '#2563EB', 
    paddingVertical: 14, 
    borderRadius: 16, 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 16,
    backgroundColor: 'transparent',
  },
  gmailBtnActive: { 
    backgroundColor: '#1E293B' 
  },
  gmailBtnText: { 
    color: '#3B82F6', 
    fontWeight: 'bold', 
    fontSize: 15 
  },
  dropdown: { 
    backgroundColor: '#F8FAFC', 
    borderRadius: 16, 
    padding: 16, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 24 
  },
  dropdownText: { 
    color: '#0F172A', 
    fontWeight: 'bold', 
    fontSize: 16 
  },
  saveBtn: { 
    backgroundColor: '#3B56FF', 
    paddingVertical: 16, 
    borderRadius: 16, 
    alignItems: 'center' 
  },
  saveBtnText: { 
    color: '#FFFFFF', 
    fontWeight: 'bold', 
    fontSize: 16 
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#1E1E22',
    borderRadius: 20,
    width: '100%',
    padding: 20,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalOption: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#27272A',
  },
  modalOptionActive: {
    backgroundColor: '#3B56FF',
  },
  modalOptionText: {
    color: '#FFFFFF',
    fontSize: 15,
  },
  modalOptionTextActive: {
    fontWeight: 'bold',
  },
  modalCancelBtn: {
    marginTop: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
});
