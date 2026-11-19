import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';

import ScreenHeader from '../../components/screenHeader/screenHeader.js';
import VoltarButton from '../../components/voltarButton/voltarButton.js';
import BottomNavigation from '../../components/bottomNavigation/bottomNavigation.js';
import { colors } from '../../constants/theme.js';
import {
  veiculos, rotas, manutencoes, buscarVeiculo, STATUS_ROTA, formatarKm, formatarMoeda,
} from '../../constants/frotaMock.js';

const PERIODOS = [
  { id: '30', label: 'Últimos 30 dias', dias: 30 },
  { id: '90', label: 'Últimos 90 dias', dias: 90 },
  { id: 'tudo', label: 'Tudo', dias: null },
];

// "DD/MM/AAAA" -> Date.
const paraDate = (texto) => {
  if (!texto) return null;
  const [d, m, a] = texto.split('/').map(Number);
  return new Date(a, m - 1, d);
};

const dentroDoPeriodo = (texto, dias) => {
  if (!dias) return true;
  const data = paraDate(texto);
  if (!data) return false;
  const limite = new Date();
  limite.setHours(0, 0, 0, 0);
  limite.setDate(limite.getDate() - dias);
  // Datas futuras (rotas agendadas) também entram, para o gestor ver o que vem por aí.
  return data >= limite;
};

// Junta os números do relatório a partir dos dados de exemplo.
function calcularRelatorio(dias) {
  const rotasPeriodo = rotas.filter((r) => dentroDoPeriodo(r.dataInicial, dias));
  const manutencoesPeriodo = manutencoes.filter((m) => dentroDoPeriodo(m.data, dias));

  const receita = rotasPeriodo.reduce((s, r) => s + (r.receita || 0), 0);
  const despesasViagem = rotasPeriodo.reduce(
    (s, r) => s + r.despesas.reduce((sd, d) => sd + d.valor, 0),
    0
  );
  const custoManutencao = manutencoesPeriodo.reduce((s, m) => s + (m.custo || 0), 0);
  const despesas = despesasViagem + custoManutencao;
  const saldo = receita - despesas;
  const margem = receita > 0 ? Math.round((saldo / receita) * 100) : 0;

  const concluidas = rotasPeriodo.filter((r) => r.hodometroFinal);
  const kmRodados = concluidas.reduce((s, r) => s + (r.hodometroFinal - r.hodometroInicial), 0);
  const custoKm = kmRodados > 0 ? despesasViagem / kmRodados : 0;

  const porStatus = Object.keys(STATUS_ROTA).map((id) => ({
    id,
    label: STATUS_ROTA[id].label,
    cor: STATUS_ROTA[id].cor,
    total: rotasPeriodo.filter((r) => r.status === id).length,
  }));

  // Ranking: menor custo por km primeiro (mais eficiente).
  const ranking = [...veiculos]
    .filter((v) => v.custoKm > 0)
    .sort((a, b) => a.custoKm - b.custoKm)
    .slice(0, 5);

  return {
    rotasPeriodo, manutencoesPeriodo, receita, despesasViagem, custoManutencao, despesas,
    saldo, margem, kmRodados, custoKm, porStatus, ranking,
  };
}

// Monta o HTML usado para gerar o PDF.
function gerarHtml(rel, periodoLabel) {
  const linhasRotas = rel.rotasPeriodo
    .map((r) => {
      const gasto = r.despesas.reduce((s, d) => s + d.valor, 0);
      return `<tr><td>${r.dataInicial || '-'}</td><td>${r.origem} → ${r.destino}</td><td>${
        buscarVeiculo(r.veiculoId)?.placa || '-'
      }</td><td>${STATUS_ROTA[r.status].label}</td><td>${formatarMoeda(r.receita)}</td><td>${formatarMoeda(gasto)}</td></tr>`;
    })
    .join('');
  const linhasRanking = rel.ranking
    .map((v, i) => `<tr><td>${i + 1}º</td><td>${v.modelo}</td><td>${v.placa}</td><td>${formatarMoeda(v.custoKm)} / km</td></tr>`)
    .join('');

  return `
  <html><head><meta charset="utf-8" />
  <style>
    body { font-family: Helvetica, Arial, sans-serif; color: #121212; padding: 24px; }
    h1 { color: #3B56FF; margin-bottom: 4px; }
    .sub { color: #666; margin-top: 0; }
    .cards { display: flex; gap: 12px; margin: 16px 0; }
    .card { flex: 1; border: 1px solid #ddd; border-radius: 8px; padding: 10px; }
    .card b { display: block; font-size: 18px; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
    th { background: #3B56FF; color: #fff; text-align: left; padding: 6px; }
    td { border-bottom: 1px solid #eee; padding: 6px; }
  </style></head>
  <body>
    <h1>FrotiX · Relatório</h1>
    <p class="sub">${periodoLabel} · gerado em ${new Date().toLocaleString('pt-BR')}</p>
    <h2>Financeiro</h2>
    <div class="cards">
      <div class="card">Receita<b>${formatarMoeda(rel.receita)}</b></div>
      <div class="card">Despesas<b>${formatarMoeda(rel.despesas)}</b></div>
      <div class="card">Saldo líquido<b>${formatarMoeda(rel.saldo)}</b></div>
      <div class="card">Margem<b>${rel.margem}%</b></div>
    </div>
    <p>Despesas de viagem: ${formatarMoeda(rel.despesasViagem)} · Manutenção: ${formatarMoeda(rel.custoManutencao)}</p>
    <h2>Operacional</h2>
    <div class="cards">
      <div class="card">Km rodados<b>${formatarKm(rel.kmRodados)}</b></div>
      <div class="card">Custo por km<b>${formatarMoeda(rel.custoKm)}</b></div>
      <div class="card">Rotas<b>${rel.rotasPeriodo.length}</b></div>
    </div>
    <h3>Rotas</h3>
    <table><tr><th>Data</th><th>Rota</th><th>Placa</th><th>Status</th><th>Receita</th><th>Despesas</th></tr>${linhasRotas}</table>
    <h3>Ranking de eficiência (custo por km)</h3>
    <table><tr><th>#</th><th>Modelo</th><th>Placa</th><th>Custo</th></tr>${linhasRanking}</table>
  </body></html>`;
}

// CSV com ";" e BOM: o Excel em português abre direto, com acentos e colunas certas.
function gerarCsv(rel, periodoLabel) {
  const numero = (v) => Number(v).toFixed(2).replace('.', ',');
  const linhas = [
    ['Relatório FrotiX', periodoLabel],
    [],
    ['Resumo'],
    ['Receita', numero(rel.receita)],
    ['Despesas de viagem', numero(rel.despesasViagem)],
    ['Manutenção', numero(rel.custoManutencao)],
    ['Saldo líquido', numero(rel.saldo)],
    ['Margem (%)', rel.margem],
    ['Km rodados', rel.kmRodados],
    ['Custo por km', numero(rel.custoKm)],
    [],
    ['Data', 'Origem', 'Destino', 'Placa', 'Motorista', 'Status', 'Receita', 'Despesas'],
    ...rel.rotasPeriodo.map((r) => [
      r.dataInicial || '',
      r.origem,
      r.destino,
      buscarVeiculo(r.veiculoId)?.placa || '',
      r.motorista,
      STATUS_ROTA[r.status].label,
      numero(r.receita),
      numero(r.despesas.reduce((s, d) => s + d.valor, 0)),
    ]),
  ];
  const escapar = (c) => {
    const t = String(c ?? '');
    return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  return '﻿' + linhas.map((l) => l.map(escapar).join(';')).join('\n');
}

/**
 * Relatórios (Gestor de Frota, Admin e Financeiro): resumo financeiro e operacional
 * do período e exportação para PDF ou para planilha (CSV que abre no Excel).
 */
export default function Relatorios({ navigation, route }) {
  const usuario = route?.params?.usuario;
  const [periodo, setPeriodo] = useState('30');
  const [exportando, setExportando] = useState(null); // 'pdf' | 'excel' | null

  const periodoAtual = PERIODOS.find((p) => p.id === periodo);
  const rel = calcularRelatorio(periodoAtual.dias);

  const compartilhar = async (uri, mimeType, UTI) => {
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert('Arquivo gerado', `O compartilhamento não está disponível neste aparelho.\n${uri}`);
      return;
    }
    await Sharing.shareAsync(uri, { mimeType, UTI, dialogTitle: 'Exportar relatório' });
  };

  const exportarPdf = async () => {
    setExportando('pdf');
    try {
      const { uri } = await Print.printToFileAsync({ html: gerarHtml(rel, periodoAtual.label) });
      await compartilhar(uri, 'application/pdf', 'com.adobe.pdf');
    } catch (erro) {
      Alert.alert('Erro', `Não foi possível gerar o PDF: ${erro.message || erro}`);
    } finally {
      setExportando(null);
    }
  };

  const exportarExcel = async () => {
    setExportando('excel');
    try {
      const arquivo = new File(Paths.cache, `relatorio-frotix-${Date.now()}.csv`);
      arquivo.create();
      arquivo.write(gerarCsv(rel, periodoAtual.label));
      await compartilhar(arquivo.uri, 'text/csv', 'public.comma-separated-values-text');
    } catch (erro) {
      Alert.alert('Erro', `Não foi possível gerar a planilha: ${erro.message || erro}`);
    } finally {
      setExportando(null);
    }
  };

  const maiorStatus = Math.max(1, ...rel.porStatus.map((s) => s.total));

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.conteudo}>
        <ScreenHeader usuario={usuario} titulo="Relatórios" />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {PERIODOS.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[styles.chip, periodo === p.id && styles.chipAtivo]}
              onPress={() => setPeriodo(p.id)}
            >
              <Text style={styles.chipTexto}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.secao}>Financeiro</Text>
        <View style={styles.cardAzul}>
          <Text style={styles.cardAzulTitulo}>Saldo líquido</Text>
          <Text style={styles.saldo}>{formatarMoeda(rel.saldo)}</Text>
          <Text style={styles.margem}>{rel.margem}% de margem</Text>
          <View style={styles.divisor} />
          <View style={styles.linha}>
            <Text style={styles.cardAzulTexto}>Receita</Text>
            <Text style={styles.cardAzulTexto}>{formatarMoeda(rel.receita)}</Text>
          </View>
          <View style={styles.linha}>
            <Text style={styles.cardAzulTexto}>Despesas de viagem</Text>
            <Text style={styles.cardAzulTexto}>{formatarMoeda(rel.despesasViagem)}</Text>
          </View>
          <View style={styles.linha}>
            <Text style={styles.cardAzulTexto}>Manutenção</Text>
            <Text style={styles.cardAzulTexto}>{formatarMoeda(rel.custoManutencao)}</Text>
          </View>
        </View>

        <Text style={styles.secao}>Operacional</Text>
        <View style={styles.metricas}>
          <View style={styles.metrica}>
            <Text style={styles.metricaValor}>{rel.kmRodados.toLocaleString('pt-BR')}</Text>
            <Text style={styles.metricaRotulo}>km rodados</Text>
          </View>
          <View style={styles.metrica}>
            <Text style={styles.metricaValor}>{formatarMoeda(rel.custoKm)}</Text>
            <Text style={styles.metricaRotulo}>custo por km</Text>
          </View>
          <View style={styles.metrica}>
            <Text style={styles.metricaValor}>{rel.rotasPeriodo.length}</Text>
            <Text style={styles.metricaRotulo}>rotas</Text>
          </View>
        </View>

        <View style={styles.cardEscuro}>
          <Text style={styles.cardEscuroTitulo}>Rotas por status</Text>
          {rel.porStatus.map((s) => (
            <View key={s.id} style={styles.barraLinha}>
              <Text style={styles.barraRotulo}>{s.label}</Text>
              <View style={styles.barraFundo}>
                <View style={[styles.barra, { width: `${(s.total / maiorStatus) * 100}%`, backgroundColor: s.cor }]} />
              </View>
              <Text style={styles.barraValor}>{s.total}</Text>
            </View>
          ))}
        </View>

        <View style={styles.cardEscuro}>
          <Text style={styles.cardEscuroTitulo}>Ranking de eficiência</Text>
          {rel.ranking.map((v, i) => (
            <View key={v.id} style={styles.rankingLinha}>
              <Text style={styles.rankingPosicao}>{i + 1}º</Text>
              <View style={styles.flex}>
                <Text style={styles.rankingModelo}>{v.modelo}</Text>
                <Text style={styles.rankingPlaca}>{v.placa}</Text>
              </View>
              <Text style={styles.rankingCusto}>{formatarMoeda(v.custoKm)} / km</Text>
            </View>
          ))}
        </View>

        <Text style={styles.secao}>Exportar</Text>
        <View style={styles.exportar}>
          <TouchableOpacity style={[styles.botaoExportar, styles.botaoPdf]} onPress={exportarPdf} disabled={!!exportando}>
            {exportando === 'pdf' ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <MaterialCommunityIcons name="file-pdf-box" size={22} color="#FFF" />
                <Text style={styles.botaoExportarTexto}>PDF</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.botaoExportar, styles.botaoExcel]} onPress={exportarExcel} disabled={!!exportando}>
            {exportando === 'excel' ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <MaterialCommunityIcons name="microsoft-excel" size={22} color="#FFF" />
                <Text style={styles.botaoExportarTexto}>Excel</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
        <View style={styles.aviso}>
          <Feather name="info" size={14} color={colors.textMuted} />
          <Text style={styles.avisoTexto}>A planilha é gerada em CSV, que abre direto no Excel.</Text>
        </View>

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
  chips: { paddingHorizontal: 18, gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.primaryBlue,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipAtivo: { backgroundColor: colors.primaryBlue },
  chipTexto: { color: '#FFF', fontSize: 12 },
  secao: { color: '#FFF', fontSize: 18, paddingHorizontal: 18, marginTop: 24, marginBottom: 10 },
  cardAzul: { backgroundColor: colors.cardBlue, borderRadius: 16, padding: 20, marginHorizontal: 18 },
  cardAzulTitulo: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  saldo: { color: '#FFF', fontSize: 30, fontWeight: '700', marginTop: 4 },
  margem: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
  divisor: { height: 1, backgroundColor: 'rgba(255,255,255,0.3)', marginVertical: 12 },
  linha: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  cardAzulTexto: { color: '#FFF', fontSize: 13 },
  metricas: { flexDirection: 'row', gap: 10, paddingHorizontal: 18 },
  metrica: {
    flex: 1,
    backgroundColor: '#E5E7EB',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  metricaValor: { color: '#121212', fontSize: 15, fontWeight: '700' },
  metricaRotulo: { color: '#444', fontSize: 11, marginTop: 2 },
  cardEscuro: { backgroundColor: colors.cardBg, borderRadius: 16, padding: 16, marginHorizontal: 18, marginTop: 14 },
  cardEscuroTitulo: { color: '#FFF', fontSize: 15, marginBottom: 12 },
  barraLinha: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  barraRotulo: { color: '#CCC', fontSize: 12, width: 82 },
  barraFundo: { flex: 1, height: 10, backgroundColor: '#2A2A2A', borderRadius: 5, overflow: 'hidden' },
  barra: { height: 10, borderRadius: 5 },
  barraValor: { color: '#FFF', fontSize: 12, width: 20, textAlign: 'right' },
  rankingLinha: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  rankingPosicao: { color: colors.primaryBlue, fontSize: 16, fontWeight: '700', width: 28 },
  rankingModelo: { color: '#FFF', fontSize: 14 },
  rankingPlaca: { color: '#888', fontSize: 11 },
  rankingCusto: { color: '#FFF', fontSize: 13 },
  exportar: { flexDirection: 'row', gap: 12, paddingHorizontal: 18 },
  botaoExportar: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  botaoPdf: { backgroundColor: '#B71C1C' },
  botaoExcel: { backgroundColor: '#1E7E45' },
  botaoExportarTexto: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  aviso: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, marginTop: 10 },
  avisoTexto: { color: colors.textMuted, fontSize: 12, flex: 1 },
});
