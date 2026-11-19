import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';

/**
 * Mostra "carregando" ou a mensagem de erro com o botão "Tentar de novo".
 * Não mostra nada quando já há dados e não há erro.
 */
export default function EstadoDados({ carregando, erro, onTentarDeNovo, temDados }) {
  if (erro) {
    return (
      <View style={styles.caixa}>
        <Text style={styles.erro}>{erro}</Text>
        {onTentarDeNovo ? (
          <TouchableOpacity style={styles.botao} onPress={onTentarDeNovo}>
            <Text style={styles.botaoTexto}>Tentar de novo</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }
  if (carregando && !temDados) {
    return (
      <View style={styles.caixa}>
        <ActivityIndicator color="#FFF" />
        <Text style={styles.texto}>Carregando...</Text>
      </View>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  caixa: { alignItems: 'center', paddingVertical: 20, paddingHorizontal: 20, gap: 10 },
  texto: { color: '#AAA', fontSize: 13 },
  erro: { color: '#FFCDD2', fontSize: 14, textAlign: 'center' },
  botao: { borderWidth: 1, borderColor: '#FFF', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 18 },
  botaoTexto: { color: '#FFF', fontWeight: '600' },
});
