import React, { useEffect, useState } from 'react';
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
  Platform,
  ActivityIndicator
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { listarCategorias, listarFormas, listarRotas, registrarTransacao, enviarComprovante } from '../../services/frotix.js';
import { descreverForma } from '../../constants/formasPagamento.js';
import {
  salvarTransacaoOffline,
  listarCategoriasLocais,
  atualizarCacheCategorias,
  listarFormasPagamentoLocais,
  salvarFormasPagamentoLocais,
  listarRotasLocais,
  atualizarCacheRotas,
} from '../../services/localDataService.js';
import { obterUsuarioLogado } from '../../services/api.js';

function prepararViagensPermitidas(rotas, usuarioId, perfil) {
  const unicas = new Map();
  for (const rota of rotas || []) {
    const motoristaId = rota.motoristaId || rota.id_motorista || rota.motorista_id;
    if (Number(perfil) === 4 && motoristaId && String(motoristaId) !== String(usuarioId)) continue;
    const id = rota.id || rota.idLocal;
    if (!id) continue;
    const status = typeof rota.status === 'object' ? rota.status?.label : rota.status;
    const partes = [`${rota.origem || 'Origem'} → ${rota.destino || 'Destino'}`];
    if (rota.dataInicial || rota.data_saida) partes.push(rota.dataInicial || rota.data_saida);
    if (status) partes.push(String(status));
    unicas.set(String(id), { ...rota, id, label: partes.join(' · ') });
  }
  return Array.from(unicas.values());
}

export default function TransactionFormScreen({ route, navigation }) {
  const { actionType, amountValue, formaPagamento, idFormaPagamento } = route.params || { actionType: 'entrada', amountValue: '0' };

  const [step, setStep] = useState('form');
  const [salvoLocalmente, setSalvoLocalmente] = useState(false);

  const [formData, setFormData] = useState({
    descricao: '',
    categoria: '',
    formaPagamento: formaPagamento || '',
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

  const [categorias, setCategorias] = useState([]);
  const [formas, setFormas] = useState([]);
  const [viagens, setViagens] = useState([]);
  const [idViagem, setIdViagem] = useState(null);
  const [carregandoViagens, setCarregandoViagens] = useState(false);
  const [erroViagens, setErroViagens] = useState(null);
  const [idCategoria, setIdCategoria] = useState(null);
  const [idForma, setIdForma] = useState(idFormaPagamento || null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    (async () => {
      const usuarioLogado = await obterUsuarioLogado();
      const uId = usuarioLogado?.id || usuarioLogado?.sub || route.params?.usuario?.id;
      if (uId) {
        try {
          const catsLocais = await listarCategoriasLocais(uId);
          if (catsLocais && catsLocais.length > 0) setCategorias(catsLocais);
          const formasLocais = await listarFormasPagamentoLocais(uId);
          if (formasLocais && formasLocais.length > 0) setFormas(formasLocais);
        } catch {}
      }

      listarCategorias()
        .then((res) => {
          setCategorias(res || []);
          if (uId) atualizarCacheCategorias(uId, res || []).catch(() => {});
        })
        .catch(() => {});

      listarFormas()
        .then((res) => {
          setFormas(res || []);
          if (uId) salvarFormasPagamentoLocais(uId, res || []).catch(() => {});
        })
        .catch(() => {});
    })();
  }, [route?.params?.usuario?.id]);

  useEffect(() => {
    let ativo = true;
    const carregarViagens = async () => {
      setCarregandoViagens(true);
      setErroViagens(null);
      let usuarioId = null;
      let perfil = route.params?.usuario?.role || route.params?.usuario?.id_perfil;
      let rotasLocais = [];

      try {
        const usuarioLogado = await obterUsuarioLogado();
        usuarioId = usuarioLogado?.id || usuarioLogado?.sub || route.params?.usuario?.id;
        perfil = usuarioLogado?.perfil || perfil;

        if (usuarioId) {
          try {
            rotasLocais = await listarRotasLocais(usuarioId);
            if (ativo && rotasLocais.length) {
              setViagens(prepararViagensPermitidas(rotasLocais, usuarioId, perfil));
            }
          } catch (erroCache) {
            console.warn('Não foi possível ler o cache das viagens:', erroCache?.message || erroCache);
          }
        }

        const rotasRemotas = await listarRotas();
        if (!ativo) return;
        let rotasDisponiveis = rotasRemotas || [];
        if (usuarioId) {
          try {
            await atualizarCacheRotas(usuarioId, rotasRemotas || []);
            const cacheAtualizado = await listarRotasLocais(usuarioId);
            if (cacheAtualizado.length) rotasDisponiveis = cacheAtualizado;
          } catch (erroCache) {
            console.warn('Não foi possível atualizar o cache das viagens:', erroCache?.message || erroCache);
          }
        }
        setViagens(prepararViagensPermitidas(rotasDisponiveis, usuarioId, perfil));
      } catch (erro) {
        if (ativo) {
          setViagens(prepararViagensPermitidas(rotasLocais, usuarioId, perfil));
          if (!rotasLocais.length) setErroViagens(erro.message || 'Não foi possível carregar as viagens.');
        }
      } finally {
        if (ativo) setCarregandoViagens(false);
      }
    };

    carregarViagens();
    return () => {
      ativo = false;
    };
  }, [route?.params?.usuario?.id, route?.params?.usuario?.role]);

  const updateNumericField = (field, value) => {
    const cleanedValue = value.replace(/[^0-9.,]/g, '');
    updateField(field, cleanedValue);
  };

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const openSelectionModal = (type) => {
    let options = [];
    if (type === 'categoria') {
      const tipo = actionType === 'entrada' ? 'entrada' : 'saida';
      options = [...categorias.filter((c) => c.tipo === tipo).map((c) => c.nome), 'Outros'];
    } else if (type === 'formaPagamento') {
      options = [...formas.map(descreverForma), 'Outros'];
    } else if (type === 'estadoOuStatus') {
      options = ['Pago', 'Pendente', 'Cancelado'];
    } else if (type === 'data') {
      const hoje = new Date().toISOString().split('T')[0];
      const ontem = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      options = [hoje, ontem];
    } else if (type === 'viagem') {
      options = [
        { id: null, label: 'Sem vínculo' },
        ...viagens.map((viagem) => ({ id: viagem.id, label: viagem.label })),
      ];
    }

    setModalType(type);
    setModalOptions(options);
    setModalVisible(true);
  };

  const selectOption = (value) => {
    if (modalType === 'viagem') {
      setIdViagem(value.id || null);
    } else {
      updateField(modalType, value);
    }
    if (modalType === 'categoria') {
      setIdCategoria(categorias.find((c) => c.nome === value)?.id || null);
    } else if (modalType === 'formaPagamento') {
      setIdForma(formas.find((f) => descreverForma(f) === value)?.id || null);
    }
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

  const enviarAnexos = async (lista) => {
    const caminhos = [];
    for (const arquivo of lista) {
      caminhos.push(await enviarComprovante(arquivo));
    }
    return caminhos;
  };

  const handleFinalSubmit = async () => {
    if (enviando) return;
    if (!formData.descricao.trim()) {
      Alert.alert('Campo obrigatório', 'Informe a descrição.');
      return;
    }
    const valor = parseFloat(String(formData.valorParcela).replace(',', '.'));
    if (!(valor > 0)) {
      Alert.alert('Valor inválido', 'Informe um valor maior que zero.');
      return;
    }
    if (actionType === 'divida' && !(parseInt(formData.quantidadeParcelas, 10) >= 2)) {
      Alert.alert('Parcelas', 'Uma dívida precisa ter pelo menos 2 parcelas. Para pagamento único, registre uma saída.');
      return;
    }

    setEnviando(true);
    const idLocal = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    try {
      const dataAtual = new Date().toISOString().split('T')[0];
      if (idViagem && String(idViagem).startsWith('local_')) {
        const usuarioLogado = await obterUsuarioLogado();
        const usuarioId = usuarioLogado?.id || usuarioLogado?.sub || route.params?.usuario?.id;
        if (!usuarioId) throw new Error('Faça login novamente para vincular a viagem.');

        await salvarTransacaoOffline(
          usuarioId,
          {
            idLocal,
            tipo: actionType,
            ...formData,
            idCategoria,
            idFormaPagamento: idForma,
            idViagem,
            data: formData.data || dataAtual,
          },
          { fotos, documentos, comprovantes }
        );
        setSalvoLocalmente(true);
        setStep('success');
        Animated.spring(scaleAnim, { toValue: 1, friction: 4, useNativeDriver: true }).start();
        setTimeout(() => navigation.goBack(), 2500);
        return;
      }

      const anexos = {
        fotos: await enviarAnexos(fotos),
        documentos: await enviarAnexos(documentos),
        comprovantes: await enviarAnexos(comprovantes),
      };

      await registrarTransacao({
        idLocal,
        tipo: actionType,
        ...formData,
        idCategoria,
        idFormaPagamento: idForma,
        idViagem,
        data: formData.data || dataAtual,
        anexos,
      });

      setSalvoLocalmente(false);
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
      const msg = error?.message || '';
      const ehErroConexao = /conexão|internet|network|failed|timeout|servidor|offline|econnrefused|aborted|fetch/i.test(msg);

      const usuarioLogado = await obterUsuarioLogado();
      const uId = usuarioLogado?.id || usuarioLogado?.sub || route.params?.usuario?.id;

      if (ehErroConexao && uId) {
        try {
          const dataAtual = new Date().toISOString().split('T')[0];
          await salvarTransacaoOffline(
            uId,
            {
              idLocal,
              tipo: actionType,
              ...formData,
              idCategoria,
              idFormaPagamento: idForma,
              idViagem,
              data: formData.data || dataAtual,
            },
            {
              fotos,
              documentos,
              comprovantes,
            }
          );

          setSalvoLocalmente(true);
          setStep('success');

          Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 4,
            useNativeDriver: true,
          }).start();

          setTimeout(() => {
            navigation.goBack();
          }, 2500);
          return;
        } catch (erroLocal) {
          Alert.alert('Erro ao salvar no dispositivo', erroLocal.message || 'Falha ao gravar transação local.');
          return;
        }
      }

      console.error('Erro ao enviar transação:', error);
      Alert.alert('Erro', error.message || 'Não foi possível conectar ao servidor.');
    } finally {
      setEnviando(false);
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
  const viagemSelecionada = viagens.find((viagem) => String(viagem.id) === String(idViagem));

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
            <Text style={styles.successText}>
              {salvoLocalmente ? 'Salvo no dispositivo' : 'Sucesso'}
            </Text>
            {salvoLocalmente && (
              <Text style={styles.successSubtitle}>
                O lançamento foi salvo localmente e será sincronizado assim que a conexão retornar.
              </Text>
            )}
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

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Viagem vinculada (opcional):</Text>
                  <TouchableOpacity style={styles.inputContainer} onPress={() => openSelectionModal('viagem')}>
                    <Text style={[styles.inputText, !viagemSelecionada && styles.placeholderText]}>
                      {viagemSelecionada?.label || (carregandoViagens ? 'Carregando viagens...' : 'Selecionar viagem')}
                    </Text>
                    <Feather name="chevron-down" size={20} color="#888" style={styles.iconRight} />
                  </TouchableOpacity>
                  {erroViagens ? <Text style={styles.tripError}>{erroViagens}</Text> : null}
                </View>

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
                  disabled={enviando}
                >
                  {enviando ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveButtonText}>{currentConfig.btnText}</Text>}
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
                  disabled={enviando}
                >
                  {enviando ? <ActivityIndicator color="#121212" /> : <Text style={styles.prosseguirButtonText}>Prosseguir</Text>}
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
                keyExtractor={(item, index) => (typeof item === 'string' ? `opcao-${index}` : `viagem-${item.id || 'nenhuma'}`)}
                renderItem={({ item }) => (
                  <TouchableOpacity 
                    style={styles.modalItem} 
                    onPress={() => selectOption(item)}
                  >
                    <Text style={styles.modalItemText}>{typeof item === 'string' ? item : item.label}</Text>
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
  successSubtitle: {
    color: '#BFDBFE',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 24,
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
  tripError: {
    color: '#FF8A80',
    fontSize: 12,
    marginTop: 6,
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