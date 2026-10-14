import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';

export default function QuickActionsCards({ id, name, onPress, selectCardPass }) {
    const isSelected = selectCardPass !== null;

    const renderIcon = () => {
        const iconColor = '#121212';
        if (id === 'finance') return <Feather name="file-text" size={24} color={iconColor} />;
        if (id === 'payment') return <MaterialCommunityIcons name="card-outline" size={24} color={iconColor} />;
        return <Feather name="users" size={24} color={iconColor} />;
    };

    return (
        <TouchableOpacity 
            onPress={onPress}
            style={[
                styles.card, 
                { backgroundColor: isSelected ? '#2541ff' : 'white' },
                { height: isSelected ? 120 : 90 },
            ]}
        >
            <View style={[
                styles.iconCircle, 
                { marginBottom: isSelected ? 10 : 0 },
            ]}>
                {renderIcon()}
            </View>
            <Text style={[
                styles.cardText, 
                { color: isSelected ? 'white' : 'black' }
            ]}>{name}</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        width: 90,
        borderRadius: 20,
        padding: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconCircle: {
        width: 50,
        height: 50,
        backgroundColor: 'white',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 5,
        borderRadius: 20
    },
    cardText: {
        fontSize: 12,
        textAlign: 'center',
        fontWeight: '500',
    },
});