import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions, Image } from 'react-native';

const { width } = Dimensions.get('window');

export default function MapCardWithButton({ onButtonPress }) {
  return (
    <View style={styles.mainContainer}>
      <View style={styles.mapCard}>
          <Image 
            source={require('../../../assets/image/map.png')} 
            style={styles.mapImage}
            resizeMode="cover"
          />
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
    marginTop: 50
  },
  mapCard: {
    width: width - 32,
    height: 480,
    backgroundColor: '#E8F5E9',
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#333333',
  },
  mapImage: {
    width: '100%',
    height: '100%',
  },
  mapPlaceholder: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#E4F1EA',
  },
  routeLine: {
    position: 'absolute',
    top: 40,
    left: 80,
    width: 140,
    height: 180,
    borderLeftWidth: 4,
    borderBottomWidth: 4,
    borderColor: '#2541EF',
    borderBottomLeftRadius: 30,
    transform: [{ rotate: '15deg' }],
  },
  pinContainer: {
    position: 'absolute',
    top: 200,
    left: 210,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#D32F2F',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  button: {
    width: width - 32,
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