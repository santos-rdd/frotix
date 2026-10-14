import React, { useState, useRef } from 'react';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { CommonActions } from '@react-navigation/native';
import {
  StyleSheet,
  View,
  Image,
  Text,
  ScrollView,
  Dimensions,
  Animated
} from 'react-native';

import BottomNavigation from '../../components/bottomNavigation/bottomNavigation.js';
import QuickActions from '../../components/quickActions/quickActions.js';
import GeneralSummaryCard from '../../components/generalSummaryCard/GeneralSummaryCard.js';
import CurrentBalanceCard from '../../components/currentBalanceCard/currentBalanceCard.js';
import ValueSliderModal from '../../components/valueSliderModal/valueSliderModal.js';
import FleetProgressCard from '../../components/fleetProgressCard/fleetProgressCard.js';
import FleetExpensesOverview from '../../components/fleetExpensesOverview/fleetExpensesOverview.js';
import PaymentCardsCarousel from '../../components/paymentCardsCarousel/paymentCardsCarousel.js';
import InteractiveCarousel from '../../components/interactiveCarousel/interactiveCarousel.js';
import UserControlPanel from '../../components/userControlPanel/userControlPanel.js';
import ViagemAtualCard from '../../components/viagemAtualCard/viagemAtualCard.js';
import RegistrarHodometroButton from '../../components/registrarHodometroButton/registrarHodometroButton.js';

const { height } = Dimensions.get('window');

export default function HomePage({ navigation, route }) {
  const [selectedQuickAction, setSelectedQuickAction] = useState('finance');

  const [saldoAtual, setSaldoAtual] = useState(53435.20);
  const [totalSaidas, setTotalSaidas] = useState(12143.50);
  const [atividades, setAtividades] = useState([
    { id: '1', tipo: 'saida', titulo: 'Alimentação', valor: '- R$ 320.99', data: '14 Setembro 14:12', saldoApos: 'R$ 3941.23' },
    { id: '2', tipo: 'entrada', titulo: 'Entrada', valor: '+ R$ 900.95', data: '14 Setembro 14:12', saldoApos: 'R$ 3941.23' },
    { id: '3', tipo: 'entrada', titulo: 'Freelance', valor: '+ R$ 236.12', data: '14 Setembro 14:12', saldoApos: 'R$ 3941.23' },
    { id: '4', tipo: 'saida', titulo: 'Abastecimento', valor: '- R$ 45.00', data: '14 Setembro 14:12', saldoApos: 'R$ 3941.23' },
  ]);

  const [isSliderVisible, setIsSliderVisible] = useState(false);
  const [actionType, setActionType] = useState('entrada');
  const [amountValue, setAmountValue] = useState('423');
  const [isEditingAmount, setIsEditingAmount] = useState(false);

  const slideAnim = useRef(new Animated.Value(height)).current;

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

  const handleNextStep = () => {
    const valorNumerico = parseFloat(amountValue.replace(',', '.')) || 0;
    
    let novoSaldo = saldoAtual;
    let novaSaidaTotal = totalSaidas;
    let tituloAcao = 'Entrada';

    if (actionType === 'entrada') {
      novoSaldo += valorNumerico;
      tituloAcao = 'Entrada';
    } else if (actionType === 'saida') {
      novoSaldo -= valorNumerico;
      novaSaidaTotal += valorNumerico;
      tituloAcao = 'Saída';
    } else if (actionType === 'divida') {
      novoSaldo -= valorNumerico;
      novaSaidaTotal += valorNumerico;
      tituloAcao = 'Nova Dívida';
    }

    setSaldoAtual(novoSaldo);
    setTotalSaidas(novaSaidaTotal);

    const novoLog = {
      id: Date.now().toString(),
      tipo: actionType === 'entrada' ? 'entrada' : 'saida',
      titulo: tituloAcao,
      valor: `${actionType === 'entrada' ? '+ ' : '- '}R$ ${valorNumerico.toFixed(2).replace('.', ',')}`,
      data: 'Hoje',
      saldoApos: `R$ ${novoSaldo.toFixed(2).replace('.', ',')}`
    };

    setAtividades([novoLog, ...atividades]);
    handleCloseSlider();
  };

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
            <GeneralSummaryCard />
         )}

        <QuickActions 
          selectedAction={selectedQuickAction} 
          onSelectAction={setSelectedQuickAction} 
          userRole={userRole}
        />

        {selectedQuickAction === 'finance' && (userRole === 1 || userRole === 3) && (
          <>
            <FleetProgressCard />
            <CurrentBalanceCard saldoAtual={saldoAtual} totalSaidas={totalSaidas} />
            <FleetExpensesOverview />
          </>
        )}

        {selectedQuickAction === 'payment' && (
          <View style={styles.sectionContainer}>
            <PaymentCardsCarousel />
            <InteractiveCarousel 
              onOpenSlider={handleOpenSlider} 
              atividades={atividades} 
            />
          </View>
        )}

        {selectedQuickAction === 'users' && (userRole === 1 || userRole === 3) &&(
          <View style={styles.sectionContainer}>
            <UserControlPanel />
          </View>
        )}

        {selectedQuickAction === 'rotes' && (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Gerenciamento de Rotas</Text>
            <ViagemAtualCard />
            <RegistrarHodometroButton />
          </View>
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
      />

      <BottomNavigation navigation={navigation} />
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