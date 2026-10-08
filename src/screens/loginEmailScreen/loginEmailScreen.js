import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  SafeAreaView 
} from 'react-native';

export default function ForgotPasswordScreen({ navigation }) {
  const [emailInput, setEmailInput] = useState('');

  const handleSendRecoveryLink = () => {
    // Lógica para enviar o link de recuperação para o e-mail
    console.log('Link de recuperação enviado para:', emailInput);
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        
        {/* Botão Voltar */}
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>

        {/* Cabeçalho */}
        <View style={styles.headerContainer}>
          <Text style={styles.title}>
            Log in no Frot<Text style={styles.titleX}>X</Text>
          </Text>
          <Text style={styles.subtitle}>
            Esqueceu sua senha? Digite seu e-mail abaixo e enviaremos um código de verificação para você redefinir sua senha com segurança.
          </Text>
        </View>

        {/* Campo de E-mail */}
        <View style={styles.formContainer}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>E-mail:</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="seuemail@exemplo.com"
                placeholderTextColor="#666"
                value={emailInput}
                onChangeText={setEmailInput}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>
        </View>

        {/* Botão de Enviar Link */}
        <View style={styles.footer}>
          <TouchableOpacity 
            style={styles.loginButton} 
            activeOpacity={0.8}
            onPress={()=>{
                handleSendRecoveryLink
                navigation.navigate('VerifyCodeScreen')

            }}
          >
            <Text style={styles.loginButtonText}>Log In</Text>
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
    paddingTop: 20,
  },
  backArrow: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '300',
    lineHeight: 36,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 30,
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
  formContainer: {
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '500',
  },
  inputWrapper: {
    borderWidth: 1,
    borderColor: '#3045FF',
    borderRadius: 12,
    backgroundColor: '#1A1A1A',
    height: 56,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  input: {
    color: '#FFFFFF',
    fontSize: 15,
    padding: 0,
  },
  footer: {
    marginTop: 'auto',
    marginBottom: 40,
    alignItems: 'center',
  },
  loginButton: {
    width: '100%',
    height: 54,
    backgroundColor: '#3B56FF',
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 450,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});