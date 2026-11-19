import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';

// Botão branco "Voltar" usado no rodapé das telas do Gestor.
export default function VoltarButton({ navigation, label = 'Voltar', onPress }) {
  return (
    <TouchableOpacity style={styles.botao} onPress={onPress || (() => navigation.goBack())}>
      <Text style={styles.texto}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  botao: {
    backgroundColor: '#F2F2F7',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 20,
  },
  texto: { color: '#121212', fontSize: 16, fontWeight: '600' },
});
