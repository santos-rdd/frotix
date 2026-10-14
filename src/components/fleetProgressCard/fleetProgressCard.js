import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';

export default function FleetProgressCard({ 
  date = 'Sexta-feira, 9 de outubro', 
  currentKm = '350', 
  totalKm = 'X', 
  periodText = 'últimos 7 dias',
  onFilterPress 
}) {
  return (
    <View style={styles.container}>
      <View style={styles.topHeader}>
        <View style={styles.paginationDots}>
          <View style={styles.dotInactive} />
          <View style={styles.dotActive} />
          <View style={styles.dotInactive} />
        </View>

        <TouchableOpacity style={styles.filterContainer} onPress={onFilterPress}>
          <Text style={styles.filterText}>{periodText}</Text>
          <Feather name="sliders" size={14} color="#888" />
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.dateText}>{date}</Text>

        <View style={styles.gaugeWrapper}>
          <View style={styles.arcBackground} />
          <View style={styles.arcProgress} />

          <View style={styles.gaugeContent}>
            <MaterialCommunityIcons name="local-fire-department" size={24} color="#2541ff" />
            <View style={styles.kmRow}>
              <Text style={styles.currentKmText}>{currentKm}</Text>
              <Text style={styles.unitText}> km</Text>
            </View>
            <Text style={styles.totalKmText}>de {totalKm} km</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    marginTop: 20,
    width: '100%',
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  paginationDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: '42%',
  },
  dotActive: {
    width: 20,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2541ff',
  },
  dotInactive: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#555',
  },
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterText: {
    color: 'white',
    fontSize: 12,
  },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    width: '100%',
    height: 213
  },
  dateText: {
    color: '#2541ff',
    fontSize: 14,
    fontWeight: '500',
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  gaugeWrapper: {
    width: 220,
    height: 115,
    alignItems: 'center',
    position: 'relative',
    marginTop: 10,
    marginBottom: 5,
  },
  arcBackground: {
    position: 'absolute',
    width: 230,
    height: 120,
    borderTopLeftRadius: 110,
    borderTopRightRadius: 110,
    borderWidth: 23,
    borderColor: '#222831',
    borderBottomWidth: 0,
    top: -10

  },
  arcProgress: {
    position: 'absolute',
    width: 230,
    height: 120,
    borderTopLeftRadius: 110,
    borderTopRightRadius: 110,
    borderWidth: 23,
    borderColor: '#2541ff',
    borderBottomWidth: 0,
    right: -5, 
    top: -10,
  },
  gaugeContent: {
    position: 'absolute',
    bottom: -5,
    alignItems: 'center',
  },
  kmRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  currentKmText: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: 'bold',
  },
  unitText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  totalKmText: {
    color: '#2541ff',
    fontSize: 14,
    marginTop: 2,
  },
});