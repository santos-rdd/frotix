import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Image,
  Alert
} from 'react-native';
import { GoogleSignin, isSuccessResponse, statusCodes } from '@react-native-google-signin/google-signin';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [auth, setAuth] = useState('');

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: '716901513376-tnb5fm21k2t2hlavoei6n7052m2terdk.apps.googleusercontent.com', 
      offlineAccess: true,
      scopes: ['profile', 'email'],
    });
  }, []);

  async function singIn(){
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();
      
      if(isSuccessResponse(response)){
        console.log("Login com sucesso:", response.data);
        setAuth(response.data);
        navigation.navigate('HomePage');
      }
    } catch(err){
      console.log("Erro completo no login:", JSON.stringify(err, null, 2), err);
      if (err.code === statusCodes.SIGN_IN_CANCELLED) {
        Alert.alert("Aviso", "Login cancelado pelo usuário.");
      } else if (err.code === statusCodes.IN_PROGRESS) {
        Alert.alert("Aguarde", "O login já está em andamento.");
      } else if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert("Erro", "Google Play Services desatualizado ou não disponível.");
      } else {
        Alert.alert(
          "Erro na Autenticação Google", 
          `Código: ${err.code}\n${err.message || 'DEVELOPER_ERROR: Verifique o SHA-1 no Google Cloud Console.'}`
        );
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>

        <View style={styles.headerContainer}>
          <Text style={styles.title}>
            Log in no Froti<Text style={styles.titleX}>X</Text>
          </Text>
          <Text style={styles.subtitle}>
            Bem-Vindo! Acesse usando seu cadastro{'\n'}ou vincule seu email para prosseguir
          </Text>
        </View>

        <TouchableOpacity  
          onPress={() => singIn()}
          style={styles.googleButton} activeOpacity={0.8}>
          <Image
            source={require('../../assets/icons/logo.png')}
            style={styles.imageGoogle}
            />

          <Text 
          style={styles.googleButtonText}>
            Entrar com Gmail
          </Text>
        </TouchableOpacity>

        <View style={styles.dividerContainer}>
          <View style={styles.line} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.line} />
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Seu Email</Text>
            <TextInput
              style={styles.input}
              placeholder=""
              placeholderTextColor="#666"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Senha</Text>
            <TextInput
              style={styles.input}
              placeholder=""
              placeholderTextColor="#666"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <TouchableOpacity 
            style={styles.checkboxContainer} 
            activeOpacity={0.8}
            onPress={() => setRememberMe(!rememberMe)}
          >
            <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
              {rememberMe && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checkboxLabel}>Lembrar Minha Senha</Text>
          </TouchableOpacity>
        </View>

        {/* Botão Principal de Login */}
        <View style={styles.footer}>
          <TouchableOpacity 
          style={styles.loginButton} activeOpacity={0.8}>
            <Text style={styles.loginButtonText}>Log In</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.forgotPasswordContainer}>
            <Text style={styles.forgotPasswordText}>Esqueceu a senha?</Text>
          </TouchableOpacity>
        </View>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 10,
    justifyContent: 'flex-start',
  },
  backButton: {
    marginBottom: 10,
    width: 40,
    paddingTop: 20
  },
  imageGoogle: {
    position: 'absolute',
    left: 75,
    width: 24,
    height: 24,
    top: 20
  },
  backArrow: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '300',
    lineHeight: 36,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 25,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  titleX: {
    color: '#3B56FF',
  },
  subtitle: {
    fontSize: 13,
    color: '#999999',
    textAlign: 'center',
    lineHeight: 18,
  },
  googleButton: {
    width: 327,
    height: 64,
    borderWidth: 1,
    borderColor: '#3045FF',
    backgroundColor: '#1A1A1A',
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  googleButtonText: {
    color: '#3045FF',
    fontSize: 15,
    fontWeight: '500',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: '#2A2A2A',
  },
  dividerText: {
    color: '#666666',
    paddingHorizontal: 15,
    fontSize: 12,
    fontWeight: '600',
  },
  formContainer: {
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    color: '#888888',
    fontSize: 13,
    marginBottom: 5,
  },
  input: {
    color: '#FFFFFF',
    fontSize: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    paddingBottom: 8,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 1.5,
    borderColor: '#666666',
    borderRadius: 4,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#3B56FF',
    borderColor: '#3B56FF',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    color: '#CCCCCC',
    fontSize: 14,
  },
  footer: {
    marginTop: 'auto',
    marginBottom: 20,
    alignItems: 'center',
  },
  loginButton: {
    width: '100%',
    height: 54,
    backgroundColor: '#3B56FF',
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  forgotPasswordText: {
    color: '#CCCCCC',
    fontSize: 14,
    paddingBottom: 50
  },
});