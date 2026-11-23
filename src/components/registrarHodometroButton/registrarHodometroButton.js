import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import { listarPosicoesViagem } from '../../services/frotix.js';

const { width } = Dimensions.get('window');
const MAP_WIDTH = width - 40;
const MAP_HEIGHT = 480;
const MENSAGEM_POSICAO_AUSENTE = 'O motorista ainda não iniciou o rastreamento ou não concedeu permissão para acessar sua localização. Isso também pode ocorrer se ele ainda não iniciou a viagem ou se o aplicativo ainda não conseguiu obter a primeira posição GPS.';
const MENSAGEM_CONSULTANDO_POSICOES = 'Consultando posições GPS...';


function generateLeafletHTML() {
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
    let mapa = null;
    let marcadores = null;
    let ultimaPosicao = null;
    const reportar = (status) => {
      const mensagem = { tipo: 'mapa', status };
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(mensagem));
      } else if (window.parent !== window) {
        window.parent.postMessage(mensagem, '*');
      }
    };

    window.onerror = () => reportar('indisponivel');

    function atualizarPosicoes(coordenadas) {
      if (!Array.isArray(coordenadas) || coordenadas.length === 0) return;
      const validas = coordenadas.filter((p) =>
        Number.isFinite(p.latitude) && p.latitude >= -90 && p.latitude <= 90 &&
        Number.isFinite(p.longitude) && p.longitude >= -180 && p.longitude <= 180
      );
      if (validas.length === 0) return;

      const posicoesComData = validas.filter((posicao) =>
        Number.isFinite(Date.parse(posicao.registradaEm || ''))
      );
      ultimaPosicao = posicoesComData.length
        ? posicoesComData.reduce((maisRecente, posicao) =>
          Date.parse(posicao.registradaEm) > Date.parse(maisRecente.registradaEm)
            ? posicao
            : maisRecente
        )
        : validas[validas.length - 1];

      if (!mapa) {
        mapa = L.map('map', { zoomControl: true, attributionControl: true })
          .setView([validas[0].latitude, validas[0].longitude], 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(mapa);
        marcadores = L.layerGroup().addTo(mapa);
        mapa.on('tileerror', () => reportar('tiles_indisponiveis'));
      }

      marcadores.clearLayers();
      validas.forEach((posicao) => {
        const rotulo = document.createElement('span');
        rotulo.textContent = posicao.rotulo || 'Posição GPS registrada';
        L.marker([posicao.latitude, posicao.longitude]).addTo(marcadores).bindPopup(rotulo);
      });

      if (validas.length === 1) {
        mapa.setView([validas[0].latitude, validas[0].longitude], Math.max(mapa.getZoom(), 14));
      } else {
        mapa.fitBounds(L.latLngBounds(validas.map((p) => [p.latitude, p.longitude])), { padding: [50, 50] });
      }
      reportar('disponivel');
    }

    function recentralizarMapa() {
      if (!mapa || !ultimaPosicao) return;
      mapa.setView(
        [ultimaPosicao.latitude, ultimaPosicao.longitude],
        Math.max(mapa.getZoom(), 14)
      );
    }

    window.setGpsPositions = atualizarPosicoes;
    window.recentralizarGps = recentralizarMapa;
    window.addEventListener('message', (evento) => {
      const dados = evento.data;
      if (dados?.tipo === 'posicoes') atualizarPosicoes(dados.coordenadas);
      if (dados?.tipo === 'recentralizar') recentralizarMapa();
    });
  </script>
</body>
</html>
`;
}

export default function MapCardWithButton({
  onButtonPress,
  viagem,
  modoMotorista = false,
  posicaoLocal = null,
  erroRastreamento = null,
  monitorarTodas = false,
  exibirBotao = true,
}) {
  const [posicoesRemotas, setPosicoesRemotas] = useState([]);
  const [erroMapa, setErroMapa] = useState(null);
  const [consultaPosicoesConcluida, setConsultaPosicoesConcluida] = useState(false);
  const [iframeCarregado, setIframeCarregado] = useState(false);
  const [agora, setAgora] = useState(Date.now());
  const webViewRef = useRef(null);
  const iframeRef = useRef(null);

  const viagemAtiva = Boolean(viagem) &&
    (!viagem.status || ['em_transito', 'EM_ANDAMENTO'].includes(viagem.status));
  const deveExibirMapa = monitorarTodas || viagemAtiva;

  useEffect(() => {
    if (posicoesRemotas.length === 0 && !posicaoLocal) return undefined;
    const timer = setInterval(() => setAgora(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [posicaoLocal, posicoesRemotas.length]);

  useFocusEffect(
    useCallback(() => {
      if (modoMotorista || !deveExibirMapa) {
        setPosicoesRemotas([]);
        return undefined;
      }

      let ativo = true;
      let timer;
      setConsultaPosicoesConcluida(false);
      const atualizar = async () => {
        try {
          const resultado = await listarPosicoesViagem(monitorarTodas ? undefined : viagem.id);
          if (ativo) {
            setPosicoesRemotas(Array.isArray(resultado) ? resultado : []);
            setErroMapa(null);
            setConsultaPosicoesConcluida(true);
          }
        } catch {
          if (ativo) {
            setErroMapa('Não foi possível atualizar as posições pelo servidor.');
            setConsultaPosicoesConcluida(true);
          }
        } finally {
          if (ativo) timer = setTimeout(atualizar, 15_000);
        }
      };

      atualizar();
      return () => {
        ativo = false;
        if (timer) clearTimeout(timer);
      };
    }, [deveExibirMapa, modoMotorista, monitorarTodas, viagem?.id])
  );

  const posicoes = useMemo(() => {
    if (modoMotorista) {
      if (!posicaoLocal || !viagem?.id) return [];
      return [{
        latitude: posicaoLocal.latitude,
        longitude: posicaoLocal.longitude,
        motorista: viagem.motorista,
        placa: viagem.placa,
        origem: viagem.origem,
        destino: viagem.destino,
        registrada_em: posicaoLocal.registradaEm,
        rotulo: 'Sua posição GPS',
      }];
    }
    return posicoesRemotas;
  }, [modoMotorista, posicaoLocal, posicoesRemotas, viagem]);

  const coordenadas = useMemo(
    () => posicoes
      .filter((posicao) => Number.isFinite(Number(posicao.latitude)) && Number.isFinite(Number(posicao.longitude)))
      .map((posicao) => ({
        latitude: Number(posicao.latitude),
        longitude: Number(posicao.longitude),
        registradaEm: posicao.registrada_em || posicao.registradaEm || null,
        rotulo: modoMotorista
          ? 'Sua posição GPS'
          : [posicao.motorista, posicao.placa, posicao.origem, posicao.destino].filter(Boolean).join(' · '),
      })),
    [modoMotorista, posicoes]
  );
  const mensagemPosicoesVazias = consultaPosicoesConcluida
    ? MENSAGEM_POSICAO_AUSENTE
    : MENSAGEM_CONSULTANDO_POSICOES;
  const recentralizarMapa = useCallback(() => {
    if (coordenadas.length === 0) return;
    if (Platform.OS === 'web') {
      iframeRef.current?.contentWindow?.postMessage({ tipo: 'recentralizar' }, '*');
    } else {
      webViewRef.current?.injectJavaScript(
        'window.recentralizarGps && window.recentralizarGps(); true;'
      );
    }
  }, [coordenadas.length]);
  const botaoRecentralizar = !modoMotorista && coordenadas.length > 0 ? (
    <TouchableOpacity
      onPress={recentralizarMapa}
      accessibilityRole="button"
      accessibilityLabel="Recentralizar mapa na posição GPS mais recente"
    >
      <Text style={styles.plateText}>Recentralizar</Text>
    </TouchableOpacity>
  ) : null;
  const htmlContent = useMemo(() => generateLeafletHTML(), []);
  const scriptPosicoes = useMemo(
    () => `window.setGpsPositions && window.setGpsPositions(${JSON.stringify(coordenadas).replace(/</g, '\\u003c')}); true;`,
    [coordenadas]
  );
  const posicoesDesatualizadas = posicoes.filter((posicao) => {
    const registrada = Date.parse(posicao.registrada_em || posicao.registradaEm);
    return !Number.isFinite(registrada) || agora - registrada > 120_000;
  });
  const uniqueKey = `${viagem?.id || (monitorarTodas ? 'monitoramento' : 'sem-viagem')}`;

  useEffect(() => {
    setIframeCarregado(false);
  }, [uniqueKey]);

  useEffect(() => {
    if (Platform.OS === 'web' && iframeCarregado) {
      iframeRef.current?.contentWindow?.postMessage({ tipo: 'posicoes', coordenadas }, '*');
    } else if (Platform.OS !== 'web') {
      webViewRef.current?.injectJavaScript(scriptPosicoes);
    }
  }, [coordenadas, iframeCarregado, scriptPosicoes]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    const receberMensagem = (evento) => {
      if (evento.source !== iframeRef.current?.contentWindow || evento.data?.tipo !== 'mapa') return;
      setErroMapa(evento.data.status === 'disponivel'
        ? null
        : 'Os mapas do OpenStreetMap estão indisponíveis no momento.');
    };
    window.addEventListener('message', receberMensagem);
    return () => window.removeEventListener('message', receberMensagem);
  }, []);

  const receberStatusMapa = useCallback((evento) => {
    try {
      const mensagem = JSON.parse(evento.nativeEvent.data);
      if (mensagem.tipo === 'mapa') {
        setErroMapa(mensagem.status === 'disponivel'
          ? null
          : 'Os mapas do OpenStreetMap estão indisponíveis no momento.');
      }
    } catch {
      setErroMapa('Não foi possível carregar o mapa.');
    }
  }, []);

  if (!deveExibirMapa) {
    return (
      <View style={styles.mainContainer}>
        {exibirBotao ? (
          <TouchableOpacity style={styles.button} activeOpacity={0.8} onPress={onButtonPress}>
            <Text style={styles.buttonText}>Registrar Hodômetro</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.mainContainer}>
      <View style={styles.mapCard}>
        {coordenadas.length > 0 ? (
          Platform.OS === 'web' ? (
            <iframe
              key={uniqueKey}
              ref={iframeRef}
              srcDoc={htmlContent}
              title="Mapa da localização GPS"
              onLoad={() => setIframeCarregado(true)}
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
              onLoadEnd={() => webViewRef.current?.injectJavaScript(scriptPosicoes)}
              onMessage={receberStatusMapa}
              onError={() => setErroMapa('Não foi possível carregar o mapa.')}
              onHttpError={() => setErroMapa('Os mapas do OpenStreetMap estão indisponíveis no momento.')}
            />
          )
        ) : (
          modoMotorista || (!monitorarTodas && !viagem) ? (
            <Text style={styles.routeText}>
              {erroRastreamento ||
                erroMapa ||
                (modoMotorista
                  ? 'Aguardando uma posição GPS válida da viagem.'
                  : mensagemPosicoesVazias)}
            </Text>
          ) : null
        )}

        {viagem ? (
          <View style={styles.hudOverlay} pointerEvents="box-none">
            <View style={styles.hudHeaderRow}>
              <View style={styles.statusBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.statusText}>
                  {posicoesDesatualizadas.length
                    ? 'ÚLTIMA POSIÇÃO'
                    : modoMotorista
                      ? 'GPS DA VIAGEM'
                      : 'LOCALIZAÇÃO ATUAL'}
                </Text>
              </View>
              <Text style={styles.plateText}>{viagem.placa || 'Sem veículo'}</Text>
            </View>
            {!monitorarTodas ? botaoRecentralizar : null}

            <Text style={styles.driverNameText} numberOfLines={1}>
              Motorista: {viagem.motorista || 'Motorista'}
            </Text>

            <Text style={styles.routeText} numberOfLines={1}>
              {viagem.origem} ➔ {viagem.destino}
            </Text>
            {erroRastreamento || erroMapa ? (
              <Text style={styles.routeText} numberOfLines={2}>{erroRastreamento || erroMapa}</Text>
            ) : !modoMotorista && !monitorarTodas && coordenadas.length === 0 ? (
              <Text style={styles.routeText}>{mensagemPosicoesVazias}</Text>
            ) : null}
            {posicoesDesatualizadas.length > 0 ? (
              <Text style={styles.routeText} numberOfLines={2}>
                {modoMotorista ? 'Última posição GPS sem atualização recente.' : 'Última posição sem atualização recente.'}
              </Text>
            ) : null}
          </View>
        ) : null}

        {monitorarTodas ? (
          <View style={styles.hudOverlay} pointerEvents="box-none">
            <View style={styles.hudHeaderRow}>
              <View style={styles.statusBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.statusText}>LOCALIZAÇÕES ATIVAS</Text>
              </View>
              <Text style={styles.plateText}>{posicoes.length} viagens</Text>
            </View>
            {botaoRecentralizar}
            {erroMapa ? <Text style={styles.routeText}>{erroMapa}</Text> : null}
            {!erroMapa && coordenadas.length === 0 ? (
              <Text style={styles.routeText}>{mensagemPosicoesVazias}</Text>
            ) : null}
            {posicoesDesatualizadas.length > 0 ? (
              <Text style={styles.routeText} numberOfLines={2}>
                {posicoesDesatualizadas.length} posição(ões) sem atualização recente.
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>

      {exibirBotao ? (
        <TouchableOpacity style={styles.button} activeOpacity={0.8} onPress={onButtonPress}>
          <Text style={styles.buttonText}>Registrar Hodômetro</Text>
        </TouchableOpacity>
      ) : null}
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
