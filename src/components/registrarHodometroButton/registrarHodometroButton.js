import React, { useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';

const { width } = Dimensions.get('window');
const MAP_WIDTH = width - 40;
const MAP_HEIGHT = 480;


function generateLeafletHTML(origem, destino, motorista) {
  const safeOrigem = (origem || 'Campinas - SP').replace(/'/g, "\\'");
  const safeDestino = (destino || 'Rio de Janeiro - RJ').replace(/'/g, "\\'");
  const safeMotorista = (motorista || 'Motorista').replace(/'/g, "\\'");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=yes" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      background: #121212;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .custom-marker-pin {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 16px;
      box-shadow: 0 4px 10px rgba(0,0,0,0.5);
      border: 2px solid #FFFFFF;
      font-size: 16px;
    }
    .pin-start {
      background: #10B981;
    }
    .pin-end {
      background: #EF4444;
      animation: pulse 1.5s infinite;
    }
    .truck-icon {
      font-size: 22px;
      filter: drop-shadow(0 2px 5px rgba(0,0,0,0.8));
    }
    @keyframes pulse {
      0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
      70% { transform: scale(1.15); box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
      100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
    }
    .leaflet-popup-content-wrapper {
      background: rgba(18, 18, 18, 0.95);
      color: #FFFFFF;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      font-size: 13px;
      padding: 4px;
    }
    .leaflet-popup-tip {
      background: rgba(18, 18, 18, 0.95);
    }
  </style>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
</head>
<body>
  <div id="map"></div>

  <script>
    const KNOWN_COORDS = {
      'campinas - sp': [-22.9056, -47.0608],
      'campinas': [-22.9056, -47.0608],
      'rio de janeiro - rj': [-22.9068, -43.1729],
      'rio de janeiro': [-22.9068, -43.1729],
      'sao paulo - sp': [-23.5505, -46.6333],
      'são paulo - sp': [-23.5505, -46.6333],
      'sao paulo': [-23.5505, -46.6333],
      'são paulo': [-23.5505, -46.6333],
      'belo horizonte - mg': [-19.9167, -43.9345],
      'belo horizonte': [-19.9167, -43.9345],
      'curitiba - pr': [-25.4284, -49.2731],
      'curitiba': [-25.4284, -49.2731],
      'santos - sp': [-23.9608, -46.3333],
      'santos': [-23.9608, -46.3333],
      'porto alegre - rs': [-30.0346, -51.2177],
      'porto alegre': [-30.0346, -51.2177],
      'brasilia - df': [-15.7975, -47.8919],
      'brasilia': [-15.7975, -47.8919],
      'salvador - ba': [-12.9777, -38.5016],
      'salvador': [-12.9777, -38.5016],
      'fortaleza - ce': [-3.7172, -38.5433],
      'recife - pe': [-8.0476, -34.8770],
      'goiania - go': [-16.6869, -49.2648],
      'ribeirao preto - sp': [-21.1776, -47.8101],
      'sorocaba - sp': [-23.5015, -47.4587],
    };

    function normalizeName(str) {
      return (str || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\\u0300-\\u036f]/g, '')
        .trim();
    }

    async function geocode(location) {
      const norm = normalizeName(location);
      if (KNOWN_COORDS[norm]) return KNOWN_COORDS[norm];

      for (const [key, coords] of Object.entries(KNOWN_COORDS)) {
        if (norm.includes(key) || key.includes(norm)) {
          return coords;
        }
      }

      // Consulta à API pública OpenStreetMap Nominatim para aceitar qualquer cidade do mundo
      try {
        const query = encodeURIComponent(location + ', Brasil');
        const res = await fetch('https://nominatim.openstreetmap.org/search?format=json&q=' + query + '&limit=1', {
          headers: { 'Accept': 'application/json' }
        });
        const data = await res.json();
        if (data && data[0]) {
          return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
        }
      } catch (e) {
        console.warn('Geocoding error:', e);
      }

      return [-23.5505, -46.6333];
    }

    async function getRoadRoute(startCoords, endCoords) {
      // Consulta a rota real de estradas via OSRM (Open Source Routing Machine)
      try {
        const url = 'https://router.project-osrm.org/route/v1/driving/' +
          startCoords[1] + ',' + startCoords[0] + ';' +
          endCoords[1] + ',' + endCoords[0] +
          '?overview=full&geometries=geojson';
        const res = await fetch(url);
        const data = await res.json();
        if (data && data.routes && data.routes[0]) {
          const coords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
          return coords;
        }
      } catch (e) {
        console.warn('OSRM error, usando linha direta:', e);
      }

      // Linha interpolada suave como fallback
      const pts = [];
      const steps = 30;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const lat = startCoords[0] + (endCoords[0] - startCoords[0]) * t;
        const lon = startCoords[1] + (endCoords[1] - startCoords[1]) * t;
        pts.push([lat, lon]);
      }
      return pts;
    }

    async function init() {
      const map = L.map('map', {
        zoomControl: true,
        attributionControl: false
      }).setView([-23.5505, -46.6333], 6);

      // Camada de mapa real (OpenStreetMap)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(map);

      const start = await geocode('${safeOrigem}');
      const end = await geocode('${safeDestino}');

      // Marcador de Partida (Origem)
      const startIcon = L.divIcon({
        className: 'custom-div-icon',
        html: '<div class="custom-marker-pin pin-start">🟢</div>',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });
      L.marker(start, { icon: startIcon })
        .addTo(map)
        .bindPopup('<b>Saída:</b> ${safeOrigem}<br><b>Motorista:</b> ${safeMotorista}')
        .openPopup();

      // Marcador de Chegada (Ponto Marcado)
      const endIcon = L.divIcon({
        className: 'custom-div-icon',
        html: '<div class="custom-marker-pin pin-end">🏁</div>',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });
      L.marker(end, { icon: endIcon })
        .addTo(map)
        .bindPopup('<b>Ponto Marcado (Destino):</b> ${safeDestino}');

      // Busca traçado real das rodovias
      const routePoints = await getRoadRoute(start, end);

      // Traçado do trajeto completo com halo brilhante
      const haloLine = L.polyline(routePoints, {
        color: 'rgba(37, 65, 239, 0.4)',
        weight: 9,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);

      const mainLine = L.polyline(routePoints, {
        color: '#2541EF',
        weight: 5,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);

      // Ajusta o zoom e centro do mapa automaticamente para caber toda a rota
      const bounds = L.latLngBounds(routePoints);
      map.fitBounds(bounds, { padding: [50, 50] });

      // Animação do veículo (🚚) percorrendo a rota até o ponto marcado
      const truckIcon = L.divIcon({
        className: 'custom-div-icon',
        html: '<div class="truck-icon">🚚</div>',
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });
      const truckMarker = L.marker(routePoints[0], { icon: truckIcon }).addTo(map);

      let step = 0;
      const totalSteps = routePoints.length;
      const speed = Math.max(1, Math.floor(totalSteps / 120)); // ~2 segundos para percorrer

      function animateTruck() {
        step += speed;
        if (step < totalSteps) {
          truckMarker.setLatLng(routePoints[step]);
          requestAnimationFrame(animateTruck);
        } else {
          truckMarker.setLatLng(routePoints[totalSteps - 1]);
        }
      }

      setTimeout(animateTruck, 400);
    }

    window.onload = init;
  </script>
</body>
</html>
`;
}

export default function MapCardWithButton({ onButtonPress, viagem }) {
  // Sem viagem em andamento, mostra só o botão (antes aparecia uma viagem de exemplo).
  if (!viagem) {
    return (
      <View style={styles.mainContainer}>
        <TouchableOpacity style={styles.button} activeOpacity={0.8} onPress={onButtonPress}>
          <Text style={styles.buttonText}>Registrar Hodômetro</Text>
        </TouchableOpacity>
      </View>
    );
  }
  return <MapaDaViagem viagem={viagem} onButtonPress={onButtonPress} />;
}

function MapaDaViagem({ onButtonPress, viagem }) {
  const viagemAtiva = viagem;

  const htmlContent = useMemo(() => {
    return generateLeafletHTML(
      viagemAtiva.origem,
      viagemAtiva.destino,
      viagemAtiva.motorista
    );
  }, [viagemAtiva.id, viagemAtiva.origem, viagemAtiva.destino, viagemAtiva.motorista]);

  const uniqueKey = `${viagemAtiva.id || 'v'}-${viagemAtiva.origem}-${viagemAtiva.destino}`;

  return (
    <View style={styles.mainContainer}>
      <View style={styles.mapCard}>
        {Platform.OS === 'web' ? (
          <iframe
            key={uniqueKey}
            srcDoc={htmlContent}
            title="Mapa da Rota"
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              borderRadius: 24,
            }}
          />
        ) : (
          <WebView
            key={uniqueKey}
            source={{ html: htmlContent }}
            style={styles.webView}
            originWhitelist={['*']}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            mixedContentMode="always"
            allowsInlineMediaPlayback={true}
          />
        )}

        {/* HUD Superior sobre o mapa com informações da viagem selecionada */}
        <View style={styles.hudOverlay} pointerEvents="box-none">
          <View style={styles.hudHeaderRow}>
            <View style={styles.statusBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.statusText}>EM ANDAMENTO</Text>
            </View>
            <Text style={styles.plateText}>{viagemAtiva?.placa || 'Sem veículo'}</Text>
          </View>

          <Text style={styles.driverNameText} numberOfLines={1}>
            Motorista: {viagemAtiva?.motorista || 'Motorista'}
          </Text>

          <Text style={styles.routeText} numberOfLines={1}>
            {viagemAtiva?.origem} ➔ {viagemAtiva?.destino}
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
    width: '100%',
    backgroundColor: '#121212',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
  },
  mapCard: {
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    backgroundColor: '#1A2332',
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#333333',
    position: 'relative',
  },
  webView: {
    width: '100%',
    height: '100%',
    backgroundColor: '#121212',
  },
  hudOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(18, 18, 18, 0.90)',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
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
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  driverNameText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  routeText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
    marginTop: 2,
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
