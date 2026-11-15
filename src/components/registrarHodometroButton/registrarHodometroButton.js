import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions, Image } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

const { width } = Dimensions.get('window');
const MAP_WIDTH = width - 32;
const MAP_HEIGHT = 480;

const CITY_COORDS = {
  'campinas - sp': { x: 0.25, y: 0.56 },
  'campinas': { x: 0.25, y: 0.56 },
  'rio de janeiro - rj': { x: 0.76, y: 0.44 },
  'rio de janeiro': { x: 0.76, y: 0.44 },
  'são paulo - sp': { x: 0.36, y: 0.65 },
  'sao paulo - sp': { x: 0.36, y: 0.65 },
  'são paulo': { x: 0.36, y: 0.65 },
  'sao paulo': { x: 0.36, y: 0.65 },
  'belo horizonte - mg': { x: 0.66, y: 0.32 },
  'belo horizonte': { x: 0.66, y: 0.32 },
  'curitiba - pr': { x: 0.22, y: 0.78 },
  'curitiba': { x: 0.22, y: 0.78 },
  'santos - sp': { x: 0.62, y: 0.72 },
  'santos': { x: 0.62, y: 0.72 },
};

const getCityCoordinates = (city, isDest = false) => {
  if (!city) {
    return isDest ? { x: MAP_WIDTH * 0.75, y: 260 } : { x: MAP_WIDTH * 0.25, y: 320 };
  }
  const key = city.trim().toLowerCase();
  let base = CITY_COORDS[key];

  if (!base) {
    for (const [k, v] of Object.entries(CITY_COORDS)) {
      if (key.includes(k) || k.includes(key)) {
        base = v;
        break;
      }
    }
  }

  if (!base) {
    let hash = 0;
    for (let i = 0; i < city.length; i++) {
      hash = (hash << 5) - hash + city.charCodeAt(i);
      hash |= 0;
    }
    const normX = 0.22 + (Math.abs(hash % 100) / 100) * 0.56;
    const normY = 0.38 + (Math.abs((hash >> 3) % 100) / 100) * 0.42;
    base = { x: normX, y: normY };
  }

  return {
    x: Math.max(35, Math.min(MAP_WIDTH - 45, base.x * MAP_WIDTH)),
    y: Math.max(140, Math.min(MAP_HEIGHT - 60, base.y * MAP_HEIGHT)),
  };
};

export default function MapCardWithButton({ onButtonPress, viagem }) {
  const origemCoord = getCityCoordinates(viagem?.origem, false);
  const destinoCoord = getCityCoordinates(viagem?.destino, true);

  const startX = origemCoord.x;
  const startY = origemCoord.y;
  const endX = destinoCoord.x;
  const endY = destinoCoord.y;

  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2 - 32;

  const routePath = `M ${startX} ${startY} Q ${midX} ${midY} ${endX} ${endY}`;

  // Ponto central da curva Bézier no instante t = 0.5 para o veículo
  const t = 0.5;
  const vehicleX = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * midX + t * t * endX;
  const vehicleY = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * midY + t * t * endY;

  return (
    <View style={styles.mainContainer}>
      <View style={styles.mapCard}>
        <Image 
          source={require('../../../assets/image/map.png')} 
          style={styles.mapImage}
          resizeMode="cover"
        />

        {/* HUD com informações do motorista e trajeto ativo */}
        <View style={styles.hudOverlay}>
          <View style={styles.hudHeaderRow}>
            <View style={styles.statusBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.statusText}>EM ANDAMENTO</Text>
            </View>
            {viagem?.placa && (
              <Text style={styles.plateText}>{viagem.placa}</Text>
            )}
          </View>

          <Text style={styles.driverNameText} numberOfLines={1}>
            {viagem?.motorista ? `Motorista: ${viagem.motorista}` : 'Selecione uma viagem acima'}
          </Text>

          <Text style={styles.routeText} numberOfLines={1}>
            {viagem?.origem || 'Origem'} ➔ {viagem?.destino || 'Destino'}
          </Text>
        </View>

        {/* Traçado da Rota sobre o Mapa */}
        <Svg style={StyleSheet.absoluteFillObject} width={MAP_WIDTH} height={MAP_HEIGHT}>
          {/* Brilho da rota */}
          <Path
            d={routePath}
            stroke="rgba(37, 65, 239, 0.25)"
            strokeWidth={10}
            fill="none"
          />
          {/* Linha principal tracejada */}
          <Path
            d={routePath}
            stroke="#2541EF"
            strokeWidth={3.5}
            strokeDasharray="8, 4"
            fill="none"
          />
          {/* Ponto de partida (Origem) */}
          <Circle cx={startX} cy={startY} r={12} fill="rgba(16, 185, 129, 0.25)" />
          <Circle cx={startX} cy={startY} r={6} fill="#10B981" stroke="#FFFFFF" strokeWidth={2} />

          {/* Veículo em trânsito no meio do trajeto */}
          <Circle cx={vehicleX} cy={vehicleY} r={14} fill="rgba(37, 65, 239, 0.3)" />
          <Circle cx={vehicleX} cy={vehicleY} r={7} fill="#2541EF" stroke="#FFFFFF" strokeWidth={2} />

          {/* Ponto de chegada (Destino) */}
          <Circle cx={endX} cy={endY} r={12} fill="rgba(239, 68, 68, 0.25)" />
          <Circle cx={endX} cy={endY} r={6} fill="#EF4444" stroke="#FFFFFF" strokeWidth={2} />
        </Svg>

        {/* Marcador flutuante da Origem */}
        <View
          style={[
            styles.pinCallout,
            styles.pinCalloutOrigin,
            {
              top: Math.max(105, startY - 38),
              left: Math.max(8, Math.min(MAP_WIDTH - 150, startX - 45))
            }
          ]}
        >
          <Text style={styles.pinCalloutText} numberOfLines={1}>
            🟢 {viagem?.origem || 'Partida'}
          </Text>
        </View>

        {/* Marcador flutuante do Destino */}
        <View
          style={[
            styles.pinCallout,
            styles.pinCalloutDest,
            {
              top: Math.max(105, endY - 38),
              left: Math.max(8, Math.min(MAP_WIDTH - 150, endX - 45))
            }
          ]}
        >
          <Text style={styles.pinCalloutText} numberOfLines={1}>
            🏁 {viagem?.destino || 'Chegada'}
          </Text>
        </View>
      </View>

      <TouchableOpacity style={styles.button} activeOpacity={0.8} onPress={onButtonPress}>
        <Text style={styles.buttonText}>Registrar Hodômetro</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#121212',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginTop: 40,
  },
  mapCard: {
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    backgroundColor: '#E8F5E9',
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#333333',
    position: 'relative',
  },
  mapImage: {
    width: '100%',
    height: '100%',
  },
  hudOverlay: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    backgroundColor: 'rgba(18, 18, 18, 0.88)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
    zIndex: 10,
  },
  hudHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  statusText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  plateText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    fontWeight: '600',
  },
  driverNameText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  routeText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
    marginTop: 2,
  },
  pinCallout: {
    position: 'absolute',
    backgroundColor: 'rgba(18, 18, 18, 0.92)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 8,
  },
  pinCalloutOrigin: {
    borderColor: '#10B981',
  },
  pinCalloutDest: {
    borderColor: '#EF4444',
  },
  pinCalloutText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  button: {
    width: MAP_WIDTH,
    height: 56,
    backgroundColor: '#2541EF',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
