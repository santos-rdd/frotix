import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import ScreenHeader from '../../components/screenHeader/screenHeader.js';
import { CardFormulario, CampoTexto, EscolhaChips } from '../../components/formularioFrota/formularioFrota.js';
import VoltarButton from '../../components/voltarButton/voltarButton.js';
import BottomNavigation from '../../components/bottomNavigation/bottomNavigation.js';
import { colors } from '../../constants/theme.js';
import EstadoDados from '../../components/estadoDados/estadoDados.js';
import useDados from '../../hooks/useDados.js';
import { listarCategorias, criarCategoria, removerCategoria } from '../../services/frotix.js';
import {
  salvarCategoriaLocal,
  listarCategoriasLocais,
  removerCadastroLocal,
} from '../../services/localDataService.js';
import { sincronizarOperacoes } from '../../services/syncService.js';

const TIPOS = [
  { id: 'entrada', label: 'Entrada' },
  { id: 'saida', label: 'Saída' },
];

const normalizar = (texto) => String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

export default function Categorias({ navigation, route }) {
  const usuario = route?.params?.usuario;
  const { dados, carregando, erro: erroLista, recarregar } = useDados(listarCategorias, []);
  const listaRemota = dados || [];
  const [locais, setLocais] = useState([]);
  const [aba, setAba] = useState('entrada');
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregarLocais = useCallback(async () => {
    if (usuario?.id) {
      try {
        const pendentes = await listarCategoriasLocais(usuario.id);
        setLocais(pendentes || []);
      } catch {}
    }
  }, [usuario?.id]);

  useEffect(() => {
    carregarLocais();
    if (usuario?.id) {
      sincronizarOperacoes(usuario.id).then((res) => {
        if (res?.processadas > 0) {
          recarregar();
          carregarLocais();
        }
      }).catch(() => {});
    }
  }, [usuario?.id, carregarLocais, recarregar]);

  const listaCompleta = (() => {
    const mapa = new Map();
    for (const c of listaRemota) {
      mapa.set(`${c.tipo}_${normalizar(c.nome)}`, c);
    }
    for (const l of locais) {
      const chave = `${l.tipo}_${normalizar(l.nome)}`;
      if (!mapa.has(chave)) {
        mapa.set(chave, l);
      }
    }
    return Array.from(mapa.values());
  })();

  const adicionar = async () => {
    const limpo = nome.trim();
    if (!limpo) {
      setErro('Informe o nome da categoria.');
      return;
    }
    if (normalizar(limpo) === 'outros') {
      setErro('"Outros" já aparece sempre no fim da lista.');
      return;
    }
    if (listaCompleta.some((c) => c.tipo === aba && normalizar(c.nome) === normalizar(limpo))) {
      setErro('Essa categoria já existe.');
      return;
    }
    if (salvando) return;
    setSalvando(true);

    try {
      await criarCategoria(limpo, aba);
      setNome('');
      setErro('');
      await recarregar();
      await carregarLocais();
    } catch (e) {
      const msg = e?.message || '';
      const ehErroConexao = /conexão|internet|network|failed|timeout/i.test(msg);

      if (ehErroConexao && usuario?.id) {
        try {
          const salvaLocal = await salvarCategoriaLocal(usuario.id, { nome: limpo, tipo: aba });
          setLocais((antigo) => [...antigo.filter((x) => x.id !== salvaLocal.id), salvaLocal]);
          setNome('');
          setErro('');
          Alert.alert(
            'Salvo no dispositivo',
            'A categoria foi salva localmente e será sincronizada assim que a conexão retornar.'
          );
        } catch (erroLocal) {
          setErro(erroLocal?.message || 'Falha ao salvar localmente.');
        }
      } else {
        setErro(msg || 'Não foi possível cadastrar a categoria.');
      }
    } finally {
      setSalvando(false);
    }
  };

  const remover = (categoria) => {
    Alert.alert('Remover categoria', `Deseja remover "${categoria.nome}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          try {
            if (categoria.pendenteSincronizacao || String(categoria.id).startsWith('local_')) {
              await removerCadastroLocal(usuario?.id, 'categorias', categoria.id);
              setLocais((antigo) => antigo.filter((x) => x.id !== categoria.id));
            } else {
              try {
                await removerCategoria(categoria.id);
                await recarregar();
              } catch (e) {
                const msg = e?.message || '';
                const ehErroConexao = /conexão|internet|network|failed|timeout/i.test(msg);
                if (ehErroConexao && usuario?.id) {
                  await removerCadastroLocal(usuario.id, 'categorias', categoria.id);
                  await carregarLocais();
                  Alert.alert(
                    'Salvo no dispositivo',
                    'A exclusão foi salva localmente e será sincronizada assim que a conexão retornar.'
                  );
                } else {
                  throw e;
                }
              }
            }
          } catch (e) {
            Alert.alert('Não foi possível remover', e.message);
          }
        },
      },
    ]);
  };

  const daAba = listaCompleta.filter((c) => c.tipo === aba);

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
            <TouchableOpacity style={styles.botaoAdicionar} onPress={adicionar} disabled={salvando}>
              <Feather name="plus" size={18} color="#121212" />
              <Text style={styles.botaoAdicionarTexto}>Adicionar</Text>
            </TouchableOpacity>
          </CardFormulario>

          <Text style={styles.subtitulo}>
            Categorias de {aba === 'entrada' ? 'entrada' : 'saída'} ({daAba.length})
          </Text>

          <EstadoDados
            carregando={carregando && listaCompleta.length === 0}
            erro={erroLista && listaCompleta.length === 0 ? erroLista : null}
            onTentarDeNovo={() => { recarregar(); carregarLocais(); }}
            temDados={listaCompleta.length > 0}
          />

          {daAba.map((c) => (
            <View key={c.id} style={styles.item}>
              <View style={[styles.bolinha, { backgroundColor: aba === 'entrada' ? colors.greenSuccess : colors.redDanger }]} />
              <Text style={styles.itemTexto}>
                {c.nome} {c.pendenteSincronizacao ? <Text style={styles.textoPendente}>(Pendente)</Text> : null}
              </Text>
              <TouchableOpacity onPress={() => remover(c)} hitSlop={10}>
                <Feather name="trash-2" size={18} color="#FF8A80" />
              </TouchableOpacity>
            </View>
          ))}

          {daAba.length === 0 && !carregando && !erroLista ? <Text style={styles.vazio}>Nenhuma categoria cadastrada.</Text> : null}
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
  textoPendente: { color: '#FCD34D', fontSize: 12, fontStyle: 'italic' },
  vazio: { color: colors.textMuted, textAlign: 'center', marginVertical: 20 },
  nota: { color: colors.textMuted, fontSize: 12, paddingHorizontal: 18, marginTop: 6 },
});
