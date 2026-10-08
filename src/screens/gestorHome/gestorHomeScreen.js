import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { 
  Ionicons, 
  MaterialCommunityIcons 
} from '@expo/vector-icons';
import { colors } from '../../constants/theme';

export default function GestorHomeScreen(props) {
  const authGoogle = props.route?.params?.auth || null;
  const bankUser = props.route?.params?.bankUser || null;
  const userName =
    props.userName ||
    authGoogle?.user?.givenName ||
    bankUser?.name ||
    'Gestor de Frota';
  const userPhoto =
    props.userPhoto ||
    authGoogle?.user?.photo ||
    null;

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
              <MaterialCommunityIcons name="truck-outline" size={22} color="#FFFFFF" />
            </View>
          )}
        </View>

        {/* Status da Frota em Tempo Real */}
        <Text style={styles.sectionTitle}>Status da Frota</Text>
        <View style={styles.metricsRow}>
          <View style={[styles.metricCard, { borderLeftColor: colors.greenSuccess, borderLeftWidth: 4 }]}>
            <Text style={styles.metricVal}>12</Text>
            <Text style={styles.metricSub}>Em Rota</Text>
          </View>

          <View style={[styles.metricCard, { borderLeftColor: colors.yellowWarning, borderLeftWidth: 4 }]}>
            <Text style={styles.metricVal}>3</Text>
            <Text style={styles.metricSub}>Em Manutenção</Text>
          </View>

          <View style={[styles.metricCard, { borderLeftColor: colors.textSecondary, borderLeftWidth: 4 }]}>
            <Text style={styles.metricVal}>5</Text>
            <Text style={styles.metricSub}>Disponíveis</Text>
          </View>
        </View>

        {/* Ações Rápidas de Gestão */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Ações Rápidas</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}>
          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: colors.primaryBlue }]}
            activeOpacity={0.8}
            onPress={() => Alert.alert('Veículo', 'Abrir cadastro de veículo')}
          >
            <MaterialCommunityIcons name="truck-plus-outline" size={24} color="#FFFFFF" />
            <Text style={styles.actionBtnTextLight}>Cadastrar Veículo</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: colors.cardLight }]}
            activeOpacity={0.8}
            onPress={() => Alert.alert('Motorista', 'Abrir atribuição de motorista')}
          >
            <Ionicons name="person-add-outline" size={24} color="#0F172A" />
            <Text style={styles.actionBtnTextDark}>Atribuir Motorista</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: colors.cardLight }]}
            activeOpacity={0.8}
            onPress={() => Alert.alert('Revisão', 'Abrir agendamento de revisão')}
          >
            <Ionicons name="construct-outline" size={24} color="#0F172A" />
            <Text style={styles.actionBtnTextDark}>Agendar Revisão</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Painel de Alertas Operacionais */}
        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Alertas e Pendências</Text>
        
        <View style={styles.alertCard}>
          <View style={styles.alertHeader}>
            <Text style={styles.alertBadgeRed}>Manutenção Crítica</Text>
            <Text style={styles.alertDate}>Hoje</Text>
          </View>
          <Text style={styles.alertTitle}>Troca de Óleo - Caminhão Volare (ABC-1234)</Text>
          <Text style={styles.alertSub}>Ultrapassou a meta de 10.000 km previstos.</Text>
        </View>

        <View style={styles.alertCard}>
          <View style={styles.alertHeader}>
            <Text style={styles.alertBadgeYellow}>Documento Vencendo</Text>
            <Text style={styles.alertDate}>Em 5 dias</Text>
          </View>
          <Text style={styles.alertTitle}>IPVA / CNH Motorista - João Silva</Text>
          <Text style={styles.alertSub}>Regularizar a renovação do documento da frota.</Text>
        </View>

        {/* Indicadores de Rendimento Operacional */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Desempenho da Semana</Text>
          <View style={styles.summaryRow}>
            <View>
              <Text style={styles.summaryVal}>14.500 km</Text>
              <Text style={styles.summaryLabel}>Total Percorrido</Text>
            </View>
            <View>
              <Text style={styles.summaryVal}>92%</Text>
              <Text style={styles.summaryLabel}>Eficiência de Rotas</Text>
            </View>
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
    backgroundColor: '#1E1E22', 
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3B56FF' 
  },

  sectionTitle: { 
    color: colors.textPrimary, 
    fontSize: 18, 
    fontWeight: 'bold', 
    marginBottom: 10 
  },
  
  metricsRow: { 
    flexDirection: 'row', 
    gap: 10 
  },
  metricCard: { 
    flex: 1, 
    backgroundColor: colors.cardBg, 
    borderRadius: 14, 
    padding: 14, 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#27272A'
  },
  metricVal: { 
    color: colors.textPrimary, 
    fontSize: 20, 
    fontWeight: 'bold' 
  },
  metricSub: { 
    color: colors.textSecondary, 
    fontSize: 11, 
    marginTop: 2, 
    textAlign: 'center' 
  },

  actionBtn: { 
    width: 115, 
    height: 110, 
    borderRadius: 18, 
    padding: 14, 
    justifyContent: 'space-between', 
    marginRight: 10 
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

  alertCard: { 
    backgroundColor: colors.cardBg, 
    borderRadius: 16, 
    padding: 16, 
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#27272A' 
  },
  alertHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 8 
  },
  alertBadgeRed: { 
    color: colors.redDanger, 
    fontSize: 11, 
    fontWeight: 'bold', 
    backgroundColor: 'rgba(239, 68, 68, 0.15)', 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 6 
  },
  alertBadgeYellow: { 
    color: colors.yellowWarning, 
    fontSize: 11, 
    fontWeight: 'bold', 
    backgroundColor: 'rgba(245, 158, 11, 0.15)', 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 6 
  },
  alertDate: { 
    color: colors.textSecondary, 
    fontSize: 11 
  },
  alertTitle: { 
    color: colors.textPrimary, 
    fontSize: 14, 
    fontWeight: 'bold' 
  },
  alertSub: { 
    color: colors.textSecondary, 
    fontSize: 12, 
    marginTop: 4 
  },

  summaryCard: { 
    backgroundColor: colors.primaryBlue, 
    borderRadius: 20, 
    padding: 18, 
    marginTop: 8 
  },
  summaryTitle: { 
    color: '#FFFFFF', 
    fontSize: 16, 
    fontWeight: 'bold', 
    marginBottom: 12 
  },
  summaryRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between' 
  },
  summaryVal: { 
    color: '#FFFFFF', 
    fontSize: 20, 
    fontWeight: 'bold' 
  },
  summaryLabel: { 
    color: '#E0E0E0', 
    fontSize: 11, 
    marginTop: 2 
  },
});
