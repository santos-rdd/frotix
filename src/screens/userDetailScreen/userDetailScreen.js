import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Modal,
  FlatList,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { atualizarUsuario, desativarUsuario } from '../../services/frotix.js';
import { PERFIS, nomePerfil, idPerfil } from '../../constants/perfis.js';
import { useNavigation, useRoute } from '@react-navigation/native';
import { obterUsuarioLogado } from '../../services/api.js';

export default function UserDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  
  useEffect(() => {
    let montado = true;
    obterUsuarioLogado().then((user) => {
      const perfilLogado = route?.params?.usuarioLogado?.role || user?.perfil;
      if (perfilLogado && Number(perfilLogado) !== 1) {
        if (montado) {
          Alert.alert('Acesso Restrito', 'A edição de usuários é exclusiva do Administrador.');
          navigation.goBack();
        }
      }
    });
    return () => { montado = false; };
  }, [navigation, route?.params?.usuarioLogado?.role]);

  // Usuário escolhido na lista (dados do banco: { id, nome, email, perfil }).
  const usuario = route.params?.usuario || {};

  const [nome, setNome] = useState(usuario.nome || '');
  const [perfil, setPerfil] = useState(nomePerfil(usuario.perfil));
  const [modalVisible, setModalVisible] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const perfisDisponíveis = PERFIS.map((p) => p.nome);

  const handleSave = async () => {
    if (!nome.trim()) {
      Alert.alert('Campo obrigatório', 'Informe o nome.');
      return;
    }
    setSalvando(true);
    try {
      await atualizarUsuario(usuario.id, { nome: nome.trim(), perfil: idPerfil(perfil) });
      Alert.alert('Usuário atualizado', `${nome.trim()} · ${perfil}`);
      navigation.goBack();
    } catch (e) {
      Alert.alert('Não foi possível salvar', e.message);
    } finally {
      setSalvando(false);
    }
  };

  // "Remover" desativa a conta: ela some da lista e não consegue mais entrar.
  const handleDelete = () => {
    Alert.alert('Remover usuário', `Deseja remover o acesso de ${usuario.nome}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          try {
            await desativarUsuario(usuario.id);
            navigation.goBack();
          } catch (e) {
            Alert.alert('Não foi possível remover', e.message);
          }
        },
      },
    ]);
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

      {/* Erro P9: o e-mail aparecia vazio e havia um botão "Entrar com Gmail" sem função.
          O e-mail é o login da pessoa, então aparece só para leitura. */}
      <View style={styles.inputGroup}>
        <Text style={[styles.inputLine, styles.inputSomenteLeitura]} numberOfLines={1}>
          {usuario.email || 'E-mail não informado'}
        </Text>
      </View>

      <Text style={styles.sectionLabel}>Perfil:</Text>

      <TouchableOpacity style={styles.selectBox} onPress={() => setModalVisible(true)}>
        <Text style={styles.selectBoxText}>{perfil}</Text>
        <Feather name="chevron-down" size={20} color="#121212" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.removeButton} onPress={handleDelete}>
        <Text style={styles.removeButtonText}>Remover usuário</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={salvando}>
        {salvando ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveButtonText}>Salvar</Text>}
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
  inputSomenteLeitura: {
    color: '#AAA',
    paddingVertical: 14,
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