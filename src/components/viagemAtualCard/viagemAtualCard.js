import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Dimensions,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import { listarViagensEmAndamento } from '../../services/frotix.js';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 40;

export default function ViagemAtualCard({
  viagemSelecionada,
  onSelectViagem,
  onOpenTripDetails,
  viagensIniciais,
}) {
  const viagensFornecidas = Array.isArray(viagensIniciais);
  const [viagens, setViagens] = useState(viagensFornecidas ? viagensIniciais : []);
  const [loading, setLoading] = useState(!viagensFornecidas);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollRef = useRef(null);

  const [erro, setErro] = useState(null);

  // Erro P10: o backend devolve só as viagens do motorista logado (ou todas, para os
  // outros perfis). Antes havia uma lista fixa de "reserva" com viagens de exemplo.
  useEffect(() => {
    let isMounted = true;

    if (viagensFornecidas) {
      setViagens(viagensIniciais);
      setErro(null);
      setLoading(false);
      if (!viagemSelecionada && viagensIniciais.length > 0) {
        onSelectViagem?.(viagensIniciais[0]);
      }
      return () => {
        isMounted = false;
      };
    }

    const carregarViagens = async () => {
      try {
        setLoading(true);
        const lista = await listarViagensEmAndamento();
        if (!isMounted) return;
        setViagens(lista);
        setErro(null);
        if (!viagemSelecionada && lista.length > 0) {
          onSelectViagem?.(lista[0]);
        }
      } catch (err) {
        if (isMounted) setErro(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    carregarViagens();

    return () => {
      isMounted = false;
    };
  }, [viagensFornecidas, viagensIniciais]);

  const handleSelectTrip = (item, index) => {
    if (viagemSelecionada?.id === item.id && onOpenTripDetails) {
      onOpenTripDetails(item);
      return;
    }
    setCurrentIndex(index);
    onSelectViagem?.(item);
    scrollRef.current?.scrollTo({ x: index * CARD_WIDTH, animated: true });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#2541EF" />
        <Text style={styles.loadingText}>Carregando viagens em curso...</Text>
      </View>
    );
  }

  if (erro || viagens.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.headerTitle}>Viagens em curso</Text>
        <TouchableOpacity
          style={styles.cardVazio}
          onPress={() => onOpenTripDetails?.(null)}
          activeOpacity={0.8}
        >
          <Text style={styles.cardVazioTexto}>{erro || 'Nenhuma viagem em andamento.'}</Text>
          <Text style={styles.cardVazioSubtexto}>Toque para consultar suas viagens ➔</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Viagens em curso</Text>

      {/* Abas para alternar rapidamente entre todos os motoristas */}
      {viagens.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.driverTabsContainer}
        >
          {viagens.map((item, index) => {
            const isSelected = viagemSelecionada?.id
              ? viagemSelecionada.id === item.id
              : currentIndex === index;

            return (
              <TouchableOpacity
                key={item.id || index}
                onPress={() => handleSelectTrip(item, index)}
                style={[
                  styles.driverTab,
                  isSelected && styles.driverTabActive
                ]}
                activeOpacity={0.8}
              >
                <View style={[styles.tabStatusDot, isSelected && styles.tabStatusDotActive]} />
                <Text
                  style={[
                    styles.driverTabText,
                    isSelected && styles.driverTabTextActive
                  ]}
                >
                  {item.motorista}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Carrossel de Cards das viagens */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / CARD_WIDTH);
          if (index >= 0 && index < viagens.length) {
            setCurrentIndex(index);
            onSelectViagem?.(viagens[index]);
          }
        }}
      >
        {viagens.map((item, index) => {
          const isSelected = viagemSelecionada?.id
            ? viagemSelecionada.id === item.id
            : currentIndex === index;

          return (
            <TouchableOpacity
              key={item.id || index}
              activeOpacity={0.9}
              onPress={() => handleSelectTrip(item, index)}
              style={[
                styles.card,
                { width: CARD_WIDTH },
                isSelected && styles.cardSelected
              ]}
            >
              <View style={styles.cardHeaderRow}>
                <Text style={styles.sectionLabel}>VIAGEM ATUAL</Text>
                {isSelected ? (
                  <TouchableOpacity
                    style={styles.selectedBadge}
                    onPress={() => onOpenTripDetails?.(item)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.selectedBadgeText}>Ver detalhes ➔</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.tapToViewText}>Toque para ver rota</Text>
                )}
              </View>

              <View style={styles.routeContainer}>
                <View style={styles.locationBlock}>
                  <View style={styles.dotOuter}>
                    <View style={styles.dotInner} />
                  </View>
                  <Text style={styles.locationTitle}>Origem</Text>
                  <Text style={styles.locationSubtitle} numberOfLines={1}>{item.origem}</Text>
                </View>

                <View style={styles.arrowContainer}>
                  <View style={styles.line} />
                  <View style={styles.arrowHead} />
                </View>

                <View style={styles.locationBlockDest}>
                  <View style={styles.solidDot} />
                  <Text style={styles.locationTitle}>Destino</Text>
                  <Text style={styles.locationSubtitle} numberOfLines={1}>{item.destino}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.licenseBox}>
                <View style={styles.driverInfoBlock}>
                  <Text style={styles.licenseLabel}>Motorista</Text>
                  <Text style={styles.driverName} numberOfLines={1}>
                    {item.motorista || 'Motorista'}
                  </Text>
                </View>
                <View style={styles.licenseInfoBlock}>
                  <Text style={styles.licenseLabel}>Licença do{'\n'}veículo</Text>
                  <Text style={styles.licenseValue}>{item.placa || 'Sem veículo'}</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Paginação inferior */}
      {viagens.length > 1 && (
        <View style={styles.pagination}>
          {viagens.map((item, index) => {
            const isSelected = viagemSelecionada?.id
              ? viagemSelecionada.id === item.id
              : currentIndex === index;

            return (
              <TouchableOpacity
                key={item.id || index}
                onPress={() => handleSelectTrip(item, index)}
                style={[
                  styles.paginationDot,
                  isSelected && styles.paginationDotActive
                ]}
                activeOpacity={0.7}
              />
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#121212',
    paddingTop: 20,
    alignItems: 'center',
  },
  loadingContainer: {
    width: '100%',
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
    marginTop: 8,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '600',
    alignSelf: 'flex-start',
    marginBottom: 16,
    marginLeft: 4,
  },
  driverTabsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  driverTab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  driverTabActive: {
    backgroundColor: '#2541EF',
    borderColor: '#FFFFFF',
  },
  tabStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    marginRight: 6,
  },
  tabStatusDotActive: {
    backgroundColor: '#10B981',
  },
  driverTabText: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 13,
    fontWeight: '600',
  },
  driverTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  scrollContent: {
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#2541EF',
    borderRadius: 24,
    padding: 24,
    marginRight: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  cardSelected: {
    borderColor: '#FFFFFF',
    shadowColor: '#2541EF',
    shadowOpacity: 0.5,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 26,
  },
  sectionLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  selectedBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  selectedBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  tapToViewText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 11,
  },
  routeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
    position: 'relative',
  },
  locationBlock: {
    flex: 1,
    alignItems: 'flex-start',
  },
  locationBlockDest: {
    flex: 1,
    alignItems: 'flex-end',
  },
  dotOuter: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  dotInner: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
  solidDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
  },
  arrowContainer: {
    flex: 0.8,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10,
    marginBottom: 12,
  },
  line: {
    flex: 1,
    height: 2,
    backgroundColor: '#FFFFFF',
  },
  arrowHead: {
    width: 8,
    height: 8,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: '#FFFFFF',
    transform: [{ rotate: '45deg' }],
    marginLeft: -4,
  },
  locationTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  locationSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginBottom: 24,
  },
  licenseBox: {
    backgroundColor: '#1B31C0',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  driverInfoBlock: {
    flex: 1,
    paddingRight: 8,
  },
  licenseInfoBlock: {
    alignItems: 'flex-end',
  },
  driverName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  licenseLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  licenseValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#555555',
    marginHorizontal: 4,
  },
  paginationDotActive: {
    width: 24,
    backgroundColor: '#2541EF',
  },
  cardVazio: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardVazioTexto: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
  },
  cardVazioSubtexto: {
    color: '#3B56FF',
    fontSize: 13,
    fontWeight: '600',
  },
});
