import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

import ScreenHeader from '../../components/screenHeader/screenHeader.js';
import DonutChart from '../../components/donutChart/donutChart.js';
import MetricCard from '../../components/metricCard/metricCard.js';
import QuickActionsCards from '../../components/quickActionsCards/quickActionsCards.js';
import KmGauge from '../../components/kmGauge/kmGauge.js';
import BottomNavigation from '../../components/bottomNavigation/bottomNavigation.js';
import { colors } from '../../constants/theme.js';
import { veiculos, resumoFrota, formatarMoeda } from '../../constants/frotaMock.js';

// Cores do donut conforme o Figma (diferentes dos selos de status das listas).
const FATIAS = [
  { id: 'em_viagem', label: 'Em viagem', color: '#E5E7EB' },
  { id: 'manutencao', label: 'Manutenção', color: '#D32F2F' },
  { id: 'disponivel', label: 'Disponível', color: '#1E2A78' },
];

const emBreve = (nome) => Alert.alert(nome, 'Esta funcionalidade ainda está em desenvolvimento.');

// Rótulo "últimos 7 dias ≡" do Figma (filtro de período, ainda só visual).
const Periodo = ({ style }) => (
  <View style={[styles.periodo, style]}>
    <Text style={styles.periodoTexto}>últimos 7 dias</Text>
    <Feather name="filter" size={12} color="#FFF" />
  </View>
);

/**
 * Home do Gestor de Frota (perfil 2).
 * Pode ser aberta como rota ("GestorHome", com params.usuario) ou renderizada
 * dentro da HomePage, que passa `usuario` direto por props.
 */
export default function GestorHome({ navigation, route, usuario: usuarioProp }) {
  const usuario = usuarioProp || route?.params?.usuario;
  const [atalhoSelecionado, setAtalhoSelecionado] = useState('frota');

  const contar = (status) => veiculos.filter((v) => v.status === status).length;
  const fatias = FATIAS.map((f) => ({ ...f, value: contar(f.id) }));
  const legenda = ['disponivel', 'em_viagem', 'manutencao'].map((id) => fatias.find((f) => f.id === id));
  const percentual = (valor) => `${Math.round((valor / veiculos.length) * 100)}%`;
  const custoMedioKm = veiculos.reduce((soma, v) => soma + v.custoKm, 0) / veiculos.length;

  const ir = (tela, params = {}) => navigation.navigate(tela, { usuario, ...params });

  const atalhos = [
    { id: 'frota', name: 'Frota', icon: <MaterialCommunityIcons name="truck-outline" size={24} color="#121212" />, tela: 'Veiculos' },
    { id: 'rotas', name: 'Rotas', icon: <Feather name="map-pin" size={22} color="#121212" />, tela: 'Rotas' },
  ];

  const grade = [
    { id: 'cadVeiculo', name: 'Cadastrar\nVeículo', icon: <MaterialCommunityIcons name="truck-outline" size={28} color="#121212" />, onPress: () => emBreve('Cadastrar Veículo') },
    { id: 'novaRota', name: 'Nova\nRota', icon: <Feather name="map" size={24} color="#121212" />, onPress: () => emBreve('Nova Rota') },
    { id: 'viagem', name: 'Registrar\nViagem', icon: <Feather name="navigation" size={24} color="#121212" />, onPress: () => ir('Viagens') },
    { id: 'relatorios', name: 'Relatórios', icon: <Feather name="edit" size={24} color="#121212" />, onPress: () => emBreve('Relatórios') },
    { id: 'manutencao', name: 'Agendar\nManutenção', icon: <MaterialCommunityIcons name="calendar-clock-outline" size={26} color="#121212" />, onPress: () => emBreve('Agendar Manutenção') },
  ];

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.conteudo}>
        <ScreenHeader usuario={usuario} />

        <View style={styles.tituloLinha}>
          <Text style={styles.secaoTitulo}>Resumo Geral</Text>
          <Periodo />
        </View>

        <View style={styles.cardStatus}>
          <Periodo style={styles.periodoCard} />
          <View style={styles.tituloLinha2}>
            <View>
              <Text style={styles.cardTitulo}>Status da Frota</Text>
              <Text style={styles.cardSubtitulo}>porcentagem atual</Text>
            </View>
            <Feather name="more-horizontal" size={22} color="#FFF" />
          </View>

          <View style={styles.legendaTopo}>
            {legenda.map((f) => (
              <View key={f.id} style={styles.legendaItem}>
                <View style={[styles.bolinha, { backgroundColor: f.color }]} />
                <Text style={styles.legendaTexto}>{f.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.graficoLinha}>
            <DonutChart
              data={fatias}
              radius={85}
              innerRadius={58}
              innerCircleColor={colors.primaryBlue}
              trackColor="transparent"
            />
            <View style={styles.percentuais}>
              {legenda.map((f) => (
                <View key={f.id} style={styles.legendaItem}>
                  <View style={[styles.bolinha, { backgroundColor: f.color }]} />
                  <Text style={styles.percentualTexto}>{percentual(f.value)}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.metricas}>
          <MetricCard value={String(contar('em_viagem'))} title={'Veículos em\nrota'} />
          <MetricCard value={`${resumoFrota.kmRodadosMes.toLocaleString('pt-BR')}\nkm`} title="rodados" />
          <MetricCard value={formatarMoeda(custoMedioKm)} title="Custo por km" />
        </View>

        <Text style={[styles.secaoTitulo, styles.acoesTitulo]}>Ações Rápidas</Text>
        <View style={styles.atalhos}>
          {atalhos.map((a) => (
            <QuickActionsCards
              key={a.id}
              id={a.id}
              name={a.name}
              icon={a.icon}
              selectCardPass={atalhoSelecionado === a.id ? a.id : null}
              onPress={() => {
                setAtalhoSelecionado(a.id);
                ir(a.tela);
              }}
            />
          ))}
        </View>

        <View style={styles.grade}>
          {grade.map((g) => (
            <TouchableOpacity key={g.id} style={styles.gradeItem} onPress={g.onPress} activeOpacity={0.8}>
              {g.icon}
              <Text style={styles.gradeTexto}>{g.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Periodo style={styles.periodoGauge} />
        <KmGauge valor={resumoFrota.kmRodadosMes} meta={resumoFrota.metaKmMes} />

        <TouchableOpacity style={styles.botaoViagens} onPress={() => ir('Viagens', { modo: 'motorista' })}>
          <Text style={styles.botaoViagensTexto}>Minhas Viagens</Text>
        </TouchableOpacity>
      </ScrollView>

      <BottomNavigation navigation={navigation} userRole={2} usuario={usuario} />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  conteudo: { paddingBottom: 150 },
  tituloLinha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 32,
    marginBottom: 16,
  },
  secaoTitulo: { color: '#FFF', fontSize: 22 },
  periodo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  periodoTexto: { color: '#FFF', fontSize: 12 },
  cardStatus: {
    backgroundColor: colors.primaryBlue,
    borderRadius: 8,
    padding: 24,
    paddingTop: 16,
    marginHorizontal: 8,
  },
  periodoCard: { alignSelf: 'flex-end' },
  tituloLinha2: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  cardTitulo: { color: '#FFF', fontSize: 22 },
  cardSubtitulo: { color: '#FFF', fontSize: 15, marginTop: 2 },
  legendaTopo: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 18, marginBottom: 24 },
  legendaItem: { flexDirection: 'row', alignItems: 'center' },
  bolinha: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  legendaTexto: { color: '#FFF', fontSize: 12 },
  graficoLinha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  percentuais: { gap: 14, marginRight: 24 },
  percentualTexto: { color: '#FFF', fontSize: 13 },
  metricas: { flexDirection: 'row', paddingHorizontal: 4, marginTop: 12 },
  acoesTitulo: { paddingHorizontal: 16, marginTop: 32, marginBottom: 12 },
  atalhos: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 8 },
  grade: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 6,
    marginTop: 36,
  },
  gradeItem: {
    width: '31%',
    height: 108,
    backgroundColor: '#E5E7EB',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  gradeTexto: { color: '#121212', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  periodoGauge: { alignSelf: 'flex-end', marginRight: 16, marginTop: 20, marginBottom: 8 },
  botaoViagens: {
    backgroundColor: colors.primaryBlue,
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
  },
  botaoViagensTexto: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
