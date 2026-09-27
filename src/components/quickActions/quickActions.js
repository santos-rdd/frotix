import react, { useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import QuickActionsCards from '../quickActionsCards/quickActionsCards';

export default function QuickActions(){

    const [ selectCard, setCardSelect ] = useState(null)

    const quickCardsInfos = [
        { id: 'finance', name: 'Categorias Financeiras', image: ''},
        { id: 'payment', name: 'Formas de Pagamento', image: ''},
        { id: 'users', name: 'Gerenciador de Usuários', image: ''},
    ]

    return (
        <View style={stylesQuickActions.container}>
            <Text style={stylesQuickActions.textQuickActions}>Ações Rapidas</Text>
            <FlatList
                contentContainerStyle={stylesQuickActions.carousel}
                data={quickCardsInfos}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.id}
                
                renderItem={({ item }) => (
                    <QuickActionsCards 
                        onPress={()=> setCardSelect(item.id)}
                        {...item}
                        selectCardPass={ selectCard == item.id ? selectCard : null} 

                    />
                    
                )}
                />
        </View>
    )
};

const stylesQuickActions = StyleSheet.create({
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
})