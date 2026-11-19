import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import ScreenHeader from '../../components/screenHeader/screenHeader.js';
import SelectField from '../../components/selectField/selectField.js';
import {
  CardFormulario, CampoTexto, EscolhaChips, BotoesFormulario,
} from '../../components/formularioFrota/formularioFrota.js';
import VoltarButton from '../../components/voltarButton/voltarButton.js';
import BottomNavigation from '../../components/bottomNavigation/bottomNavigation.js';
import { colors } from '../../constants/theme.js';
import {
  veiculos, buscarVeiculo, manutencoes as manutencoesIniciais, adicionarManutencao,
  TIPOS_MANUTENCAO, STATUS_MANUTENCAO, labelTipoManutencao, dataValida, formatarData, formatarMoeda,
} from '../../constants/frotaMock.js';

const hoje = () => new Date().toLocaleDateString('pt-BR');
const paraNumero = (texto) => Number(texto.replace(/\./g, '').replace(',', '.'));

/**
 * Agendar manutenção + Ordens de Serviço (Gestor de Frota).
 * - Ação rápida "Agendar Manutenção" da Home: abre com o formulário.
 * - Atalho "Ordens de Serviço" do card do veículo: params.veiculoId filtra a lista
 *   e já deixa o veículo escolhido no formulário.
 * Iniciar uma OS coloca o veículo "Em manutenção"; concluir devolve como "Disponível".
 */
export default function Manutencao({ navigation, route }) {
  const usuario = route?.params?.usuario;
  const veiculoInicial = route?.params?.veiculoId || null;

  const [ordens, setOrdens] = useState(manutencoesIniciais);
  const [filtroVeiculo, setFiltroVeiculo] = useState(veiculoInicial);

  const [veiculoId, setVeiculoId] = useState(veiculoInicial);
  const [tipo, setTipo] = useState('preventiva');
  const [data, setData] = useState(hoje());
  const [oficina, setOficina] = useState('');
  const [custo, setCusto] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [erros, setErros] = useState({});

  const opcoesVeiculo = veiculos.map((v) => ({ id: v.id, label: `${v.modelo} · ${v.placa}` }));

  const limpar = () => {
    setVeiculoId(veiculoInicial);
    setTipo('preventiva');
    setData(hoje());
    setOficina('');
    setCusto('');
    setObservacoes('');
    setErros({});
  };

  const agendar = () => {
    const novos = {};
    if (!veiculoId) novos.veiculo = 'Selecione o veículo.';
    if (!dataValida(data)) novos.data = 'Data inválida. Use DD/MM/AAAA.';
    if (!oficina.trim()) novos.oficina = 'Informe a oficina ou o responsável.';
    if (custo && (Number.isNaN(paraNumero(custo)) || paraNumero(custo) < 0)) {
      novos.custo = 'Informe um valor válido (ex.: 1500,00).';
    }
    setErros(novos);
    if (Object.keys(novos).length) return;

    const nova = adicionarManutencao({
      veiculoId,
      tipo,
      data,
      oficina: oficina.trim(),
      custo: custo ? paraNumero(custo) : 0,
      observacoes: observacoes.trim(),
    });
    setOrdens([...manutencoesIniciais]);
    limpar();
    Alert.alert('Manutenção agendada', `${labelTipoManutencao(nova.tipo)} em ${nova.data}.`);
  };

  // Avança o status da OS e ajusta o status do veículo.
  const avancar = (ordem) => {
    const proximo = ordem.status === 'agendada' ? 'em_andamento' : 'concluida';
    const veiculo = buscarVeiculo(ordem.veiculoId);
    const aplicar = () => {
      ordem.status = proximo;
      if (veiculo) veiculo.status = proximo === 'em_andamento' ? 'manutencao' : 'disponivel';
      setOrdens([...manutencoesIniciais]);
    };
    if (proximo === 'em_andamento' && veiculo?.status === 'em_viagem') {
      Alert.alert('Veículo em viagem', 'Feche a viagem atual antes de iniciar a manutenção.');
      return;
    }
    Alert.alert(
      proximo === 'em_andamento' ? 'Iniciar manutenção' : 'Concluir manutenção',
      proximo === 'em_andamento'
        ? `O veículo ${veiculo?.placa} ficará "Em manutenção".`
        : `O veículo ${veiculo?.placa} voltará a ficar "Disponível".`,
      [{ text: 'Cancelar', style: 'cancel' }, { text: 'Confirmar', onPress: aplicar }]
    );
  };

  const lista = ordens.filter((o) => !filtroVeiculo || o.veiculoId === filtroVeiculo);
  const veiculoFiltrado = buscarVeiculo(filtroVeiculo);

  return (
    <>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.container} contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
          <ScreenHeader usuario={usuario} titulo="Agendar Manutenção" />

          <CardFormulario>
            <SelectField label="VEÍCULO" opcoes={opcoesVeiculo} valor={veiculoId} onSelecionar={setVeiculoId} />
            {erros.veiculo ? <Text style={styles.erro}>{erros.veiculo}</Text> : null}
            <EscolhaChips label="TIPO DE SERVIÇO" opcoes={TIPOS_MANUTENCAO} valor={tipo} onSelecionar={setTipo} />
            <CampoTexto
              label="DATA"
              value={data}
              onChangeText={(t) => setData(formatarData(t))}
              placeholder="DD/MM/AAAA"
              keyboardType="numeric"
              maxLength={10}
              erro={erros.data}
            />
            <CampoTexto label="OFICINA / RESPONSÁVEL" value={oficina} onChangeText={setOficina} placeholder="Ex.: Oficina Central" erro={erros.oficina} />
            <CampoTexto
              label="CUSTO ESTIMADO (R$, opcional)"
              value={custo}
              onChangeText={(t) => setCusto(t.replace(/[^0-9,.]/g, ''))}
              placeholder="1500,00"
              keyboardType="decimal-pad"
              erro={erros.custo}
            />
            <CampoTexto
              label="OBSERVAÇÕES (opcional)"
              value={observacoes}
              onChangeText={setObservacoes}
              placeholder="Descreva o serviço"
              multiline
            />
            <BotoesFormulario onCancelar={limpar} onConfirmar={agendar} confirmarLabel="Agendar" />
          </CardFormulario>

          <View style={styles.tituloLinha}>
            <Text style={styles.subtitulo}>
              Ordens de Serviço{veiculoFiltrado ? ` · ${veiculoFiltrado.placa}` : ''}
            </Text>
            {filtroVeiculo ? (
              <TouchableOpacity onPress={() => setFiltroVeiculo(null)}>
                <Text style={styles.verTodas}>Ver todas</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {lista.map((o) => {
            const veiculo = buscarVeiculo(o.veiculoId);
            const status = STATUS_MANUTENCAO[o.status];
            return (
              <View key={o.id} style={styles.card}>
                <View style={styles.cardTopo}>
                  <MaterialCommunityIcons name="wrench-outline" size={22} color="#FFF" />
                  <View style={styles.flex}>
                    <Text style={styles.cardTitulo}>{labelTipoManutencao(o.tipo)}</Text>
                    <Text style={styles.cardSub}>
                      {veiculo ? `${veiculo.modelo} · ${veiculo.placa}` : 'Veículo removido'}
                    </Text>
                  </View>
                  <View style={[styles.selo, { backgroundColor: status.cor }]}>
                    <Text style={styles.seloTexto}>{status.label.toUpperCase()}</Text>
                  </View>
                </View>

                <View style={styles.linhaInfo}>
                  <Text style={styles.info}>Data: {o.data}</Text>
                  <Text style={styles.info}>{formatarMoeda(o.custo)}</Text>
                </View>
                <Text style={styles.info}>Oficina: {o.oficina}</Text>
                {o.observacoes ? <Text style={styles.obs}>{o.observacoes}</Text> : null}

                {o.status !== 'concluida' ? (
                  <TouchableOpacity style={styles.botaoAcao} onPress={() => avancar(o)}>
                    <Text style={styles.botaoAcaoTexto}>
                      {o.status === 'agendada' ? 'Iniciar manutenção' : 'Concluir manutenção'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })}

          {lista.length === 0 ? <Text style={styles.vazio}>Nenhuma ordem de serviço.</Text> : null}

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
  erro: { color: '#FFCDD2', fontSize: 12, marginTop: -8, marginBottom: 12 },
  tituloLinha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    marginTop: 12,
    marginBottom: 10,
  },
  subtitulo: { color: '#FFF', fontSize: 16 },
  verTodas: { color: colors.primaryBlue, fontSize: 13, fontWeight: '600' },
  card: {
    backgroundColor: '#1F2156',
    borderWidth: 1,
    borderColor: colors.primaryBlue,
    borderRadius: 8,
    padding: 14,
    marginHorizontal: 18,
    marginBottom: 14,
  },
  cardTopo: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  cardTitulo: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  cardSub: { color: '#CCC', fontSize: 12 },
  selo: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  seloTexto: { color: '#FFF', fontSize: 9 },
  linhaInfo: { flexDirection: 'row', justifyContent: 'space-between' },
  info: { color: '#FFF', fontSize: 12, marginBottom: 4 },
  obs: { color: '#AAA', fontSize: 12, fontStyle: 'italic', marginTop: 2 },
  botaoAcao: {
    backgroundColor: '#E5E7EB',
    borderRadius: 20,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  botaoAcaoTexto: { color: '#121212', fontSize: 13, fontWeight: '700' },
  vazio: { color: colors.textMuted, textAlign: 'center', marginVertical: 20 },
});
