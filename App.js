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
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// adb reverse tcp:3000 tcp:3000
// npx expo run:android
// node --watch ./backend/server.js 
// backend hospedado: https://frotix.onrender.com
// por enquanto estarei usando local 