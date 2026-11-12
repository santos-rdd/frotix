import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import ScreenHeader from '../../components/screenHeader/screenHeader.js';
import { CardFormulario, CampoTexto, EscolhaChips } from '../../components/formularioFrota/formularioFrota.js';
import VoltarButton from '../../components/voltarButton/voltarButton.js';
import BottomNavigation from '../../components/bottomNavigation/bottomNavigation.js';
import { colors } from '../../constants/theme.js';
import { categorias as categoriasIniciais, adicionarCategoria, removerCategoria } from '../../constants/categoriasMock.js';

const TIPOS = [
  { id: 'entrada', label: 'Entrada' },
  { id: 'saida', label: 'Saída' },
];

const normalizar = (texto) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/**
 * Categorias Financeiras (Admin e Financeiro): cadastro e remoção das categorias usadas
 * nos formulários de entrada e saída. Aberta pelo botão "Gerenciar categorias"
 * da ação rápida "Categorias Financeiras" da Home.
 */
export default function Categorias({ navigation, route }) {
  const usuario = route?.params?.usuario;
  const [lista, setLista] = useState([...categoriasIniciais]);
  const [aba, setAba] = useState('entrada');
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState('');

  const atualizar = () => setLista([...categoriasIniciais]);

  const adicionar = () => {
    const limpo = nome.trim();
    if (!limpo) {
      setErro('Informe o nome da categoria.');
      return;
    }
    if (normalizar(limpo) === 'outros') {
      setErro('"Outros" já aparece sempre no fim da lista.');
      return;
    }
    if (categoriasIniciais.some((c) => c.tipo === aba && normalizar(c.nome) === normalizar(limpo))) {
      setErro('Essa categoria já existe.');
      return;
    }
    adicionarCategoria({ nome: limpo, tipo: aba });
    setNome('');
    setErro('');
    atualizar();
  };

  const remover = (categoria) => {
    Alert.alert('Remover categoria', `Deseja remover "${categoria.nome}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: () => {
          removerCategoria(categoria.id);
          atualizar();
        },
      },
    ]);
  };

  const daAba = lista.filter((c) => c.tipo === aba);

  return (
    <>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.container} contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
          <ScreenHeader usuario={usuario} titulo="Categorias Financeiras" />

          <CardFormulario>
            <EscolhaChips label="TIPO" opcoes={TIPOS} valor={aba} onSelecionar={(id) => { setAba(id); setErro(''); }} />
            <CampoTexto
              label="NOVA CATEGORIA"
              value={nome}
              onChangeText={(t) => { setNome(t); setErro(''); }}
              placeholder={aba === 'entrada' ? 'Ex.: Frete' : 'Ex.: Combustível'}
              erro={erro}
              onSubmitEditing={adicionar}
              returnKeyType="done"
            />
            <TouchableOpacity style={styles.botaoAdicionar} onPress={adicionar}>
              <Feather name="plus" size={18} color="#121212" />
              <Text style={styles.botaoAdicionarTexto}>Adicionar</Text>
            </TouchableOpacity>
          </CardFormulario>

          <Text style={styles.subtitulo}>
            Categorias de {aba === 'entrada' ? 'entrada' : 'saída'} ({daAba.length})
          </Text>

          {daAba.map((c) => (
            <View key={c.id} style={styles.item}>
              <View style={[styles.bolinha, { backgroundColor: aba === 'entrada' ? colors.greenSuccess : colors.redDanger }]} />
              <Text style={styles.itemTexto}>{c.nome}</Text>
              <TouchableOpacity onPress={() => remover(c)} hitSlop={10}>
                <Feather name="trash-2" size={18} color="#FF8A80" />
              </TouchableOpacity>
            </View>
          ))}

          {daAba.length === 0 ? <Text style={styles.vazio}>Nenhuma categoria cadastrada.</Text> : null}
          <Text style={styles.nota}>"Outros" aparece sempre no fim da lista dos formulários.</Text>

          <VoltarButton navigation={navigation} />
        </ScrollView>
      </KeyboardAvoidingView>

      <BottomNavigation navigation={navigation} userRole={usuario?.role} usuario={usuario} />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.background },
  conteudo: { paddingBottom: 150 },
  botaoAdicionar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 28,
    height: 50,
    marginTop: 4,
  },
  botaoAdicionarTexto: { color: '#121212', fontSize: 15, fontWeight: '700' },
  subtitulo: { color: '#FFF', fontSize: 16, paddingHorizontal: 18, marginBottom: 10 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginHorizontal: 18,
    marginBottom: 8,
  },
  bolinha: { width: 10, height: 10, borderRadius: 5 },
  itemTexto: { color: '#FFF', fontSize: 14, flex: 1 },
  vazio: { color: colors.textMuted, textAlign: 'center', marginVertical: 20 },
  nota: { color: colors.textMuted, fontSize: 12, paddingHorizontal: 18, marginTop: 6 },
});
