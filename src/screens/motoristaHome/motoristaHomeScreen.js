import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Image,
  Animated,
  Dimensions,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import BottomNavigation from '../../components/bottomNavigation/bottomNavigation.js';
import QuickActionsCards from '../../components/quickActionsCards/quickActionsCards.js';
import PaymentCardsCarousel from '../../components/paymentCardsCarousel/paymentCardsCarousel.js';
import InteractiveCarousel from '../../components/interactiveCarousel/interactiveCarousel.js';
import ViagemAtualCard from '../../components/viagemAtualCard/viagemAtualCard.js';
import RegistrarHodometroButton from '../../components/registrarHodometroButton/registrarHodometroButton.js';
import ValueSliderModal from '../../components/valueSliderModal/valueSliderModal.js';
import { colors } from '../../constants/theme.js';

import {
  listarVeiculos,
  listarRotas,
  listarViagensEmAndamento,
  listarFormas,
} from '../../services/frotix.js';

import {
  listarVeiculosPermitidosLocais,
  listarRotasLocais,
  listarViagensLocais,
  atualizarCacheVeiculos,
  atualizarCacheRotas,
} from '../../services/localDataService.js';

import { obterUsuarioLogado } from '../../services/api.js';
import useDados from '../../hooks/useDados.js';
import EstadoDados from '../../components/estadoDados/estadoDados.js';
import { iniciarRastreamento, pararRastreamento } from '../../services/rastreamentoService.js';

const { height } = Dimensions.get('window');

export default function MotoristaHomeScreen(props) {
  const insets = useSafeAreaInsets();

  const safeAreaPadding = {
    paddingTop: insets.top,
    paddingRight: insets.right,
    paddingBottom: insets.bottom,
    paddingLeft: insets.left,
  };

  const navigation = props.navigation;
  const route = props.route || {};
  const authGoogle = route?.params?.auth || null;
  const authenticatedUser = route?.params?.authenticatedUser || {};
  const bankUser = route?.params?.bankUser || null;
  const usuarioParam = route?.params?.usuario || {};

  const [usuarioId, setUsuarioId] = useState(
    authenticatedUser.id || bankUser?.id || usuarioParam?.id
      ? String(authenticatedUser.id || bankUser?.id || usuarioParam?.id)
      : null
  );

  const [usuarioNome, setUsuarioNome] = useState(
    authenticatedUser.nome ||
      props.userName ||
      usuarioParam?.nome ||
      authGoogle?.user?.givenName ||
      bankUser?.nome ||
      bankUser?.name ||
      'Motorista'
  );

  const usuarioFoto =
    props.userPhoto ||
    usuarioParam?.foto ||
    authGoogle?.user?.photo ||
    bankUser?.imagem ||
    null;

  const [usuarioRole, setUsuarioRole] = useState(
    authenticatedUser.role ||
      bankUser?.role ||
      authGoogle?.user?.role ||
      usuarioParam?.role ||
      4
  );

  // Os dois cartões apenas alternam o conteúdo exibido abaixo.
  const [selectedAction, setSelectedAction] = useState('finance');
  const [formasPagamento, setFormasPagamento] = useState([]);
  const [viagemSelecionada, setViagemSelecionada] = useState(null);
  const [viagensUsandoCache, setViagensUsandoCache] = useState(false);

  const [isSliderVisible, setIsSliderVisible] = useState(false);
  const [actionType, setActionType] = useState('entrada');
  const [amountValue, setAmountValue] = useState('0');
  const [isEditingAmount, setIsEditingAmount] = useState(false);

  const slideAnim = useRef(new Animated.Value(height)).current;

  const carregarDadosMotorista = useCallback(async () => {
    try {
      const uLogado = await obterUsuarioLogado();

      const id = uLogado?.id || uLogado?.sub || usuarioParam?.id;
      const nome = uLogado?.nome || usuarioNome;
      const perfil = uLogado?.perfil ?? usuarioRole;

      if (id) setUsuarioId(String(id));

      setUsuarioNome(nome || 'Motorista');
      setUsuarioRole(Number(perfil) || 4);

      return id;
    } catch {
      return null;
    }
  }, [usuarioNome, usuarioRole, usuarioParam?.id]);

  const carregarVeiculos = useCallback(async () => {
    if (!usuarioId) return [];

    try {
      const servidor = await listarVeiculos();

      await atualizarCacheVeiculos(
        usuarioId,
        servidor || []
      ).catch(() => {});

      return servidor || [];
    } catch {
      return await listarVeiculosPermitidosLocais(usuarioId);
    }
  }, [usuarioId]);

  const carregarRotas = useCallback(async () => {
    if (!usuarioId) return [];

    try {
      const servidor = await listarRotas();

      await atualizarCacheRotas(
        usuarioId,
        servidor || []
      ).catch(() => {});

      return servidor || [];
    } catch {
      return await listarRotasLocais(usuarioId);
    }
  }, [usuarioId]);

  const carregarViagens = useCallback(async () => {
    if (!usuarioId) {
      setViagensUsandoCache(false);
      return [];
    }

    try {
      const servidor = await listarViagensEmAndamento();

      setViagensUsandoCache(false);

      return Array.isArray(servidor) ? servidor : [];
    } catch {
      setViagensUsandoCache(true);

      const locais = await listarViagensLocais(usuarioId);

      return (locais || []).filter(
        (viagem) => viagem.status === 'em_transito'
      );
    }
  }, [usuarioId]);

  useEffect(() => {
    carregarDadosMotorista();
  }, [carregarDadosMotorista]);

  useEffect(() => {
    let ativo = true;

    const carregarFormasPagamento = async () => {
      try {
        const formas = await listarFormas();

        if (ativo) {
          setFormasPagamento(
            Array.isArray(formas) ? formas : []
          );
        }
      } catch {
        if (ativo) setFormasPagamento([]);
      }
    };

    carregarFormasPagamento();

    return () => {
      ativo = false;
    };
  }, []);

  const {
    dados: veiculos,
    carregando: carregandoVeiculos,
    erro: erroVeiculos,
    recarregar: recarregarVeiculos,
  } = useDados(carregarVeiculos, []);

  const {
    dados: rotas,
    carregando: carregandoRotas,
    erro: erroRotas,
    recarregar: recarregarRotas,
  } = useDados(carregarRotas, []);

  const {
    dados: viagensEmAndamento,
    carregando: carregandoViagens,
    erro: erroViagens,
    recarregar: recarregarViagens,
  } = useDados(carregarViagens, []);

  const veiculosLista = veiculos || [];
  const rotasLista = rotas || [];
  const andamentoLista = viagensEmAndamento || [];

  const rotasAgendadas = rotasLista.filter(
    (rota) => rota.status === 'agendada'
  );

  const viagemEmAndamento = andamentoLista[0] || null;

  const rotaEmDestaque =
    viagemEmAndamento || rotasAgendadas[0] || null;

  const idViagemEmAndamento = viagemEmAndamento?.id ? String(viagemEmAndamento.id) : null;

  // Enquanto houver viagem em andamento, envia o GPS para o mapa do Admin/Gestor.
  // Para sozinho quando a viagem é concluída (a lista volta vazia) ou a tela sai.
  useEffect(() => {
    if (!usuarioId || !idViagemEmAndamento) {
      pararRastreamento();
      return undefined;
    }
    let ativo = true;
    iniciarRastreamento({ usuarioId, viagemId: idViagemEmAndamento }).then((r) => {
      if (!ativo || r.ativo) return;
      if (r.motivo === 'sem_permissao') {
        Alert.alert(
          'Localização desativada',
          'Sem a permissão de localização, o gestor não consegue acompanhar em que ponto da rota você está.'
        );
      } else if (r.motivo === 'gps_desligado') {
        Alert.alert('GPS desligado', 'Ligue a localização do celular para compartilhar sua posição na rota.');
      }
    });
    return () => {
      ativo = false;
    };
  }, [usuarioId, idViagemEmAndamento]);

  useEffect(() => () => pararRastreamento(), []);

  const veiculoEmDestaque = veiculosLista.find((veiculo) =>
    [veiculo.id, veiculo.idLocal].some(
      (id) =>
        id != null &&
        String(id) === String(rotaEmDestaque?.veiculoId)
    )
  );

  const modeloEmDestaque =
    rotaEmDestaque?.veiculoModelo || veiculoEmDestaque?.modelo;

  const placaEmDestaque =
    rotaEmDestaque?.placa ||
    veiculoEmDestaque?.placa ||
    'Sem veículo atribuído';

  const carregandoDados =
    carregandoVeiculos ||
    carregandoRotas ||
    carregandoViagens;

  const erroDados =
    erroVeiculos || erroRotas || erroViagens;

  const recarregarTudo = async () => {
    await Promise.all([
      recarregarVeiculos(),
      recarregarRotas(),
      recarregarViagens(),
    ]);
  };

  const abrirViagens = () => {
    navigation.navigate('Viagens', {
      usuario: usuarioParam,
      modo: 'motorista',
    });
  };

  const handleOpenSlider = (type) => {
    setActionType(type);
    setIsSliderVisible(true);

    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const handleCloseSlider = () => {
    Animated.timing(slideAnim, {
      toValue: height,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setIsSliderVisible(false);
      setIsEditingAmount(false);
    });
  };

  const handleNextStep = () => handleCloseSlider();

  const abrirExtrato = () => {
    navigation.navigate('Extrato', {
      usuario: usuarioParam,
    });
  };

  const abrirDetalhesViagem = (viagem) => {
    if (!viagem) {
      abrirViagens();
      return;
    }

    navigation.navigate('DetalhesRota', {
      usuario: usuarioParam,
      rota: {
        id: viagem.id,
        origem: viagem.origem,
        destino: viagem.destino,
        status: 'em_transito',
        hodometroInicial:
          viagem.hodometroInicial ?? viagem.km_inicial,
        veiculoId: viagem.veiculoId,
        veiculoModelo: viagem.veiculoModelo,
        motorista: viagem.motorista,
        placa: viagem.placa,
        despesas: [],
      },
    });
  };

  if (Number(usuarioRole) !== 4) {
    return (
      <View style={[styles.container, safeAreaPadding]}>
        <Text style={styles.cityName}>
          Esta área é exclusiva para motoristas.
        </Text>
      </View>
    );
  }

  const acoesPrincipais = [
    {
      id: 'finance',
      name: 'Financeiro',
      image: '',
    },
    {
      id: 'routes',
      name: 'Rotas',
      image: '',
    },
  ];

  return (
    <View style={[styles.container, safeAreaPadding]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Boa Tarde</Text>
            <Text style={styles.userName}>{usuarioNome}</Text>
          </View>

          {usuarioFoto ? (
            <Image
              source={{ uri: usuarioFoto }}
              style={styles.avatar}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons
                name="person"
                size={20}
                color="#FFFFFF"
              />
            </View>
          )}
        </View>

        <View style={styles.quickActionsContainer}>
          <Text style={styles.quickActionsTitle}>
            Ações Rápidas
          </Text>

          <FlatList
            data={acoesPrincipais}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.actionsCarousel}
            renderItem={({ item }) => (
              <QuickActionsCards
                {...item}
                onPress={() => setSelectedAction(item.id)}
                selectCardPass={
                  selectedAction === item.id
                    ? selectedAction
                    : null
                }
              />
            )}
          />
        </View>

        {selectedAction === 'finance' ? (
          <View>
            <PaymentCardsCarousel
              key={`formas-pagamento-${formasPagamento.length}`}
              formas={formasPagamento}
            />

            <InteractiveCarousel
              onOpenSlider={handleOpenSlider}
              onMenuAtividades={abrirExtrato}
            />
          </View>
        ) : null}

        {selectedAction === 'routes' ? (
          <View>
            {(carregandoDados || erroDados) ? (
              <EstadoDados
                carregando={carregandoDados}
                erro={erroDados}
                onTentarDeNovo={recarregarTudo}
                temDados={
                  veiculosLista.length > 0 ||
                  rotasLista.length > 0 ||
                  andamentoLista.length > 0
                }
              />
            ) : null}

            {andamentoLista.length > 0 && !viagensUsandoCache ? (
              <ViagemAtualCard
                key={`viagens-${andamentoLista.length}-${viagemEmAndamento?.id || 'lista'}`}
                viagemSelecionada={viagemSelecionada}
                onSelectViagem={setViagemSelecionada}
                onOpenTripDetails={abrirDetalhesViagem}
              />
            ) : (
              <View style={styles.tripCard}>
                <Text style={styles.tripTag}>
                  {rotaEmDestaque?.status === 'em_transito'
                    ? 'VIAGEM EM ANDAMENTO'
                    : rotaEmDestaque?.status === 'agendada'
                      ? 'VIAGEM AGENDADA'
                      : 'VIAGENS EM CURSO'}
                </Text>

                {rotaEmDestaque ? (
                  <>
                    <View style={styles.routeTimeline}>
                      <View style={styles.dotStart} />
                      <View style={styles.line} />
                      <View style={styles.dotEnd} />
                    </View>

                    <View style={styles.routeLabels}>
                      <View>
                        <Text style={styles.cityTitle}>
                          Origem
                        </Text>

                        <Text style={styles.cityName}>
                          {rotaEmDestaque.origem}
                        </Text>
                      </View>

                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.cityTitle}>
                          Destino
                        </Text>

                        <Text style={styles.cityName}>
                          {rotaEmDestaque.destino}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.licenseBox}>
                      <Text
                        style={[
                          styles.licenseText,
                          { flexShrink: 1 },
                        ]}
                        numberOfLines={1}
                      >
                        {modeloEmDestaque || 'Veículo'}
                      </Text>

                      <View style={styles.licenseDashedLine} />

                      <Text
                        style={styles.plateText}
                        numberOfLines={1}
                      >
                        {placaEmDestaque}
                      </Text>
                    </View>
                  </>
                ) : (
                  <Text style={styles.cityName}>
                    Nenhuma viagem agendada ou em andamento.
                  </Text>
                )}
              </View>
            )}

            <RegistrarHodometroButton
              viagem={
                viagensUsandoCache
                  ? null
                  : viagemSelecionada || viagemEmAndamento
              }
              onButtonPress={abrirViagens}
            />
          </View>
        ) : null}
      </ScrollView>

      <ValueSliderModal
        visible={isSliderVisible}
        actionType={actionType}
        amountValue={amountValue}
        setAmountValue={setAmountValue}
        isEditingAmount={isEditingAmount}
        setIsEditingAmount={setIsEditingAmount}
        slideAnim={slideAnim}
        onClose={handleCloseSlider}
        onNext={handleNextStep}
        formasPagamento={formasPagamento}
      />

      <BottomNavigation
        navigation={navigation}
        userRole={usuarioRole}
        usuario={usuarioParam}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  scrollContent: {
    padding: 16,
    paddingBottom: 120,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10,
  },

  greeting: {
    color: colors.textSecondary,
    fontSize: 14,
  },

  userName: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: 'bold',
  },

  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#374151',
  },

  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1E1E22',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3B56FF',
  },

  quickActionsContainer: {
    width: '100%',
    height: 200,
    flexDirection: 'column',
  },

  quickActionsTitle: {
    fontSize: 24,
    fontWeight: '400',
    paddingTop: 15,
    paddingLeft: 20,
    paddingBottom: 10,
    color: 'white',
  },

  actionsCarousel: {
    height: 120,
    padding: 10,
    gap: 15,
  },

  tripCard: {
    backgroundColor: colors.primaryBlue,
    borderRadius: 20,
    padding: 20,
    marginVertical: 8,
  },

  tripTag: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  routeTimeline: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
    paddingHorizontal: 10,
  },

  dotStart: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    backgroundColor: colors.primaryBlue,
  },

  line: {
    flex: 1,
    height: 2,
    backgroundColor: '#FFFFFF',
  },

  dotEnd: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
  },

  routeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },

  cityTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },

  cityName: {
    color: '#E0E0E0',
    fontSize: 12,
  },

  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginVertical: 16,
  },

  licenseBox: {
    backgroundColor: '#1D3BBD',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  licenseText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },

  licenseDashedLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 10,
  },

  plateText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
});