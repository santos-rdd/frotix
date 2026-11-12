import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from './src/screens/homeScreen/homeScreen.js';
import LoginScreen from './src/screens/login/loginScreen.js'; 
import HomePage from './src/screens/home/homePage.js';
import ForgotPasswordScreen from './src/screens/loginEmailScreen/loginEmailScreen.js';
import VerifyCodeScreen from './src/screens/verifyCodeScreen/verifyCodeScreen.js';
import UserProfileScreen from './src/screens/user/userOptions.js';
import uploadProofScreen from './src/screens/upload/uploadProof.js';
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

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName="Home" 
        screenOptions={{ headerShown: false }} 
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="HomePage" component={HomePage} />
        <Stack.Screen name="LoginEmail" component={ForgotPasswordScreen} />
        <Stack.Screen name="VerifyCodeScreen" component={VerifyCodeScreen} />
        <Stack.Screen name="userProfile" component={UserProfileScreen} />
        <Stack.Screen name="uploadProof" component={uploadProofScreen} />
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// adb reverse tcp:3000 tcp:3000
// npx expo run:android
// node --watch ./backend/server.js 
// backend hospedado: https://frotix.onrender.com
// por enquanto estarei usando local 