import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { colors } from '../../constants/theme.js';

/**
 * Modal que pede um motivo antes de uma ação que desfaz algo (estornar, cancelar dívida).
 * onConfirmar(motivo) pode ser async; enquanto roda, o botão mostra o indicador.
 */
export default function ModalMotivo({ visivel, titulo, descricao, confirmarLabel = 'Confirmar', onCancelar, onConfirmar }) {
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (visivel) {
      setMotivo('');
      setErro('');
    }
  }, [visivel]);

  const confirmar = async () => {
    if (motivo.trim().length < 3) {
      setErro('Escreva o motivo (pelo menos 3 letras).');
      return;
    }
    setSalvando(true);
    try {
      await onConfirmar(motivo.trim());
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal visible={visivel} transparent animationType="fade" onRequestClose={onCancelar}>
      <KeyboardAvoidingView style={styles.fundo} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.caixa}>
          <Text style={styles.titulo}>{titulo}</Text>
          {descricao ? <Text style={styles.descricao}>{descricao}</Text> : null}
          <Text style={styles.label}>MOTIVO</Text>
          <TextInput
            style={[styles.input, erro && styles.inputErro]}
            value={motivo}
            onChangeText={(t) => { setMotivo(t); setErro(''); }}
            placeholder="Ex.: lançado em dobro"
            placeholderTextColor="#777"
            multiline
          />
          {erro ? <Text style={styles.erro}>{erro}</Text> : null}
          <View style={styles.botoes}>
            <TouchableOpacity style={[styles.botao, styles.botaoClaro]} onPress={onCancelar} disabled={salvando}>
              <Text style={styles.botaoTextoEscuro}>Voltar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.botao, styles.botaoPerigo]} onPress={confirmar} disabled={salvando}>
              {salvando ? <ActivityIndicator color="#FFF" /> : <Text style={styles.botaoTextoClaro}>{confirmarLabel}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', padding: 24 },
  caixa: { backgroundColor: colors.cardBg, borderRadius: 16, padding: 20 },
  titulo: { color: '#FFF', fontSize: 17, fontWeight: '700' },
  descricao: { color: colors.textMuted, fontSize: 13, marginTop: 6 },
  label: { color: '#FFF', fontSize: 12, fontWeight: '700', marginTop: 16, marginBottom: 6 },
  input: { backgroundColor: '#2A2A2A', borderRadius: 10, borderWidth: 1, borderColor: colors.border, color: '#FFF', minHeight: 70, padding: 12, textAlignVertical: 'top' },
  inputErro: { borderColor: '#FF8A80' },
  erro: { color: '#FFCDD2', fontSize: 12, marginTop: 6 },
  botoes: { flexDirection: 'row', gap: 12, marginTop: 18 },
  botao: { flex: 1, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  botaoClaro: { backgroundColor: '#E5E7EB' },
  botaoPerigo: { backgroundColor: '#B71C1C' },
  botaoTextoEscuro: { color: '#121212', fontWeight: '700' },
  botaoTextoClaro: { color: '#FFF', fontWeight: '700' },
});
