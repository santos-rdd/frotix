import React, { useRef, useEffect, useState } from 'react';
import {
  Modal,
  View,
  TouchableOpacity,
  Text,
  TextInput,
  Animated,
  TouchableWithoutFeedback,
  StyleSheet,
  Keyboard,
  PanResponder
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import PaymentCardsCarousel from '../paymentCardsCarousel/paymentCardsCarousel.js';
import { descreverForma } from '../../constants/formasPagamento.js';


const TEXTOS = {
  entrada: { titulo: 'Registrar Entrada', subtitulo: 'Selecione o meio de recebimento', justificar: 'Justificar entrada:' },
  saida: { titulo: 'Registrar Saída', subtitulo: 'Selecione o local de saída', justificar: 'Justificar saída:' },
  divida: { titulo: 'Nova Dívida', subtitulo: 'Selecione a forma de pagamento', justificar: 'Justificar dívida:' },
};


const OPCAO_OUTROS = { id: 'outros', tipo: 'outros' };

export default function ValueSliderModal({
  visible,
  actionType,
  amountValue,
  setAmountValue,
  isEditingAmount,
  setIsEditingAmount,
  slideAnim,
  onClose,
  onNext,
  formasPagamento = [],
}) {
  const navigation = useNavigation();
  const cardThemeColor = actionType === 'entrada' ? '#2541ff' : '#b22222';
  const cardHeightAnim = useRef(new Animated.Value(340)).current;

  const [modalStep, setModalStep] = useState('slider');

  const [indiceForma, setIndiceForma] = useState(0);
  const opcoesCarrossel = [...formasPagamento, OPCAO_OUTROS];
  const textos = TEXTOS[actionType] || TEXTOS.entrada;

  const MAX_VALUE = 999.99;
  const barWidthRef = useRef(0);
  const barXRef = useRef(0);
  const barContainerRef = useRef(null);

  const numericValue = parseFloat(String(amountValue || '0').replace(',', '.')) || 0;
  const currentProgress = Math.min(Math.max(numericValue / MAX_VALUE, 0), 1);

  const updateValueFromPosition = (x) => {
    if (barWidthRef.current <= 0) return;
    
    let relativeX = x - barXRef.current;
    let progress = relativeX / barWidthRef.current;
    
    if (progress < 0) progress = 0;
    if (progress > 1) progress = 1;

    let calculatedValue = progress * MAX_VALUE;
    
    setAmountValue(calculatedValue.toFixed(2).replace('.', ','));
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        updateValueFromPosition(evt.nativeEvent.locationX);
      },
      onPanResponderMove: (evt) => {
        updateValueFromPosition(evt.nativeEvent.locationX);
      },
    })
  ).current;

  useEffect(() => {
    if (!visible) {
      setModalStep('slider');
      setIndiceForma(0);
    }
  }, [visible]);

  useEffect(() => {
    Animated.timing(cardHeightAnim, {
      toValue: isEditingAmount ? 640 : (modalStep === 'justification' ? 300 : 360), 
      duration: 250,
      useNativeDriver: false, 
    }).start();
  }, [isEditingAmount, modalStep]);

  const handleForwardPress = () => {
    if (modalStep === 'slider') {
      setModalStep('justification');
    } else {
      onNext();
    }
  };

  const handleBackPress = () => {
    if (modalStep === 'justification') {
      setModalStep('slider');
    } else {
      onClose();
    }
  };

  const handleProceed = () => {

    const forma = opcoesCarrossel[indiceForma];
    onClose();
    navigation.navigate('TransactionForm', {
      actionType: actionType,
      amountValue: amountValue,
      formaPagamento: forma && forma.id !== OPCAO_OUTROS.id ? descreverForma(forma) : '',
      idFormaPagamento: forma && forma.id !== OPCAO_OUTROS.id ? forma.id : null,
    });
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        {modalStep === 'justification' ? (

          <View style={styles.selecaoArea}>
            <TouchableOpacity style={styles.selecaoVoltar} onPress={handleBackPress} hitSlop={10}>
              <Feather name="chevron-left" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.selecaoTitulo}>{textos.titulo}</Text>
            <Text style={styles.selecaoSubtitulo}>{textos.subtitulo}</Text>
            <PaymentCardsCarousel formas={opcoesCarrossel} onChangeIndex={setIndiceForma} />
            <Text style={styles.selecaoValor}>R$ {amountValue}</Text>
          </View>
        ) : (
          <TouchableWithoutFeedback onPress={onClose}>
            <View style={styles.modalDismissArea} />
          </TouchableWithoutFeedback>
        )}

        <Animated.View 
          style={[
            styles.sliderContainerWrapper, 
            { transform: [{ translateY: slideAnim }] }
          ]}
        >
          <Animated.View 
            style={[
              styles.sliderCard, 
              { 
                backgroundColor: cardThemeColor, 
                height: cardHeightAnim 
              }
            ]}
          >
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={handleBackPress}
            >
              <Feather name="arrow-left" size={20} color="#FFF" />
            </TouchableOpacity>

            {modalStep === 'slider' ? (
              <>
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

                <View 
                  ref={barContainerRef}
                  style={styles.sliderBarContainer}
                  onLayout={(event) => {
                    barWidthRef.current = event.nativeEvent.layout.width;
                  }}
                  {...panResponder.panHandlers}
                >
                  <View style={[styles.sliderLineFilled, { flex: currentProgress || 0.001 }]} />
                  <View style={styles.sliderThumb} />
                  <View style={[styles.sliderLineEmpty, { flex: (1 - currentProgress) || 0.001 }]} />
                </View>

                <Text style={styles.sliderInstruction}>Deslize para selecionar a quantidade</Text>

                <TouchableOpacity style={styles.forwardButton} onPress={handleForwardPress}>
                  <Feather name="arrow-right" size={20} color="#FFF" />
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.justificationContainer}>
                <Text style={styles.justificationTitle}>{textos.justificar}</Text>

                <TouchableOpacity 
                  style={styles.actionButtonCustom}
                  onPress={handleProceed}
                >
                  <Ionicons name="add-circle-outline" size={20} color="#FFF" style={{ marginRight: 8 }} />
                  <Text style={styles.actionButtonCustomText}>Prosseguir</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.backButtonCustom}
                  onPress={() => setModalStep('slider')}
                >
                  <Text style={styles.backButtonCustomText}>Voltar</Text>
                </TouchableOpacity>
              </View>
            )}

          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalDismissArea: {
    flex: 1,
  },
  sliderContainerWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  sliderCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
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
    paddingVertical: 15,
  },
  sliderLineFilled: {
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
    marginBottom: 25
  },
  justificationContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginBottom: 50
  },
  selecaoArea: {
    flex: 1,
    backgroundColor: '#121212',
    paddingTop: 50,
  },
  selecaoVoltar: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  selecaoTitulo: {
    color: '#FFF',
    fontSize: 22,
    paddingHorizontal: 20,
  },
  selecaoSubtitulo: {
    color: '#AAA',
    fontSize: 13,
    paddingHorizontal: 20,
    marginTop: 6,
  },
  selecaoValor: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '300',
    textAlign: 'center',
    marginTop: 4,
  },
  justificationTitle: {
    color: '#FFF',
    fontSize: 16,
    alignSelf: 'flex-start',
    marginBottom: 15,
  },
  actionButtonCustom: {
    width: '100%',
    height: 50,
    borderRadius: 14,
    backgroundColor: '#121212',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionButtonCustomText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  backButtonCustom: {
    width: '100%',
    height: 50,
    borderRadius: 14,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  backButtonCustomText: {
    color: '#121212',
    fontSize: 16,
    fontWeight: '600',
  },
});