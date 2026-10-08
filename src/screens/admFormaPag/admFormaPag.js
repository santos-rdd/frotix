import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { colors } from '../../constants/theme';

const { width } = Dimensions.get('window');

export default function AdmFormaPag({ onBack, navigation }) {
  const [selectedPaymentFilter, setSelectedPaymentFilter] = useState('all');
  
  // Estado do sub-carrossel (0: Opções/Registros, 1: Histórico de Transações)
  const [activeSubTab, setActiveSubTab] = useState(0);

  // Lista dinâmica de transações
  const [transactions, setTransactions] = useState([
    {
      id: '1',
      title: 'Alimentação',
      date: '14 Setembro, 14:12',
      amount: '- R$ 320,99',
      type: 'out',
      method: 'cartao',
      badge: 'Cartão de Débito',
    },
    {
      id: '2',
      title: 'Entrada de Cliente',
      date: '14 Setembro, 12:12',
      amount: '+ R$ 900,95',
      type: 'in',
      method: 'pix',
      badge: 'Pix',
    },
    {
      id: '3',
      title: 'Freelance Design',
      date: '13 Setembro, 18:30',
      amount: '+ R$ 236,12',
      type: 'in',
      method: 'pix',
      badge: 'Pix',
    },
    {
      id: '4',
      title: 'Abastecimento Frota',
      date: '13 Setembro, 10:15',
      amount: '- R$ 45,00',
      type: 'out',
      method: 'boleto',
      badge: 'Boleto Bancário',
    },
  ]);

  // Estados do Modal de Novo Registro
  const [modalVisible, setModalVisible] = useState(false);
  const [transactionType, setTransactionType] = useState('in'); // 'in' ou 'out'
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('pix');

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (navigation?.goBack) {
      navigation.goBack();
    }
  };

  // Função para abrir o formulário configurado
  const handleOpenRegister = (type) => {
    setTransactionType(type);
    setTitle('');
    setAmount('');
    setModalVisible(true);
  };

  // Salvar novo registro de Entrada/Saída
  const handleSaveTransaction = () => {
    if (!title.trim() || !amount.trim()) {
      Alert.alert('Atenção', 'Preencha a descrição e o valor.');
      return;
    }

    const cleanAmount = parseFloat(amount.replace(',', '.'));
    if (isNaN(cleanAmount) || cleanAmount <= 0) {
      Alert.alert('Atenção', 'Informe um valor numérico válido.');
      return;
    }

    const newEntry = {
      id: String(Date.now()),
      title: title.trim(),
      date: 'Hoje, ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      amount: `${transactionType === 'in' ? '+' : '-'} R$ ${cleanAmount.toFixed(2)}`,
      type: transactionType,
      method: method,
      badge: method === 'pix' ? 'Pix' : method === 'cartao' ? 'Cartão' : 'Boleto',
    };

    setTransactions([newEntry, ...transactions]);
    setModalVisible(false);
    setActiveSubTab(1); // Redireciona automaticamente para o histórico
  };

  const filteredTransactions = transactions.filter((item) => {
    if (selectedPaymentFilter === 'all') return true;
    return item.method === selectedPaymentFilter;
  });

  return (
    <View style={styles.container}>
      {(onBack || navigation?.goBack) && (
        <TouchableOpacity style={styles.backBtn} onPress={handleBack} activeOpacity={0.7}>
          <Feather name="chevron-left" size={28} color="#FFFFFF" />
          <Text style={styles.backBtnText}>Voltar</Text>
        </TouchableOpacity>
      )}

      {/* 1. CARROSSEL DOS MÉTODOS DE PAGAMENTO (CARTÃO, PIX, BOLETO) */}
      <View style={styles.dashboardPaymentContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.paymentCardsScroll}
        >
          {/* CARD 1: CARTÃO */}
          <TouchableOpacity
            activeOpacity={0.8}
            style={[
              styles.methodCard,
              styles.cardGradient,
              selectedPaymentFilter === 'cartao' && styles.methodCardSelected,
            ]}
            onPress={() => setSelectedPaymentFilter(selectedPaymentFilter === 'cartao' ? 'all' : 'cartao')}
          >
            <View style={styles.cardHeaderRow}>
              <Ionicons name="card-outline" size={24} color="#FFFFFF" />
              <Text style={styles.cardTypeLabel}>DEBIT / CREDIT</Text>
            </View>
            <Text style={styles.cardNumberText}>•••• •••• •••• 8824</Text>
            <View style={styles.cardFooterRow}>
              <View>
                <Text style={styles.cardSubTitle}>TITULAR</Text>
                <Text style={styles.cardValText}>Joy Laroy</Text>
              </View>
              <View>
                <Text style={styles.cardSubTitle}>VAL</Text>
                <Text style={styles.cardValText}>12/28</Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* CARD 2: PIX */}
          <TouchableOpacity
            activeOpacity={0.8}
            style={[
              styles.methodCard,
              styles.pixCardBg,
              selectedPaymentFilter === 'pix' && styles.methodCardSelected,
            ]}
            onPress={() => setSelectedPaymentFilter(selectedPaymentFilter === 'pix' ? 'all' : 'pix')}
          >
            <View style={styles.cardHeaderRow}>
              <Ionicons name="qr-code-outline" size={24} color="#00F2FE" />
              <Text style={styles.pixTag}>Instantâneo</Text>
            </View>
            <Text style={styles.pixTitle}>Chave Pix Ativa</Text>
            <Text style={styles.pixKey}>financeiro@empresa.com.br</Text>
            <View style={styles.pixFooter}>
              <Text style={styles.pixStatus}>● Disponível 24h</Text>
            </View>
          </TouchableOpacity>

          {/* CARD 3: BOLETO */}
          <TouchableOpacity
            activeOpacity={0.8}
            style={[
              styles.methodCard,
              styles.boletoCardBg,
              selectedPaymentFilter === 'boleto' && styles.methodCardSelected,
            ]}
            onPress={() => setSelectedPaymentFilter(selectedPaymentFilter === 'boleto' ? 'all' : 'boleto')}
          >
            <View style={styles.cardHeaderRow}>
              <Ionicons name="document-text-outline" size={24} color="#EAB308" />
              <Text style={styles.boletoTag}>Boleto DDA</Text>
            </View>
            <Text style={styles.boletoTitle}>Boletos em Aberto</Text>
            <Text style={styles.boletoAmount}>2 pendentes</Text>
            <View style={styles.boletoFooter}>
              <Text style={styles.boletoDueDate}>Próximo: 20/09</Text>
            </View>
          </TouchableOpacity>
        </ScrollView>

        {/* PAGINAÇÃO DOS MÉTODOS */}
        <View style={styles.dotsRow}>
          <View style={styles.dotInactive} />
          <View style={styles.dotActive} />
          <View style={styles.dotInactive} />
        </View>
      </View>

      {/* 2. ALTERNADOR ENTRE OPÇÕES E HISTÓRICO */}
      <View style={styles.subTabHeader}>
        <TouchableOpacity onPress={() => setActiveSubTab(0)}>
          <Text style={[styles.subTabTitle, activeSubTab === 0 && styles.subTabTitleActive]}>
            Opções
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setActiveSubTab(1)}>
          <Text style={[styles.subTabTitle, activeSubTab === 1 && styles.subTabTitleActive]}>
            Atividade Recente
          </Text>
        </TouchableOpacity>
      </View>

      {/* VIEW ABA 0: OPÇÕES (ADICIONAR/DELETAR CARTÃO E REGISTRAR ENTRADA/SAÍDA) */}
      {activeSubTab === 0 && (
        <View style={styles.optionsContainer}>
          {/* Botões Circulares */}
          <View style={styles.circleButtonsRow}>
            <TouchableOpacity 
              style={styles.circleBtnContainer}
              onPress={() => Alert.alert('Cartão', 'Opção de adicionar novo cartão')}
            >
              <View style={styles.circleBtn}>
                <Feather name="plus" size={22} color="#0F172A" />
              </View>
              <Text style={styles.circleBtnLabel}>Adicionar{'\n'}Cartão</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.circleBtnContainer}
              onPress={() => Alert.alert('Cartão', 'Opção de gerenciar ou deletar cartão')}
            >
              <View style={styles.circleBtn}>
                <Feather name="trash-2" size={22} color="#0F172A" />
              </View>
              <Text style={styles.circleBtnLabel}>Deletar{'\n'}Cartão</Text>
            </TouchableOpacity>
          </View>

          {/* Botões de Ação de Registro */}
          <TouchableOpacity
            style={styles.registerInBtn}
            onPress={() => handleOpenRegister('in')}
            activeOpacity={0.8}
          >
            <Text style={styles.registerBtnText}>Registrar Entrada</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.registerOutBtn}
            onPress={() => handleOpenRegister('out')}
            activeOpacity={0.8}
          >
            <Text style={styles.registerBtnText}>Registrar Saída</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* VIEW ABA 1: ATIVIDADE RECENTE / HISTÓRICO */}
      {activeSubTab === 1 && (
        <View style={styles.transactionsList}>
          {selectedPaymentFilter !== 'all' && (
            <TouchableOpacity
              style={styles.clearFilterBtn}
              onPress={() => setSelectedPaymentFilter('all')}
            >
              <Text style={styles.clearFilterText}>
                Filtro: {selectedPaymentFilter.toUpperCase()} (Toque para limpar)
              </Text>
            </TouchableOpacity>
          )}

          {filteredTransactions.map((item) => (
            <TouchableOpacity key={item.id} style={styles.transactionCard} activeOpacity={0.8}>
              <View style={styles.transactionLeft}>
                <View
                  style={[
                    styles.iconCircle,
                    item.type === 'in' ? styles.iconIn : styles.iconOut,
                  ]}
                >
                  <Feather
                    name={item.type === 'in' ? 'arrow-down-left' : 'arrow-up-right'}
                    size={18}
                    color={item.type === 'in' ? '#10B981' : '#EF4444'}
                  />
                </View>
                <View>
                  <Text style={styles.transTitle}>{item.title}</Text>
                  <Text style={styles.transDate}>
                    {item.date} • <Text style={styles.badgeText}>{item.badge}</Text>
                  </Text>
                </View>
              </View>

              <Text
                style={[
                  styles.transAmount,
                  item.type === 'in' ? styles.amountIn : styles.amountOut,
                ]}
              >
                {item.amount}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* INDICADOR DE PAGINAÇÃO DAS ABAS */}
      <View style={[styles.dotsRow, { marginTop: 20 }]}>
        <View style={activeSubTab === 0 ? styles.dotActive : styles.dotInactive} />
        <View style={activeSubTab === 1 ? styles.dotActive : styles.dotInactive} />
      </View>

      {/* ======================================================== */}
      {/* MODAL PARA REGISTRAR ENTRADA / SAÍDA                      */}
      {/* ======================================================== */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {transactionType === 'in' ? 'Registrar Entrada' : 'Registrar Saída'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Feather name="x" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Descrição</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Recebimento de Cliente, Abastecimento..."
              placeholderTextColor="#64748B"
              value={title}
              onChangeText={setTitle}
            />

            <Text style={styles.inputLabel}>Valor (R$)</Text>
            <TextInput
              style={styles.input}
              placeholder="0,00"
              placeholderTextColor="#64748B"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />

            <Text style={styles.inputLabel}>Forma de Pagamento</Text>
            <View style={styles.methodSelectorRow}>
              {['pix', 'cartao', 'boleto'].map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[
                    styles.methodSelectorBtn,
                    method === m && styles.methodSelectorBtnActive,
                  ]}
                  onPress={() => setMethod(m)}
                >
                  <Text style={styles.methodSelectorText}>{m.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[
                styles.saveModalBtn,
                { backgroundColor: transactionType === 'in' ? '#2563EB' : '#DC2626' },
              ]}
              onPress={handleSaveTransaction}
              activeOpacity={0.8}
            >
              <Text style={styles.saveModalBtnText}>Confirmar e Salvar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 5,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  backBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginLeft: 4,
  },
  dashboardPaymentContainer: {
    marginBottom: 10,
  },
  paymentCardsScroll: {
    flexDirection: 'row',
  },
  methodCard: {
    width: width * 0.65,
    height: 140,
    borderRadius: 20,
    padding: 16,
    marginRight: 14,
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  methodCardSelected: {
    borderColor: '#38BDF8',
  },
  cardGradient: {
    backgroundColor: '#3B82F6',
  },
  pixCardBg: {
    backgroundColor: '#0F172A',
    borderColor: '#1E293B',
    borderWidth: 1,
  },
  boletoCardBg: {
    backgroundColor: '#18181B',
    borderColor: '#27272A',
    borderWidth: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTypeLabel: {
    color: '#E0E7FF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  cardNumberText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardSubTitle: {
    color: '#93C5FD',
    fontSize: 9,
  },
  cardValText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  pixTag: {
    color: '#00F2FE',
    fontSize: 11,
    fontWeight: 'bold',
  },
  pixTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  pixKey: {
    color: '#94A3B8',
    fontSize: 12,
  },
  pixFooter: {
    marginTop: 4,
  },
  pixStatus: {
    color: '#10B981',
    fontSize: 11,
  },
  boletoTag: {
    color: '#EAB308',
    fontSize: 11,
    fontWeight: 'bold',
  },
  boletoTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  boletoAmount: {
    color: '#E2E8F0',
    fontSize: 13,
  },
  boletoFooter: {},
  boletoDueDate: {
    color: '#F59E0B',
    fontSize: 11,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  dotActive: {
    width: 20,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2563EB',
  },
  dotInactive: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
    opacity: 0.8,
  },

  /* SUB TABS INTERNAS (OPÇÕES / ATIVIDADE RECENTE) */
  subTabHeader: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 15,
    marginBottom: 15,
  },
  subTabTitle: {
    color: '#64748B',
    fontSize: 18,
    fontWeight: 'bold',
  },
  subTabTitleActive: {
    color: '#FFFFFF',
  },

  /* CONTAINER DAS OPÇÕES */
  optionsContainer: {
    alignItems: 'center',
    gap: 12,
  },
  circleButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 10,
  },
  circleBtnContainer: {
    alignItems: 'center',
  },
  circleBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  circleBtnLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  registerInBtn: {
    backgroundColor: '#2563EB',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
  },
  registerOutBtn: {
    backgroundColor: '#B91C1C',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
  },
  registerBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },

  /* HISTÓRICO DE TRANSAÇÕES */
  transactionsList: {
    marginTop: 5,
  },
  clearFilterBtn: {
    marginBottom: 10,
  },
  clearFilterText: {
    color: '#38BDF8',
    fontSize: 12,
  },
  transactionCard: {
    backgroundColor: '#18181B',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconIn: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  iconOut: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  transTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  transDate: {
    color: '#71717A',
    fontSize: 12,
    marginTop: 2,
  },
  badgeText: {
    color: '#A1A1AA',
    fontWeight: '500',
  },
  transAmount: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  amountIn: {
    color: '#10B981',
  },
  amountOut: {
    color: '#FFFFFF',
  },

  /* ESTILOS DO MODAL */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  inputLabel: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 10,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#0F172A',
    color: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
  },
  methodSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    marginBottom: 16,
  },
  methodSelectorBtn: {
    flex: 1,
    backgroundColor: '#0F172A',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  methodSelectorBtnActive: {
    borderColor: '#38BDF8',
    backgroundColor: '#1E3A8A',
  },
  methodSelectorText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  saveModalBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  saveModalBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
