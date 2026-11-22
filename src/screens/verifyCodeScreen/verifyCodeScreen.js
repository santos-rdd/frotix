import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  SafeAreaView 
} from 'react-native';

export default function VerifyCodeScreen({ navigation }) {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef([]);

  const [timer, setTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    let interval = null;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prevTimer) => prevTimer - 1);
      }, 1000);
    } else {
      setCanResend(true);
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const handleResendCode = () => {
    if (canResend) {
      console.log('Código reenviado!');
      setTimer(30); 
      setCanResend(false);
    }
  };

  const handleCodeChange = (text, index) => {
    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);

    if (text && index < 5) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleVerify = () => {
    const fullCode = code.join('');
    console.log('Código inserido:', fullCode);
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
            Verifique Seu{'\n'}<Text style={styles.titleBlue}>Email</Text>
          </Text>
          <Text style={styles.subtitle}>
            Um código de verificação foi enviado{'\n'}para o seu e-mail.
          </Text>
        </View>

        {/* Caixas de Texto para o Código (6 Dígitos) */}
        <View style={styles.otpContainer}>
          {code.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => (inputRefs.current[index] = ref)}
              style={styles.otpInput}
              keyboardType="number-pad"
              maxLength={1}
              value={digit}
              onChangeText={(text) => handleCodeChange(text, index)}
              placeholderTextColor="#666"
            />
          ))}
        </View>

        {/* Seção de Reenviar Código com Contador */}
        <View style={styles.resendContainer}>
          <Text style={styles.resendQuestion}>Não recebeu o código?</Text>
          <TouchableOpacity 
            onPress={handleResendCode}
            disabled={!canResend}
          >
            <Text style={[styles.resendText, !canResend && styles.resendTextDisabled]}>
              {canResend ? 'Reenviar' : `Reenviar Em ${timer}s`}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Botão Verificar */}
        <View style={styles.footer}>
          <TouchableOpacity 
            style={styles.verifyButton} 
            activeOpacity={0.8}
            onPress={()=> {
                handleVerify
            }}
          >
            <Text style={styles.verifyButtonText}>Verificar</Text>
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
    marginBottom: 25,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
    lineHeight: 34,
  },
  titleBlue: {
    color: '#3B56FF',
  },
  subtitle: {
    fontSize: 14,
    color: '#999999',
    lineHeight: 20,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 25,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderWidth: 1.5,
    borderColor: '#3045FF',
    borderRadius: 12,
    backgroundColor: '#1A1A1A',
    color: '#FFFFFF',
    fontSize: 22,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
    paddingHorizontal: 2,
  },
  resendQuestion: {
    color: '#999999',
    fontSize: 14,
  },
  resendText: {
    color: '#3B56FF',
    fontSize: 14,
    fontWeight: '600',
  },
  resendTextDisabled: {
    color: '#666666',
  },
  footer: {
    marginTop: 'auto',
    marginBottom: 40,
    alignItems: 'center',
  },
  verifyButton: {
    width: '100%',
    height: 54,
    backgroundColor: '#3B56FF',
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});