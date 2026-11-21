import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

import ScreenHeader from '../../components/screenHeader/screenHeader.js';
import FilterSearchBar from '../../components/filterSearchBar/filterSearchBar.js';
import PrevisaoCaixaCard from '../../components/previsaoCaixaCard/previsaoCaixaCard.js';
import VoltarButton from '../../components/voltarButton/voltarButton.js';
import BottomNavigation from '../../components/bottomNavigation/bottomNavigation.js';
import EstadoDados from '../../components/estadoDados/estadoDados.js';
import { colors } from '../../constants/theme.js';
import { formatarMoeda } from '../../constants/frota.js';
import { STATUS_DIVIDA, dataIsoParaBr } from '../../constants/financeiro.js';
import { listarDividas } from '../../services/frotix.js';
import useDados from '../../hooks/useDados.js';

const normalizar = (t) => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/**
 * Dívidas e Financiamentos (Admin e Financeiro): previsão de caixa, dívidas abertas
 * com o progresso das parcelas e acesso ao detalhe (pagar parcela, cancelar dívida).
 */
export default function Dividas({ navigation, route }) {
  const usuario = route?.params?.usuario;
  const { dados, carregando, erro, recarregar } = useDados(listarDividas);
  const dividas = dados?.dividas || [];
  const totais = dados?.totais || { abertas: 0, valorRestante: 0, parcelasAtrasadas: 0 };
  const [filtro, setFiltro] = useState('abertas');
  const [busca, setBusca] = useState('');

  const contar = (f) => dividas.filter(f).length;
  const aberta = (d) => d.status === 'em_dia' || d.status === 'atrasada';
  const filtros = [
    { id: 'abertas', label: 'Abertas', total: contar(aberta) },
    { id: 'atrasada', label: 'Atrasadas', cor: STATUS_DIVIDA.atrasada.cor, total: contar((d) => d.status === 'atrasada') },
    { id: 'quitada', label: 'Quitadas', cor: STATUS_DIVIDA.quitada.cor, total: contar((d) => d.status === 'quitada') },
    { id: 'cancelada', label: 'Canceladas', cor: STATUS_DIVIDA.cancelada.cor, total: contar((d) => d.status === 'cancelada') },
  ];

  const termo = normalizar(busca);
  const lista = dividas.filter((d) => {
    if (filtro === 'abertas' ? !aberta(d) : d.status !== filtro) return false;
    return !termo || normalizar(d.descricao).includes(termo) || normalizar(d.credor).includes(termo);
  });

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
        <ScreenHeader usuario={usuario} titulo="Dívidas e Financiamentos" />

        <View style={styles.resumo}>
          <View style={styles.resumoItem}>
            <Text style={styles.resumoValor}>{totais.abertas}</Text>
            <Text style={styles.resumoRotulo}>dívidas abertas</Text>
          </View>
          <View style={styles.resumoItem}>
            <Text style={styles.resumoValor}>{formatarMoeda(totais.valorRestante)}</Text>
            <Text style={styles.resumoRotulo}>a pagar</Text>
          </View>
          <View style={styles.resumoItem}>
            <Text style={[styles.resumoValor, totais.parcelasAtrasadas > 0 && styles.vermelho]}>{totais.parcelasAtrasadas}</Text>
            <Text style={styles.resumoRotulo}>parcelas atrasadas</Text>
          </View>
        </View>

        <PrevisaoCaixaCard />

        <Text style={styles.subtitulo}>Dívidas</Text>
        <FilterSearchBar
          filtros={filtros}
          filtroAtivo={filtro}
          onFiltrar={setFiltro}
          busca={busca}
          onBuscar={setBusca}
          placeholder="Descrição ou credor..."
          botaoLabel="Nova dívida"
          onBotao={() => navigation.navigate('TransactionForm', { actionType: 'divida', amountValue: '' })}
        />

        <EstadoDados carregando={carregando} erro={erro} onTentarDeNovo={recarregar} temDados={dividas.length > 0} />

        {lista.map((d) => {
          const status = STATUS_DIVIDA[d.status];
          const progresso = d.quantidadeParcelas > 0 ? d.pagas / d.quantidadeParcelas : 0;
          return (
            <TouchableOpacity
              key={d.id}
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('DetalheDivida', { usuario, id: d.id })}
            >
              <View style={styles.cardTopo}>
                <View style={styles.flex}>
                  <Text style={styles.cardTitulo}>{d.descricao}</Text>
                  {d.credor ? <Text style={styles.cardSub}>{d.credor}</Text> : null}
                </View>
                <View style={[styles.selo, { backgroundColor: status.cor }]}>
                  <Text style={styles.seloTexto}>{status.label.toUpperCase()}</Text>
                </View>
              </View>

              <View style={styles.progressoFundo}>
                <View style={[styles.progresso, { width: `${Math.round(progresso * 100)}%` }]} />
              </View>
              <View style={styles.linha}>
                <Text style={styles.info}>{d.pagas}/{d.quantidadeParcelas} parcelas pagas</Text>
                <Text style={styles.info}>{formatarMoeda(d.valorParcela)} / mês</Text>
              </View>
              <View style={styles.linha}>
                <Text style={styles.info}>Falta: {formatarMoeda(d.valorRestante)}</Text>
                {d.proximoVencimento ? (
                  <Text style={[styles.info, d.atrasadas > 0 && styles.vermelho]}>
                    {d.atrasadas > 0 ? `${d.atrasadas} atrasada(s)` : `Próx.: ${dataIsoParaBr(d.proximoVencimento)}`}
                  </Text>
                ) : null}
              </View>
              <View style={styles.rodape}>
                <Text style={styles.link}>Ver parcelas</Text>
                <Feather name="chevron-right" size={16} color={colors.primaryBlue} />
              </View>
            </TouchableOpacity>
          );
        })}

        {lista.length === 0 && !carregando && !erro ? <Text style={styles.vazio}>Nenhuma dívida neste filtro.</Text> : null}

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
  resumo: { flexDirection: 'row', gap: 8, marginHorizontal: 16 },
  resumoItem: { flex: 1, backgroundColor: colors.cardBg, borderRadius: 12, padding: 12, alignItems: 'center' },
  resumoValor: { color: '#FFF', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  resumoRotulo: { color: colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 2 },
  vermelho: { color: '#FF8A80' },
  subtitulo: { color: '#FFF', fontSize: 18, paddingHorizontal: 18, marginTop: 24, marginBottom: 6 },
  card: {
    backgroundColor: '#1F2156',
    borderWidth: 1,
    borderColor: colors.primaryBlue,
    borderRadius: 10,
    padding: 14,
    marginHorizontal: 18,
    marginBottom: 12,
  },
  cardTopo: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  cardTitulo: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  cardSub: { color: '#CCC', fontSize: 12, marginTop: 2 },
  selo: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  seloTexto: { color: '#FFF', fontSize: 9 },
  progressoFundo: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.15)', overflow: 'hidden', marginBottom: 8 },
  progresso: { height: 8, borderRadius: 4, backgroundColor: colors.greenSuccess },
  linha: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  info: { color: '#FFF', fontSize: 12 },
  rodape: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 2, marginTop: 6 },
  link: { color: colors.primaryBlue, fontSize: 13, fontWeight: '600' },
  vazio: { color: colors.textMuted, textAlign: 'center', marginVertical: 20 },
});
