import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  SafeAreaView, 
  TouchableOpacity,
  Image,
} from 'react-native';
import { 
  Ionicons, 
  Feather, 
  MaterialCommunityIcons, 
} from '@expo/vector-icons';

import DonutChart from '../../components/donutChart/donutChart';
import AdmFormaPag from '../admFormaPag/admFormaPag';
import { colors } from '../../constants/theme';

const dataBalanco = [
  { value: 694.23, color: '#3B82F6' },
  { value: 554.15, color: '#94A3B8' },
];

const dataDespesas = [
  { value: 37, color: '#1E3A8A' },
  { value: 44, color: '#FFFFFF' },
  { value: 14, color: '#DC2626' },
];

export default function FinanceiroHomeScreen(props) {
  const authGoogle = props.route?.params?.auth || null;
  const bankUser = props.route?.params?.bankUser || null;
  const userName =
    props.userName ||
    authGoogle?.user?.givenName ||
    bankUser?.name ||
    'Financeiro';
  const userPhoto =
    props.userPhoto ||
    authGoogle?.user?.photo ||
    null;

  const [showPagamentos, setShowPagamentos] = useState(false);

  if (showPagamentos) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <AdmFormaPag onBack={() => setShowPagamentos(false)} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Boa Tarde</Text>
            <Text style={styles.userName}>{userName}</Text>
          </View>
          {userPhoto ? (
            <Image source={{ uri: userPhoto }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={20} color="#FFFFFF" />
            </View>
          )}
        </View>

        {/* Resumo Geral Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Resumo Geral</Text>
          <View style={styles.filterRow}>
            <Text style={styles.filterText}>últimos 7 dias </Text>
            <Feather name="chevron-down" size={14} color={colors.textSecondary} />
          </View>
        </View>

        {/* Card: Balanço Atual (Azul) */}
        <View style={styles.blueCard}>
          <View style={styles.cardTopRow}>
            <View>
              <Text style={styles.blueCardTitle}>Balanço Atual</Text>
              <Text style={styles.blueCardSub}>Resumo financeiro</Text>
            </View>
            <TouchableOpacity activeOpacity={0.7}>
              <Feather name="more-horizontal" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: '#3B82F6' }]} />
              <Text style={styles.legendText}>Entradas</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: '#94A3B8' }]} />
              <Text style={styles.legendText}>Saídas</Text>
            </View>
          </View>

          <View style={styles.chartContainer}>
            <DonutChart
              data={dataBalanco}
              radius={45}
              innerRadius={30}
              innerCircleColor={colors.cardBlue}
            />
            <View style={styles.chartValues}>
              <Text style={styles.chartValGreen}>+ R$ 694.23</Text>
              <Text style={styles.chartSubText}>nos últimos 7 dias</Text>
              
              <Text style={[styles.chartValRed, { marginTop: 12 }]}>- R$ 554.15</Text>
              <Text style={styles.chartSubText}>nos últimos 7 dias</Text>
            </View>
          </View>
        </View>

        {/* Ações Rápidas Financeiro */}
        <Text style={[styles.sectionTitle, { marginTop: 24, marginBottom: 12 }]}>Ações Rápidas</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: colors.cardBlue }]}
            activeOpacity={0.8}
          >
            <Ionicons name="card-outline" size={24} color="#FFFFFF" />
            <Text style={styles.actionBtnTextLight}>Categorias Financeiras</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: colors.cardLight }]}
            onPress={() => setShowPagamentos(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="wallet-outline" size={24} color="#0F172A" />
            <Text style={styles.actionBtnTextDark}>Formas de Pagamento</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Card: Saldo Atual */}
        <View style={styles.darkCard}>
          <Text style={styles.dateText}>Segunda, 14 de setembro</Text>
          <View style={{ alignItems: 'center', marginVertical: 12 }}>
            <MaterialCommunityIcons name="piggy-bank-outline" size={32} color="#3B82F6" />
            <Text style={styles.mainBalance}>53.435,20</Text>
            <Text style={styles.balanceLabel}>Saldo atual em conta</Text>
            <Text style={styles.expenseValue}>- 12.143,50</Text>
            <Text style={styles.expenseLabel}>Saídas registradas</Text>
          </View>
        </View>

        {/* Card: Despesas e Percentual */}
        <View style={[styles.blueCard, { marginTop: 16 }]}>
          <View style={styles.cardTopRow}>
            <View>
              <Text style={styles.blueCardTitle}>Despesas</Text>
              <Text style={styles.blueCardSub}>percentagem atual</Text>
            </View>
            <TouchableOpacity activeOpacity={0.7}>
              <Feather name="more-horizontal" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.legendRow}>
            <Text style={styles.legendText}>● Manutenção</Text>
            <Text style={styles.legendText}>● Combustível</Text>
            <Text style={styles.legendText}>● Pedágios</Text>
          </View>

          <View style={styles.chartContainer}>
            <DonutChart
              data={dataDespesas}
              radius={45}
              innerRadius={30}
              innerCircleColor={colors.cardBlue}
            />
            <View style={styles.chartValues}>
              <Text style={styles.legendPercentText}>• 37% (Manutenção)</Text>
              <Text style={styles.legendPercentText}>• 44% (Combustível)</Text>
              <Text style={styles.legendPercentText}>• 14% (Pedágios)</Text>
            </View>
          </View>
        </View>

        {/* Trinca de Indicadores Rápidos */}
        <View style={styles.metricsRow}>
          <View style={styles.metricBox}>
            <Text style={styles.metricVal}>10</Text>
            <Text style={styles.metricSub}>Veículos em rota</Text>
          </View>

          <View style={styles.metricBox}>
            <Text style={styles.metricVal}>3.200 km</Text>
            <Text style={styles.metricSub}>rodados</Text>
          </View>

          <View style={styles.metricBox}>
            <Text style={styles.metricVal}>R$ 6,80</Text>
            <Text style={styles.metricSub}>Custo por km</Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
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
    backgroundColor: '#27272A', 
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3B82F6'
  },
  
  sectionHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 12 
  },
  sectionTitle: { 
    color: colors.textPrimary, 
    fontSize: 20, 
    fontWeight: 'bold' 
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterText: { 
    color: colors.textSecondary, 
    fontSize: 12 
  },

  blueCard: { 
    backgroundColor: colors.cardBlue, 
    borderRadius: 20, 
    padding: 18, 
    marginBottom: 12 
  },
  blueCardTitle: { 
    color: '#FFFFFF', 
    fontSize: 18, 
    fontWeight: 'bold' 
  },
  blueCardSub: { 
    color: '#BFDBFE', 
    fontSize: 12 
  },
  cardTopRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start' 
  },
  legendRow: { 
    flexDirection: 'row', 
    gap: 14, 
    marginVertical: 12 
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: { 
    color: '#FFFFFF', 
    fontSize: 11 
  },
  legendPercentText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },

  chartContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginTop: 10, 
    gap: 20 
  },
  chartValues: { 
    justifyContent: 'center' 
  },
  chartValGreen: { 
    color: '#FFFFFF', 
    fontWeight: 'bold', 
    fontSize: 15 
  },
  chartValRed: { 
    color: '#FFFFFF', 
    fontWeight: 'bold', 
    fontSize: 15 
  },
  chartSubText: { 
    color: '#BFDBFE', 
    fontSize: 10 
  },

  actionBtn: { 
    width: 120, 
    height: 110, 
    borderRadius: 18, 
    padding: 14, 
    justifyContent: 'space-between', 
    marginRight: 12 
  },
  actionBtnTextLight: { 
    color: '#FFFFFF', 
    fontSize: 11, 
    fontWeight: '600' 
  },
  actionBtnTextDark: { 
    color: '#0F172A', 
    fontSize: 11, 
    fontWeight: '600' 
  },

  darkCard: { 
    backgroundColor: colors.cardBg, 
    borderRadius: 16, 
    padding: 18,
    borderWidth: 1,
    borderColor: '#27272A'
  },
  dateText: { 
    color: '#60A5FA', 
    fontSize: 12 
  },
  mainBalance: { 
    color: colors.textPrimary, 
    fontSize: 28, 
    fontWeight: 'bold', 
    marginTop: 6 
  },
  balanceLabel: { 
    color: colors.textSecondary, 
    fontSize: 11 
  },
  expenseValue: { 
    color: colors.redDanger, 
    fontSize: 18, 
    fontWeight: 'bold', 
    marginTop: 8 
  },
  expenseLabel: { 
    color: colors.redDanger, 
    fontSize: 11 
  },

  metricsRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginTop: 16, 
    gap: 8 
  },
  metricBox: { 
    flex: 1, 
    backgroundColor: colors.cardLight, 
    borderRadius: 16, 
    padding: 12, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  metricVal: { 
    color: '#000000', 
    fontSize: 16, 
    fontWeight: 'bold' 
  },
  metricSub: { 
    color: '#666666', 
    fontSize: 10, 
    textAlign: 'center', 
    marginTop: 2 
  },
});
