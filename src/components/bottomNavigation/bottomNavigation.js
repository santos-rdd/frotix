import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

export default function BottomNavigation({ navigation }) {
  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.navButton} 
        onPress={() => navigation.navigate('uploadProof')}
      >
        <MaterialCommunityIcons name="truck-delivery-outline" size={24} color="#2541ff" />
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.navButton} 
        onPress={() => navigation.navigate('HomePage')}
      >
        <Feather name="home" size={24} color="#2541ff" />
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.navButton} 
        onPress={() => console.log('Ferramenta clicada')}
      >
        <Feather name="tool" size={24} color="#2541ff" />
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.navButton} 
        onPress={() => navigation.navigate('userProfile')}
      >
        <Feather name="user" size={24} color="#2541ff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 110,
    backgroundColor: '#1a1a1a',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 10,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    paddingTop: 8
  },
  navButton: {
    justifyContent: 'center',
    alignItems: 'center',
    height: 50,
    width: 50,
  },
});