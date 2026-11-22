import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Dimensions,
  Platform,
  AppState,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useFocusEffect } from '@react-navigation/native';
import { obterPosicaoViagem } from '../../services/frotix.js';

const { width } = Dimensions.get('window');
const MAP_WIDTH = width - 40;
const MAP_HEIGHT = 480;

// De quanto em quanto tempo o mapa pergunta ao servidor onde o motorista está.
const INTERVALO_ATUALIZACAO_MS = 10000;
// Sem posição nova há mais que isso: mostra aviso de sinal perdido.
const LIMITE_SINAL_PERDIDO_MS = 5 * 60 * 1000;

/** Coloca um valor dentro do <script> sem quebrar o HTML (aspas, barras, "</script>"). */
function paraScript(valor) {
  return JSON.stringify(valor)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function generateLeafletHTML(origem, destino, motorista) {
  const config = paraScript({
    origem: origem || 'Campinas - SP',
    destino: destino || 'Rio de Janeiro - RJ',
    motorista: motorista || 'Motorista',
  });

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
    .truck-wrap {
      position: relative;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    /* Halo pulsando em volta do caminhão, como o "ponto ao vivo" de apps de corrida */
    .truck-wrap::before {
      content: '';
      position: absolute;
      width: 44px;
      height: 44px;
      border-radius: 22px;
      background: rgba(37, 65, 239, 0.25);
      animation: halo 2s infinite;
    }
    .truck-wrap.sem-sinal::before {
      background: rgba(245, 158, 11, 0.3);
    }
    .truck-wrap.aguardando {
      opacity: 0.45;
    }
    .truck-wrap.aguardando::before {
      display: none;
    }
    @keyframes halo {
      0% { transform: scale(0.6); opacity: 1; }
      100% { transform: scale(1.4); opacity: 0; }
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
    const CONFIG = ${config};

    const KNOWN_COORDS = {
      'campinas - sp': [-22.9056, -47.0608],
      'campinas': [-22.9056, -47.0608],
      'rio de janeiro - rj': [-22.9068, -43.1729],
      'rio de janeiro': [-22.9068, -43.1729],
      'sao paulo - sp': [-23.5505, -46.6333],
      'sao paulo': [-23.5505, -46.6333],
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

    // Até esta distância da linha, o caminhão é "grudado" na rota (o GPS oscila alguns metros).
    const DISTANCIA_MAX_ROTA_M = 500;
    const RAIO_TERRA_M = 6371000;
    const RAD = Math.PI / 180;

    function normalizeName(str) {
      return String(str ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\\u0300-\\u036f]/g, '')
        .trim();
    }

    // Avisa o app (React Native ou a página web que contém o iframe).
    function avisarApp(mensagem) {
      const texto = JSON.stringify({ origem: 'frotix-mapa', ...mensagem });
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(texto);
      } else if (window.parent && window.parent !== window) {
        window.parent.postMessage(texto, '*');
      }
    }

    async function geocode(location) {
      const norm = normalizeName(location);
      if (KNOWN_COORDS[norm]) return KNOWN_COORDS[norm];

      for (const [key, coords] of Object.entries(KNOWN_COORDS)) {
        if (norm.includes(key) || key.includes(norm)) {
          return coords;
        }
      }

      // Consulta à API pública OpenStreetMap Nominatim para aceitar qualquer cidade
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
          return data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
        }
      } catch (e) {
        console.warn('OSRM error, usando linha direta:', e);
      }

      // Linha interpolada suave como fallback
      const pts = [];
      const steps = 30;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        pts.push([
          startCoords[0] + (endCoords[0] - startCoords[0]) * t,
          startCoords[1] + (endCoords[1] - startCoords[1]) * t,
        ]);
      }
      return pts;
    }

    function distanciaM(a, b) {
      const dLat = (b[0] - a[0]) * RAD;
      const dLon = (b[1] - a[1]) * RAD;
      const h = Math.sin(dLat / 2) ** 2 +
        Math.cos(a[0] * RAD) * Math.cos(b[0] * RAD) * Math.sin(dLon / 2) ** 2;
      return 2 * RAIO_TERRA_M * Math.asin(Math.sqrt(h));
    }

    // ----- Estado do mapa -----
    let map = null;
    let rota = [];            // pontos [lat, lon] da rota
    let acumulado = [];       // distância (m) do início até cada ponto
    let linhaPercorrida = null;
    let linhaRestante = null;
    let haloRestante = null;
    let caminhao = null;
    let indiceAnterior = 0;
    let posicaoPendente = null;
    let animacao = null;

    /**
     * Acha o ponto da rota mais perto da posição do GPS.
     * Devolve o índice do trecho, o ponto projetado e a distância (m) até a linha.
     */
    function projetarNaRota(p) {
      const cosLat = Math.cos(p[0] * RAD);
      const xy = (q) => [(q[1] - p[1]) * cosLat * RAD * RAIO_TERRA_M, (q[0] - p[0]) * RAD * RAIO_TERRA_M];

      let melhor = null;
      for (let i = 0; i < rota.length - 1; i++) {
        const a = xy(rota[i]);
        const b = xy(rota[i + 1]);
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const len2 = dx * dx + dy * dy;
        let t = len2 > 0 ? -(a[0] * dx + a[1] * dy) / len2 : 0;
        t = Math.max(0, Math.min(1, t));
        const px = a[0] + t * dx;
        const py = a[1] + t * dy;
        let dist = Math.sqrt(px * px + py * py);
        // Rotas que passam duas vezes pelo mesmo lugar: prefere seguir em frente.
        if (i < indiceAnterior - 5) dist *= 1.5;
        if (!melhor || dist < melhor.dist) {
          melhor = {
            i,
            t,
            dist,
            ponto: [rota[i][0] + t * (rota[i + 1][0] - rota[i][0]), rota[i][1] + t * (rota[i + 1][1] - rota[i][1])],
          };
        }
      }
      return melhor;
    }

    function moverCaminhao(destino) {
      if (animacao) cancelAnimationFrame(animacao);
      const de = caminhao.getLatLng();
      const inicio = performance.now();
      const duracao = 1200;
      function passo(agora) {
        const t = Math.min(1, (agora - inicio) / duracao);
        const suave = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        caminhao.setLatLng([
          de.lat + (destino[0] - de.lat) * suave,
          de.lng + (destino[1] - de.lng) * suave,
        ]);
        if (t < 1) animacao = requestAnimationFrame(passo);
      }
      animacao = requestAnimationFrame(passo);
    }

    function definirEstadoCaminhao(classe) {
      const el = caminhao && caminhao.getElement();
      const wrap = el && el.querySelector('.truck-wrap');
      if (!wrap) return;
      wrap.classList.remove('aguardando', 'sem-sinal');
      if (classe) wrap.classList.add(classe);
    }

    /** Chamado pelo app com a última posição do motorista ({ latitude, longitude, semSinal }). */
    window.atualizarPosicao = function (posicao) {
      if (!map || rota.length < 2) {
        posicaoPendente = posicao;
        return;
      }
      if (!posicao || !Number.isFinite(posicao.latitude) || !Number.isFinite(posicao.longitude)) {
        definirEstadoCaminhao('aguardando');
        return;
      }

      const gps = [posicao.latitude, posicao.longitude];
      const proj = projetarNaRota(gps);
      const naRota = proj && proj.dist <= DISTANCIA_MAX_ROTA_M;
      const total = acumulado[acumulado.length - 1] || 0;

      let percorridoM;
      let pontoCaminhao;
      if (naRota) {
        indiceAnterior = proj.i;
        percorridoM = acumulado[proj.i] + proj.t * (acumulado[proj.i + 1] - acumulado[proj.i]);
        pontoCaminhao = proj.ponto;
        linhaPercorrida.setLatLngs([...rota.slice(0, proj.i + 1), proj.ponto]);
        linhaRestante.setLatLngs([proj.ponto, ...rota.slice(proj.i + 1)]);
        haloRestante.setLatLngs([proj.ponto, ...rota.slice(proj.i + 1)]);
      } else {
        // Fora da rota (desvio, outra estrada): mostra onde ele está de verdade.
        percorridoM = proj ? acumulado[proj.i] + proj.t * (acumulado[proj.i + 1] - acumulado[proj.i]) : 0;
        pontoCaminhao = gps;
      }

      moverCaminhao(pontoCaminhao);
      definirEstadoCaminhao(posicao.semSinal ? 'sem-sinal' : null);
      if (!map.getBounds().pad(-0.1).contains(pontoCaminhao)) {
        map.panTo(pontoCaminhao, { animate: true });
      }

      avisarApp({
        tipo: 'progresso',
        progresso: total > 0 ? Math.max(0, Math.min(1, percorridoM / total)) : 0,
        restanteKm: Math.max(0, (total - percorridoM) / 1000),
        foraDaRota: !naRota,
      });
    };

    // Versão web: o app conversa com o iframe por postMessage.
    window.addEventListener('message', (evento) => {
      try {
        const dados = typeof evento.data === 'string' ? JSON.parse(evento.data) : evento.data;
        if (dados && dados.origem === 'frotix-app' && dados.tipo === 'posicao') {
          window.atualizarPosicao(dados.posicao);
        }
      } catch (e) {}
    });

    async function init() {
      map = null;
      const mapa = L.map('map', {
        zoomControl: true,
        attributionControl: false
      }).setView([-23.5505, -46.6333], 6);

      // Camada de mapa real (OpenStreetMap)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(mapa);

      const start = await geocode(CONFIG.origem);
      const end = await geocode(CONFIG.destino);

      const popupSaida = document.createElement('div');
      popupSaida.innerHTML = '<b>Saída:</b> <span></span><br><b>Motorista:</b> <span></span>';
      popupSaida.querySelectorAll('span')[0].textContent = CONFIG.origem;
      popupSaida.querySelectorAll('span')[1].textContent = CONFIG.motorista;

      const popupDestino = document.createElement('div');
      popupDestino.innerHTML = '<b>Ponto Marcado (Destino):</b> <span></span>';
      popupDestino.querySelector('span').textContent = CONFIG.destino;

      // Marcador de Partida (Origem)
      L.marker(start, {
        icon: L.divIcon({
          className: 'custom-div-icon',
          html: '<div class="custom-marker-pin pin-start">🟢</div>',
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        })
      }).addTo(mapa).bindPopup(popupSaida);

      // Marcador de Chegada (Ponto Marcado)
      L.marker(end, {
        icon: L.divIcon({
          className: 'custom-div-icon',
          html: '<div class="custom-marker-pin pin-end">🏁</div>',
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        })
      }).addTo(mapa).bindPopup(popupDestino);

      // Busca traçado real das rodovias
      rota = await getRoadRoute(start, end);
      acumulado = [0];
      for (let i = 1; i < rota.length; i++) {
        acumulado.push(acumulado[i - 1] + distanciaM(rota[i - 1], rota[i]));
      }

      // Trecho já percorrido (cinza) e o que falta (azul, com halo)
      linhaPercorrida = L.polyline([rota[0]], {
        color: '#6B7280',
        weight: 5,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(mapa);

      haloRestante = L.polyline(rota, {
        color: 'rgba(37, 65, 239, 0.4)',
        weight: 9,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(mapa);

      linhaRestante = L.polyline(rota, {
        color: '#2541EF',
        weight: 5,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(mapa);

      // Ajusta o zoom e centro do mapa automaticamente para caber toda a rota
      mapa.fitBounds(L.latLngBounds(rota), { padding: [50, 50] });

      // Caminhão começa apagado na origem até chegar a primeira posição do GPS
      caminhao = L.marker(rota[0], {
        icon: L.divIcon({
          className: 'custom-div-icon',
          html: '<div class="truck-wrap aguardando"><div class="truck-icon">🚚</div></div>',
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        }),
        zIndexOffset: 1000
      }).addTo(mapa);

      map = mapa;
      avisarApp({ tipo: 'pronto' });

      if (posicaoPendente) {
        const p = posicaoPendente;
        posicaoPendente = null;
        window.atualizarPosicao(p);
      }
    }

    window.onload = init;
  </script>
</body>
</html>
`;
}

/** "agora", "há 3 min", "há 2 h" */
function tempoDesde(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 60 * 1000) return 'agora';
  const min = Math.round(ms / 60000);
  if (min < 60) return `há ${min} min`;
  return `há ${Math.round(min / 60)} h`;
}

function formatarKm(km) {
  if (!Number.isFinite(km)) return null;
  return km >= 10 ? `${Math.round(km).toLocaleString('pt-BR')} km` : `${km.toFixed(1).replace('.', ',')} km`;
}

/**
 * Pergunta ao backend a última posição do motorista enquanto a tela está visível
 * e o app está em primeiro plano.
 */
function usePosicaoMotorista(viagemId) {
  const [posicao, setPosicao] = useState(null);
  const [statusViagem, setStatusViagem] = useState('em_transito');
  const [carregou, setCarregou] = useState(false);

  useEffect(() => {
    setPosicao(null);
    setStatusViagem('em_transito');
    setCarregou(false);
  }, [viagemId]);

  useFocusEffect(
    useCallback(() => {
      if (!viagemId) return undefined;
      let ativo = true;
      let timer = null;

      const buscar = async () => {
        try {
          const r = await obterPosicaoViagem(viagemId);
          if (!ativo) return;
          setPosicao(r.posicao || null);
          setStatusViagem(r.status || 'em_transito');
        } catch (e) {
          // Sem conexão: mantém a última posição na tela e tenta de novo no próximo ciclo.
        } finally {
          if (ativo) setCarregou(true);
        }
      };

      const iniciar = () => {
        if (timer) return;
        buscar();
        timer = setInterval(buscar, INTERVALO_ATUALIZACAO_MS);
      };
      const pausar = () => {
        if (timer) clearInterval(timer);
        timer = null;
      };

      iniciar();
      const assinatura = AppState.addEventListener('change', (estado) => {
        if (estado === 'active') iniciar();
        else pausar();
      });

      return () => {
        ativo = false;
        pausar();
        assinatura.remove();
      };
    }, [viagemId])
  );

  return { posicao, statusViagem, carregou };
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
  const webViewRef = useRef(null);
  const iframeRef = useRef(null);
  const [mapaPronto, setMapaPronto] = useState(false);
  const [progresso, setProgresso] = useState(null);

  const { posicao, statusViagem, carregou } = usePosicaoMotorista(viagemAtiva.id);

  const htmlContent = useMemo(() => {
    return generateLeafletHTML(
      viagemAtiva.origem,
      viagemAtiva.destino,
      viagemAtiva.motorista
    );
  }, [viagemAtiva.id, viagemAtiva.origem, viagemAtiva.destino, viagemAtiva.motorista]);

  const uniqueKey = `${viagemAtiva.id || 'v'}-${viagemAtiva.origem}-${viagemAtiva.destino}`;

  useEffect(() => {
    setMapaPronto(false);
    setProgresso(null);
  }, [uniqueKey]);

  const semSinal = Boolean(
    posicao && Date.now() - new Date(posicao.registradaEm).getTime() > LIMITE_SINAL_PERDIDO_MS
  );

  // Manda a posição nova para dentro do mapa (WebView no celular, iframe na web).
  useEffect(() => {
    if (!mapaPronto) return;
    const dados = posicao
      ? { latitude: posicao.latitude, longitude: posicao.longitude, semSinal }
      : null;

    if (Platform.OS === 'web') {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ origem: 'frotix-app', tipo: 'posicao', posicao: dados }),
        '*'
      );
    } else {
      webViewRef.current?.injectJavaScript(
        `window.atualizarPosicao && window.atualizarPosicao(${JSON.stringify(dados)}); true;`
      );
    }
  }, [mapaPronto, posicao, semSinal]);

  const tratarMensagemMapa = useCallback((texto) => {
    let msg;
    try {
      msg = typeof texto === 'string' ? JSON.parse(texto) : texto;
    } catch {
      return;
    }
    if (!msg || msg.origem !== 'frotix-mapa') return;
    if (msg.tipo === 'pronto') setMapaPronto(true);
    if (msg.tipo === 'progresso') setProgresso(msg);
  }, []);

  // Na web, as mensagens do iframe chegam pelo window.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    const ouvir = (evento) => {
      if (evento.source !== iframeRef.current?.contentWindow) return;
      tratarMensagemMapa(evento.data);
    };
    window.addEventListener('message', ouvir);
    return () => window.removeEventListener('message', ouvir);
  }, [tratarMensagemMapa]);

  let textoLocalizacao;
  let estiloLocalizacao = styles.locationText;
  if (statusViagem !== 'em_transito') {
    textoLocalizacao = 'Viagem encerrada';
  } else if (!carregou) {
    textoLocalizacao = 'Buscando localização do motorista...';
  } else if (!posicao) {
    textoLocalizacao = 'Aguardando o GPS do motorista';
    estiloLocalizacao = [styles.locationText, styles.locationTextMuted];
  } else {
    const partes = [];
    if (progresso) {
      partes.push(`${Math.round(progresso.progresso * 100)}% da rota`);
      const restante = formatarKm(progresso.restanteKm);
      if (restante) partes.push(`faltam ${restante}`);
    }
    partes.push(`${semSinal ? 'sem sinal' : 'atualizado'} ${tempoDesde(posicao.registradaEm)}`);
    textoLocalizacao = partes.join(' · ');
    if (semSinal) estiloLocalizacao = [styles.locationText, styles.locationTextAlert];
  }

  return (
    <View style={styles.mainContainer}>
      <View style={styles.mapCard}>
        {Platform.OS === 'web' ? (
          <iframe
            key={uniqueKey}
            ref={iframeRef}
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
            ref={webViewRef}
            source={{ html: htmlContent }}
            style={styles.webView}
            originWhitelist={['*']}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            mixedContentMode="always"
            allowsInlineMediaPlayback={true}
            onMessage={(evento) => tratarMensagemMapa(evento.nativeEvent.data)}
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

          <Text style={estiloLocalizacao} numberOfLines={1}>
            {textoLocalizacao}
            {progresso?.foraDaRota && posicao ? ' · fora da rota' : ''}
          </Text>

          {progresso && posicao ? (
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(progresso.progresso * 100)}%` }]} />
            </View>
          ) : null}
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
  locationText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  locationTextMuted: {
    color: 'rgba(255, 255, 255, 0.55)',
  },
  locationTextAlert: {
    color: '#F59E0B',
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    marginTop: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#2541EF',
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
