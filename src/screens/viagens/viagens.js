import React, { useState } from 'react';
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
import useDados from '../../hooks/useDados.js';
import EstadoDados from '../../components/estadoDados/estadoDados.js';

// Rotas e veículos juntos, para a tela recarregar tudo de uma vez.
const carregarTudo = async () => {
  const [rotas, veiculos] = await Promise.all([listarRotas(), listarVeiculos()]);
  return { rotas, veiculos };
};

const somenteNumeros = (texto) => texto.replace(/\D/g, '');

/**
 * Viagens: abrir viagem, fechar viagens em andamento e listar as concluídas.
 * Usada pelo Gestor (ação "Registrar Viagem") e pelo Motorista (botão "Minhas Viagens",
 * params.modo === 'motorista'). params.veiculoId pré-seleciona um veículo.
 */
export default function Viagens({ navigation, route }) {
  const usuario = route?.params?.usuario;
  const modoMotorista = route?.params?.modo === 'motorista';

  // Erro P6/P11: viagens = rotas do banco. O motorista recebe só as dele (o backend filtra).
  const { dados, carregando, erro, recarregar } = useDados(carregarTudo, { rotas: [], veiculos: [] });
  const rotas = dados?.rotas || [];
  const veiculos = dados?.veiculos || [];
  const buscarVeiculo = (id) => veiculos.find((v) => v.id === id);

  const [veiculoId, setVeiculoId] = useState(route?.params?.veiculoId || null);
  const [rotaId, setRotaId] = useState(null);
  const [hodometroInicial, setHodometroInicial] = useState('');
  const [hodometrosFinais, setHodometrosFinais] = useState({}); // { [rotaId]: texto }
  const [salvando, setSalvando] = useState(false);

  const emAndamento = rotas.filter((r) => r.status === 'em_transito');
  const concluidas = rotas.filter((r) => r.status === 'concluida');

  const opcoesVeiculo = veiculos
    .filter((v) => v.status === 'disponivel')
    .map((v) => ({ id: v.id, label: `${v.modelo} · ${v.placa}` }));
  const opcoesRota = rotas
    .filter((r) => r.status === 'agendada')
    .map((r) => ({ id: r.id, label: `${r.origem} → ${r.destino}${r.dataInicial ? ` · ${r.dataInicial}` : ''}` }));

  const selecionarVeiculo = (id) => {
    setVeiculoId(id);
    setHodometroInicial(String(buscarVeiculo(id)?.hodometro ?? ''));
  };

  // Ao escolher a rota, já sugere o veículo e o hodômetro cadastrados nela.
  const selecionarRota = (id) => {
    setRotaId(id);
    const rota = rotas.find((r) => r.id === id);
    if (rota?.veiculoId && buscarVeiculo(rota.veiculoId)?.status === 'disponivel') {
      selecionarVeiculo(rota.veiculoId);
    }
  };

  const limparFormulario = () => {
    setVeiculoId(null);
    setRotaId(null);
    setHodometroInicial('');
  };

  const abrirViagem = async () => {
    if (!veiculoId || !rotaId || !hodometroInicial) {
      Alert.alert('Campos obrigatórios', 'Selecione o veículo, a rota e informe o hodômetro inicial.');
      return;
    }
    const inicial = Number(hodometroInicial);
    const veiculo = buscarVeiculo(veiculoId);
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
      Alert.alert('Não foi possível abrir a viagem', e.message);
    } finally {
      setSalvando(false);
    }
  };

  const fecharViagem = async (viagem) => {
    const texto = hodometrosFinais[viagem.id];
    const final = Number(texto);
    if (!texto || final <= viagem.hodometroInicial) {
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
      Alert.alert('Não foi possível fechar a viagem', e.message);
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
              onChangeText={(t) => setHodometroInicial(somenteNumeros(t))}
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
                onChangeText={(t) => setHodometrosFinais({ ...hodometrosFinais, [viagem.id]: somenteNumeros(t) })}
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
              infoDireita={`Hodômetro: ${viagem.hodometroFinal.toLocaleString('pt-BR')}\n${formatarKm(viagem.kmRodados)} rodados`}
              {...dadosCard(viagem)}
            />
          ))}

          <EstadoDados carregando={carregando} erro={erro} onTentarDeNovo={recarregar} temDados={rotas.length > 0} />

          {emAndamento.length === 0 && concluidas.length === 0 && !carregando && !erro ? (
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
