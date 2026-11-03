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
import {
  veiculos, rotas, viagens as viagensIniciais, buscarVeiculo, buscarRota, STATUS_ROTA, formatarKm,
} from '../../constants/frotaMock.js';

const somenteNumeros = (texto) => texto.replace(/\D/g, '');

/**
 * Viagens: abrir viagem, fechar viagens em andamento e listar as concluídas.
 * Usada pelo Gestor (ação "Registrar Viagem") e pelo Motorista (botão "Minhas Viagens",
 * params.modo === 'motorista'). params.veiculoId pré-seleciona um veículo.
 */
export default function Viagens({ navigation, route }) {
  const usuario = route?.params?.usuario;
  const modoMotorista = route?.params?.modo === 'motorista';

  const [viagens, setViagens] = useState(viagensIniciais);
  const [veiculoId, setVeiculoId] = useState(route?.params?.veiculoId || null);
  const [rotaId, setRotaId] = useState(null);
  const [hodometroInicial, setHodometroInicial] = useState(
    route?.params?.veiculoId ? String(buscarVeiculo(route.params.veiculoId)?.hodometro ?? '') : ''
  );
  const [hodometrosFinais, setHodometrosFinais] = useState({}); // { [viagemId]: texto }

  const emAndamento = viagens.filter((v) => v.status === 'em_andamento');
  const concluidas = viagens.filter((v) => v.status === 'concluida');

  // Só oferece veículos disponíveis e rotas agendadas que não estejam numa viagem aberta.
  const ocupados = new Set(emAndamento.map((v) => v.veiculoId));
  const rotasOcupadas = new Set(emAndamento.map((v) => v.rotaId));
  const opcoesVeiculo = veiculos
    .filter((v) => v.status === 'disponivel' && !ocupados.has(v.id))
    .map((v) => ({ id: v.id, label: `${v.modelo} · ${v.placa}` }));
  const opcoesRota = rotas
    .filter((r) => r.status === 'agendada' && !rotasOcupadas.has(r.id))
    .map((r) => ({ id: r.id, label: `${r.origem} → ${r.destino}` }));

  const selecionarVeiculo = (id) => {
    setVeiculoId(id);
    setHodometroInicial(String(buscarVeiculo(id)?.hodometro ?? ''));
  };

  const limparFormulario = () => {
    setVeiculoId(null);
    setRotaId(null);
    setHodometroInicial('');
  };

  const abrirViagem = () => {
    if (!veiculoId || !rotaId || !hodometroInicial) {
      Alert.alert('Campos obrigatórios', 'Selecione o veículo, a rota e informe o hodômetro inicial.');
      return;
    }
    const inicial = Number(hodometroInicial);
    const veiculo = buscarVeiculo(veiculoId);
    if (inicial < veiculo.hodometro) {
      Alert.alert('Hodômetro inválido', `O hodômetro do veículo já marca ${formatarKm(veiculo.hodometro)}.`);
      return;
    }
    const rota = buscarRota(rotaId);
    const nova = {
      id: `t${Date.now()}`,
      rotaId,
      veiculoId,
      motorista: modoMotorista ? usuario?.nome || rota.motorista : rota.motorista,
      hodometroInicial: inicial,
      hodometroFinal: null,
      status: 'em_andamento',
    };
    setViagens([nova, ...viagens]);
    limparFormulario();
  };

  const fecharViagem = (viagem) => {
    const texto = hodometrosFinais[viagem.id];
    const final = Number(texto);
    if (!texto || final <= viagem.hodometroInicial) {
      Alert.alert('Hodômetro final inválido', `Informe um valor maior que ${formatarKm(viagem.hodometroInicial)}.`);
      return;
    }
    setViagens(viagens.map((v) => (v.id === viagem.id ? { ...v, hodometroFinal: final, status: 'concluida' } : v)));
    setHodometrosFinais({ ...hodometrosFinais, [viagem.id]: '' });
  };

  const dadosCard = (viagem) => {
    const rota = buscarRota(viagem.rotaId);
    return {
      origem: rota?.origem,
      destino: rota?.destino,
      placa: buscarVeiculo(viagem.veiculoId)?.placa,
      motorista: viagem.motorista,
    };
  };

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
              onSelecionar={setRotaId}
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
              <TouchableOpacity style={[styles.botao, styles.botaoClaro]} onPress={abrirViagem}>
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
              <TouchableOpacity style={[styles.botao, styles.botaoClaro, styles.botaoFechar]} onPress={() => fecharViagem(viagem)}>
                <Text style={styles.botaoTextoEscuro}>Fechar</Text>
              </TouchableOpacity>
            </TripCard>
          ))}

          {concluidas.map((viagem) => (
            <TripCard
              key={viagem.id}
              titulo="VIAGEM CONCLUÍDA"
              status={STATUS_ROTA.concluida}
              infoDireita={`Hodômetro: ${viagem.hodometroFinal.toLocaleString('pt-BR')}\n${formatarKm(
                viagem.hodometroFinal - viagem.hodometroInicial
              )} rodados`}
              {...dadosCard(viagem)}
            />
          ))}

          {emAndamento.length === 0 && concluidas.length === 0 ? (
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
