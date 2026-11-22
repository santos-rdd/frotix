import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import QuickActionsCards from '../quickActionsCards/quickActionsCards';

export default function QuickActions({ selectedAction, onSelectAction, userRole }) {
    const role = Number(userRole);
    const allCards = [
        { id: 'finance', name: 'Categorias Financeiras', image: ''},
        { id: 'payment', name: 'Entradas e Saídas', image: ''},
        { id: 'users', name: 'Gerenciador de Usuários', image: ''},
        { id: 'rotes', name: 'Rotas', image: '' },
    ];

    const quickCardsInfos = allCards.filter(card => {
        if (card.id === 'users') {
            return role === 1;
        }
        if (card.id === 'finance') {
            return role === 1 || role === 3;
        }
        if (card.id === 'payment') {
            return role !== 4;
        }
        if (card.id === 'rotes') {
            return role !== 3 && role !== 4;
        }
        return true;
    });

    return (
        <View style={styles.container}>
            <Text style={styles.textQuickActions}>Ações Rápidas</Text>
            <FlatList
                contentContainerStyle={styles.carousel}
                data={quickCardsInfos}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <QuickActionsCards 
                        onPress={() => onSelectAction(item.id)}
                        {...item}
                        selectCardPass={selectedAction === item.id ? selectedAction : null} 
                    />
                )}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        height: 233,
        flexDirection: 'column',
    },
    textQuickActions:{
        fontSize: 24,
        fontWeight: '400',
        paddingTop: 55,
        paddingLeft: 20,
        paddingBottom: 10,
        color: 'white'
    },
    carousel: {
        height: 120,
        padding: 10,
        gap: 15
    }
});