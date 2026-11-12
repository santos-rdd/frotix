import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

/**
 * Campo "Selecione ⌄" que abre uma lista em modal (sem biblioteca de picker).
 * opcoes: [{ id, label }]
 */
export default function SelectField({ label, opcoes, valor, onSelecionar, vazio = 'Nenhuma opção disponível' }) {
  const [aberto, setAberto] = useState(false);
  const selecionada = opcoes.find((o) => o.id === valor);

  return (
    <View style={styles.bloco}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.campo} onPress={() => setAberto(true)}>
        <Text style={styles.valor} numberOfLines={1}>
          {selecionada ? selecionada.label : 'Selecione'}
        </Text>
        <Feather name="chevron-down" size={22} color="#FFF" />
      </TouchableOpacity>

      <Modal visible={aberto} transparent animationType="fade" onRequestClose={() => setAberto(false)}>
        <TouchableOpacity style={styles.fundo} activeOpacity={1} onPress={() => setAberto(false)}>
          <View style={styles.lista}>
            <Text style={styles.listaTitulo}>{label}</Text>
            <FlatList
              data={opcoes}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={<Text style={styles.vazio}>{vazio}</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.opcao}
                  onPress={() => {
                    onSelecionar(item.id);
                    setAberto(false);
                  }}
                >
                  <Text style={styles.opcaoTexto}>{item.label}</Text>
                  {item.id === valor ? <Feather name="check" size={18} color="#3B56FF" /> : null}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  bloco: { marginBottom: 16 },
  label: { color: '#FFF', fontSize: 14, fontWeight: '700', marginBottom: 8 },
  campo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#2A3BC9',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: 10,
    paddingHorizontal: 16,
    height: 48,
  },
  valor: { color: '#FFF', fontSize: 13, flex: 1 },
  fundo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  lista: { backgroundColor: '#1E1E1E', borderRadius: 16, padding: 16, maxHeight: '70%' },
  listaTitulo: { color: '#FFF', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  opcao: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#27272A',
  },
  opcaoTexto: { color: '#FFF', fontSize: 14 },
  vazio: { color: '#888', paddingVertical: 14 },
});
