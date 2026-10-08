import React, { useState, useRef } from 'react';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { CommonActions } from '@react-navigation/native';
import {
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Dimensions,
  Animated,
  TouchableWithoutFeedback,
  Modal
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons'; 

import BottomNavigation from '../../components/bottomNavigation/bottomNavigation';
import QuickActions from '../../components/quickActions/quickActions';

const { width, height } = Dimensions.get('window');

export default function HomePage({ navigation, route }) {
  // Estados financeiros (prontos para integração com banco de dados)
  const [saldoAtual, setSaldoAtual] = useState(53435.20);
  const [totalSaidas, setTotalSaidas] = useState(12143.50);
  const [atividades, setAtividades] = useState([
    { id: '1', tipo: 'saida', titulo: 'Alimentação', valor: '- R$ 320.99', data: '14 Setembro 14:12', saldoApos: 'R$ 3941.23' },
    { id: '2', tipo: 'entrada', titulo: 'Entrada', valor: '+ R$ 900.95', data: '14 Setembro 14:12', saldoApos: 'R$ 3941.23' },
    { id: '3', tipo: 'entrada', titulo: 'Freelance', valor: '+ R$ 236.12', data: '14 Setembro 14:12', saldoApos: 'R$ 3941.23' },
    { id: '4', tipo: 'saida', titulo: 'Abastecimento', valor: '- R$ 45.00', data: '14 Setembro 14:12', saldoApos: 'R$ 3941.23' },
  ]);

  // Estados para controlar o painel deslizante e tipo de ação
  const [isSliderVisible, setIsSliderVisible] = useState(false);
  const [actionType, setActionType] = useState('entrada'); // 'entrada' | 'saida' | 'divida'
  const [amountValue, setAmountValue] = useState('423');
  const [isEditingAmount, setIsEditingAmount] = useState(false);

  // Animação para subir de baixo para cima suavemente
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

  // Função que processa a transação e atualiza os saldos e logs (simulando BD)
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

    // Adiciona o novo registro nos logs de Atividade Recente
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

  const handleLogout = async () => {
    try {
      await GoogleSignin.signOut();
    } catch (error) {
      console.log('Erro ao deslogar do Google (pode ser login por email):', error);
    }

    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'LoginScreen' }], 
      })
    );
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

  const cardThemeColor = actionType === 'entrada' ? '#2541ff' : '#b22222';

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

        <QuickActions />

        {(userRole === 1 || userRole === 3) && (
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Resumo Geral</Text>

          <View style={styles.mainBalanceCard}>
            <Text style={styles.mainDateText}>Segunda, 14 de setembro</Text>
            <View style={styles.walletIconContainer}>
              <MaterialCommunityIcons name="piggy-bank-outline" size={28} color="#2541ff" />
            </View>
            <Text style={styles.mainBalanceValue}>
              {saldoAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </Text>
            <Text style={styles.mainBalanceLabel}>Saldo atual</Text>
            
            <Text style={styles.mainSaidasValue}>
              {totalSaidas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </Text>
            <Text style={styles.mainSaidasLabel}>Saídas</Text>
          </View>
        </View>
      )}

        <View style={styles.interactiveSection}>
          <View style={styles.optionsCard}>
            <Text style={styles.optionsTitle}>Opções</Text>
            
            <View style={styles.circleButtonsRow}>
              <TouchableOpacity style={styles.circleButton}>
                <View style={styles.circleButtonMaterial}>
                  <MaterialCommunityIcons name="wallet-plus-outline" size={26} color="#121212" />
                </View>
                <Text style={styles.circleButtonText}>Adicionar Forma De Pagamento</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.circleButton}>
                <View style={styles.circleButtonMaterial}>
                  <Feather name="trash-2" size={24} color="#121212" />
                </View>
                <Text style={styles.circleButtonText}>Deletar Forma De Pagamento</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: '#2541ff' }]}
              onPress={() => handleOpenSlider('entrada')}
            >
              <Text style={styles.actionButtonText}>Registrar Entrada</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: '#b22222' }]}
              onPress={() => handleOpenSlider('saida')}
            >
              <Text style={styles.actionButtonText}>Registrar Saída</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: '#b22222' }]}
              onPress={() => handleOpenSlider('divida')}
            >
              <Text style={styles.actionButtonText}>Nova Dívida</Text>
            </TouchableOpacity>

            <View style={styles.paginationDots}>
              <View style={styles.dotInactive} />
              <View style={styles.dotActive} />
              <View style={styles.dotInactive} />
            </View>
          </View>
        </View>

        {/* Seção de Atividade Recente (Logs dinâmicos) */}
        <View style={styles.sectionContainer}>
          <View style={styles.activityHeaderRow}>
            <Text style={styles.sectionTitle}>Atividade Recente</Text>
            <TouchableOpacity>
              <Feather name="more-horizontal" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>

          {/* Lista de logs recentes */}
          {atividades.map((item) => (
            <View key={item.id} style={styles.activityCard}>
              <View style={styles.activityLeft}>
                <View style={[styles.activityIconBox, { backgroundColor: item.tipo === 'entrada' ? '#e6f0ff' : '#ffe6e6' }]}>
                  <Feather 
                    name={item.tipo === 'entrada' ? 'arrow-up' : 'arrow-down'} 
                    size={16} 
                    color={item.tipo === 'entrada' ? '#2541ff' : '#b22222'} 
                  />
                </View>
                <View>
                  <Text style={styles.activityTitle}>{item.titulo}</Text>
                  <Text style={styles.activityDate}>{item.data}</Text>
                </View>
              </View>
              <View style={styles.activityRight}>
                <Text style={[styles.activityValueText, { color: item.tipo === 'entrada' ? '#2541ff' : '#FFF' }]}>
                  {item.valor}
                </Text>
                <Text style={styles.activitySaldoApos}>{item.saldoApos}</Text>
              </View>
            </View>
          ))}

          <View style={styles.paginationDots}>
            <View style={styles.dotInactive} />
            <View style={styles.dotActive} />
            <View style={styles.dotInactive} />
          </View>
        </View>

      </ScrollView>

      {/* Modal / Overlay deslizante */}
      <Modal
        visible={isSliderVisible}
        transparent={true}
        animationType="none"
        onRequestClose={handleCloseSlider}
      >
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={handleCloseSlider}>
            <View style={styles.modalDismissArea} />
          </TouchableWithoutFeedback>

          <Animated.View 
            style={[
              styles.sliderContainerWrapper, 
              { transform: [{ translateY: slideAnim }] }
            ]}
          >
            <View style={[styles.sliderCard, { backgroundColor: cardThemeColor }]}>
              <TouchableOpacity 
                style={styles.backButton} 
                onPress={handleCloseSlider}
              >
                <Feather name="arrow-left" size={20} color="#FFF" />
              </TouchableOpacity>

              <View style={styles.amountContainer}>
                <Text style={styles.currencySymbol}>R$</Text>
                {isEditingAmount ? (
                  <TextInput
                    style={styles.amountInput}
                    value={amountValue}
                    onChangeText={setAmountValue}
                    keyboardType="numeric"
                    autoFocus
                    onBlur={() => setIsEditingAmount(false)}
                  />
                ) : (
                  <TouchableOpacity onPress={() => setIsEditingAmount(true)}>
                    <Text style={styles.amountText}>{amountValue}</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.sliderBarContainer}>
                <View style={styles.sliderLineFilled} />
                <View style={styles.sliderThumb} />
                <View style={styles.sliderLineEmpty} />
              </View>
              <Text style={styles.sliderInstruction}>Deslize para selecionar a quantidade</Text>

              <TouchableOpacity style={styles.forwardButton} onPress={handleNextStep}>
                <Feather name="arrow-right" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

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
    paddingBottom: 100,
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
  mainDateText: {
    color: '#888',
    fontSize: 12,
    marginBottom: 15,
    alignSelf: 'flex-start',
  },
  walletIconContainer: {
    marginBottom: 10,
  },
  mainBalanceValue: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: 'bold',
  },
  mainBalanceLabel: {
    color: '#888',
    fontSize: 13,
    marginBottom: 20,
  },
  mainSaidasValue: {
    color: '#b22222',
    fontSize: 20,
    fontWeight: '600',
  },
  mainSaidasLabel: {
    color: '#b22222',
    fontSize: 12,
  },
  interactiveSection: {
    paddingHorizontal: 20,
    marginTop: 25,
  },
  optionsCard: {
    backgroundColor: 'none',
    borderRadius: 24,
    padding: 20,
    width: '100%',
  },
  optionsTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
  },
  circleButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 25,
  },
  circleButton: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    width: 130,
  },
  circleButtonMaterial: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    width: 74,
    height: 74,
    borderRadius: 37,
  },
  circleButtonText: {
    color: 'white',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
  },
  actionButton: {
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  paginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 15,
  },
  dotActive: {
    width: 24,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2541ff',
  },
  dotInactive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#555',
  },
  activityHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activityCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  activityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  activityIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
  },
  activityDate: {
    color: '#888',
    fontSize: 11,
    marginTop: 2,
  },
  activityRight: {
    alignItems: 'flex-end',
  },
  activityValueText: {
    fontSize: 14,
    fontWeight: '600',
  },
  activitySaldoApos: {
    color: '#888',
    fontSize: 10,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalDismissArea: {
    flex: 1,
  },
  sliderContainerWrapper: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  sliderCard: {
    borderRadius: 24,
    padding: 24,
    height: 340,
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  backButton: {
    alignSelf: 'flex-start',
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  currencySymbol: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '300',
    marginRight: 4,
  },
  amountText: {
    color: '#FFF',
    fontSize: 48,
    fontWeight: '300',
  },
  amountInput: {
    color: '#FFF',
    fontSize: 48,
    fontWeight: '300',
    borderBottomWidth: 1,
    borderBottomColor: '#FFF',
    minWidth: 120,
    textAlign: 'center',
  },
  sliderBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 10,
  },
  sliderLineFilled: {
    flex: 1,
    height: 3,
    backgroundColor: '#121212',
  },
  sliderThumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFF',
    marginHorizontal: 4,
  },
  sliderLineEmpty: {
    flex: 1,
    height: 3,
    backgroundColor: '#FFF',
  },
  sliderInstruction: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
  },
  forwardButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#121212',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
});