import react from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';

export default function QuickActionsCards(props){

    const name = props.name;
    const selectCardPass = props.selectCardPass;
    const onPress = props.onPress;
    if(selectCardPass){
        console.log('Verdadeiro')
    }

    return (
        <TouchableOpacity 
            style={stylesQuickActionsCards.container} 
            onPress={onPress} 
            activeOpacity={0.7}
        >
            <Text style={ stylesQuickActionsCards.textCardExplain }> { name } </Text>
        </TouchableOpacity>
    )
};

const stylesQuickActionsCards = StyleSheet.create({
    container: {
        width: 90,
        height: 90,
        flexDirection: 'column',
        backgroundColor: 'white',
        borderRadius: 20

    },
    textCardExplain: {
        color: 'black'
    }
})