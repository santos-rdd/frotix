import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

/**
 * Filtros em "chips" + campo de busca + botão de cadastro.
 * filtros: [{ id, label, cor?, total? }] — `cor` desenha a borda e a bolinha do chip.
 */
export default function FilterSearchBar({
  filtros,
  filtroAtivo,
  onFiltrar,
  busca,
  onBuscar,
  placeholder,
  botaoLabel,
  onBotao,
}) {
  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {filtros.map((f) => {
          const ativo = f.id === filtroAtivo;
          return (
            <TouchableOpacity
              key={f.id}
              onPress={() => onFiltrar(f.id)}
              style={[
                styles.chip,
                ativo ? styles.chipAtivo : { borderColor: f.cor || '#3B56FF' },
              ]}
            >
              {!ativo && f.cor ? <View style={[styles.bolinha, { backgroundColor: f.cor }]} /> : null}
              <Text style={styles.chipTexto}>
                {f.label}
                {f.total !== undefined ? ` (${f.total})` : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.linhaBusca}>
        <View style={styles.busca}>
          <Feather name="search" size={14} color="#AAA" />
          <TextInput
            style={styles.buscaInput}
            value={busca}
            onChangeText={onBuscar}
            placeholder={placeholder}
            placeholderTextColor="#AAA"
            autoCapitalize="characters"
          />
        </View>
        {botaoLabel ? (
          <TouchableOpacity style={styles.botao} onPress={onBotao}>
            <Text style={styles.botaoTexto}>+ {botaoLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { paddingHorizontal: 16, gap: 10 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#121212',
  },
  chipAtivo: { backgroundColor: '#3B56FF', borderColor: '#3B56FF' },
  bolinha: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  chipTexto: { color: '#FFF', fontSize: 13 },
  linhaBusca: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 20,
    gap: 12,
  },
  busca: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#5A5A5A',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#AAA',
    paddingHorizontal: 12,
    height: 36,
  },
  buscaInput: { flex: 1, color: '#FFF', fontSize: 12, marginLeft: 6, paddingVertical: 0 },
  botao: { backgroundColor: '#3B56FF', borderRadius: 4, paddingHorizontal: 12, height: 36, justifyContent: 'center' },
  botaoTexto: { color: '#FFF', fontSize: 14 },
});
