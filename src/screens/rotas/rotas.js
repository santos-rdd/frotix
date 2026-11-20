import React, { useState } from 'react';
import { Text, ScrollView, StyleSheet } from 'react-native';

import ScreenHeader from '../../components/screenHeader/screenHeader.js';
import FilterSearchBar from '../../components/filterSearchBar/filterSearchBar.js';
import TripCard from '../../components/tripCard/tripCard.js';
import VoltarButton from '../../components/voltarButton/voltarButton.js';
import BottomNavigation from '../../components/bottomNavigation/bottomNavigation.js';
import { colors } from '../../constants/theme.js';
import { STATUS_ROTA, formatarKm } from '../../constants/frota.js';
import { listarRotas } from '../../services/frotix.js';
import useDados from '../../hooks/useDados.js';
import EstadoDados from '../../components/estadoDados/estadoDados.js';

const TITULOS = {
  em_transito: 'ROTA EM TRÂNSITO',
  agendada: 'ROTA AGENDADA',
  concluida: 'ROTA CONCLUÍDA',
};

const normalizar = (texto) =>
  String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/-/g, '').toLowerCase();

export default function Rotas({ navigation, route }) {
  const usuario = route?.params?.usuario;
  // Erro P6: as rotas vêm do banco e recarregam ao voltar do cadastro ou dos detalhes.
  const { dados, carregando, erro, recarregar } = useDados(listarRotas, []);
  const rotas = dados || [];
  const [filtro, setFiltro] = useState('todos');
  const [busca, setBusca] = useState('');

  const filtros = [
    { id: 'todos', label: 'Todos' },
    { id: 'em_transito', label: 'Em trânsito', cor: STATUS_ROTA.em_transito.cor },
    { id: 'agendada', label: 'Agendadas', cor: '#E6C84A' },
    { id: 'concluida', label: 'Concluídas', cor: STATUS_ROTA.concluida.cor },
  ];

  const termo = normalizar(busca);
  const lista = rotas.filter((r) => {
    if (filtro !== 'todos' && r.status !== filtro) return false;
    if (!termo) return true;
    return [r.placa, r.origem, r.destino, r.motorista].some((campo) => normalizar(campo).includes(termo));
  });

  const infoHodometro = (r) =>
    r.hodometroFinal
      ? `Hodômetro: ${r.hodometroFinal.toLocaleString('pt-BR')}\n${formatarKm(r.kmRodados)} rodados`
      : r.distanciaPrevistaKm
      ? `Hodômetro:\n${formatarKm(r.hodometroInicial)} inicial\nPrevisto: ~${formatarKm(r.distanciaPrevistaKm)}`
      : `Hodômetro:\n${formatarKm(r.hodometroInicial)} inicial`;

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
        <ScreenHeader usuario={usuario} titulo="Rotas" />

        <FilterSearchBar
          filtros={filtros}
          filtroAtivo={filtro}
          onFiltrar={setFiltro}
          busca={busca}
          onBuscar={setBusca}
          placeholder="Placa ou cidade..."
          botaoLabel="Cadastrar rota"
          onBotao={() => navigation.navigate('CadastroRota', { usuario })}
        />

        <Text style={styles.subtitulo}>Lista de Rotas</Text>

        <EstadoDados carregando={carregando} erro={erro} onTentarDeNovo={recarregar} temDados={rotas.length > 0} />

        {lista.map((r) => (
          <TripCard
            key={r.id}
            titulo={TITULOS[r.status]}
            status={STATUS_ROTA[r.status]}
            origem={r.origem}
            destino={r.destino}
            placa={r.placa || 'Sem veículo'}
            motorista={r.motorista}
            infoDireita={infoHodometro(r)}
            onPress={() => navigation.navigate('DetalhesRota', { usuario, rota: r })}
          />
        ))}

        {lista.length === 0 && !carregando && !erro ? <Text style={styles.vazio}>Nenhuma rota encontrada.</Text> : null}

        <VoltarButton navigation={navigation} />
      </ScrollView>

      <BottomNavigation navigation={navigation} userRole={usuario?.role} usuario={usuario} />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  conteudo: { paddingBottom: 150 },
  subtitulo: { color: '#FFF', fontSize: 16, paddingHorizontal: 18, marginTop: 28, marginBottom: 10 },
  vazio: { color: colors.textMuted, textAlign: 'center', marginVertical: 20 },
});
