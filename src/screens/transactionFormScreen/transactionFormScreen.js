import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Animated,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

export default function TransactionFormScreen({ route, navigation }) {
  const { actionType, amountValue } = route.params || { actionType: 'entrada', amountValue: '0' };

  const [step, setStep] = useState('form');

  const [formData, setFormData] = useState({
    descricao: '',
    categoria: '',
    formaPagamento: '',
    data: '',
    clienteOuVeiculo: '',
    estadoOuStatus: '',
    credor: '',
    valorParcela: amountValue || '',
    quantidadeParcelas: '',
    vencimentoPrimeira: '',
    valorQuitacaoAntecipada: '',
  });

  const [fotos, setFotos] = useState([]);
  const [documentos, setDocumentos] = useState([]);
  const [comprovantes, setComprovantes] = useState([]);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState('');
  const [modalOptions, setModalOptions] = useState([]);

  const scaleAnim = useState(new Animated.Value(0.5))[0];

  // Função para validar e atualizar campos numéricos (bloqueia letras e caracteres inválidos)
  const updateNumericField = (field, value) => {
    // Permite apenas números, ponto e vírgula
    const cleanedValue = value.replace(/[^0-9.,]/g, '');
    updateField(field, cleanedValue);
  };

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const openSelectionModal = (type) => {
    let options = [];
    if (type === 'categoria') {
      options = actionType === 'entrada' 
        ? ['Frete', 'Serviço Extra', 'Reembolso', 'Outros'] 
        : ['Combustível', 'Manutenção', 'Pedágio', 'Alimentação', 'Outros'];
    } else if (type === 'formaPagamento') {
      options = ['Dinheiro', 'Pix', 'Cartão de Crédito', 'Cartão de Débito', 'Boleto', 'Transferência'];
    } else if (type === 'estadoOuStatus') {
      options = ['Pago', 'Pendente', 'Cancelado'];
    } else if (type === 'data') {
      const hoje = new Date().toISOString().split('T')[0];
      const ontem = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      options = [hoje, ontem];
    }

    setModalType(type);
    setModalOptions(options);
    setModalVisible(true);
  };

  const selectOption = (value) => {
    updateField(modalType, value);
    setModalVisible(false);
  };

  const pickImage = (typeList, setTypeList) => {
    Alert.alert(
      'Selecionar Imagem',
      'Escolha a origem da imagem:',
      [
        {
          text: 'Câmera',
          onPress: async () => {
            const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
            if (!permissionResult.granted) {
              Alert.alert('Permissão negada', 'Precisamos de permissão para acessar a câmera.');
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              quality: 1,
            });
            if (!result.canceled && result.assets) {
              setTypeList(prev => [...prev, ...result.assets]);
            }
          }
        },
        {
          text: 'Galeria',
          onPress: async () => {
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permissionResult.granted) {
              Alert.alert('Permissão negada', 'Precisamos de permissão para acessar a galeria.');
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsMultipleSelection: true,
              quality: 1,
            });
            if (!result.canceled && result.assets) {
              setTypeList(prev => [...prev, ...result.assets]);
            }
          }
        },
        { text: 'Cancelar', style: 'cancel' }
      ]
    );
  };

  const pickDocument = (setTypeList) => {
    Alert.alert(
      'Selecionar Arquivo',
      'Escolha a origem do arquivo:',
      [
        {
          text: 'Câmera (Foto como Doc)',
          onPress: async () => {
            const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
            if (!permissionResult.granted) {
              Alert.alert('Permissão negada', 'Precisamos de permissão para acessar a câmera.');
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 1,
            });
            if (!result.canceled && result.assets) {
              setTypeList(prev => [...prev, ...result.assets]);
            }
          }
        },
        {
          text: 'Gerenciador / Galeria',
          onPress: async () => {
            try {
              const result = await DocumentPicker.getDocumentAsync({
                multiple: true,
                type: '*/*',
              });
              if (!result.canceled && result.assets) {
                setTypeList(prev => [...prev, ...result.assets]);
              }
            } catch (err) {
              console.log(err);
            }
          }
        },
        { text: 'Cancelar', style: 'cancel' }
      ]
    );
  };

  const handleFinalSubmit = async () => {
    try {
      const dataAtual = new Date().toISOString().split('T')[0];

      const payloadBancoDados = {
        tipo: actionType,
        ...formData,
        data: formData.data || dataAtual,
        anexos: {
          fotos: fotos.map(f => f.uri),
          documentos: documentos.map(d => d.uri),
          comprovantes: comprovantes.map(c => c.uri)
        }
      };

      const response = await fetch('http://localhost:3000/financeiro/transacoes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payloadBancoDados),
      });

      const result = await response.json();

      if (!response.ok || !result.sucesso) {
        throw new Error(result.mensagem || 'Erro ao salvar transação.');
      }

      setStep('success');

      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }).start();

      setTimeout(() => {
        navigation.goBack();
      }, 2500);

    } catch (error) {
      console.error('Erro ao enviar transação:', error);
      Alert.alert('Erro', error.message || 'Não foi possível conectar ao servidor.');
    }
  };

  const handleMainAction = () => {
    if (actionType === 'divida') {
      handleFinalSubmit();
      return;
    }

    if (step === 'form') {
      setStep('attachment');
    } else {
      handleFinalSubmit();
    }
  };

  const config = {
    entrada: {
      title: 'Registrar Entrada',
      subtitle: 'Preencha o formulário de registro',
      sectionTitle: 'Dados Gerais da Receita:',
      btnColor: '#2541ff',
      btnText: 'Salvar Entrada',
    },
    saida: {
      title: 'Registrar Saída',
      subtitle: 'Preencha o formulário de registro',
      sectionTitle: 'Dados Gerais da Despesa:',
      btnColor: '#b22222',
      btnText: 'Salvar Despesa',
    },
    divida: {
      title: 'Registrar Divida',
      subtitle: 'Preencha o formulário de registro',
      sectionTitle: 'Dados Gerais da Divida:',
      btnColor: '#b22222',
      btnText: 'Salvar Divida',
    }
  };

  const currentConfig = config[actionType] || config.entrada;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#121212' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {step !== 'success' && (
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => {
              if (step === 'attachment') {
                setStep('form');
              } else {
                navigation.goBack();
              }
            }}
          >
            <Feather name="arrow-left" size={22} color="#FFF" />
          </TouchableOpacity>
        )}

        {step === 'success' ? (
          <View style={styles.successContainer}>
            <Animated.View style={[styles.successCircle, { backgroundColor: currentConfig.btnColor, transform: [{ scale: scaleAnim }] }]}>
              <Feather name="check" size={60} color="#FFF" />
            </Animated.View>
            <Text style={styles.successText}>Sucesso</Text>
          </View>
        ) : (
          <>
            <Text style={styles.mainTitle}>{currentConfig.title}</Text>
            <Text style={styles.subtitle}>{currentConfig.subtitle}</Text>

            {step === 'attachment' && (
              <View style={styles.paginationDots}>
                <View style={[styles.dot, styles.dotInactive]} />
                <View style={[styles.dot, styles.dotActive]} />
                <View style={[styles.dot, styles.dotInactive]} />
              </View>
            )}

            {step === 'form' ? (
              <>
                <Text style={styles.sectionHeader}>{currentConfig.sectionTitle}</Text>

                {actionType === 'entrada' && (
                  <>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Descrição / Detalhes Do Lançamento</Text>
                      <View style={styles.inputContainer}>
                        <TextInput 
                          style={styles.input} 
                          placeholderTextColor="#888"
                          value={formData.descricao}
                          onChangeText={(val) => updateField('descricao', val)}
                        />
                      </View>
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Categoria De Entrada:</Text>
                      <TouchableOpacity style={styles.inputContainer} onPress={() => openSelectionModal('categoria')}>
                        <Text style={[styles.inputText, !formData.categoria && styles.placeholderText]}>
                          {formData.categoria || 'Selecione a categoria'}
                        </Text>
                        <Feather name="chevron-down" size={20} color="#888" style={styles.iconRight} />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Forma De Pagamento / Recebimento:</Text>
                      <TouchableOpacity style={styles.inputContainer} onPress={() => openSelectionModal('formaPagamento')}>
                        <Text style={[styles.inputText, !formData.formaPagamento && styles.placeholderText]}>
                          {formData.formaPagamento || 'Selecione a forma de pagamento'}
                        </Text>
                        <Feather name="chevron-down" size={20} color="#888" style={styles.iconRight} />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Data De Recebimento:</Text>
                      <TouchableOpacity style={styles.inputContainer} onPress={() => openSelectionModal('data')}>
                        <Text style={[styles.inputText, !formData.data && styles.placeholderText]}>
                          {formData.data || 'Selecione a data'}
                        </Text>
                        <Feather name="calendar" size={20} color="#888" style={styles.iconRight} />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Cliente / Tomador Do Serviço:</Text>
                      <View style={styles.inputContainer}>
                        <TextInput 
                          style={styles.input} 
                          placeholderTextColor="#888"
                          value={formData.clienteOuVeiculo}
                          onChangeText={(val) => updateField('clienteOuVeiculo', val)}
                        />
                      </View>
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Estado De Liquidação:</Text>
                      <TouchableOpacity style={styles.inputContainer} onPress={() => openSelectionModal('estadoOuStatus')}>
                        <Text style={[styles.inputText, !formData.estadoOuStatus && styles.placeholderText]}>
                          {formData.estadoOuStatus || 'Selecione o estado'}
                        </Text>
                        <Feather name="chevron-down" size={20} color="#888" style={styles.iconRight} />
                      </TouchableOpacity>
                    </View>
                  </>
                )}

                {actionType === 'saida' && (
                  <>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Descrição / Detalhes Da Despesa:</Text>
                      <View style={styles.inputContainer}>
                        <TextInput 
                          style={styles.input} 
                          placeholderTextColor="#888"
                          value={formData.descricao}
                          onChangeText={(val) => updateField('descricao', val)}
                        />
                      </View>
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Categoria De Saída:</Text>
                      <TouchableOpacity style={styles.inputContainer} onPress={() => openSelectionModal('categoria')}>
                        <Text style={[styles.inputText, !formData.categoria && styles.placeholderText]}>
                          {formData.categoria || 'Selecione a categoria'}
                        </Text>
                        <Feather name="chevron-down" size={20} color="#888" style={styles.iconRight} />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Forma De Pagamento:</Text>
                      <TouchableOpacity style={styles.inputContainer} onPress={() => openSelectionModal('formaPagamento')}>
                        <Text style={[styles.inputText, !formData.formaPagamento && styles.placeholderText]}>
                          {formData.formaPagamento || 'Selecione a forma de pagamento'}
                        </Text>
                        <Feather name="chevron-down" size={20} color="#888" style={styles.iconRight} />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Data De Vencimento:</Text>
                      <TouchableOpacity style={styles.inputContainer} onPress={() => openSelectionModal('data')}>
                        <Text style={[styles.inputText, !formData.data && styles.placeholderText]}>
                          {formData.data || 'Selecione a data'}
                        </Text>
                        <Feather name="calendar" size={20} color="#888" style={styles.iconRight} />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Vincula Com Veículo / Rota:</Text>
                      <View style={styles.inputContainer}>
                        <TextInput 
                          style={styles.input} 
                          placeholderTextColor="#888"
                          value={formData.clienteOuVeiculo}
                          onChangeText={(val) => updateField('clienteOuVeiculo', val)}
                        />
                      </View>
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Status Do Pagamento:</Text>
                      <TouchableOpacity style={styles.inputContainer} onPress={() => openSelectionModal('estadoOuStatus')}>
                        <Text style={[styles.inputText, !formData.estadoOuStatus && styles.placeholderText]}>
                          {formData.estadoOuStatus || 'Selecione o status'}
                        </Text>
                        <Feather name="chevron-down" size={20} color="#888" style={styles.iconRight} />
                      </TouchableOpacity>
                    </View>
                  </>
                )}

                {actionType === 'divida' && (
                  <>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Descrição / Título Do Contrato</Text>
                      <View style={styles.inputContainer}>
                        <TextInput 
                          style={styles.input} 
                          placeholderTextColor="#888"
                          value={formData.descricao}
                          onChangeText={(val) => updateField('descricao', val)}
                        />
                      </View>
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Credor / Instituição Financeira:</Text>
                      <View style={styles.inputContainer}>
                        <TextInput 
                          style={styles.input} 
                          placeholderTextColor="#888"
                          value={formData.credor}
                          onChangeText={(val) => updateField('credor', val)}
                        />
                      </View>
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Categoria Financeira:</Text>
                      <TouchableOpacity style={styles.inputContainer} onPress={() => openSelectionModal('categoria')}>
                        <Text style={[styles.inputText, !formData.categoria && styles.placeholderText]}>
                          {formData.categoria || 'Selecione a categoria'}
                        </Text>
                        <Feather name="chevron-down" size={20} color="#888" style={styles.iconRight} />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Veículo Vinculado:</Text>
                      <View style={styles.inputContainer}>
                        <TextInput 
                          style={styles.input} 
                          placeholderTextColor="#888"
                          value={formData.clienteOuVeiculo}
                          onChangeText={(val) => updateField('clienteOuVeiculo', val)}
                        />
                      </View>
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Valor Da Parcela (R$):</Text>
                      <View style={styles.inputContainer}>
                        <TextInput 
                          style={styles.input} 
                          placeholderTextColor="#888"
                          value={formData.valorParcela}
                          onChangeText={(val) => updateNumericField('valorParcela', val)}
                          keyboardType="numeric"
                        />
                      </View>
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Quantidade De Parcelas:</Text>
                      <View style={styles.inputContainer}>
                        <TextInput 
                          style={styles.input} 
                          placeholderTextColor="#888"
                          value={formData.quantidadeParcelas}
                          onChangeText={(val) => updateNumericField('quantidadeParcelas', val)}
                          keyboardType="numeric"
                        />
                      </View>
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Vencimento Da 1ª Parcela:</Text>
                      <TouchableOpacity style={styles.inputContainer} onPress={() => openSelectionModal('data')}>
                        <Text style={[styles.inputText, !formData.vencimentoPrimeira && styles.placeholderText]}>
                          {formData.vencimentoPrimeira || 'Selecione a data'}
                        </Text>
                        <Feather name="calendar" size={20} color="#888" style={styles.iconRight} />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Valor Para Quitação Antecipada (R$):</Text>
                      <View style={styles.inputContainer}>
                        <TextInput 
                          style={styles.input} 
                          placeholderTextColor="#888"
                          value={formData.valorQuitacaoAntecipada}
                          onChangeText={(val) => updateNumericField('valorQuitacaoAntecipada', val)}
                          keyboardType="numeric"
                        />
                      </View>
                    </View>
                  </>
                )}

                <TouchableOpacity 
                  style={[styles.saveButton, { backgroundColor: currentConfig.btnColor }]}
                  onPress={handleMainAction}
                >
                  <Text style={styles.saveButtonText}>{currentConfig.btnText}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
                  <Text style={styles.cancelButtonText}>Voltar</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.attachmentContainer}>
                <Text style={styles.sectionHeader}>Anexar arquivo:</Text>

                <TouchableOpacity 
                  style={[styles.attachmentButton, { backgroundColor: currentConfig.btnColor }]}
                  onPress={() => pickImage(fotos, setFotos)}
                >
                  <Ionicons name="add-circle-outline" size={20} color="#FFF" style={{ marginRight: 8 }} />
                  <Text style={styles.attachmentButtonText}>
                    Anexar Foto {fotos.length > 0 ? `(${fotos.length})` : ''}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.attachmentButton, { backgroundColor: currentConfig.btnColor }]}
                  onPress={() => pickDocument(setDocumentos)}
                >
                  <Ionicons name="add-circle-outline" size={20} color="#FFF" style={{ marginRight: 8 }} />
                  <Text style={styles.attachmentButtonText}>
                    Anexar Documento {documentos.length > 0 ? `(${documentos.length})` : ''}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.attachmentButton, { backgroundColor: currentConfig.btnColor }]}
                  onPress={() => pickDocument(setComprovantes)}
                >
                  <Ionicons name="add-circle-outline" size={20} color="#FFF" style={{ marginRight: 8 }} />
                  <Text style={styles.attachmentButtonText}>
                    Anexar Comprovante {comprovantes.length > 0 ? `(${comprovantes.length})` : ''}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.prosseguirButton}
                  onPress={handleMainAction}
                >
                  <Text style={styles.prosseguirButtonText}>Prosseguir</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.cancelButton} 
                  onPress={() => setStep('form')}
                >
                  <Text style={styles.cancelButtonText}>Voltar</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {/* Modal de Seleção */}
        <Modal
          visible={modalVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Selecione uma opção</Text>
              <FlatList
                data={modalOptions}
                keyExtractor={(item, index) => index.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity 
                    style={styles.modalItem} 
                    onPress={() => selectOption(item)}
                  >
                    <Text style={styles.modalItemText}>{item}</Text>
                  </TouchableOpacity>
                )}
              />
              <TouchableOpacity 
                style={styles.modalCloseButton} 
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalCloseButtonText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
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
    marginBottom: 15,
  },
  mainTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#888',
    fontSize: 13,
    marginBottom: 15,
  },
  paginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 24,
    backgroundColor: '#2541ff',
  },
  dotInactive: {
    backgroundColor: '#555',
  },
  sectionHeader: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 15,
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    color: '#CCC',
    fontSize: 12,
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
  },
  input: {
    flex: 1,
    color: '#FFF',
    fontSize: 14,
  },
  inputText: {
    flex: 1,
    color: '#FFF',
    fontSize: 14,
  },
  placeholderText: {
    color: '#888',
  },
  iconRight: {
    marginLeft: 8,
  },
  saveButton: {
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 12,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  attachmentContainer: {
    marginTop: 10,
  },
  attachmentButton: {
    height: 50,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  attachmentButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  prosseguirButton: {
    height: 50,
    borderRadius: 14,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 12,
  },
  prosseguirButtonText: {
    color: '#121212',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    height: 50,
    borderRadius: 14,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#121212',
    fontSize: 16,
    fontWeight: '600',
  },
  successContainer: {
    flex: 1,
    height: 600,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  successText: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1e1e1e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '50%',
  },
  modalTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  modalItemText: {
    color: '#FFF',
    fontSize: 16,
  },
  modalCloseButton: {
    marginTop: 15,
    backgroundColor: '#b22222',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});