import React, { useState } from 'react';
import { ScrollView, Text, View, StyleSheet, Alert, KeyboardAvoidingView, Platform, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import ScreenHeader from '../../components/screenHeader/screenHeader.js';
import SelectField from '../../components/selectField/selectField.js';
import { CardFormulario, CampoTexto, BotoesFormulario } from '../../components/formularioFrota/formularioFrota.js';
import BottomNavigation from '../../components/bottomNavigation/bottomNavigation.js';
import { colors } from '../../constants/theme.js';
import { dataValida, formatarData, formatarKm } from '../../constants/frota.js';
import { listarVeiculos, listarMotoristas, cadastrarRota } from '../../services/frotix.js';
import { calcularDistanciaRodoviaria } from '../../services/roteamentoService.js';
import { salvarRotaOffline } from '../../services/localDataService.js';
import { obterUsuarioLogado } from '../../services/api.js';
import useDados from '../../hooks/useDados.js';

const somenteNumeros = (texto) => texto.replace(/\D/g, '');
const normalizar = (texto) => String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

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
  const [motoristaId, setMotoristaId] = useState(null);
  const [data, setData] = useState(hoje());
  const [hodometroInicial, setHodometroInicial] = useState('');
  const [receita, setReceita] = useState('');
  const [distancia, setDistancia] = useState('');
  const [origemDistancia, setOrigemDistancia] = useState(null); // 'sugerido' | 'manual' | null
  const [calculandoDistancia, setCalculandoDistancia] = useState(false);
  const [sugestaoDistancia, setSugestaoDistancia] = useState(null);
  const [erros, setErros] = useState({});
  const [salvando, setSalvando] = useState(false);

  const { dados: veiculos } = useDados(listarVeiculos, []);
  // Erro P7: o motorista é escolhido entre os usuários com perfil Motorista.
  const { dados: motoristas } = useDados(listarMotoristas, []);
  const buscarVeiculo = (id) => (veiculos || []).find((v) => v.id === id);

  // Veículos em manutenção não podem receber rota.
  const opcoesVeiculo = (veiculos || [])
    .filter((v) => v.status !== 'manutencao')
    .map((v) => ({ id: v.id, label: `${v.modelo} · ${v.placa}` }));
  const opcoesMotorista = (motoristas || []).map((m) => ({ id: m.id, label: m.nome }));

  const selecionarVeiculo = (id) => {
    setVeiculoId(id);
    setHodometroInicial(String(buscarVeiculo(id)?.hodometro ?? ''));
  };

  const mudarOrigem = (texto) => {
    setOrigem(texto);
    setSugestaoDistancia(null);
    if (origemDistancia === 'sugerido') {
      setDistancia('');
      setOrigemDistancia(null);
    }
  };

  const mudarDestino = (texto) => {
    setDestino(texto);
    setSugestaoDistancia(null);
    if (origemDistancia === 'sugerido') {
      setDistancia('');
      setOrigemDistancia(null);
    }
  };

  const handleCalcularDistancia = async () => {
    if (!origem.trim()) {
      Alert.alert('Origem necessária', 'Informe a cidade de origem para calcular a distância.');
      return;
    }
    if (!destino.trim()) {
      Alert.alert('Destino necessário', 'Informe a cidade de destino para calcular a distância.');
      return;
    }
    if (normalizar(origem) === normalizar(destino)) {
      Alert.alert('Cidades iguais', 'A origem e o destino precisam ser diferentes.');
      return;
    }

    setCalculandoDistancia(true);
    setSugestaoDistancia(null);
    try {
      const res = await calcularDistanciaRodoviaria(origem, destino);
      if (res.sucesso && res.distanciaKm != null) {
        setSugestaoDistancia(res.distanciaKm);
      } else {
        Alert.alert(
          'Cálculo de rota indisponível',
          res.erro || 'Não foi possível obter a estimativa rodoviária. Você pode informar a distância manualmente.'
        );
      }
    } catch {
      Alert.alert(
        'Falha na consulta',
        'Não foi possível consultar a rota no momento. Você pode informar a distância manualmente.'
      );
    } finally {
      setCalculandoDistancia(false);
    }
  };

  const aplicarSugestao = () => {
    if (sugestaoDistancia != null) {
      setDistancia(String(sugestaoDistancia));
      setOrigemDistancia('sugerido');
      setSugestaoDistancia(null);
    }
  };

  const mudarDistanciaManual = (texto) => {
    const limpo = somenteNumeros(texto);
    setDistancia(limpo);
    setOrigemDistancia(limpo ? 'manual' : null);
  };

  const validar = () => {
    const novos = {};
    if (!origem.trim()) novos.origem = 'Informe a cidade de origem.';
    if (!destino.trim()) novos.destino = 'Informe a cidade de destino.';
    else if (origem.trim() && normalizar(origem) === normalizar(destino)) {
      novos.destino = 'O destino precisa ser diferente da origem.';
    }
    if (!veiculoId) novos.veiculo = 'Selecione o veículo.';
    if (!motoristaId) novos.motorista = 'Selecione o motorista.';
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
    if (distancia && (Number.isNaN(Number(distancia)) || Number(distancia) < 0)) {
      novos.distancia = 'A distância prevista deve ser um valor numérico válido.';
    }
    setErros(novos);
    return Object.keys(novos).length === 0;
  };

  const salvar = async () => {
    if (!validar() || salvando) return;
    setSalvando(true);
    try {
      const distNum = distancia ? Number(distancia) : null;
      const nova = await cadastrarRota({
        origem: origem.trim(),
        destino: destino.trim(),
        veiculoId,
        motoristaId,
        dataSaida: data,
        hodometroInicial: Number(hodometroInicial),
        receita: Number(receita.replace(/\./g, '').replace(',', '.')),
        distanciaPrevistaKm: distNum,
      });
      const detalheDist = nova.distanciaPrevistaKm ? `\nDistância prevista: ~${formatarKm(nova.distanciaPrevistaKm)}` : '';
      Alert.alert(
        'Rota cadastrada',
        `${nova.origem} → ${nova.destino}\nAgendada para ${nova.dataInicial}${detalheDist}`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (e) {
      const msg = e?.message || '';
      const ehErroConexao = /conexão|internet|network|failed|timeout|servidor|econnrefused/i.test(msg);
      if (ehErroConexao) {
        try {
          const uLogado = await obterUsuarioLogado();
          const uId = usuario?.id || uLogado?.id || uLogado?.sub;
          if (uId) {
            const distNum = distancia ? Number(distancia) : null;
            await salvarRotaOffline(uId, {
              origem: origem.trim(),
              destino: destino.trim(),
              veiculoId,
              motoristaId,
              dataSaida: data,
              hodometroInicial: Number(hodometroInicial),
              receita: Number(receita.replace(/\./g, '').replace(',', '.')),
              distanciaPrevistaKm: distNum,
            });
            Alert.alert(
              'Rota salva no dispositivo',
              'Sem conexão com o servidor no momento. A rota foi salva localmente e será sincronizada assim que a internet voltar.',
              [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
            return;
          }
        } catch {}
      }
      Alert.alert('Não foi possível cadastrar', e.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.container} contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
          <ScreenHeader usuario={usuario} titulo="Cadastrar Rota" />

          <CardFormulario>
            <CampoTexto label="ORIGEM" value={origem} onChangeText={mudarOrigem} placeholder="Cidade de origem (ex: Campinas - SP)" erro={erros.origem} />
            <CampoTexto label="DESTINO" value={destino} onChangeText={mudarDestino} placeholder="Cidade de destino (ex: Santos - SP)" erro={erros.destino} />

            <View style={styles.blocoRoteamento}>
              <TouchableOpacity
                style={[styles.btnCalcular, calculandoDistancia && styles.btnDesabilitado]}
                onPress={handleCalcularDistancia}
                disabled={calculandoDistancia}
                activeOpacity={0.8}
              >
                {calculandoDistancia ? (
                  <View style={styles.linhaAcao}>
                    <ActivityIndicator size="small" color="#121212" />
                    <Text style={styles.btnCalcularTexto}>Calculando rota...</Text>
                  </View>
                ) : (
                  <View style={styles.linhaAcao}>
                    <MaterialCommunityIcons name="map-marker-distance" size={18} color="#121212" />
                    <Text style={styles.btnCalcularTexto}>Calcular distância</Text>
                  </View>
                )}
              </TouchableOpacity>

              {sugestaoDistancia != null && (
                <View style={styles.cardSugestao}>
                  <View style={styles.sugestaoCabecalho}>
                    <MaterialCommunityIcons name="check-circle-outline" size={18} color="#4ADE80" />
                    <Text style={styles.sugestaoTexto}>Sugestão calculada: <Text style={styles.sugestaoDestaque}>{sugestaoDistancia} km</Text></Text>
                  </View>
                  <TouchableOpacity style={styles.btnUsarSugestao} onPress={aplicarSugestao} activeOpacity={0.8}>
                    <Text style={styles.btnUsarSugestaoTexto}>Usar sugestão</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={styles.blocoDistancia}>
              <CampoTexto
                label="DISTÂNCIA PREVISTA (km)"
                value={distancia}
                onChangeText={mudarDistanciaManual}
                placeholder="Ex: 485 (opcional)"
                keyboardType="numeric"
                erro={erros.distancia}
              />
              {origemDistancia && (
                <View style={styles.badgeOrigemContainer}>
                  <View style={[styles.badgeOrigem, origemDistancia === 'sugerido' ? styles.badgeSugerido : styles.badgeManual]}>
                    <Text style={styles.badgeOrigemTexto}>
                      {origemDistancia === 'sugerido' ? '✓ Sugerido pelo aplicativo' : '✎ Informado manualmente'}
                    </Text>
                  </View>
                </View>
              )}
              <Text style={styles.atribuicao}>
                Estimativa rodoviária via OpenStreetMap e OSRM para fins de planejamento. Não substitui o hodômetro.
              </Text>
            </View>

            <SelectField
              label="VEÍCULO"
              opcoes={opcoesVeiculo}
              valor={veiculoId}
              onSelecionar={selecionarVeiculo}
              vazio="Nenhum veículo disponível"
            />
            {erros.veiculo ? <Text style={styles.erro}>{erros.veiculo}</Text> : null}
            <SelectField
              label="MOTORISTA"
              opcoes={opcoesMotorista}
              valor={motoristaId}
              onSelecionar={setMotoristaId}
              vazio="Nenhum usuário com perfil Motorista"
            />
            {erros.motorista ? <Text style={styles.erro}>{erros.motorista}</Text> : null}
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

            <BotoesFormulario onCancelar={() => navigation.goBack()} onConfirmar={salvar} confirmarLabel="Cadastrar" salvando={salvando} />
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
  blocoRoteamento: { marginTop: -4, marginBottom: 16 },
  btnCalcular: {
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDesabilitado: { opacity: 0.6 },
  linhaAcao: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnCalcularTexto: { color: '#121212', fontSize: 13, fontWeight: '700' },
  cardSugestao: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    padding: 12,
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sugestaoCabecalho: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, marginRight: 8 },
  sugestaoTexto: { color: '#FFF', fontSize: 13 },
  sugestaoDestaque: { fontWeight: '700', color: '#4ADE80' },
  btnUsarSugestao: {
    backgroundColor: '#4ADE80',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  btnUsarSugestaoTexto: { color: '#064E3B', fontSize: 12, fontWeight: '700' },
  blocoDistancia: { marginBottom: 16 },
  badgeOrigemContainer: { marginTop: -8, marginBottom: 8, flexDirection: 'row' },
  badgeOrigem: { borderRadius: 6, paddingVertical: 3, paddingHorizontal: 8 },
  badgeSugerido: { backgroundColor: 'rgba(74, 222, 128, 0.2)', borderWidth: 1, borderColor: '#4ADE80' },
  badgeManual: { backgroundColor: 'rgba(255, 255, 255, 0.15)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.3)' },
  badgeOrigemTexto: { color: '#FFF', fontSize: 11, fontWeight: '600' },
  atribuicao: { color: 'rgba(255, 255, 255, 0.6)', fontSize: 11, fontStyle: 'italic', marginTop: 2 },
});
