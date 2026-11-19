import React, { useState } from 'react';
import { ScrollView, Text, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';

import ScreenHeader from '../../components/screenHeader/screenHeader.js';
import SelectField from '../../components/selectField/selectField.js';
import { CardFormulario, CampoTexto, BotoesFormulario } from '../../components/formularioFrota/formularioFrota.js';
import BottomNavigation from '../../components/bottomNavigation/bottomNavigation.js';
import { colors } from '../../constants/theme.js';
import {
  veiculos, buscarVeiculo, adicionarRota, dataValida, formatarData, formatarKm,
} from '../../constants/frotaMock.js';

const somenteNumeros = (texto) => texto.replace(/\D/g, '');
const normalizar = (texto) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

// Data de hoje no formato DD/MM/AAAA (valor inicial do campo).
const hoje = () => new Date().toLocaleDateString('pt-BR');

// "DD/MM/AAAA" -> Date, para comparar com hoje.
const paraDate = (texto) => {
  const [d, m, a] = texto.split('/').map(Number);
  return new Date(a, m - 1, d);
};

/**
 * Cadastrar rota (Gestor de Frota). Aberta pelo "+ Cadastrar rota" da tela Rotas e pela
 * ação rápida "Nova Rota" da Home. A rota nasce como "Agendada"; o hodômetro final é
 * informado depois, nos Detalhes da rota.
 */
export default function CadastroRota({ navigation, route }) {
  const usuario = route?.params?.usuario;

  const [origem, setOrigem] = useState('');
  const [destino, setDestino] = useState('');
  const [veiculoId, setVeiculoId] = useState(null);
  const [motorista, setMotorista] = useState('');
  const [data, setData] = useState(hoje());
  const [hodometroInicial, setHodometroInicial] = useState('');
  const [receita, setReceita] = useState('');
  const [erros, setErros] = useState({});

  // Veículos em manutenção não podem receber rota.
  const opcoesVeiculo = veiculos
    .filter((v) => v.status !== 'manutencao')
    .map((v) => ({ id: v.id, label: `${v.modelo} · ${v.placa}` }));

  const selecionarVeiculo = (id) => {
    setVeiculoId(id);
    setHodometroInicial(String(buscarVeiculo(id)?.hodometro ?? ''));
  };

  const validar = () => {
    const novos = {};
    if (!origem.trim()) novos.origem = 'Informe a cidade de origem.';
    if (!destino.trim()) novos.destino = 'Informe a cidade de destino.';
    else if (origem.trim() && normalizar(origem) === normalizar(destino)) {
      novos.destino = 'O destino precisa ser diferente da origem.';
    }
    if (!veiculoId) novos.veiculo = 'Selecione o veículo.';
    if (!motorista.trim()) novos.motorista = 'Informe o motorista.';
    if (!dataValida(data)) {
      novos.data = 'Data inválida. Use DD/MM/AAAA.';
    } else {
      const inicioDoDia = new Date();
      inicioDoDia.setHours(0, 0, 0, 0);
      if (paraDate(data) < inicioDoDia) novos.data = 'A data não pode estar no passado.';
    }
    const veiculo = buscarVeiculo(veiculoId);
    if (!hodometroInicial) novos.hodometro = 'Informe o hodômetro inicial.';
    else if (veiculo && Number(hodometroInicial) < veiculo.hodometro) {
      novos.hodometro = `O veículo já marca ${formatarKm(veiculo.hodometro)}.`;
    }
    const receitaNum = Number(receita.replace(/\./g, '').replace(',', '.'));
    if (!receita || Number.isNaN(receitaNum) || receitaNum <= 0) {
      novos.receita = 'Informe a receita prevista do frete.';
    }
    setErros(novos);
    return Object.keys(novos).length === 0;
  };

  const salvar = () => {
    if (!validar()) return;
    const nova = adicionarRota({
      origem: origem.trim(),
      destino: destino.trim(),
      veiculoId,
      motorista: motorista.trim(),
      dataInicial: data,
      hodometroInicial: Number(hodometroInicial),
      receita: Number(receita.replace(/\./g, '').replace(',', '.')),
    });
    Alert.alert(
      'Rota cadastrada',
      `${nova.origem} → ${nova.destino}\nAgendada para ${nova.dataInicial}`,
      [{ text: 'OK', onPress: () => navigation.goBack() }]
    );
  };

  return (
    <>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.container} contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
          <ScreenHeader usuario={usuario} titulo="Cadastrar Rota" />

          <CardFormulario>
            <CampoTexto label="ORIGEM" value={origem} onChangeText={setOrigem} placeholder="Cidade de origem" erro={erros.origem} />
            <CampoTexto label="DESTINO" value={destino} onChangeText={setDestino} placeholder="Cidade de destino" erro={erros.destino} />
            <SelectField
              label="VEÍCULO"
              opcoes={opcoesVeiculo}
              valor={veiculoId}
              onSelecionar={selecionarVeiculo}
              vazio="Nenhum veículo disponível"
            />
            {erros.veiculo ? <Text style={styles.erro}>{erros.veiculo}</Text> : null}
            <CampoTexto label="MOTORISTA" value={motorista} onChangeText={setMotorista} placeholder="Nome do motorista" erro={erros.motorista} />
            <CampoTexto
              label="DATA DE SAÍDA"
              value={data}
              onChangeText={(t) => setData(formatarData(t))}
              placeholder="DD/MM/AAAA"
              keyboardType="numeric"
              maxLength={10}
              erro={erros.data}
            />
            <CampoTexto
              label="HODÔMETRO INICIAL (km)"
              value={hodometroInicial}
              onChangeText={(t) => setHodometroInicial(somenteNumeros(t))}
              placeholder="123456"
              keyboardType="numeric"
              erro={erros.hodometro}
            />
            <CampoTexto
              label="RECEITA PREVISTA (R$)"
              value={receita}
              onChangeText={(t) => setReceita(t.replace(/[^0-9,.]/g, ''))}
              placeholder="5200,00"
              keyboardType="decimal-pad"
              erro={erros.receita}
            />

            <BotoesFormulario onCancelar={() => navigation.goBack()} onConfirmar={salvar} confirmarLabel="Cadastrar" />
          </CardFormulario>
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
});
