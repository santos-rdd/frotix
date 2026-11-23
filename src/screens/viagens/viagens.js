import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';

import ScreenHeader from '../../components/screenHeader/screenHeader.js';
import SelectField from '../../components/selectField/selectField.js';
import TripCard from '../../components/tripCard/tripCard.js';
import VoltarButton from '../../components/voltarButton/voltarButton.js';
import BottomNavigation from '../../components/bottomNavigation/bottomNavigation.js';
import { colors } from '../../constants/theme.js';
import { STATUS_ROTA, formatarKm } from '../../constants/frota.js';
import { listarRotas, listarVeiculos, abrirViagem as abrirViagemApi, concluirViagem } from '../../services/frotix.js';
import {
  abrirViagemOffline,
  concluirViagemOffline,
  listarRotasLocais,
  listarVeiculosLocais,
  listarVeiculosPermitidosLocais,
  atualizarCacheRotas,
  atualizarCacheVeiculos,
} from '../../services/localDataService.js';
import { obterUsuarioLogado } from '../../services/api.js';
import useDados from '../../hooks/useDados.js';
import EstadoDados from '../../components/estadoDados/estadoDados.js';

const carregarTudo = async ({ modoMotorista, usuarioId } = {}) => {
  const uLogado = await obterUsuarioLogado();
  const uId = usuarioId || uLogado?.id || uLogado?.sub;
  const motorista = modoMotorista || Number(uLogado?.perfil) === 4;
  try {
    const [rotas, veiculos] = await Promise.all([listarRotas(), listarVeiculos()]);
    if (uId) {
      if (Array.isArray(rotas)) atualizarCacheRotas(uId, rotas).catch(() => {});
      if (Array.isArray(veiculos)) atualizarCacheVeiculos(uId, veiculos).catch(() => {});
    }
    return { rotas: rotas || [], veiculos: veiculos || [] };
  } catch (err) {
    if (uId) {
      const carregarVeiculosLocais = motorista
        ? listarVeiculosPermitidosLocais(uId)
        : listarVeiculosLocais(uId);
      const [rotasLocais, veiculosLocais] = await Promise.all([
        listarRotasLocais(uId),
        carregarVeiculosLocais,
      ]);
      if ((rotasLocais && rotasLocais.length > 0) || (veiculosLocais && veiculosLocais.length > 0)) {
        return { rotas: rotasLocais || [], veiculos: veiculosLocais || [] };
      }
    }
    throw err;
  }
};

const normalizarHodometro = (texto) => texto
  .replace(/[^\d.,]/g, '')
  .replace(/,/g, '.')
  .replace(/(\..*)\./g, '$1');

export default function Viagens({ navigation, route }) {
  const usuario = route?.params?.usuario;
  const modoMotorista = route?.params?.modo === 'motorista';

  const carregarDados = React.useCallback(
    () => carregarTudo({ modoMotorista: modoMotorista || Number(usuario?.role) === 4, usuarioId: usuario?.id }),
    [modoMotorista, usuario]
  );
  const { dados, carregando, erro, recarregar } = useDados(carregarDados, { rotas: [], veiculos: [] });
  const rotas = dados?.rotas || [];
  const veiculos = dados?.veiculos || [];
  const buscarVeiculo = (id) => veiculos.find((v) => v.id === id);
  const rotaSelecionada = rotas.find((rota) => rota.id === rotaId);

  const [veiculoId, setVeiculoId] = useState(route?.params?.veiculoId || null);
  const [rotaId, setRotaId] = useState(route?.params?.rotaId || null);
  const [hodometroInicial, setHodometroInicial] = useState('');
  const [hodometrosFinais, setHodometrosFinais] = useState({});
  const [salvando, setSalvando] = useState(false);

  const emAndamento = rotas.filter((r) => r.status === 'em_transito');
  const concluidas = rotas.filter((r) => r.status === 'concluida');
  const agendadas = rotas.filter((r) => r.status === 'agendada');

  const opcoesVeiculo = veiculos
    .filter((v) =>
      v.status === 'disponivel' &&
      (!rotaSelecionada?.veiculoId || v.id === rotaSelecionada.veiculoId)
    )
    .map((v) => ({ id: v.id, label: `${v.modelo} · ${v.placa}` }));
  const opcoesRota = rotas
    .filter((r) => r.status === 'agendada')
    .map((r) => ({ id: r.id, label: `${r.origem} → ${r.destino}${r.dataInicial ? ` · ${r.dataInicial}` : ''}` }));

  useEffect(() => {
    const rota = rotas.find((item) => item.id === rotaId);
    if (!rota?.veiculoId) return;
    const veiculo = buscarVeiculo(rota.veiculoId);
    if (veiculo?.status === 'disponivel') {
      setVeiculoId(veiculo.id);
      setHodometroInicial(String(veiculo.hodometro ?? ''));
    }
  }, [rotas, veiculos, rotaId]);

  useEffect(() => {
    const veiculo = buscarVeiculo(veiculoId);
    if (veiculo && !hodometroInicial) {
      setHodometroInicial(String(veiculo.hodometro ?? ''));
    }
  }, [veiculoId, veiculos]);

  const selecionarVeiculo = (id) => {
    setVeiculoId(id);
    setHodometroInicial(String(buscarVeiculo(id)?.hodometro ?? ''));
  };

  const selecionarRota = (id) => {
    setRotaId(id);
    const rota = rotas.find((r) => r.id === id);
    if (rota?.veiculoId && buscarVeiculo(rota.veiculoId)?.status === 'disponivel') {
      selecionarVeiculo(rota.veiculoId);
    } else {
      setVeiculoId(null);
      setHodometroInicial('');
    }
  };

  const limparFormulario = () => {
    setVeiculoId(null);
    setRotaId(null);
    setHodometroInicial('');
  };

  const abrirViagem = async () => {
    if (!veiculoId || !rotaId || hodometroInicial.trim() === '') {
      Alert.alert('Campos obrigatórios', 'Selecione o veículo, a rota e informe o hodômetro inicial.');
      return;
    }
    const inicial = Number(hodometroInicial);
    const veiculo = buscarVeiculo(veiculoId);
    if (!Number.isFinite(inicial) || inicial < 0) {
      Alert.alert('Hodômetro inválido', 'Informe um valor numérico igual ou maior que zero.');
      return;
    }
    if (!veiculo) {
      Alert.alert('Veículo indisponível', 'Selecione um veículo disponível nas suas rotas.');
      return;
    }
    if (veiculo && inicial < veiculo.hodometro) {
      Alert.alert('Hodômetro inválido', `O hodômetro do veículo já marca ${formatarKm(veiculo.hodometro)}.`);
      return;
    }
    if (salvando) return;
    setSalvando(true);
    try {
      await abrirViagemApi(rotaId, { veiculoId, hodometroInicial: inicial });
      limparFormulario();
      await recarregar();
    } catch (e) {
      const msg = e?.message || '';
      const ehErroConexao = /conexão|internet|network|failed|timeout|servidor|econnrefused/i.test(msg);
      if (ehErroConexao) {
        try {
          const uLogado = await obterUsuarioLogado();
          const uId = usuario?.id || uLogado?.id || uLogado?.sub;
          if (uId) {
            await abrirViagemOffline(uId, rotaId, { veiculoId, hodometroInicial: inicial });
            limparFormulario();
            await recarregar();
            Alert.alert(
              'Viagem aberta no dispositivo',
              'Sem conexão com o servidor. A abertura da viagem foi registrada localmente e será sincronizada assim que a internet voltar.',
              [{ text: 'OK' }]
            );
            return;
          }
        } catch (erroOffline) {
          Alert.alert('Não foi possível salvar offline', erroOffline.message || 'Falha ao registrar a viagem no dispositivo.');
          return;
        }
      }
      Alert.alert('Não foi possível abrir a viagem', e.message || 'Ocorreu um erro ao iniciar a viagem.');
    } finally {
      setSalvando(false); 
    }
  };

  const fecharViagem = async (viagem) => {
    const texto = hodometrosFinais[viagem.id];
    const final = Number(texto);
    if (!texto || !Number.isFinite(final) || final <= Number(viagem.hodometroInicial)) {
      Alert.alert('Hodômetro final inválido', `Informe um valor maior que ${formatarKm(viagem.hodometroInicial)}.`);
      return;
    }
    if (salvando) return;
    setSalvando(true);
    try {
      await concluirViagem(viagem.id, final);
      setHodometrosFinais({ ...hodometrosFinais, [viagem.id]: '' });
      await recarregar();
    } catch (e) {
      const msg = e?.message || '';
      const ehErroConexao = /conexão|internet|network|failed|timeout|servidor|econnrefused/i.test(msg);
      if (ehErroConexao) {
        try {
          const uLogado = await obterUsuarioLogado();
          const uId = usuario?.id || uLogado?.id || uLogado?.sub;
          if (uId) {
            await concluirViagemOffline(uId, viagem.id, { hodometroFinal: final });
            setHodometrosFinais({ ...hodometrosFinais, [viagem.id]: '' });
            await recarregar();
            Alert.alert(
              'Conclusão salva no dispositivo',
              'Sem conexão com o servidor. A conclusão da viagem foi registrada localmente e será sincronizada assim que a internet voltar.',
              [{ text: 'OK' }]
            );
            return;
          }
        } catch (erroOffline) {
          Alert.alert('Não foi possível salvar offline', erroOffline.message || 'Falha ao registrar a conclusão no dispositivo.');
          return;
        }
      }
      Alert.alert('Não foi possível fechar a viagem', e.message || 'Ocorreu um erro ao concluir a viagem.');
    } finally {
      setSalvando(false);
    }
  };

  const dadosCard = (viagem) => ({
    origem: viagem.origem,
    destino: viagem.destino,
    placa: viagem.placa || 'Sem veículo',
    motorista: viagem.motorista,
  });

  return (
    <>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.container} contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
          <ScreenHeader usuario={usuario} titulo={modoMotorista ? 'Minhas Viagens' : 'Viagens'} />

          <View style={styles.formulario}>
            <SelectField
              label="VEÍCULO"
              opcoes={opcoesVeiculo}
              valor={veiculoId}
              onSelecionar={selecionarVeiculo}
              vazio="Nenhum veículo disponível"
            />
            <SelectField
              label="ROTA"
              opcoes={opcoesRota}
              valor={rotaId}
              onSelecionar={selecionarRota}
              vazio="Nenhuma rota agendada"
            />
            <Text style={styles.label}>HODÔMETRO INICIAL (km)</Text>
            <TextInput
              style={styles.input}
              value={hodometroInicial}
              onChangeText={(t) => setHodometroInicial(normalizarHodometro(t))}
              keyboardType="numeric"
              placeholder="123456"
              placeholderTextColor="rgba(255,255,255,0.6)"
            />
            <View style={styles.botoes}>
              <TouchableOpacity style={[styles.botao, styles.botaoCancelar]} onPress={limparFormulario}>
                <Text style={styles.botaoTextoClaro}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.botao, styles.botaoClaro]} onPress={abrirViagem} disabled={salvando}>
                <Text style={styles.botaoTextoEscuro}>Abrir viagem</Text>
              </TouchableOpacity>
            </View>
          </View>

          {modoMotorista && (
            agendadas.length > 0 ? (
              agendadas.map((viagem) => (
                <TripCard
                  key={viagem.id}
                  titulo="VIAGEM AGENDADA"
                  status={STATUS_ROTA.agendada}
                  infoDireita={[
                    viagem.dataInicial ? `Saída: ${viagem.dataInicial}` : null,
                    viagem.hodometroInicial !== null && viagem.hodometroInicial !== undefined
                      ? `Hodômetro: ${formatarKm(viagem.hodometroInicial)}`
                      : null,
                  ].filter(Boolean).join('\n')}
                  {...dadosCard(viagem)}
                />
              ))
            ) : (
              <Text style={styles.vazio}>Nenhuma viagem agendada.</Text>
            )
          )}

          {emAndamento.map((viagem) => (
            <TripCard
              key={viagem.id}
              titulo="VIAGEM EM ANDAMENTO"
              status={STATUS_ROTA.em_transito}
              infoDireita={`Hodômetro:\n${formatarKm(viagem.hodometroInicial)} inicial`}
              {...dadosCard(viagem)}
            >
              <Text style={[styles.label, styles.labelFinal]}>HODÔMETRO FINAL</Text>
              <TextInput
                style={styles.input}
                value={hodometrosFinais[viagem.id] || ''}
                onChangeText={(t) => setHodometrosFinais({ ...hodometrosFinais, [viagem.id]: normalizarHodometro(t) })}
                keyboardType="numeric"
                placeholder={String(viagem.hodometroInicial)}
                placeholderTextColor="rgba(255,255,255,0.6)"
              />
              <TouchableOpacity style={[styles.botao, styles.botaoClaro, styles.botaoFechar]} onPress={() => fecharViagem(viagem)} disabled={salvando}>
                <Text style={styles.botaoTextoEscuro}>Fechar</Text>
              </TouchableOpacity>
            </TripCard>
          ))}

          {concluidas.map((viagem) => (
            <TripCard
              key={viagem.id}
              titulo="VIAGEM CONCLUÍDA"
              status={STATUS_ROTA.concluida}
              infoDireita={`Hodômetro: ${formatarKm(viagem.hodometroFinal)}\n${formatarKm(viagem.kmRodados)} rodados`}
              {...dadosCard(viagem)}
            />
          ))}

          <EstadoDados carregando={carregando} erro={erro} onTentarDeNovo={recarregar} temDados={rotas.length > 0} />

          {rotas.length === 0 && !carregando && !erro ? (
            <Text style={styles.vazio}>Nenhuma viagem registrada ainda.</Text>
          ) : null}

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
  formulario: {
    backgroundColor: colors.primaryBlue,
    borderRadius: 12,
    padding: 20,
    paddingTop: 28,
    marginHorizontal: 8,
    marginBottom: 40,
    elevation: 6,
  },
  label: { color: '#FFF', fontSize: 14, fontWeight: '700', marginBottom: 8 },
  labelFinal: { marginTop: 18 },
  input: {
    backgroundColor: '#2A3BC9',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: 10,
    paddingHorizontal: 16,
    height: 48,
    color: '#FFF',
    fontSize: 13,
  },
  botoes: { flexDirection: 'row', gap: 16, marginTop: 36 },
  botao: { flex: 1, borderRadius: 28, height: 56, justifyContent: 'center', alignItems: 'center' },
  botaoCancelar: { backgroundColor: '#B71C1C' },
  botaoClaro: { backgroundColor: '#E5E7EB' },
  botaoFechar: { flex: 0, width: 150, alignSelf: 'center', marginTop: 22 },
  botaoTextoClaro: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  botaoTextoEscuro: { color: '#121212', fontSize: 15, fontWeight: '700' },
  vazio: { color: colors.textMuted, textAlign: 'center', marginVertical: 20 },
});
