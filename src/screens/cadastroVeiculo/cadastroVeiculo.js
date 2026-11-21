import React, { useState } from 'react';
import { ScrollView, StyleSheet, Alert, KeyboardAvoidingView, Platform, TouchableOpacity, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';

import ScreenHeader from '../../components/screenHeader/screenHeader.js';
import SelectField from '../../components/selectField/selectField.js';
import { CardFormulario, CampoTexto, BotoesFormulario } from '../../components/formularioFrota/formularioFrota.js';
import BottomNavigation from '../../components/bottomNavigation/bottomNavigation.js';
import { colors } from '../../constants/theme.js';
import { STATUS_VEICULO, placaValida, formatarPlaca, formatarKm } from '../../constants/frota.js';
import { cadastrarVeiculo, editarVeiculo, desativarVeiculo } from '../../services/frotix.js';

const somenteNumeros = (texto) => texto.replace(/\D/g, '');
const anoAtual = new Date().getFullYear();

const opcoesStatus = [
  { id: 'disponivel', label: STATUS_VEICULO.disponivel.label },
  { id: 'manutencao', label: STATUS_VEICULO.manutencao.label },
];

/**
 * Cadastrar veículo (Gestor de Frota). Aberta pelo "+ Cadastrar veículo" da tela Veículos
 * e pela ação rápida "Cadastrar Veículo" da Home. Valida placa (antiga ou Mercosul),
 * placa repetida, ano e hodômetro.
 */
export default function CadastroVeiculo({ navigation, route }) {
  const usuario = route?.params?.usuario;
  // Edição: params.veiculo (da lista de Veículos). Os campos já vêm preenchidos.
  const veiculoEditado = route?.params?.veiculo || null;
  const editando = Boolean(veiculoEditado);
  const emViagem = veiculoEditado?.status === 'em_viagem';

  const [modelo, setModelo] = useState(veiculoEditado?.modelo || '');
  const [placa, setPlaca] = useState(veiculoEditado?.placa || '');
  const [ano, setAno] = useState(veiculoEditado?.ano ? String(veiculoEditado.ano) : '');
  const [hodometro, setHodometro] = useState(veiculoEditado ? String(Math.round(veiculoEditado.hodometro || 0)) : '');
  const [consumo, setConsumo] = useState(
    veiculoEditado?.consumoInformado ? String(veiculoEditado.consumoInformado).replace('.', ',') : ''
  );
  const [status, setStatus] = useState(veiculoEditado?.status === 'manutencao' ? 'manutencao' : 'disponivel');
  const [erros, setErros] = useState({});
  const [salvando, setSalvando] = useState(false);

  const validar = () => {
    const novos = {};
    if (!modelo.trim()) novos.modelo = 'Informe o modelo do veículo.';
    if (!placaValida(placa)) {
      novos.placa = 'Placa inválida. Use ABC-1234 ou o padrão Mercosul ABC1D23.';
    }
    const anoNum = Number(ano);
    if (ano && (anoNum < 1980 || anoNum > anoAtual + 1)) {
      novos.ano = `Informe um ano entre 1980 e ${anoAtual + 1}.`;
    }
    if (!hodometro) novos.hodometro = 'Informe o hodômetro atual.';
    const consumoNum = Number(consumo.replace(',', '.'));
    if (consumo && (Number.isNaN(consumoNum) || consumoNum <= 0)) {
      novos.consumo = 'Informe um consumo maior que zero (ex.: 2,8).';
    }
    setErros(novos);
    return Object.keys(novos).length === 0;
  };

  // Erro P6: grava no banco (a placa repetida é conferida pelo backend).
  const salvar = async () => {
    if (!validar() || salvando) return;
    setSalvando(true);
    try {
      // Na edição só manda o hodômetro se ele mudou (o campo mostra o valor arredondado).
      const hodometroMudou = !editando || Number(hodometro) !== Math.round(veiculoEditado.hodometro || 0);
      const dados = {
        modelo: modelo.trim(),
        placa: formatarPlaca(placa),
        ano: ano ? Number(ano) : null,
        ...(hodometroMudou ? { hodometro: Number(hodometro) } : {}),
        consumoMedio: consumo ? Number(consumo.replace(',', '.')) : null,
        // Em viagem o status é controlado pela viagem; não manda.
        ...(emViagem ? {} : { status }),
      };
      if (editando) {
        const atualizado = await editarVeiculo(veiculoEditado.id, dados);
        Alert.alert('Veículo atualizado', `${atualizado.modelo} · ${atualizado.placa}`, [{ text: 'OK', onPress: () => navigation.goBack() }]);
        return;
      }
      const novo = await cadastrarVeiculo(dados);
      Alert.alert(
        'Veículo cadastrado',
        `${novo.modelo} · ${novo.placa}\nHodômetro: ${formatarKm(novo.hodometro)}`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (e) {
      if (/placa/i.test(e.message)) setErros((atual) => ({ ...atual, placa: e.message }));
      else Alert.alert(editando ? 'Não foi possível salvar' : 'Não foi possível cadastrar', e.message);
    } finally {
      setSalvando(false);
    }
  };

  // Desativar: o veículo some das listas, mas as viagens e os custos antigos continuam.
  const desativar = () => {
    Alert.alert(
      'Desativar veículo',
      `${veiculoEditado.modelo} · ${veiculoEditado.placa} sai da frota. O histórico de viagens e custos continua nos relatórios.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desativar',
          style: 'destructive',
          onPress: async () => {
            try {
              await desativarVeiculo(veiculoEditado.id);
              navigation.goBack();
            } catch (e) {
              Alert.alert('Não foi possível desativar', e.message);
            }
          },
        },
      ]
    );
  };

  return (
    <>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.container} contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
          <ScreenHeader usuario={usuario} titulo={editando ? 'Editar Veículo' : 'Cadastrar Veículo'} />

          <CardFormulario>
            <CampoTexto
              label="MODELO"
              value={modelo}
              onChangeText={setModelo}
              placeholder="Ex.: Scania R450"
              erro={erros.modelo}
            />
            <CampoTexto
              label="PLACA"
              value={placa}
              onChangeText={(t) => setPlaca(formatarPlaca(t))}
              placeholder="ABC-1234 ou ABC1D23"
              autoCapitalize="characters"
              maxLength={8}
              erro={erros.placa}
            />
            <CampoTexto
              label="ANO (opcional)"
              value={ano}
              onChangeText={(t) => setAno(somenteNumeros(t).slice(0, 4))}
              placeholder={String(anoAtual)}
              keyboardType="numeric"
              erro={erros.ano}
            />
            <CampoTexto
              label="HODÔMETRO ATUAL (km)"
              value={hodometro}
              onChangeText={(t) => setHodometro(somenteNumeros(t))}
              placeholder="123456"
              keyboardType="numeric"
              erro={erros.hodometro}
            />
            <CampoTexto
              label="CONSUMO MÉDIO (km/l, opcional)"
              value={consumo}
              onChangeText={(t) => setConsumo(t.replace(/[^0-9,.]/g, ''))}
              placeholder="2,8"
              keyboardType="decimal-pad"
              erro={erros.consumo}
            />
            {emViagem ? (
              <Text style={styles.nota}>Status: em viagem (muda sozinho quando a viagem for fechada).</Text>
            ) : (
              <SelectField label={editando ? 'STATUS' : 'STATUS INICIAL'} opcoes={opcoesStatus} valor={status} onSelecionar={setStatus} />
            )}
            {editando && veiculoEditado.consumoCalculado ? (
              <Text style={styles.nota}>
                Consumo real pelos abastecimentos: {String(veiculoEditado.consumoCalculado).replace('.', ',')} km/l (usado no lugar do informado).
              </Text>
            ) : null}

            <BotoesFormulario onCancelar={() => navigation.goBack()} onConfirmar={salvar} confirmarLabel={editando ? 'Salvar' : 'Cadastrar'} salvando={salvando} />
          </CardFormulario>

          {editando && !emViagem ? (
            <TouchableOpacity style={styles.desativar} onPress={desativar}>
              <Feather name="slash" size={16} color="#FF8A80" />
              <Text style={styles.desativarTexto}>Desativar veículo</Text>
            </TouchableOpacity>
          ) : null}
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
  nota: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginBottom: 12 },
  desativar: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 14 },
  desativarTexto: { color: '#FF8A80', fontSize: 15, fontWeight: '600' },
});
