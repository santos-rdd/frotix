import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Dimensions,
  Image,
  Alert,
} from 'react-native';
import { 
  Ionicons, 
  Feather, 
} from '@expo/vector-icons';

import AdmFormaPag from '../admFormaPag/admFormaPag';
import { colors } from '../../constants/theme';

const { width } = Dimensions.get('window');

export default function MotoristaHomeScreen(props) {
  const authGoogle = props.route?.params?.auth || null;
  const bankUser = props.route?.params?.bankUser || null;
  const userName =
    props.userName ||
    authGoogle?.user?.givenName ||
    bankUser?.name ||
    'Motorista';
  const userPhoto =
    props.userPhoto ||
    authGoogle?.user?.photo ||
    null;

  const [showPagamentos, setShowPagamentos] = useState(false);

  const handleRegistrarHodometro = () => {
    Alert.alert(
      'Hodômetro',
      'Confirmação de leitura do hodômetro:\nVeículo: POX-XX\nStatus: Rota Ativa',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar Leitura', onPress: () => Alert.alert('Sucesso', 'Hodômetro registrado com sucesso!') },
      ]
    );
  };

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

        {/* Ações Rápidas */}
        <Text style={styles.sectionTitle}>Ações Rápidas</Text>
        <View style={styles.actionsRow}>
          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: colors.cardLight }]}
            onPress={() => setShowPagamentos(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="card-outline" size={24} color="#0F172A" />
            <Text style={styles.actionTextDark}>Formas de Pagamento</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: colors.primaryBlue }]}
            activeOpacity={0.8}
            onPress={() => Alert.alert('Rotas', 'Visualizar rotas disponíveis para hoje')}
          >
            <Ionicons name="location-outline" size={24} color="#FFFFFF" />
            <Text style={styles.actionTextLight}>Rotas</Text>
          </TouchableOpacity>
        </View>

        {/* Viagens em Curso */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Viagens em curso</Text>
        
        <View style={styles.tripCard}>
          <Text style={styles.tripTag}>MINHA VIAGEM ATUAL</Text>

          {/* Timeline da Rota */}
          <View style={styles.routeTimeline}>
            <View style={styles.dotStart} />
            <View style={styles.line} />
            <View style={styles.dotEnd} />
          </View>

          <View style={styles.routeLabels}>
            <View>
              <Text style={styles.cityTitle}>Origem</Text>
              <Text style={styles.cityName}>São Paulo - SP</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.cityTitle}>Destino</Text>
              <Text style={styles.cityName}>Campinas - SP</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Card interno de Licença do Veículo */}
          <View style={styles.licenseBox}>
            <Text style={styles.licenseText}>Licença do veículo</Text>
            <View style={styles.licenseDashedLine} />
            <Text style={styles.plateText}>POX-XX</Text>
          </View>
        </View>

        {/* Componente Visual do Mapa */}
        <View style={styles.mapContainer}>
          <View style={styles.mapMockBg}>
            <Text style={styles.mapText}>[ Monitoramento GPS da Rota ]</Text>
            {/* Rota traçada fictícia */}
            <View style={styles.mockRouteLine} />
            <View style={styles.mockPin}>
              <Ionicons name="location-sharp" size={32} color="#DC2626" />
            </View>
          </View>
        </View>

        {/* Botão Registrar Hodômetro */}
        <TouchableOpacity 
          style={styles.primaryButton} 
          activeOpacity={0.8}
          onPress={handleRegistrarHodometro}
        >
          <Text style={styles.primaryButtonText}>Registrar Hodômetro</Text>
        </TouchableOpacity>

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
    fontSize: 20, 
    fontWeight: 'bold', 
    marginBottom: 14 
  },
  
  actionsRow: { 
    flexDirection: 'row', 
    gap: 12 
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

  mapContainer: { 
    height: 240, 
    borderRadius: 24, 
    overflow: 'hidden', 
    marginVertical: 16 
  },
  mapMockBg: { 
    flex: 1, 
    backgroundColor: '#1E293B', 
    justifyContent: 'center', 
    alignItems: 'center', 
    position: 'relative',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 24,
  },
  mapText: { 
    color: '#94A3B8', 
    fontSize: 12, 
    fontWeight: 'bold' 
  },
  mockRouteLine: { 
    position: 'absolute', 
    width: 120, 
    height: 4, 
    backgroundColor: colors.primaryBlue, 
    transform: [{ rotate: '-35deg' }] 
  },
  mockPin: { 
    position: 'absolute', 
    top: '38%', 
    right: '35%' 
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
