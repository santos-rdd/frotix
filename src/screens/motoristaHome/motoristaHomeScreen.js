import React, { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  Ionicons, 
} from '@expo/vector-icons';

import BottomNavigation from '../../components/bottomNavigation/bottomNavigation.js';
import { colors } from '../../constants/theme.js';
import { listarVeiculos, listarRotas, listarViagensEmAndamento } from '../../services/frotix.js';
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
    authenticatedUser.nome || props.userName || usuarioParam?.nome || authGoogle?.user?.givenName || bankUser?.nome || bankUser?.name || 'Motorista'
  );
  const usuarioFoto =
    props.userPhoto || usuarioParam?.foto || authGoogle?.user?.photo || bankUser?.imagem || null;
  const [usuarioRole, setUsuarioRole] = useState(
    authenticatedUser.role || bankUser?.role || authGoogle?.user?.role || usuarioParam?.role || 4
  );

  const carregarDadosMotorista = useCallback(async () => {
    try {
      const uLogado = await obterUsuarioLogado();
      const id = uLogado?.id || uLogado?.sub || usuarioParam?.id;
      const nome = uLogado?.nome || usuarioNome;
      const perfil = uLogado?.perfil ?? usuarioRole;
      if (id) {
        setUsuarioId(String(id));
      }
      setUsuarioNome(nome || 'Motorista');
      setUsuarioRole(Number(perfil) || 4);
      return id;
    } catch {
      return null;
    }
  }, [usuarioNome, usuarioRole]);

  const carregarVeiculos = useCallback(async () => {
    if (!usuarioId) return [];
    try {
      const servidor = await listarVeiculos();
      await atualizarCacheVeiculos(usuarioId, servidor || []).catch(() => {});
      return servidor || [];
    } catch {
      return await listarVeiculosPermitidosLocais(usuarioId);
    }
  }, [usuarioId]);

  const carregarRotas = useCallback(async () => {
    if (!usuarioId) return [];
    try {
      const servidor = await listarRotas();
      await atualizarCacheRotas(usuarioId, servidor || []).catch(() => {});
      return servidor || [];
    } catch {
      return await listarRotasLocais(usuarioId);
    }
  }, [usuarioId]);

  const carregarViagens = useCallback(async () => {
    if (!usuarioId) return [];
    try {
      const serv = await listarViagensEmAndamento();
      return Array.isArray(serv) ? serv : [];
    } catch {
      const locais = await listarViagensLocais(usuarioId);
      return (locais || []).filter((r) => r.status === 'em_transito');
    }
  }, [usuarioId]);

  useEffect(() => {
    carregarDadosMotorista();
  }, [carregarDadosMotorista]);

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
  const veiculosDisponiveis = veiculosLista.filter((v) => v.status === 'disponivel');
  const rotasAgendadas = rotasLista.filter((r) => r.status === 'agendada');
  const viagemEmAndamento = andamentoLista[0] || null;
  const rotaEmDestaque = viagemEmAndamento || rotasAgendadas[0] || null;
  const veiculoEmDestaque = veiculosLista.find((v) =>
    [v.id, v.idLocal].some(
      (id) => id != null && String(id) === String(rotaEmDestaque?.veiculoId)
    )
  );
  const modeloEmDestaque = rotaEmDestaque?.veiculoModelo || veiculoEmDestaque?.modelo;
  const placaEmDestaque = rotaEmDestaque?.placa || veiculoEmDestaque?.placa || 'Sem veículo atribuído';
  const carregandoDados = carregandoVeiculos || carregandoRotas || carregandoViagens;
  const erroDados = erroVeiculos || erroRotas || erroViagens;

  const recarregarTudo = async () => {
    await Promise.all([recarregarVeiculos(), recarregarRotas(), recarregarViagens()]);
  };

  const abrirViagens = () => {
    navigation.navigate('Viagens', { usuario: usuarioParam, modo: 'motorista' });
  };

  const abrirRotas = () => {
    navigation.navigate('Rotas', { usuario: usuarioParam });
  };

  const abrirVeiculos = () => {
    navigation.navigate('Veiculos', { usuario: usuarioParam });
  };

  const abrirFormularioFinanceiro = (actionType) => {
    navigation.navigate('TransactionForm', {
      usuario: usuarioParam,
      actionType,
      amountValue: '0',
    });
  };

  const abrirDividas = () => {
    navigation.navigate('Dividas', { usuario: usuarioParam });
  };

  const abrirExtrato = () => {
    navigation.navigate('Extrato', { usuario: usuarioParam });
  };

  if (Number(usuarioRole) !== 4) {
    return (
      <View style={[styles.container, safeAreaPadding]}>
        <Text style={styles.cityName}>Esta área é exclusiva para motoristas.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, safeAreaPadding]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Boa Tarde</Text>
            <Text style={styles.userName}>{usuarioNome}</Text>
          </View>
          {usuarioFoto ? (
            <Image source={{ uri: usuarioFoto }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={20} color="#FFFFFF" />
            </View>
          )}
        </View>

        <Text style={styles.sectionTitle}>Ações Rápidas</Text>
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.cardLight }]}
            activeOpacity={0.8}
            onPress={abrirVeiculos}
          >
            <Ionicons name="car-outline" size={24} color="#0F172A" />
            <Text style={styles.actionTextDark}>Veículos disponíveis ({veiculosDisponiveis.length})</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primaryBlue }]}
            activeOpacity={0.8}
            onPress={abrirRotas}
          >
            <Ionicons name="location-outline" size={24} color="#FFFFFF" />
            <Text style={styles.actionTextLight}>Rotas</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Finanças pessoais</Text>
        <View style={styles.actionsRow}>
          <TouchableOpacity
            accessibilityRole="button"
            style={[styles.actionBtn, { backgroundColor: colors.cardLight }]}
            activeOpacity={0.8}
            onPress={() => abrirFormularioFinanceiro('entrada')}
          >
            <Ionicons name="cash-outline" size={24} color="#0F172A" />
            <Text style={styles.actionTextDark}>Registrar Frete</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            style={[styles.actionBtn, { backgroundColor: colors.primaryBlue }]}
            activeOpacity={0.8}
            onPress={() => abrirFormularioFinanceiro('saida')}
          >
            <Ionicons name="receipt-outline" size={24} color="#FFFFFF" />
            <Text style={styles.actionTextLight}>Lançar Despesa</Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.actionsRow, styles.financialActionsRow]}>
          <TouchableOpacity
            accessibilityRole="button"
            style={[styles.actionBtn, { backgroundColor: colors.cardLight }]}
            activeOpacity={0.8}
            onPress={abrirDividas}
          >
            <Ionicons name="wallet-outline" size={24} color="#0F172A" />
            <Text style={styles.actionTextDark}>Minhas Dívidas</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            style={[styles.actionBtn, { backgroundColor: colors.primaryBlue }]}
            activeOpacity={0.8}
            onPress={abrirExtrato}
          >
            <Ionicons name="document-text-outline" size={24} color="#FFFFFF" />
            <Text style={styles.actionTextLight}>Meu Extrato</Text>
          </TouchableOpacity>
        </View>

        {(carregandoDados || erroDados) ? (
          <EstadoDados
            carregando={carregandoDados}
            erro={erroDados}
            onTentarDeNovo={recarregarTudo}
            temDados={veiculosLista.length > 0 || rotasLista.length > 0 || andamentoLista.length > 0}
          />
        ) : null}

        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Viagens em curso</Text>
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
                  <Text style={styles.cityTitle}>Origem</Text>
                  <Text style={styles.cityName}>{rotaEmDestaque.origem}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.cityTitle}>Destino</Text>
                  <Text style={styles.cityName}>{rotaEmDestaque.destino}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.licenseBox}>
                <Text
                  style={[styles.licenseText, { flexShrink: 1 }]}
                  numberOfLines={1}
                >
                  {modeloEmDestaque || 'Veículo'}
                </Text>
                <View style={styles.licenseDashedLine} />
                <Text style={styles.plateText} numberOfLines={1}>{placaEmDestaque}</Text>
              </View>
            </>
          ) : (
            <Text style={styles.cityName}>Nenhuma viagem agendada ou em andamento.</Text>
          )}
        </View>

        <TouchableOpacity style={styles.primaryButton} activeOpacity={0.8} onPress={abrirViagens}>
          <Text style={styles.primaryButtonText}>Registrar Hodômetro</Text>
        </TouchableOpacity>
      </ScrollView>

      <BottomNavigation navigation={navigation} userRole={usuarioRole} usuario={usuarioParam} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: colors.background 
  },
  scrollContent: { 
    padding: 16, 
    paddingBottom: 40 
  },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 20,
    marginTop: 10 
  },
  greeting: { 
    color: colors.textSecondary, 
    fontSize: 14 
  },
  userName: { 
    color: colors.textPrimary, 
    fontSize: 22, 
    fontWeight: 'bold' 
  },
  avatar: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    borderWidth: 2, 
    borderColor: '#374151' 
  },
  avatarPlaceholder: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    backgroundColor: '#1E1E22', 
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3B56FF' 
  },

  sectionTitle: { 
    color: colors.textPrimary, 
    fontSize: 20, 
    fontWeight: 'bold', 
    marginBottom: 14 
  },
  
  actionsRow: { 
    flexDirection: 'row', 
    gap: 12 
  },
  financialActionsRow: {
    marginTop: 12,
  },
  actionBtn: { 
    width: 120, 
    height: 110, 
    borderRadius: 18, 
    padding: 14, 
    justifyContent: 'space-between' 
  },
  actionTextDark: { 
    color: '#000000', 
    fontSize: 11, 
    fontWeight: '600' 
  },
  actionTextLight: { 
    color: '#FFFFFF', 
    fontSize: 11, 
    fontWeight: '600' 
  },

  tripCard: { 
    backgroundColor: colors.primaryBlue, 
    borderRadius: 20, 
    padding: 20, 
    marginVertical: 8 
  },
  tripTag: { 
    color: '#FFFFFF', 
    fontSize: 13, 
    fontWeight: '800', 
    letterSpacing: 0.5 
  },
  
  routeTimeline: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginVertical: 18, 
    paddingHorizontal: 10 
  },
  dotStart: { 
    width: 12, 
    height: 12, 
    borderRadius: 6, 
    borderWidth: 3, 
    borderColor: '#FFFFFF', 
    backgroundColor: colors.primaryBlue 
  },
  line: { 
    flex: 1, 
    height: 2, 
    backgroundColor: '#FFFFFF' 
  },
  dotEnd: { 
    width: 12, 
    height: 12, 
    borderRadius: 6, 
    backgroundColor: '#FFFFFF' 
  },
  
  routeLabels: { 
    flexDirection: 'row', 
    justifyContent: 'space-between' 
  },
  cityTitle: { 
    color: '#FFFFFF', 
    fontSize: 14, 
    fontWeight: 'bold' 
  },
  cityName: { 
    color: '#E0E0E0', 
    fontSize: 12 
  },

  divider: { 
    height: 1, 
    backgroundColor: 'rgba(255, 255, 255, 0.2)', 
    marginVertical: 16 
  },

  licenseBox: { 
    backgroundColor: '#1D3BBD', 
    borderRadius: 12, 
    padding: 14, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between' 
  },
  licenseText: { 
    color: '#FFFFFF', 
    fontSize: 12, 
    fontWeight: '600' 
  },
  licenseDashedLine: { 
    flex: 1, 
    height: 1, 
    backgroundColor: 'rgba(255,255,255,0.3)', 
    marginHorizontal: 10 
  },
  plateText: { 
    color: '#FFFFFF', 
    fontSize: 13, 
    fontWeight: 'bold' 
  },

  primaryButton: { 
    backgroundColor: colors.primaryBlue, 
    height: 54, 
    borderRadius: 16, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginTop: 8 
  },
  primaryButtonText: { 
    color: '#FFFFFF', 
    fontSize: 16, 
    fontWeight: 'bold' 
  },
});
