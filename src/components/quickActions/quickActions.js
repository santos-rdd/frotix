import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import QuickActionsCards from '../quickActionsCards/quickActionsCards';

export default function QuickActions({ selectedAction, onSelectAction, userRole }) {
    const allCards = [
        { id: 'finance', name: 'Categorias Financeiras', image: ''},
        { id: 'payment', name: 'Formas de Pagamento', image: ''},
        { id: 'users', name: 'Gerenciador de Usuários', image: ''},
        { id: 'rotes', name: 'Rotas', image: '' },
    ];

    // Filtra quais cards o usuário pode ver
    const quickCardsInfos = allCards.filter(card => {
        // Exemplo: Restringe 'users' e 'finance' apenas para Admin (1) ou Financeiro (3)
        if (card.id === 'users' || card.id === 'finance') {
            return userRole === 1 || userRole === 3;
        }
        // Os demais cards (payment, rotes, etc.) aparecem para todos
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