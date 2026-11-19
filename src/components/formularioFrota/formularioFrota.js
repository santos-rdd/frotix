import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../../constants/theme.js';

/**
 * Peças dos formulários das telas de frota, no mesmo visual do formulário de Viagens
 * (card azul, campos azul-escuros, botões Cancelar vermelho e ação clara).
 */

// Card azul que envolve os campos.
export function CardFormulario({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

// Rótulo + campo de texto. `erro` mostra a mensagem em vermelho embaixo do campo.
export function CampoTexto({ label, erro, style, ...props }) {
  return (
    <View style={styles.bloco}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, erro && styles.inputErro, props.multiline && styles.inputMultilinha, style]}
        placeholderTextColor="rgba(255,255,255,0.6)"
        {...props}
      />
      {erro ? <Text style={styles.erro}>{erro}</Text> : null}
    </View>
  );
}

// Chips de escolha única (ex.: tipo de manutenção, entrada/saída).
export function EscolhaChips({ label, opcoes, valor, onSelecionar }) {
  return (
    <View style={styles.bloco}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.chips}>
        {opcoes.map((o) => {
          const ativo = o.id === valor;
          return (
            <TouchableOpacity
              key={o.id}
              style={[styles.chip, ativo && styles.chipAtivo]}
              onPress={() => onSelecionar(o.id)}
            >
              <Text style={[styles.chipTexto, ativo && styles.chipTextoAtivo]}>{o.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// Par de botões do rodapé do card: Cancelar (vermelho) e a ação principal (claro).
export function BotoesFormulario({ onCancelar, onConfirmar, confirmarLabel = 'Salvar', cancelarLabel = 'Cancelar' }) {
  return (
    <View style={styles.botoes}>
      <TouchableOpacity style={[styles.botao, styles.botaoCancelar]} onPress={onCancelar}>
        <Text style={styles.botaoTextoClaro}>{cancelarLabel}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.botao, styles.botaoClaro]} onPress={onConfirmar}>
        <Text style={styles.botaoTextoEscuro}>{confirmarLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.primaryBlue,
    borderRadius: 12,
    padding: 20,
    paddingTop: 28,
    marginHorizontal: 8,
    marginBottom: 24,
    elevation: 6,
  },
  bloco: { marginBottom: 16 },
  label: { color: '#FFF', fontSize: 14, fontWeight: '700', marginBottom: 8 },
  input: {
    backgroundColor: '#2A3BC9',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: 10,
    paddingHorizontal: 16,
    height: 48,
    color: '#FFF',
    fontSize: 13,
  },
  inputMultilinha: { height: 90, paddingTop: 12, textAlignVertical: 'top' },
  inputErro: { borderColor: '#FF8A80', borderWidth: 2 },
  erro: { color: '#FFCDD2', fontSize: 12, marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  chipAtivo: { backgroundColor: '#FFF', borderColor: '#FFF' },
  chipTexto: { color: '#FFF', fontSize: 13 },
  chipTextoAtivo: { color: colors.primaryBlue, fontWeight: '700' },
  botoes: { flexDirection: 'row', gap: 16, marginTop: 20 },
  botao: { flex: 1, borderRadius: 28, height: 56, justifyContent: 'center', alignItems: 'center' },
  botaoCancelar: { backgroundColor: '#B71C1C' },
  botaoClaro: { backgroundColor: '#E5E7EB' },
  botaoTextoClaro: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  botaoTextoEscuro: { color: '#121212', fontSize: 15, fontWeight: '700' },
});
