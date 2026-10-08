import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../constants/theme';

const adminActions = [
  { id: '1', title: 'Usuários', iconFamily: 'Feather', iconName: 'users' },
  { id: '2', title: 'Categorias', iconFamily: 'Ionicons', iconName: 'card-outline' },
  { id: '3', title: 'Pagamentos', iconFamily: 'MaterialCommunityIcons', iconName: 'bank-outline' },
  { id: '4', title: 'Frota', iconFamily: 'MaterialCommunityIcons', iconName: 'truck-outline' },
  { id: '5', title: 'Manutenção', iconFamily: 'Ionicons', iconName: 'construct-outline' },
];

function renderActionIcon(family, name) {
  if (family === 'Feather') return <Feather name={name} size={24} color="#FFFFFF" />;
  if (family === 'MaterialCommunityIcons') return <MaterialCommunityIcons name={name} size={24} color="#FFFFFF" />;
  return <Ionicons name={name} size={24} color="#FFFFFF" />;
}

export default function ActionGrid({ onSelectAction }) {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Ações Rápidas (Master)</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {adminActions.map((action) => (
          <TouchableOpacity
            key={action.id}
            style={styles.actionButton}
            activeOpacity={0.8}
            onPress={() => onSelectAction && onSelectAction(action.id)}
          >
            <View style={styles.iconContainer}>
              {renderActionIcon(action.iconFamily, action.iconName)}
            </View>
            <Text style={styles.actionText}>{action.title}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  actionButton: {
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    width: 95,
    height: 95,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  iconContainer: {
    marginBottom: 8,
  },
  actionText: {
    color: colors.textPrimary,
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '500',
  },
});
