import React, { useState, useRef, useCallback } from 'react';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { CommonActions, useFocusEffect } from '@react-navigation/native';
import {
  StyleSheet,
  View,
  Image,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Animated,
  Alert
} from 'react-native';

import BottomNavigation from '../../components/bottomNavigation/bottomNavigation.js';
import QuickActions from '../../components/quickActions/quickActions.js';
import GeneralSummaryCard from '../../components/generalSummaryCard/GeneralSummaryCard.js';
// import CurrentBalanceCard from '../../components/currentBalanceCard/currentBalanceCard.js';
import ValueSliderModal from '../../components/valueSliderModal/valueSliderModal.js';
// import FleetProgressCard from '../../components/fleetProgressCard/fleetProgressCard.js';
import FleetExpensesOverview from '../../components/fleetExpensesOverview/fleetExpensesOverview.js';
import PaymentCardsCarousel from '../../components/paymentCardsCarousel/paymentCardsCarousel.js';
import InteractiveCarousel from '../../components/interactiveCarousel/interactiveCarousel.js';
import UserControlPanel from '../../components/userControlPanel/userControlPanel.js';
import ViagemAtualCard from '../../components/viagemAtualCard/viagemAtualCard.js';
import RegistrarHodometroButton from '../../components/registrarHodometroButton/registrarHodometroButton.js';
import GestorHome from '../gestorHome/gestorHome.js';
import FormaPagamentoModal from '../../components/formaPagamentoModal/formaPagamentoModal.js';
import { descreverForma } from '../../constants/formasPagamento.js';
import { listarFormas, criarForma, removerForma } from '../../services/frotix.js';

const { height } = Dimensions.get('window');

export default function HomePage({ navigation, route }) {
  // null = ainda não escolhido; a ação inicial depende do perfil (ver acaoInicial abaixo).
  const [selectedQuickAction, setSelectedQuickAction] = useState(null);
  const [viagemSelecionada, setViagemSelecionada] = useState(null);

  const [isSliderVisible, setIsSliderVisible] = useState(false);
  const [actionType, setActionType] = useState('entrada');
  const [amountValue, setAmountValue] = useState('423');
  const [isEditingAmount, setIsEditingAmount] = useState(false);

  const slideAnim = useRef(new Animated.Value(height)).current;

  // Formas de pagamento cadastradas no banco (erro P4: antes eram dados de exemplo).
  const [formasPagamento, setFormasPagamento] = useState([]);
  const [indiceForma, setIndiceForma] = useState(0); // cartão visível no carrossel
  const [isFormaModalVisible, setIsFormaModalVisible] = useState(false);

  const carregarFormas = useCallback(async () => {
    try {
      setFormasPagamento(await listarFormas());
    } catch (e) {
      console.warn('Erro ao carregar formas de pagamento:', e.message);
    }
  }, []);

  useFocusEffect(useCallback(() => { carregarFormas(); }, [carregarFormas]));

  const handleSalvarForma = async (novaForma) => {
    try {
      const criada = await criarForma(novaForma);
      setIsFormaModalVisible(false);
      await carregarFormas();
      Alert.alert('Forma de pagamento adicionada', descreverForma(criada));
    } catch (e) {
      Alert.alert('Não foi possível salvar', e.message);
    }
  };

  // Deleta a forma que está visível no carrossel, depois de confirmar.
  const handleDeletarForma = () => {
    const forma = formasPagamento[indiceForma];
    if (!forma) {
      Alert.alert('Nada para deletar', 'Não há formas de pagamento cadastradas.');
      return;
    }
    Alert.alert(
      'Deletar forma de pagamento',
      `Deseja deletar "${descreverForma(forma)}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Deletar',
          style: 'destructive',
          onPress: async () => {
            try {
              await removerForma(forma.id);
              setIndiceForma(0);
              await carregarFormas();
            } catch (e) {
              Alert.alert('Não foi possível deletar', e.message);
            }
          },
        },
      ]
    );
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

  // O lançamento em si é salvo no formulário (TransactionForm), que grava no banco.
  const handleNextStep = () => handleCloseSlider();

  const authGoogle = route?.params?.auth || null;
  const bankUser = route?.params?.bankUser || null;

  const userName = authGoogle?.user?.givenName || bankUser?.name || 'Usuário';
  const userPhoto = authGoogle?.user?.photo || null; 
  const userRole = bankUser?.role || authGoogle?.user?.role || 'Membro';

  const reference = {
    1 : 'Admin',
    2 : 'Gestor de Frota',
    3 : 'Financeiro',
    4 : 'Motorista'
  };

  // Os "⋯" e os filtros "últimos 7 dias" dos cards levam aos Relatórios,
  // onde estão o detalhamento e o filtro de período de verdade.
  const abrirRelatorios = () => navigation.navigate('Relatorios', { usuario });

  // Admin e Financeiro abrem nos dashboards ("Categorias Financeiras"); os outros perfis
  // não veem esse card, então abrem em "Rotas" (viagem atual), como no Figma do Motorista.
  const acaoInicial = userRole === 1 || userRole === 3 ? 'finance' : 'rotes';
  const acaoAtiva = selectedQuickAction ?? acaoInicial;
  const podeEditarFormas = userRole === 1 || userRole === 3;

  // Dados do usuário repassados às telas de frota (cabeçalho e barra inferior).
  const usuario = { nome: userName, foto: userPhoto, role: userRole };

  // Gestor de Frota tem uma Home própria.
  if (userRole === 2) {
    return <GestorHome navigation={navigation} route={route} usuario={usuario} />;
  }

  return (
    <>
      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Boa Tarde</Text>
            <Text style={styles.username}> { userName } </Text>
            <Text style={styles.userRole}> { reference[userRole] } </Text>
          </View>
          <Image 
            source={userPhoto == null ? require('../../../assets/icons/user.png') : { uri: userPhoto }} 
            style={styles.avatar} 
          />
        </View>

         {(userRole === 1 || userRole === 3) &&(
            <GeneralSummaryCard onMenuPress={abrirRelatorios} />
         )}

        <QuickActions 
          selectedAction={acaoAtiva} 
          onSelectAction={setSelectedQuickAction} 
          userRole={userRole}
        />

        {acaoAtiva === 'finance' && (userRole === 1 || userRole === 3) && (
          <>
            {/* <FleetProgressCard /> */}
            {/* <CurrentBalanceCard saldoAtual={saldoAtual} totalSaidas={totalSaidas} /> */}
            <FleetExpensesOverview onFilterPress={abrirRelatorios} onMenuPress={abrirRelatorios} />
            <View style={styles.atalhosFinanceiro}>
              <TouchableOpacity
                style={styles.atalhoFinanceiro}
                onPress={() => navigation.navigate('Categorias', { usuario })}
              >
                <Text style={styles.atalhoFinanceiroTexto}>Gerenciar categorias</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.atalhoFinanceiro}
                onPress={() => navigation.navigate('Relatorios', { usuario })}
              >
                <Text style={styles.atalhoFinanceiroTexto}>Relatórios</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {acaoAtiva === 'payment' && (
          <View style={styles.sectionContainer}>
            {/* key muda ao deletar, para o carrossel voltar ao primeiro cartão */}
            <PaymentCardsCarousel
              key={formasPagamento.length}
              formas={formasPagamento}
              onChangeIndex={setIndiceForma}
            />
            <InteractiveCarousel 
              onOpenSlider={handleOpenSlider} 
              onAddForma={podeEditarFormas ? () => setIsFormaModalVisible(true) : undefined}
              onDeleteForma={podeEditarFormas ? handleDeletarForma : undefined}
              onMenuAtividades={abrirRelatorios}
            />
          </View>
        )}

        {acaoAtiva === 'users' && (userRole === 1 || userRole === 3) &&(
          <View style={styles.sectionContainer}>
            <UserControlPanel />
          </View>
        )}

        {acaoAtiva === 'rotes' && (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Gerenciamento de Rotas</Text>
            <ViagemAtualCard 
              viagemSelecionada={viagemSelecionada}
              onSelectViagem={setViagemSelecionada}
            />
            <RegistrarHodometroButton
              viagem={viagemSelecionada}
              onButtonPress={() => navigation.navigate('Viagens', { usuario })}
            />
          </View>
        )}

        {userRole === 4 && (
          <TouchableOpacity
            style={styles.minhasViagens}
            onPress={() => navigation.navigate('Viagens', { usuario, modo: 'motorista' })}
          >
            <Text style={styles.minhasViagensTexto}>Minhas Viagens</Text>
          </TouchableOpacity>
        )}

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

      <FormaPagamentoModal
        visible={isFormaModalVisible}
        onClose={() => setIsFormaModalVisible(false)}
        onSalvar={handleSalvarForma}
      />

      <BottomNavigation navigation={navigation} userRole={userRole} usuario={usuario} />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212', 
  },
  contentContainer: {
    paddingBottom: 150,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
  },
  greeting: {
    color: '#888',
    fontSize: 14,
  },
  username: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
  userRole: {
    color: '#888',
    fontSize: 14,
  },
  avatar: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
  },
  sectionContainer: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  atalhosFinanceiro: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 20,
    marginTop: 20,
  },
  atalhoFinanceiro: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  atalhoFinanceiroTexto: {
    color: '#121212',
    fontSize: 14,
    fontWeight: '600',
  },
  minhasViagens: {
    backgroundColor: '#3B56FF',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 20,
  },
  minhasViagensTexto: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 18,
    marginBottom: 15,
  },
  mainBalanceCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    width: '100%',
  },
  placeholderText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    textAlign: 'center',
  },
});