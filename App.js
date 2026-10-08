import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from './src/screens/homeScreen/homeScreen.js';
import LoginScreen from './src/screens/login/loginScreen.js'; 
import HomePage from './src/screens/home/homePage.js';
import ForgotPasswordScreen from './src/screens/loginEmailScreen/loginEmailScreen.js';
import VerifyCodeScreen from './src/screens/verifyCodeScreen/verifyCodeScreen.js';

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
      </Stack.Navigator>
    </NavigationContainer>
  );
<<<<<<< HEAD
}

// adb reverse tcp:3000 tcp:3000
// npx expo run:android
// node --watch ./backend/server.js 
=======
}
>>>>>>> e110326ceb7b63258327fd89dc1b2591e7a009b4
