import React, { useState } from 'react';
import { ScrollView, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';

import ScreenHeader from '../../components/screenHeader/screenHeader.js';
import SelectField from '../../components/selectField/selectField.js';
import { CardFormulario, CampoTexto, BotoesFormulario } from '../../components/formularioFrota/formularioFrota.js';
import BottomNavigation from '../../components/bottomNavigation/bottomNavigation.js';
import { colors } from '../../constants/theme.js';
import {
  veiculos, STATUS_VEICULO, placaValida, formatarPlaca, adicionarVeiculo, formatarKm,
} from '../../constants/frotaMock.js';

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

  const [modelo, setModelo] = useState('');
  const [placa, setPlaca] = useState('');
  const [ano, setAno] = useState('');
  const [hodometro, setHodometro] = useState('');
  const [consumo, setConsumo] = useState('');
  const [status, setStatus] = useState('disponivel');
  const [erros, setErros] = useState({});

  const validar = () => {
    const novos = {};
    if (!modelo.trim()) novos.modelo = 'Informe o modelo do veículo.';
    if (!placaValida(placa)) {
      novos.placa = 'Placa inválida. Use ABC-1234 ou o padrão Mercosul ABC1D23.';
    } else if (veiculos.some((v) => formatarPlaca(v.placa) === formatarPlaca(placa))) {
      novos.placa = 'Já existe um veículo com essa placa.';
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

  const salvar = () => {
    if (!validar()) return;
    const novo = adicionarVeiculo({
      modelo: modelo.trim(),
      placa: formatarPlaca(placa),
      ano: ano ? Number(ano) : null,
      hodometro: Number(hodometro),
      consumoMedio: consumo ? Number(consumo.replace(',', '.')) : null,
      status,
    });
    Alert.alert(
      'Veículo cadastrado',
      `${novo.modelo} · ${novo.placa}\nHodômetro: ${formatarKm(novo.hodometro)}`,
      [{ text: 'OK', onPress: () => navigation.goBack() }]
    );
  };

  return (
    <>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.container} contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
          <ScreenHeader usuario={usuario} titulo="Cadastrar Veículo" />

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
            <SelectField label="STATUS INICIAL" opcoes={opcoesStatus} valor={status} onSelecionar={setStatus} />

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
});
