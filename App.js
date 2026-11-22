import React, { useEffect, useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { NavigationContainer, createNavigationContainerRef, CommonActions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as ExpoLinking from 'expo-linking';

import HomeScreen from './src/screens/homeScreen/homeScreen.js';
import LoginScreen from './src/screens/login/loginScreen.js'; 
import HomePage from './src/screens/home/homePage.js';
import ForgotPasswordScreen from './src/screens/loginEmailScreen/loginEmailScreen.js';
import VerifyCodeScreen from './src/screens/verifyCodeScreen/verifyCodeScreen.js';
import ResetPasswordScreen from './src/screens/resetPasswordScreen/resetPasswordScreen.js';
import UserProfileScreen from './src/screens/user/userOptions.js';
import UploadProofScreen from './src/screens/upload/uploadProof.js';
import TransactionFormScreen from './src/screens/transactionFormScreen/transactionFormScreen.js';
import Extrato from './src/screens/extrato/extrato.js';
import Dividas from './src/screens/dividas/dividas.js';
import DetalheDivida from './src/screens/detalheDivida/detalheDivida.js';
import RegisterUserScreen from './src/screens/registerUserScreen/registerUserScreen.js';
import ManageUserScreen from './src/screens/manageUserScreen/manageUserScreen.js';
import UserDetailScreen from './src/screens/userDetailScreen/userDetailScreen.js';
import GestorHome from './src/screens/gestorHome/gestorHome.js';
import Viagens from './src/screens/viagens/viagens.js';
import Veiculos from './src/screens/veiculos/veiculos.js';
import Rotas from './src/screens/rotas/rotas.js';
import DetalhesRota from './src/screens/detalhesRota/detalhesRota.js';
import CadastroVeiculo from './src/screens/cadastroVeiculo/cadastroVeiculo.js';
import CadastroRota from './src/screens/cadastroRota/cadastroRota.js';
import Manutencao from './src/screens/manutencao/manutencao.js';
import Relatorios from './src/screens/relatorios/relatorios.js';
import Categorias from './src/screens/categorias/categorias.js';
import { definirAoExpirarSessao, obterUsuarioLogado } from './src/services/api.js';
import { abrirBanco } from './src/database/index.js';
import { iniciarMonitorConectividade, recuperarOperacoesInterrompidas } from './src/services/syncService.js';
import { podeAcessarTela } from './src/navigation/permissions.js';

const Stack = createNativeStackNavigator();
const navigationRef = createNavigationContainerRef();

function parametrosDaUrl(url) {
  const [principal, fragmento = ''] = url.split('#');
  const consulta = principal.includes('?') ? principal.slice(principal.indexOf('?') + 1) : '';
  const parsear = (texto) => Object.fromEntries(
    texto.split('&').filter(Boolean).map((parte) => {
      const [chave, ...valor] = parte.split('=');
      try {
        return [
          decodeURIComponent(chave.replace(/\+/g, ' ')),
          decodeURIComponent(valor.join('=').replace(/\+/g, ' ')),
        ];
      } catch {
        return ['', ''];
      }
    }).filter(([chave]) => chave)
  );
  return { ...parsear(consulta), ...parsear(fragmento) };
}

function RotaComPermissao({ Component, ...props }) {
  const [sessao, setSessao] = useState(null);
  const [verificando, setVerificando] = useState(true);
  const route = props.route || {};
  const telaPermitida = sessao && podeAcessarTela(sessao.role, route.name);

  useEffect(() => {
    let ativa = true;
    obterUsuarioLogado()
      .then((payload) => {
        if (!ativa) return;
        const role = Number(payload?.perfil ?? payload?.role);
        if (!payload?.sub || ![1, 2, 3, 4].includes(role)) {
          setSessao(null);
          return;
        }
        setSessao({
          id: String(payload.sub),
          nome: payload.nome || '',
          role,
        });
      })
      .catch((erro) => {
        console.warn('Não foi possível validar o perfil da sessão:', erro?.message || erro);
        if (ativa) setSessao(null);
      })
      .finally(() => {
        if (ativa) setVerificando(false);
      });
    return () => {
      ativa = false;
    };
  }, []);

  useEffect(() => {
    if (verificando) return;
    if (!sessao) {
      props.navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Login' }] }));
    } else if (!telaPermitida) {
      props.navigation.dispatch(CommonActions.reset({
        index: 0,
        routes: [{
          name: 'HomePage',
          params: { authenticatedUser: sessao, usuario: sessao },
        }],
      }));
    }
  }, [props.navigation, sessao, telaPermitida, verificando]);

  if (verificando || !sessao || !telaPermitida) {
    return (
      <View style={{ flex: 1, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#FFF' }}>
          {verificando ? 'Validando acesso...' : 'Acesso não permitido.'}
        </Text>
      </View>
    );
  }

  const usuario = {
    ...route.params?.usuario,
    id: sessao.id,
    nome: sessao.nome || route.params?.usuario?.nome,
    role: sessao.role,
  };
  const params = {
    ...route.params,
    usuario,
    authenticatedUser: sessao,
    usuarioLogado: { ...route.params?.usuarioLogado, ...sessao },
  };
  if (route.params?.bankUser) {
    params.bankUser = { ...route.params.bankUser, id: sessao.id, role: sessao.role };
  }
  if (sessao.role === 4 && route.name === 'Viagens') {
    params.modo = 'motorista';
  }

  return <Component {...props} route={{ ...route, params }} />;
}

function protegerTela(Component) {
  return function TelaProtegida(props) {
    return <RotaComPermissao {...props} Component={Component} />;
  };
}

const HomePageProtegida = protegerTela(HomePage);
const UserProfileProtegida = protegerTela(UserProfileScreen);
const UploadProofProtegida = protegerTela(UploadProofScreen);
const TransactionFormProtegida = protegerTela(TransactionFormScreen);
const ExtratoProtegido = protegerTela(Extrato);
const DividasProtegidas = protegerTela(Dividas);
const DetalheDividaProtegida = protegerTela(DetalheDivida);
const RegisterUserProtegida = protegerTela(RegisterUserScreen);
const ManageUserProtegida = protegerTela(ManageUserScreen);
const UserDetailProtegida = protegerTela(UserDetailScreen);
const GestorHomeProtegida = protegerTela(GestorHome);
const ViagensProtegida = protegerTela(Viagens);
const VeiculosProtegida = protegerTela(Veiculos);
const RotasProtegida = protegerTela(Rotas);
const DetalhesRotaProtegida = protegerTela(DetalhesRota);
const CadastroVeiculoProtegida = protegerTela(CadastroVeiculo);
const CadastroRotaProtegida = protegerTela(CadastroRota);
const ManutencaoProtegida = protegerTela(Manutencao);
const RelatoriosProtegida = protegerTela(Relatorios);
const CategoriasProtegida = protegerTela(Categorias);

export default function App() {
  const recoveryUrlPendente = useRef(null);
  const recoveryUrlProcessada = useRef(null);

  const abrirRecuperacaoPorUrl = (url) => {
    if (!url || !/^frotix:\/\/auth\/recovery(?:[?#]|$)/i.test(url)) return;
    if (recoveryUrlProcessada.current === url) return;
    const params = parametrosDaUrl(url);
    if (params.type !== 'recovery') return;

    if (!navigationRef.isReady()) {
      recoveryUrlPendente.current = url;
      return;
    }

    recoveryUrlProcessada.current = url;
    navigationRef.dispatch(CommonActions.reset({
      index: 0,
      routes: [{ name: 'ResetPassword', params }],
    }));
  };

  useEffect(() => {
    let cancelarMonitor = null;

    abrirBanco()
      .then(() => recuperarOperacoesInterrompidas())
      .then(() => {
        cancelarMonitor = iniciarMonitorConectividade();
      })
      .catch(() => {});

    definirAoExpirarSessao(() => {
      if (!navigationRef.isReady()) return;
      Alert.alert('Sessão encerrada', 'Entre novamente para continuar.');
      navigationRef.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Login' }] }));
    });

    return () => {
      cancelarMonitor?.();
    };
  }, []);

  useEffect(() => {
    let ativa = true;
    ExpoLinking.getInitialURL()
      .then((url) => {
        if (ativa) abrirRecuperacaoPorUrl(url);
      })
      .catch((error) => {
        console.warn('Não foi possível ler o link inicial:', error?.message);
      });

    const subscription = ExpoLinking.addEventListener('url', ({ url }) => {
      abrirRecuperacaoPorUrl(url);
    });

    return () => {
      ativa = false;
      subscription.remove();
    };
  }, []);

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        if (recoveryUrlPendente.current) {
          const url = recoveryUrlPendente.current;
          recoveryUrlPendente.current = null;
          abrirRecuperacaoPorUrl(url);
        }
      }}
    >
      <Stack.Navigator 
        initialRouteName="Home" 
        screenOptions={{ headerShown: false }} 
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="HomePage" component={HomePageProtegida} />
        <Stack.Screen name="LoginEmail" component={ForgotPasswordScreen} />
        <Stack.Screen name="VerifyCodeScreen" component={VerifyCodeScreen} />
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        <Stack.Screen name="userProfile" component={UserProfileProtegida} />
        <Stack.Screen name="uploadProof" component={UploadProofProtegida} />
        <Stack.Screen name="TransactionForm" component={TransactionFormProtegida} />
        <Stack.Screen name="Extrato" component={ExtratoProtegido} />
        <Stack.Screen name="Dividas" component={DividasProtegidas} />
        <Stack.Screen name="DetalheDivida" component={DetalheDividaProtegida} />
        <Stack.Screen name="RegisterUser" component={RegisterUserProtegida} />
        <Stack.Screen name="ManageUser" component={ManageUserProtegida} />
        <Stack.Screen name="UserDetail" component={UserDetailProtegida} />
        <Stack.Screen name="GestorHome" component={GestorHomeProtegida} />
        <Stack.Screen name="Viagens" component={ViagensProtegida} />
        <Stack.Screen name="Veiculos" component={VeiculosProtegida} />
        <Stack.Screen name="Rotas" component={RotasProtegida} />
        <Stack.Screen name="DetalhesRota" component={DetalhesRotaProtegida} />
        <Stack.Screen name="CadastroVeiculo" component={CadastroVeiculoProtegida} />
        <Stack.Screen name="CadastroRota" component={CadastroRotaProtegida} />
        <Stack.Screen name="Manutencao" component={ManutencaoProtegida} />
        <Stack.Screen name="Relatorios" component={RelatoriosProtegida} />
        <Stack.Screen name="Categorias" component={CategoriasProtegida} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
