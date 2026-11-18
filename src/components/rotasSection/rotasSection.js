import React from 'react';
import {
  Alert,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function RotasSection({ onRegistrarHodometro }) {
  const handleRegistrar = () => {
    if (onRegistrarHodometro) {
      onRegistrarHodometro();
    } else {
      Alert.alert('Hodômetro', 'Abrir tela de registro de hodômetro');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Viagens em curso</Text>

      {/* Card da Viagem Atual */}
      <View style={styles.blueCard}>
        <Text style={styles.cardHeaderTitle}>VIAGEM ATUAL</Text>

        {/* Linha do Percurso (Origem -> Destino) */}
        <View style={styles.routeRow}>
          <View style={styles.pointContainer}>
            <View style={styles.circleOutline} />
            <Text style={styles.locationTitle}>Origem</Text>
            <Text style={styles.locationSub}>Cidade x</Text>
          </View>

          <View style={styles.lineConnector} />

          <View style={styles.pointContainerRight}>
            <View style={styles.circleSolid} />
            <Text style={styles.locationTitleRight}>Destino</Text>
            <Text style={styles.locationSubRight}>Cidade y</Text>
          </View>
        </View>

        {/* Card Interno: Licença do veículo */}
        <View style={styles.licenseCard}>
          <Text style={styles.licenseLabel}>Licença do{'\n'}veículo</Text>
          <View style={styles.dashedLine} />
          <Text style={styles.licensePlate}>POX-XX</Text>
        </View>
      </View>

      {/* Indicadores de página/carrossel */}
      <View style={styles.paginationDots}>
        <View style={[styles.dot, styles.inactiveDot]} />
        <View style={[styles.dot, styles.activeDot]} />
        <View style={[styles.dot, styles.inactiveDot]} />
      </View>

      {/* Visualização do Mapa */}
      <View style={styles.mapContainer}>
        <Image
          source={{ uri: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&q=80&w=600' }}
          style={styles.mapImage}
        />
        {/* Marcador do mapa */}
        <View style={styles.mapMarker}>
          <Ionicons name="location-sharp" size={32} color="#DC2626" />
        </View>
      </View>

      {/* Botão Registrar Hodômetro */}
      <TouchableOpacity 
        style={styles.btnRegistrar} 
        onPress={handleRegistrar} 
        activeOpacity={0.8}
      >
        <Text style={styles.btnRegistrarText}>Registrar Hodômetro</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    marginTop: 16 
  },
  sectionTitle: { 
    fontSize: 22, 
    fontWeight: '600', 
    color: '#FFFFFF', 
    marginBottom: 16 
  },
  blueCard: { 
    backgroundColor: '#2541FF', 
    borderRadius: 24, 
    padding: 20 
  },
  cardHeaderTitle: { 
    color: '#FFFFFF', 
    fontSize: 13, 
    fontWeight: 'bold', 
    letterSpacing: 0.5, 
    marginBottom: 20 
  },
  routeRow: { 
    flexDirection: 'row', 
    alignItems: 'flex-start', 
    justifyContent: 'space-between', 
    marginBottom: 20, 
    position: 'relative' 
  },
  pointContainer: { 
    alignItems: 'flex-start' 
  },
  pointContainerRight: { 
    alignItems: 'flex-end' 
  },
  circleOutline: { 
    width: 14, 
    height: 14, 
    borderRadius: 7, 
    borderWidth: 3, 
    borderColor: '#FFFFFF', 
    backgroundColor: '#2541FF', 
    marginBottom: 6 
  },
  circleSolid: { 
    width: 14, 
    height: 14, 
    borderRadius: 7, 
    backgroundColor: '#FFFFFF', 
    marginBottom: 6 
  },
  lineConnector: { 
    position: 'absolute', 
    top: 5, 
    left: 14, 
    right: 14, 
    height: 2, 
    backgroundColor: '#FFFFFF' 
  },
  locationTitle: { 
    color: '#FFFFFF', 
    fontSize: 14, 
    fontWeight: 'bold' 
  },
  locationSub: { 
    color: '#BFDBFE', 
    fontSize: 11 
  },
  locationTitleRight: { 
    color: '#FFFFFF', 
    fontSize: 14, 
    fontWeight: 'bold', 
    textAlign: 'right' 
  },
  locationSubRight: { 
    color: '#BFDBFE', 
    fontSize: 11, 
    textAlign: 'right' 
  },
  licenseCard: { 
    backgroundColor: '#1E3A8A', 
    borderRadius: 16, 
    padding: 16, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between' 
  },
  licenseLabel: { 
    color: '#FFFFFF', 
    fontSize: 12, 
    fontWeight: 'bold', 
    lineHeight: 16 
  },
  dashedLine: { 
    flex: 1, 
    height: 1, 
    backgroundColor: '#60A5FA', 
    marginHorizontal: 12 
  },
  licensePlate: { 
    color: '#FFFFFF', 
    fontSize: 16, 
    fontWeight: 'bold' 
  },
  paginationDots: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginVertical: 16 
  },
  dot: { 
    height: 8, 
    borderRadius: 4, 
    marginHorizontal: 4 
  },
  activeDot: { 
    width: 24, 
    backgroundColor: '#2541FF' 
  },
  inactiveDot: { 
    width: 8, 
    backgroundColor: '#FFFFFF' 
  },
  mapContainer: { 
    width: '100%', 
    height: 260, 
    borderRadius: 24, 
    overflow: 'hidden', 
    marginBottom: 20, 
    position: 'relative' 
  },
  mapImage: { 
    width: '100%', 
    height: '100%' 
  },
  mapMarker: { 
    position: 'absolute', 
    top: '50%', 
    left: '50%', 
    marginTop: -16, 
    marginLeft: -16 
  },
  btnRegistrar: { 
    backgroundColor: '#3B56FF', 
    paddingVertical: 16, 
    borderRadius: 16, 
    alignItems: 'center' 
  },
  btnRegistrarText: { 
    color: '#FFFFFF', 
    fontSize: 16, 
    fontWeight: 'bold' 
  }
});
