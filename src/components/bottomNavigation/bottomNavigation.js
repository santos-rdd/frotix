import react from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
} from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons'; 

export default function BottomNavigation(){
    return (
        <View style={stylesBottomNavigation.bottomNav}>
            <TouchableOpacity style={stylesBottomNavigation.navItem}>
                <Ionicons name="home-outline" size={24} color="#3b59ff" />
            </TouchableOpacity>
    
            <TouchableOpacity style={stylesBottomNavigation.navItem}>
                <Ionicons name="car-outline" size={24} color="#3b59ff" />
            </TouchableOpacity>
    
            <TouchableOpacity style={stylesBottomNavigation.navItem}>
                <Ionicons name="construct-outline" size={24} color="#3b59ff" />
            </TouchableOpacity>
    
            <TouchableOpacity style={stylesBottomNavigation.navItem}>
                <Ionicons name="person-outline" size={24} color="#3b59ff" />
            </TouchableOpacity>
        </View>
    )
};

const stylesBottomNavigation = StyleSheet.create({
    bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 15,
    backgroundColor: '#121212',
    borderTopWidth: 1,
    borderTopColor: '#1e1e1e',
    paddingBottom: 60,
    position: 'absolute',
    bottom: 0,            
    left: 0,
    right: 0,
    bottomNav: 0
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})

