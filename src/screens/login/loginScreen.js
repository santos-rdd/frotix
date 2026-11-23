import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator
} from 'react-native';
import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import GOOGLE_CONFIG from '../../config/google.js';
import { API_URL } from '../../config/api.js';
import {
  biometriaConfigurada,
  habilitarBiometria,
  carregarCredenciaisLembradas,
  recuperarSessaoBiometrica,
  removerCredenciaisLembradas,
  salvarCredenciaisLembradas,
  salvarSessao,
} from '../../services/api.js';
import { CommonActions } from '@react-navigation/native';



const irParaHome = (navigation, params) =>
  navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'HomePage', params }] }));

export default function LoginScreen({ navigation }) {
  const [emailInput, setEmailInput] = useState(''); 
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);


  const [entrando, setEntrando] = useState(null);

  useEffect(() => { 
    GoogleSignin.configure({
      webClientId: GOOGLE_CONFIG.webClientId,
      offlineAccess: true,
      scopes: ['profile', 'email'],
    });
  }, []); 

  useEffect(() => {
    let ativa = true;
    carregarCredenciaisLembradas()
      .then((credenciais) => {
        if (!ativa || !credenciais) return;
        setEmailInput(credenciais.email);
        setPassword(credenciais.senha);
        setRememberMe(true);
      })
      .catch((error) => {
        console.warn('Não foi possível carregar as credenciais salvas:', error?.message);
      });

    recuperarSessaoBiometrica()
      .then((resultado) => {
        if (!ativa || resultado.status !== 'success') return;
        irParaHome(navigation, { bankUser: resultado.data.usuario });
      })
      .catch((error) => {
        console.warn('Não foi possível iniciar o acesso biométrico:', error?.message);
      });

    return () => {
      ativa = false;
    };
  }, [navigation]);

  const oferecerBiometria = async (refreshToken) => {
    if (!refreshToken) return;
    try {
      if (await biometriaConfigurada()) return;
      const localAuth = await import('expo-local-authentication');
      const [hardware, cadastrada] = await Promise.all([
        localAuth.hasHardwareAsync(),
        localAuth.isEnrolledAsync(),
      ]);
      if (!hardware || !cadastrada) return;
    } catch (error) {
      console.warn('Não foi possível verificar a disponibilidade biométrica:', error?.message);
      return;
    }

    Alert.alert(
      'Ativar acesso biométrico?',
      'Use sua biometria para renovar sua sessão Frotix nas próximas entradas.',
      [
        { text: 'Agora não', style: 'cancel' },
        {
          text: 'Ativar',
          onPress: async () => {
            try {
              const resultado = await habilitarBiometria(refreshToken);
              if (resultado.status === 'unavailable') {
                Alert.alert('Biometria indisponível', 'Configure uma biometria no dispositivo para ativar este acesso.');
              }
            } catch {
              Alert.alert('Não foi possível ativar', 'Tente novamente ou continue usando e-mail e senha.');
            }
          },
        },
      ]
    );
  };

  const finalizarLogin = async (data, opcoes = {}) => {
    if (data.sessao?.access_token) {
      await salvarSessao(data.sessao);
    } else if (data.token) {
      await salvarSessao({ access_token: data.token });
    } else {
      throw new Error('O servidor não retornou um token de acesso.');
    }

    if (opcoes.salvarSenha) {
      await salvarCredenciaisLembradas(emailInput.trim(), password);
    } else if (opcoes.limparSenhaSalva) {
      await removerCredenciaisLembradas();
    }

    irParaHome(navigation, opcoes.params || { bankUser: data.usuario });
    await oferecerBiometria(data.sessao?.refresh_token);
  };
  
  
const logIn = async (idToken, googleData) => {
    try {
        console.log('Enviando autenticação Google para:', `${API_URL}/auth/login-google`);

        const response = await fetch(`${API_URL}/auth/login-google`, {
            method: 'POST',

            headers: {
                'Content-Type': 'application/json',
            },

            body: JSON.stringify({
                idToken
            }),
        });

        const data = await response.json();

        if (response.ok) {
            console.log('Login Google autorizado!', data.usuario);
            await finalizarLogin(data, {
                params: {
                    auth: {
                        user: googleData?.user || {}
                    },
                    bankUser: data.usuario
                }
            });

        } else {
            console.log('Acesso negado:', data.erro);

            Alert.alert(
                'Acesso Negado',
                data.erro || 'Não foi possível autenticar com o Google.'
            );
        }

    } catch (error) {
        console.error('Erro de conexão com o servidor:', error);

        Alert.alert(
            'Erro de Conexão',
            `Não foi possível conectar em ${API_URL}. Verifique o servidor.`
        );
    }
};


 
async function singIn() {
    try {
        await GoogleSignin.hasPlayServices({
            showPlayServicesUpdateDialog: true
        });

        try {
            await GoogleSignin.signOut();
        } catch (error) {
            console.log('Nenhuma sessão anterior para limpar.');
        }

        const response = await GoogleSignin.signIn();

        if (isSuccessResponse(response)) {
            const googleData = response.data;

            const idToken = googleData.idToken;

            if (!idToken) {
                Alert.alert(
                    'Erro de autenticação',
                    'O Google não forneceu o ID Token. Confira o Web Client ID na configuração.'
                );

                return;
            }

            console.log('Conta Google selecionada:', googleData.user.email);

            await logIn(idToken, googleData);

        } else {
            console.log('Login Google cancelado pelo usuário.');
        }

    } catch (err) {
        console.log(
            'Erro completo no login:',
            JSON.stringify(err, null, 2)
        );

        Alert.alert(
            'Erro',
            `Falha na autenticação com o Google: ${err.message || err}`
        );
    }
}


  const handleEmailLogin = async () => {
    if (!emailInput || !password) {
      Alert.alert("Atenção", "Preencha o e-mail e a senha.");
      return;
    }

    if (entrando) return;
    setEntrando('email');
    try {

      const response = await fetch(`${API_URL}/auth/login-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: emailInput, password: password }),
      });

      const data = await response.json();

      if (response.ok) {
          console.log('Login por email autorizado!', data.usuario);
          await finalizarLogin(data, {
              salvarSenha: rememberMe,
              limparSenhaSalva: !rememberMe,
              params: { bankUser: data.usuario }
          });
      } else {
        Alert.alert("Acesso Negado", data.erro || "Credenciais inválidas.");
      }
    } catch (error) {
      console.error('Erro de conexão no login por email:', error);
      Alert.alert("Erro", "Não foi possível conectar ao servidor.");
    } finally {
      setEntrando(null);
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
          disabled={Boolean(entrando)}
          style={styles.googleButton} activeOpacity={0.8}>
          {entrando === 'google' ? (
            <ActivityIndicator color="#FFF" style={styles.imageGoogle} />
          ) : (
            <Image
              source={require('../../../assets/icons/logo.png')}
              style={styles.imageGoogle}
              />
          )}

          <Text 
          style={styles.googleButtonText}>
            {entrando === 'google' ? 'Entrando...' : 'Entrar com Gmail'}
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
              value={emailInput}
              onChangeText={setEmailInput}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Senha</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder=""
                placeholderTextColor="#666"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity 
                style={styles.eyeButton} 
                onPress={() => setShowPassword(!showPassword)}
              >
                <Text style={styles.eyeText}>{showPassword ? 'O' : 'Ø'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity 
            style={styles.checkboxContainer} 
            activeOpacity={0.8}
            onPress={() => {
              if (rememberMe) {
                setRememberMe(false);
                removerCredenciaisLembradas().catch(() => {
                  Alert.alert('Não foi possível remover', 'Tente novamente para excluir a senha salva.');
                });
              } else {
                setRememberMe(true);
              }
            }}
          >
            <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
              {rememberMe && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checkboxLabel}>Lembrar Minha Senha</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity 
          style={styles.loginButton} activeOpacity={0.8}
          onPress={handleEmailLogin}
          disabled={Boolean(entrando)}
          >
            {entrando === 'email' ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.loginButtonText}>Log In</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
          style={styles.forgotPasswordContainer}
          onPress={() => navigation.navigate('LoginEmail')} >
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
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  passwordInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    paddingBottom: 8,
  },
  eyeButton: {
    paddingHorizontal: 8,
    paddingBottom: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eyeText: {
    color: '#888888',
    fontSize: 16,
    fontWeight: 'bold',
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