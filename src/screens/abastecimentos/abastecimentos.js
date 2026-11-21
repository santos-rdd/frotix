import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import ScreenHeader from '../../components/screenHeader/screenHeader.js';
import SelectField from '../../components/selectField/selectField.js';
import { CardFormulario, CampoTexto, BotoesFormulario } from '../../components/formularioFrota/formularioFrota.js';
import BannerOffline from '../../components/bannerOffline/bannerOffline.js';
import VoltarButton from '../../components/voltarButton/voltarButton.js';
import BottomNavigation from '../../components/bottomNavigation/bottomNavigation.js';
import EstadoDados from '../../components/estadoDados/estadoDados.js';
import { colors } from '../../constants/theme.js';
import { dataValida, formatarData, formatarKm, formatarMoeda } from '../../constants/frota.js';
import { listarAbastecimentos } from '../../services/frotix.js';
import { enviarOuGuardar, listarRotasOffline, listarVeiculosOffline } from '../../services/offline.js';
import useDados from '../../hooks/useDados.js';

const hoje = () => new Date().toLocaleDateString('pt-BR');
const paraNumero = (texto) => Number(String(texto).replace(/\./g, '').replace(',', '.'));
const somenteNumeros = (texto) => texto.replace(/\D/g, '');

const carregarBase = async () => {
  const [veiculos, rotas] = await Promise.all([listarVeiculosOffline(), listarRotasOffline()]);
  return { veiculos, rotas };
};

/**
 * Abastecimentos: o motorista registra (funciona sem internet) e a gestão acompanha.
 * Cada abastecimento vira uma saída no financeiro, ligada à viagem escolhida,
 * e o consumo médio (km/l) do veículo passa a ser calculado pelos abastecimentos.
 * params.veiculoId pré-seleciona e filtra o veículo.
 */
export default function Abastecimentos({ navigation, route }) {
  const usuario = route?.params?.usuario;
  const ehMotorista = usuario?.role === 4;
  const veiculoInicial = route?.params?.veiculoId || null;

  const { dados: base, carregando, erro, recarregar } = useDados(carregarBase, { veiculos: [], rotas: [] });
  const veiculos = base?.veiculos || [];
  const rotas = base?.rotas || [];

  const [veiculoId, setVeiculoId] = useState(veiculoInicial);
  const [viagemId, setViagemId] = useState(null);
  const [data, setData] = useState(hoje());
  const [litros, setLitros] = useState('');
  const [valor, setValor] = useState('');
  const [hodometro, setHodometro] = useState('');
  const [posto, setPosto] = useState('');
  const [erros, setErros] = useState({});
  const [salvando, setSalvando] = useState(false);

  // Histórico (precisa de internet).
  const carregarHistorico = useCallback(() => listarAbastecimentos(veiculoId || undefined), [veiculoId]);
  const historico = useDados(carregarHistorico, { abastecimentos: [], consumoMedio: null });
  const primeira = useRef(true);
  useEffect(() => {
    if (primeira.current) {
      primeira.current = false;
      return;
    }
    historico.recarregar();
  }, [veiculoId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sugere a viagem em andamento do veículo e o hodômetro atual.
  const escolherVeiculo = (id) => {
    setVeiculoId(id);
    const emAndamento = rotas.find((r) => r.veiculoId === id && r.status === 'em_transito');
    setViagemId(emAndamento?.id || null);
    const v = veiculos.find((x) => x.id === id);
    if (v) setHodometro(String(Math.ceil(v.hodometro || 0) || ''));
  };

  const opcoesVeiculo = veiculos.map((v) => ({ id: v.id, label: `${v.modelo} · ${v.placa}` }));
  const opcoesViagem = [
    { id: '__nenhuma', label: 'Sem viagem' },
    ...rotas
      .filter((r) => r.status !== 'agendada' && (!veiculoId || r.veiculoId === veiculoId))
      .map((r) => ({ id: r.id, label: `${r.origem} → ${r.destino}${r.dataInicial ? ` · ${r.dataInicial}` : ''}${r.status === 'em_transito' ? ' (em andamento)' : ''}` })),
  ];

  const limpar = () => {
    setLitros('');
    setValor('');
    setPosto('');
    setHodometro('');
    setData(hoje());
    setErros({});
  };

  const salvar = async () => {
    const novos = {};
    const veiculo = veiculos.find((v) => v.id === veiculoId);
    if (!veiculoId) novos.veiculo = 'Selecione o veículo.';
    if (!dataValida(data)) novos.data = 'Data inválida. Use DD/MM/AAAA.';
    if (!(paraNumero(litros) > 0)) novos.litros = 'Informe os litros (ex.: 320,5).';
    if (!(paraNumero(valor) > 0)) novos.valor = 'Informe o valor pago (ex.: 1.850,00).';
    if (!(Number(hodometro) > 0)) novos.hodometro = 'Informe o hodômetro no momento do abastecimento.';
    else if (veiculo && Number(hodometro) < veiculo.hodometro) novos.hodometro = `O veículo já marca ${formatarKm(veiculo.hodometro)}.`;
    setErros(novos);
    if (Object.keys(novos).length || salvando) return;

    setSalvando(true);
    try {
      const r = await enviarOuGuardar(
        'abastecimento',
        {
          veiculoId,
          viagemId: viagemId && viagemId !== '__nenhuma' ? viagemId : null,
          data,
          litros: paraNumero(litros),
          valor: paraNumero(valor),
          hodometro: Number(hodometro),
          posto: posto.trim() || null,
        },
        `Abastecimento ${veiculo?.placa || ''} (${litros} l)`
      );
      limpar();
      if (r.offline) {
        Alert.alert('Salvo no celular', 'Sem internet agora. O abastecimento será enviado quando a conexão voltar.');
      } else {
        const consumo = r.resultado?.consumoMedio;
        Alert.alert('Abastecimento registrado', consumo ? `Consumo médio do veículo: ${String(consumo).replace('.', ',')} km/l.` : 'A saída já foi lançada no financeiro.');
        historico.recarregar();
        recarregar();
      }
    } catch (e) {
      Alert.alert('Não foi possível registrar', e.message);
    } finally {
      setSalvando(false);
    }
  };

  const lista = historico.dados?.abastecimentos || [];
  const consumo = historico.dados?.consumoMedio;
  const veiculoSelecionado = veiculos.find((v) => v.id === veiculoId);

  return (
    <>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.container} contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
          <ScreenHeader usuario={usuario} titulo="Abastecimentos" />
          {ehMotorista ? <BannerOffline style={styles.banner} /> : null}

          <EstadoDados carregando={carregando} erro={erro} onTentarDeNovo={recarregar} temDados={veiculos.length > 0} />

          <CardFormulario>
            <SelectField label="VEÍCULO" opcoes={opcoesVeiculo} valor={veiculoId} onSelecionar={escolherVeiculo} vazio="Nenhum veículo disponível" />
            {erros.veiculo ? <Text style={styles.erro}>{erros.veiculo}</Text> : null}
            <SelectField label="VIAGEM (opcional)" opcoes={opcoesViagem} valor={viagemId || '__nenhuma'} onSelecionar={setViagemId} />
            <CampoTexto label="DATA" value={data} onChangeText={(t) => setData(formatarData(t))} placeholder="DD/MM/AAAA" keyboardType="numeric" maxLength={10} erro={erros.data} />
            <CampoTexto label="LITROS" value={litros} onChangeText={(t) => setLitros(t.replace(/[^0-9,.]/g, ''))} placeholder="320,5" keyboardType="decimal-pad" erro={erros.litros} />
            <CampoTexto label="VALOR PAGO (R$)" value={valor} onChangeText={(t) => setValor(t.replace(/[^0-9,.]/g, ''))} placeholder="1850,00" keyboardType="decimal-pad" erro={erros.valor} />
            <CampoTexto label="HODÔMETRO (km)" value={hodometro} onChangeText={(t) => setHodometro(somenteNumeros(t))} placeholder="123456" keyboardType="numeric" erro={erros.hodometro} />
            <CampoTexto label="POSTO (opcional)" value={posto} onChangeText={setPosto} placeholder="Ex.: Posto Graal BR-381" />
            {paraNumero(litros) > 0 && paraNumero(valor) > 0 ? (
              <Text style={styles.preco}>Preço por litro: {formatarMoeda(paraNumero(valor) / paraNumero(litros))}</Text>
            ) : null}
            <BotoesFormulario onCancelar={limpar} onConfirmar={salvar} confirmarLabel="Registrar" salvando={salvando} />
          </CardFormulario>

          <Text style={styles.subtitulo}>
            Histórico{veiculoSelecionado ? ` · ${veiculoSelecionado.placa}` : ''}
          </Text>
          {veiculoSelecionado ? (
            <View style={styles.consumo}>
              <MaterialCommunityIcons name="gas-station-outline" size={22} color="#FFF" />
              <Text style={styles.consumoTexto}>
                {consumo
                  ? `Consumo médio real: ${String(consumo).replace('.', ',')} km/l`
                  : 'Registre 2 abastecimentos (tanque cheio) para calcular o consumo real.'}
              </Text>
            </View>
          ) : null}

          <EstadoDados carregando={historico.carregando} erro={historico.erro} onTentarDeNovo={historico.recarregar} temDados={lista.length > 0} />

          {lista.map((a) => (
            <View key={a.id} style={styles.item}>
              <View style={styles.flex}>
                <Text style={styles.itemTitulo}>{a.data} · {String(a.litros).replace('.', ',')} l</Text>
                <Text style={styles.itemSub}>
                  {[a.veiculo, a.posto, a.motorista && !ehMotorista ? a.motorista : null].filter(Boolean).join(' · ')}
                </Text>
                <Text style={styles.itemSub}>{formatarKm(a.hodometro)} · {formatarMoeda(a.precoLitro)}/l</Text>
              </View>
              <Text style={styles.itemValor}>{formatarMoeda(a.valor)}</Text>
            </View>
          ))}
          {lista.length === 0 && !historico.carregando && !historico.erro ? <Text style={styles.vazio}>Nenhum abastecimento registrado.</Text> : null}

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
  banner: { marginBottom: 12 },
  erro: { color: '#FFCDD2', fontSize: 12, marginTop: -8, marginBottom: 12 },
  preco: { color: '#FFF', fontSize: 13, fontWeight: '600', marginTop: -4 },
  subtitulo: { color: '#FFF', fontSize: 16, paddingHorizontal: 18, marginBottom: 10 },
  consumo: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1F2156', borderRadius: 10, padding: 12, marginHorizontal: 18, marginBottom: 12 },
  consumoTexto: { color: '#FFF', fontSize: 13, flex: 1 },
  item: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.cardBg, borderRadius: 12, padding: 12, marginHorizontal: 18, marginBottom: 8 },
  itemTitulo: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  itemSub: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  itemValor: { color: colors.redDanger, fontSize: 14, fontWeight: '700' },
  vazio: { color: colors.textMuted, textAlign: 'center', marginVertical: 20 },
});
