import React, { useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Ionicons,
  Feather,
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import DonutChart from '../../components/donutChart/donutChart';
import AdmFormaPag from '../admFormaPag/admFormaPag';
import UserControlSection from '../../components/userControlSection/userControlSection';
import RotasSection from '../../components/rotasSection/rotasSection';
import { colors } from '../../constants/theme';

// Dados dos gráficos
const dataBalanco = [
  { value: 694.23, color: '#3B82F6' },
  { value: 554.15, color: '#94A3B8' },
];

const dataDespesas = [
  { value: 37, color: '#1E3A8A' },
  { value: 44, color: '#FFFFFF' },
  { value: 14, color: '#DC2626' },
];

const QuickActionButton = ({ iconRender, label, isActive, onPress }) => {
  return (
    <TouchableOpacity
      style={[
        styles.quickActionButton,
        {
          backgroundColor: isActive ? '#2563EB' : '#1E1E1E',
          borderColor: isActive ? '#3B82F6' : '#27272A',
        },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {iconRender(isActive ? '#FFFFFF' : '#94A3B8')}
      <Text
        style={[
          styles.quickActionText,
          { color: isActive ? '#FFFFFF' : '#CBD5E1' },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

export default function AdminHomeScreen(props) {
  const authGoogle = props.route?.params?.auth || null;
  const bankUser = props.route?.params?.bankUser || null;
  const userName =
    props.userName ||
    authGoogle?.user?.givenName ||
    bankUser?.name ||
    'Administrador';
  const userPhoto =
    props.userPhoto ||
    authGoogle?.user?.photo ||
    null;

  // 0: Categorias Financeiras, 1: Formas de Pagamento, 2: Gerenciador de usuários, 3: Rotas e Veículos
  const [selectedAction, setSelectedAction] = useState(0);

  const actions = [
    {
      id: 0,
      label: 'Categorias Financeiras',
      icon: (color) => <Ionicons name="card-outline" size={24} color={color} />,
    },
    {
      id: 1,
      label: 'Formas de Pagamento',
      icon: (color) => <Ionicons name="wallet-outline" size={24} color={color} />,
    },
    {
      id: 2,
      label: 'Gerenciador de usuários',
      icon: (color) => <Feather name="users" size={24} color={color} />,
    },
    {
      id: 3,
      label: 'Rotas e Veículos',
      icon: (color) => <MaterialCommunityIcons name="truck-outline" size={24} color={color} />,
    },
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Cabeçalho */}
        <View style={styles.header}>
          <View>
            <Text style={styles.subtitle}>Boa Tarde</Text>
            <Text style={styles.title}>{userName}</Text>
          </View>
          {userPhoto ? (
            <Image source={{ uri: userPhoto }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={24} color="#FFFFFF" />
            </View>
          )}
        </View>

        {/* Resumo Geral */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Resumo Geral</Text>
          <View style={styles.filterContainer}>
            <Text style={styles.filterText}>últimos 7 dias </Text>
            <Feather name="filter" size={12} color="#9CA3AF" />
          </View>
        </View>

        {/* Card Balanço Atual */}
        <View style={styles.blueCard}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardTitle}>Balanço Atual</Text>
              <Text style={styles.cardSubtitle}>Visão semanal</Text>
            </View>
            <TouchableOpacity activeOpacity={0.7}>
              <Feather name="more-horizontal" size={20} color="#BFDBFE" />
            </TouchableOpacity>
          </View>

          <View style={styles.chartRow}>
            <DonutChart
              data={dataBalanco}
              radius={50}
              innerRadius={35}
              innerCircleColor="#2541FF"
            />
            <View style={{ gap: 8 }}>
              <View>
                <Text style={styles.incomeText}>+ R$ 694.23</Text>
                <Text style={styles.subDetailText}>nos últimos 7 dias</Text>
              </View>
              <View>
                <Text style={styles.expenseDetailText}>- R$ 554.15</Text>
                <Text style={styles.subDetailText}>nos últimos 7 dias</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Ações Rápidas */}
        <Text style={styles.sectionTitle}>Ações Rápidas</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.actionsScrollView}
        >
          {actions.map((action) => (
            <QuickActionButton
              key={action.id}
              iconRender={action.icon}
              label={action.label}
              isActive={selectedAction === action.id}
              onPress={() => setSelectedAction(action.id)}
            />
          ))}
        </ScrollView>

        {/* CONTEÚDO 0: CATEGORIAS FINANCEIRAS */}
        {selectedAction === 0 && (
          <View>
            {/* Card Quilometragem */}
            <View style={styles.darkCard}>
              <Text style={styles.dateText}>Segunda, 14 de setembro</Text>
              <View style={styles.centerContent}>
                <Ionicons name="flame" size={24} color="#3B82F6" />
                <Text style={styles.kmValue}>
                  350 <Text style={styles.kmUnit}>km</Text>
                </Text>
                <Text style={styles.dateText}>de 500 km meta</Text>
              </View>
            </View>

            {/* Card Saldo */}
            <View style={styles.darkCardCenter}>
              <Text style={styles.dateText}>Segunda, 14 de setembro</Text>
              <MaterialCommunityIcons
                name="piggy-bank-outline"
                size={28}
                color="#3B82F6"
                style={{ marginVertical: 6 }}
              />
              <Text style={styles.balanceValue}>53.435,20</Text>
              <Text style={styles.dateText}>Saldo atual</Text>
              <Text style={styles.expenseValue}>- 12.143,50</Text>
              <Text style={styles.expenseLabel}>Saídas do período</Text>
            </View>

            {/* Card Despesas */}
            <View style={styles.blueCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Despesas</Text>
                <View style={styles.filterContainer}>
                  <Text style={styles.filterTextLight}>últimos 7 dias </Text>
                  <Feather name="filter" size={10} color="#BFDBFE" />
                </View>
              </View>
              <Text style={styles.cardSubtitle}>percentagem atual</Text>

              <View style={styles.chartRow}>
                <DonutChart
                  data={dataDespesas}
                  radius={50}
                  innerRadius={35}
                  innerCircleColor="#2541FF"
                />
                <View style={{ gap: 8 }}>
                  <Text style={styles.legendText}>• 37% (Manutenção)</Text>
                  <Text style={styles.legendText}>• 44% (Combustível)</Text>
                  <Text style={styles.legendText}>• 14% (Pedágios)</Text>
                </View>
              </View>
            </View>

            {/* Métricas da Frota */}
            <View style={styles.metricsRow}>
              <View style={styles.metricCard}>
                <Text style={styles.metricValue}>10</Text>
                <Text style={styles.metricLabel}>Veículos em rota</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricValue}>3.200 km</Text>
                <Text style={styles.metricLabel}>rodados</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricValue}>R$ 6,80</Text>
                <Text style={styles.metricLabel}>Custo por km</Text>
              </View>
            </View>
          </View>
        )}

        {/* CONTEÚDO 1: FORMAS DE PAGAMENTO */}
        {selectedAction === 1 && (
          <View style={{ marginTop: 8 }}>
            <AdmFormaPag />
          </View>
        )}

        {/* CONTEÚDO 2: GERENCIADOR DE USUÁRIOS */}
        {selectedAction === 2 && (
          <View style={{ marginTop: 8 }}>
            <UserControlSection />
          </View>
        )}

        {/* CONTEÚDO 3: ROTAS E VEÍCULOS */}
        {selectedAction === 3 && (
          <View style={{ marginTop: 8 }}>
            <RotasSection />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#121212' 
  },
  scrollContent: { 
    padding: 16, 
    paddingBottom: 90 
  },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginTop: 20, 
    marginBottom: 16 
  },
  title: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    color: '#FFFFFF' 
  },
  subtitle: { 
    fontSize: 14, 
    color: '#9CA3AF' 
  },
  avatar: { 
    width: 48, 
    height: 48, 
    borderRadius: 24, 
    borderWidth: 2, 
    borderColor: '#374151' 
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#27272A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  sectionHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 12 
  },
  sectionTitle: { 
    fontSize: 18, 
    fontWeight: '600', 
    color: '#FFFFFF', 
    marginVertical: 8 
  },
  filterContainer: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  filterText: { 
    fontSize: 12, 
    color: '#9CA3AF' 
  },
  filterTextLight: { 
    fontSize: 12, 
    color: '#BFDBFE' 
  },
  blueCard: { 
    backgroundColor: '#2541FF', 
    borderRadius: 24, 
    padding: 20, 
    marginVertical: 8 
  },
  cardHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start' 
  },
  cardTitle: { 
    fontSize: 20, 
    fontWeight: '600', 
    color: '#FFFFFF' 
  },
  cardSubtitle: { 
    fontSize: 12, 
    color: '#BFDBFE' 
  },
  chartRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    alignItems: 'center', 
    marginTop: 14 
  },
  incomeText: { 
    fontSize: 15, 
    fontWeight: 'bold', 
    color: '#DBEAFE' 
  },
  expenseDetailText: { 
    fontSize: 15, 
    fontWeight: 'bold', 
    color: '#FFFFFF' 
  },
  subDetailText: { 
    fontSize: 11, 
    color: '#BFDBFE' 
  },
  actionsScrollView: { 
    flexDirection: 'row', 
    marginVertical: 8 
  },
  quickActionButton: { 
    width: 105, 
    height: 105, 
    borderRadius: 18, 
    padding: 12, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 12,
    borderWidth: 1,
  },
  quickActionText: { 
    fontSize: 11, 
    textAlign: 'center', 
    fontWeight: '500', 
    marginTop: 8 
  },
  darkCard: { 
    backgroundColor: '#1E1E1E', 
    borderRadius: 16, 
    padding: 16, 
    marginVertical: 8, 
    borderWidth: 1, 
    borderColor: '#27272A' 
  },
  darkCardCenter: { 
    backgroundColor: '#1E1E1E', 
    borderRadius: 16, 
    padding: 20, 
    marginVertical: 8, 
    borderWidth: 1, 
    borderColor: '#27272A', 
    alignItems: 'center' 
  },
  dateText: { 
    fontSize: 12, 
    color: '#60A5FA' 
  },
  centerContent: { 
    alignItems: 'center', 
    marginVertical: 8 
  },
  kmValue: { 
    fontSize: 28, 
    fontWeight: 'bold', 
    color: '#FFFFFF' 
  },
  kmUnit: { 
    fontSize: 14, 
    fontWeight: 'normal' 
  },
  balanceValue: { 
    fontSize: 30, 
    fontWeight: '800', 
    color: '#FFFFFF' 
  },
  expenseValue: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: '#EF4444', 
    marginTop: 8 
  },
  expenseLabel: { 
    fontSize: 12, 
    color: '#F87171' 
  },
  legendText: { 
    fontSize: 12, 
    color: '#FFFFFF', 
    fontWeight: '500' 
  },
  metricsRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginTop: 8 
  },
  metricCard: { 
    backgroundColor: '#F2F2F7', 
    borderRadius: 16, 
    padding: 12, 
    flex: 1, 
    marginHorizontal: 4, 
    alignItems: 'center' 
  },
  metricValue: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    color: '#0F172A' 
  },
  metricLabel: { 
    fontSize: 10, 
    color: '#334155', 
    textAlign: 'center', 
    marginTop: 2 
  },
});
