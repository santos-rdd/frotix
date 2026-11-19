import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import ScreenHeader from '../../components/screenHeader/screenHeader.js';
import FilterSearchBar from '../../components/filterSearchBar/filterSearchBar.js';
import VoltarButton from '../../components/voltarButton/voltarButton.js';
import BottomNavigation from '../../components/bottomNavigation/bottomNavigation.js';
import { colors } from '../../constants/theme.js';
import { veiculos, STATUS_VEICULO, formatarKm, formatarMoeda } from '../../constants/frotaMock.js';

// Normaliza para a busca ignorar maiúsculas, acentos e o hífen da placa.
const normalizar = (texto) =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/-/g, '').toLowerCase();

export default function Veiculos({ navigation, route }) {
  const usuario = route?.params?.usuario;
  const [filtro, setFiltro] = useState('todos');
  const [busca, setBusca] = useState('');
  const [, setAtualizacao] = useState(0);

  // Ao voltar do cadastro ou da manutenção, redesenha a lista com os dados novos.
  useEffect(() => navigation.addListener('focus', () => setAtualizacao((n) => n + 1)), [navigation]);

  const contar = (status) => veiculos.filter((v) => v.status === status).length;
  const filtros = [
    { id: 'todos', label: 'Todos', total: veiculos.length },
    ...Object.entries(STATUS_VEICULO).map(([id, s]) => ({ id, label: s.label, cor: s.cor, total: contar(id) })),
  ];

  const termo = normalizar(busca);
  const lista = veiculos.filter(
    (v) =>
      (filtro === 'todos' || v.status === filtro) &&
      (!termo || normalizar(v.placa).includes(termo) || normalizar(v.modelo).includes(termo))
  );

  // Atalho do rodapé de cada card, conforme o status do veículo.
  const atalho = (v) => {
    if (v.status === 'em_viagem') {
      return { label: 'Ver viagem atual', onPress: () => navigation.navigate('Viagens', { usuario }) };
    }
    if (v.status === 'disponivel') {
      return { label: 'Novo Despacho', onPress: () => navigation.navigate('Viagens', { usuario, veiculoId: v.id }) };
    }
    return {
      label: 'Ordens de Serviço',
      onPress: () => navigation.navigate('Manutencao', { usuario, veiculoId: v.id }),
    };
  };

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
        <ScreenHeader usuario={usuario} titulo="Veículos" />

        <FilterSearchBar
          filtros={filtros}
          filtroAtivo={filtro}
          onFiltrar={setFiltro}
          busca={busca}
          onBuscar={setBusca}
          placeholder="Placa ou modelo..."
          botaoLabel="Cadastrar veículo"
          onBotao={() => navigation.navigate('CadastroVeiculo', { usuario })}
        />

        <Text style={styles.subtitulo}>Lista de Veículos</Text>

        {lista.map((v) => {
          const status = STATUS_VEICULO[v.status];
          const acao = atalho(v);
          return (
            <View key={v.id} style={styles.card}>
              <View style={styles.foto}>
                <MaterialCommunityIcons name="truck-outline" size={36} color="#121212" />
                <View style={styles.fotoLinha} />
                <View style={[styles.fotoLinha, styles.fotoLinhaCurta]} />
              </View>

              <View style={styles.info}>
                <View style={styles.infoTopo}>
                  <View style={styles.flex}>
                    <Text style={styles.modelo}>{v.modelo}</Text>
                    <Text style={styles.placa}>{v.placa}</Text>
                  </View>
                  <View style={[styles.selo, { backgroundColor: status.cor }]}>
                    <Text style={styles.seloTexto}>{status.label.toUpperCase()}</Text>
                  </View>
                </View>

                <View style={styles.hodometroLinha}>
                  <Text style={styles.rotulo}>Hodômetro:</Text>
                  <View style={styles.alinhaDireita}>
                    <Text style={styles.km}>{formatarKm(v.hodometro)}</Text>
                    <Text style={styles.custo}>
                      <Text style={styles.custoRotulo}>Custo </Text>
                      {formatarMoeda(v.custoKm)} / km
                    </Text>
                  </View>
                </View>

                <View style={styles.divisor} />
                <TouchableOpacity onPress={acao.onPress}>
                  <Text style={styles.atalho}>{acao.label} {'>'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {lista.length === 0 ? <Text style={styles.vazio}>Nenhum veículo encontrado.</Text> : null}

        <VoltarButton navigation={navigation} />
      </ScrollView>

      <BottomNavigation navigation={navigation} userRole={usuario?.role} usuario={usuario} />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.background },
  conteudo: { paddingBottom: 150 },
  subtitulo: { color: '#FFF', fontSize: 16, paddingHorizontal: 18, marginTop: 28, marginBottom: 10 },
  card: {
    flexDirection: 'row',
    backgroundColor: '#1F2156',
    borderWidth: 1,
    borderColor: colors.primaryBlue,
    borderRadius: 4,
    padding: 6,
    marginHorizontal: 18,
    marginBottom: 18,
  },
  foto: {
    width: 110,
    height: 110,
    backgroundColor: '#E5E7EB',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fotoLinha: { width: 80, height: 1, backgroundColor: '#121212', marginTop: 12 },
  fotoLinhaCurta: { width: 48, marginTop: 8, alignSelf: 'flex-start', marginLeft: 15 },
  info: { flex: 1, paddingLeft: 12, paddingTop: 8 },
  infoTopo: { flexDirection: 'row', alignItems: 'flex-start' },
  modelo: { color: '#FFF', fontSize: 16 },
  placa: { color: '#DDD', fontSize: 12 },
  selo: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  seloTexto: { color: '#FFF', fontSize: 9 },
  hodometroLinha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 10 },
  rotulo: { color: '#FFF', fontSize: 12 },
  alinhaDireita: { alignItems: 'flex-end' },
  km: { color: '#FFF', fontSize: 13 },
  custo: { color: '#FFF', fontSize: 10 },
  custoRotulo: { color: colors.primaryBlue },
  divisor: { height: 2, backgroundColor: '#AAA', marginTop: 4, marginBottom: 6 },
  atalho: { color: '#FFF', fontSize: 12, textAlign: 'right' },
  vazio: { color: colors.textMuted, textAlign: 'center', marginVertical: 20 },
});
