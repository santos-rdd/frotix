import React, { useEffect, useState } from 'react';
import { Alert, View, ActivityIndicator } from 'react-native';
import { NavigationContainer, createNavigationContainerRef, CommonActions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from './src/screens/homeScreen/homeScreen.js';
import LoginScreen from './src/screens/login/loginScreen.js'; 
import HomePage from './src/screens/home/homePage.js';
import ForgotPasswordScreen from './src/screens/loginEmailScreen/loginEmailScreen.js';
import VerifyCodeScreen from './src/screens/verifyCodeScreen/verifyCodeScreen.js';
import UserProfileScreen from './src/screens/user/userOptions.js';
import UploadProofScreen from './src/screens/upload/uploadProof.js';
import TransactionFormScreen from './src/screens/transactionFormScreen/transactionFormScreen.js';
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
import Extrato from './src/screens/extrato/extrato.js';
import Dividas from './src/screens/dividas/dividas.js';
import DetalheDivida from './src/screens/detalheDivida/detalheDivida.js';
import Abastecimentos from './src/screens/abastecimentos/abastecimentos.js';
import { definirAoExpirarSessao, carregarSessao } from './src/services/api.js';
import { iniciarModoOffline } from './src/services/offline.js';

const Stack = createNativeStackNavigator();
const navigationRef = createNavigationContainerRef();

export default function App() {
  // undefined = ainda conferindo; null = sem sessão (abre o onboarding); objeto = entra direto.
  const [sessao, setSessao] = useState(undefined);

  // Se o backend responder 401 (token vencido ou inválido), volta para o login.
  useEffect(() => {
    definirAoExpirarSessao(() => {
      if (!navigationRef.isReady()) return;
      Alert.alert('Sessão encerrada', 'Entre novamente para continuar.');
      navigationRef.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Login' }] }));
    });
    // Login salvo: se o token ainda vale, abre direto na Home (persistência de sessão).
    carregarSessao().then(setSessao).catch(() => setSessao(null));
    // Fila do modo offline do motorista: envia sozinha quando a internet volta.
    iniciarModoOffline();
  }, []);

  if (sessao === undefined) {
    return (
      <View style={{ flex: 1, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#FFF" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator 
        initialRouteName={sessao ? 'HomePage' : 'Home'}
        screenOptions={{ headerShown: false }} 
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="HomePage" component={HomePage} initialParams={sessao || undefined} />
        <Stack.Screen name="LoginEmail" component={ForgotPasswordScreen} />
        <Stack.Screen name="VerifyCodeScreen" component={VerifyCodeScreen} />
        <Stack.Screen name="userProfile" component={UserProfileScreen} />
        <Stack.Screen name="uploadProof" component={UploadProofScreen} />
        <Stack.Screen name="TransactionForm" component={TransactionFormScreen} />
        <Stack.Screen name="RegisterUser" component={RegisterUserScreen} />
        <Stack.Screen name="ManageUser" component={ManageUserScreen} />
        <Stack.Screen name="UserDetail" component={UserDetailScreen} />
        <Stack.Screen name="GestorHome" component={GestorHome} />
        <Stack.Screen name="Viagens" component={Viagens} />
        <Stack.Screen name="Veiculos" component={Veiculos} />
        <Stack.Screen name="Rotas" component={Rotas} />
        <Stack.Screen name="DetalhesRota" component={DetalhesRota} />
        <Stack.Screen name="CadastroVeiculo" component={CadastroVeiculo} />
        <Stack.Screen name="CadastroRota" component={CadastroRota} />
        <Stack.Screen name="Manutencao" component={Manutencao} />
        <Stack.Screen name="Relatorios" component={Relatorios} />
        <Stack.Screen name="Categorias" component={Categorias} />
        <Stack.Screen name="Extrato" component={Extrato} />
        <Stack.Screen name="Dividas" component={Dividas} />
        <Stack.Screen name="DetalheDivida" component={DetalheDivida} />
        <Stack.Screen name="Abastecimentos" component={Abastecimentos} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// Como rodar (backend local, emulador, .env): veja CONFIGURACAO.md
