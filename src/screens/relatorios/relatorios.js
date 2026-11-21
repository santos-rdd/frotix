import React, { useCallback, useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';

import ScreenHeader from '../../components/screenHeader/screenHeader.js';
import VoltarButton from '../../components/voltarButton/voltarButton.js';
import BottomNavigation from '../../components/bottomNavigation/bottomNavigation.js';
import { colors } from '../../constants/theme.js';
import { STATUS_ROTA, formatarKm, formatarMoeda } from '../../constants/frota.js';
import { relatorio as buscarRelatorio } from '../../services/frotix.js';
import useDados from '../../hooks/useDados.js';
import EstadoDados from '../../components/estadoDados/estadoDados.js';
import FluxoMensalChart from '../../components/fluxoMensalChart/fluxoMensalChart.js';
import { gerarXlsx } from '../../utils/xlsx.js';

const PERIODOS = [
  { id: '30', label: 'Últimos 30 dias', dias: 30 },
  { id: '90', label: 'Últimos 90 dias', dias: 90 },
  { id: 'tudo', label: 'Tudo', dias: null },
];

// Relatório vazio, mostrado enquanto os dados do servidor não chegam.
const RELATORIO_VAZIO = {
  rotasPeriodo: [], manutencoesPeriodo: [], receita: 0, despesasViagem: 0, custoManutencao: 0,
  despesas: 0, saldo: 0, margem: 0, kmRodados: 0, custoKm: 0, porStatus: [], ranking: [], rankingRotas: [], porMes: [],
};

// Põe nome e cor de cada status (o backend manda só o id e o total).
const completarStatus = (porStatus) =>
  porStatus.map((s) => ({ ...s, label: STATUS_ROTA[s.id]?.label || s.id, cor: STATUS_ROTA[s.id]?.cor || '#888' }));

// Nome do arquivo exportado, ex.: relatorio-frotix-2026-11-19.pdf
const nomeArquivo = (extensao) => `relatorio-frotix-${new Date().toISOString().slice(0, 10)}.${extensao}`;

// Monta o HTML usado para gerar o PDF.
function gerarHtml(rel, periodoLabel) {
  const linhasRotas = rel.rotasPeriodo
    .map((r) => {
      const gasto = r.despesas.reduce((s, d) => s + d.valor, 0);
      return `<tr><td>${r.dataInicial || '-'}</td><td>${r.origem} → ${r.destino}</td><td>${
        r.placa || '-'
      }</td><td>${STATUS_ROTA[r.status].label}</td><td>${formatarMoeda(r.receita)}</td><td>${formatarMoeda(gasto)}</td></tr>`;
    })
    .join('');
  const linhasRanking = rel.ranking
    .map((v, i) => `<tr><td>${i + 1}º</td><td>${v.modelo}</td><td>${v.placa}</td><td>${formatarMoeda(v.custoKm)} / km</td></tr>`)
    .join('');
  const linhasRankingRotas = (rel.rankingRotas || [])
    .map((r, i) => `<tr><td>${i + 1}º</td><td>${r.trajeto}</td><td>${r.viagens}</td><td>${formatarMoeda(r.saldo)}</td><td>${r.margem}%</td><td>${formatarMoeda(r.custoKm)} / km</td></tr>`)
    .join('');
  const linhasMes = (rel.porMes || [])
    .map((m) => `<tr><td>${m.rotulo}</td><td>${formatarMoeda(m.entradas)}</td><td>${formatarMoeda(m.saidas)}</td><td>${formatarMoeda(m.resultado)}</td></tr>`)
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
    <p>Despesas lançadas: ${formatarMoeda(rel.despesasViagem)} · Manutenção: ${formatarMoeda(rel.custoManutencao)}</p>
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
    <h3>Ranking por rota (margem)</h3>
    <table><tr><th>#</th><th>Trajeto</th><th>Viagens</th><th>Saldo</th><th>Margem</th><th>Custo</th></tr>${linhasRankingRotas}</table>
    <h3>Fluxo de caixa mensal (pago/recebido)</h3>
    <table><tr><th>Mês</th><th>Entradas</th><th>Saídas</th><th>Resultado</th></tr>${linhasMes}</table>
  </body></html>`;
}

// Planilha Excel (.xlsx) com uma aba para cada parte do relatório.
function gerarPlanilha(rel, periodoLabel) {
  const t = (v) => ({ v, negrito: true });
  const moeda = (v) => ({ v: Number(v) || 0, moeda: true });
  return gerarXlsx([
    {
      nome: 'Resumo',
      larguras: [26, 18],
      linhas: [
        [t('Relatório FrotiX'), periodoLabel],
        ['Gerado em', new Date().toLocaleString('pt-BR')],
        [],
        [t('Financeiro')],
        ['Receita', moeda(rel.receita)],
        ['Despesas lançadas', moeda(rel.despesasViagem)],
        ['Manutenção', moeda(rel.custoManutencao)],
        ['Despesas totais', moeda(rel.despesas)],
        [t('Saldo líquido'), { ...moeda(rel.saldo), negrito: true }],
        ['Margem (%)', rel.margem],
        [],
        [t('Operacional')],
        ['Km rodados', Number(rel.kmRodados) || 0],
        ['Custo por km', moeda(rel.custoKm)],
        ['Rotas no período', rel.rotasPeriodo.length],
      ],
    },
    {
      nome: 'Rotas',
      larguras: [12, 22, 22, 11, 20, 13, 14, 14, 14, 10],
      linhas: [
        ['Data', 'Origem', 'Destino', 'Placa', 'Motorista', 'Status', 'Receita', 'Custos', 'Saldo', 'Km'].map(t),
        ...rel.rotasPeriodo.map((r) => {
          const custos = r.custos ?? r.despesas.reduce((s, d) => s + d.valor, 0);
          return [
            r.dataInicial || '',
            r.origem,
            r.destino,
            r.placa || '',
            r.motorista,
            STATUS_ROTA[r.status]?.label || r.status,
            moeda(r.receita),
            moeda(custos),
            moeda(r.saldo ?? r.receita - custos),
            Number(r.kmRodados) || 0,
          ];
        }),
      ],
    },
    {
      nome: 'Ranking veículos',
      larguras: [6, 22, 12, 14, 14, 12],
      linhas: [
        ['#', 'Modelo', 'Placa', 'Custo/km', 'Gastos', 'Km'].map(t),
        ...rel.ranking.map((v, i) => [i + 1, v.modelo, v.placa, moeda(v.custoKm), moeda(v.gastos), Number(v.kmRodados) || 0]),
      ],
    },
    {
      nome: 'Ranking rotas',
      larguras: [6, 34, 10, 14, 14, 14, 10, 12],
      linhas: [
        ['#', 'Trajeto', 'Viagens', 'Receita', 'Custos', 'Saldo', 'Margem %', 'Custo/km'].map(t),
        ...(rel.rankingRotas || []).map((r, i) => [i + 1, r.trajeto, r.viagens, moeda(r.receita), moeda(r.custos), moeda(r.saldo), r.margem, moeda(r.custoKm)]),
      ],
    },
    {
      nome: 'Fluxo mensal',
      larguras: [10, 16, 16, 16],
      linhas: [
        ['Mês', 'Entradas', 'Saídas', 'Resultado'].map(t),
        ...(rel.porMes || []).map((m) => [m.rotulo, moeda(m.entradas), moeda(m.saidas), moeda(m.resultado)]),
      ],
    },
    {
      nome: 'Manutenções',
      larguras: [12, 20, 24, 14, 14],
      linhas: [
        ['Data', 'Tipo', 'Oficina', 'Status', 'Custo'].map(t),
        ...rel.manutencoesPeriodo.map((m) => [m.data, m.tipo, m.oficina, m.status, moeda(m.custo)]),
      ],
    },
  ]);
}

/**
 * Relatórios (Gestor de Frota, Admin e Financeiro): resumo financeiro e operacional
 * do período e exportação para PDF ou para planilha (CSV que abre no Excel).
 */
export default function Relatorios({ navigation, route }) {
  const usuario = route?.params?.usuario;
  const [periodo, setPeriodo] = useState(route?.params?.periodoInicial || '30');
  const [exportando, setExportando] = useState(null); // 'pdf' | 'excel' | null

  useEffect(() => {
    if (route?.params?.periodoInicial) {
      setPeriodo(route.params.periodoInicial);
    }
  }, [route?.params?.periodoInicial]);

  const periodoAtual = PERIODOS.find((p) => p.id === periodo);

  // Erro P3: os números vêm do backend, dos mesmos lançamentos usados na Home.
  const carregar = useCallback(() => buscarRelatorio(periodoAtual.dias), [periodoAtual.dias]);
  const { dados, carregando, erro, recarregar } = useDados(carregar);
  const rel = dados ? { ...dados, porStatus: completarStatus(dados.porStatus) } : RELATORIO_VAZIO;

  const trocarPeriodo = (id) => {
    if (id === periodo) return;
    setPeriodo(id);
  };

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
      // Erro C8: o PDF saía com nome aleatório; agora sai como relatorio-frotix-AAAA-MM-DD.pdf.
      let arquivoFinal = uri;
      try {
        const destino = new File(Paths.cache, nomeArquivo('pdf'));
        if (destino.exists) destino.delete();
        new File(uri).move(destino);
        arquivoFinal = destino.uri;
      } catch (e) {
        console.warn('Não foi possível renomear o PDF:', e?.message || e);
      }
      await compartilhar(arquivoFinal, 'application/pdf', 'com.adobe.pdf');
    } catch (erro) {
      Alert.alert('Erro', `Não foi possível gerar o PDF: ${erro.message || erro}`);
    } finally {
      setExportando(null);
    }
  };

  const exportarExcel = async () => {
    setExportando('excel');
    try {
      const arquivo = new File(Paths.cache, nomeArquivo('xlsx'));
      if (arquivo.exists) arquivo.delete();
      arquivo.create();
      arquivo.write(gerarPlanilha(rel, periodoAtual.label));
      await compartilhar(
        arquivo.uri,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'org.openxmlformats.spreadsheetml.sheet'
      );
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
              onPress={() => trocarPeriodo(p.id)}
            >
              <Text style={styles.chipTexto}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <EstadoDados carregando={carregando} erro={erro} onTentarDeNovo={recarregar} temDados={false} />

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
            <Text style={styles.cardAzulTexto}>Despesas lançadas</Text>
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
            <Text style={styles.metricaValor}>{Math.round(rel.kmRodados).toLocaleString('pt-BR')}</Text>
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

        <View style={styles.cardEscuro}>
          <Text style={styles.cardEscuroTitulo}>Ranking por rota</Text>
          {(rel.rankingRotas || []).length === 0 ? (
            <Text style={styles.vazio}>Nenhuma viagem concluída no período.</Text>
          ) : (
            rel.rankingRotas.map((r, i) => (
              <View key={r.trajeto} style={styles.rankingLinha}>
                <Text style={styles.rankingPosicao}>{i + 1}º</Text>
                <View style={styles.flex}>
                  <Text style={styles.rankingModelo}>{r.trajeto}</Text>
                  <Text style={styles.rankingPlaca}>{r.viagens} viagem(ns) · {formatarMoeda(r.custoKm)}/km</Text>
                </View>
                <View style={styles.alinhaDireita}>
                  <Text style={[styles.rankingCusto, { color: r.saldo >= 0 ? colors.greenSuccess : colors.redDanger }]}>{r.margem}%</Text>
                  <Text style={styles.rankingPlaca}>{formatarMoeda(r.saldo)}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        <FluxoMensalChart meses={rel.porMes} titulo="Fluxo de caixa (últimos 6 meses)" />

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
          <Text style={styles.avisoTexto}>A planilha sai em .xlsx (Excel), com uma aba para cada parte do relatório.</Text>
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
  vazio: { color: colors.textMuted, fontSize: 12 },
  alinhaDireita: { alignItems: 'flex-end' },
});
