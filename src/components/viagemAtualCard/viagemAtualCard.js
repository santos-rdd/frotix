import React from 'react';
import { StyleSheet, Text, View, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

export default function ViagemAtualCard() {
  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Viagens em curso</Text>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>VIAGEM ATUAL</Text>

        <View style={styles.routeContainer}>
          <View style={styles.locationBlock}>
            <View style={styles.dotOuter}>
              <View style={styles.dotInner} />
            </View>
            <Text style={styles.locationTitle}>Origem</Text>
            <Text style={styles.locationSubtitle}>Cidade x</Text>
          </View>

          <View style={styles.arrowContainer}>
            <View style={styles.line} />
            <View style={styles.arrowHead} />
          </View>

          <View style={styles.locationBlockDest}>
            <View style={styles.solidDot} />
            <Text style={styles.locationTitle}>Destino</Text>
            <Text style={styles.locationSubtitle}>Cidade y</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.licenseBox}>
          <Text style={styles.licenseLabel}>Licença do{'\n'}veículo</Text>
          <Text style={styles.licenseValue}>POX-XX</Text>
        </View>
      </View>

      <View style={styles.pagination}>
        <View style={styles.paginationDot} />
        <View style={[styles.paginationDot, styles.paginationDotActive]} />
        <View style={styles.paginationDot} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    paddingTop: 50,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '600',
    alignSelf: 'flex-start',
    marginBottom: 20,
    marginLeft: 4,
  },
  card: {
    width: width - 32,
    backgroundColor: '#2541EF', 
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  sectionLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 30,
  },
  routeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
    position: 'relative',
  },
  locationBlock: {
    alignItems: 'flex-start',
  },
  locationBlockDest: {
    alignItems: 'flex-start',
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
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
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
    color: 'rgba(255, 255, 255, 0.7)',
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
  licenseLabel: {
    color: '#FFFFFF',
    fontSize: 14,
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
    marginTop: 24,
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
});