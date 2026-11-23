
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { concluirRecuperacaoSenha } from '../../services/authRecovery.js';
import { removerCredenciaisDeAutenticacao } from '../../services/api.js';

export default function ResetPasswordScreen({ navigation, route }) {
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [salvando, setSalvando] = useState(false);

  const redefinir = async () => {
    if (senha.length < 6 || senha !== confirmacao) {
      Alert.alert(
        'Confira a senha',
        'Use ao menos 6 caracteres e confirme a mesma senha.'
      );
      return;
    }

    if (salvando) return;

    setSalvando(true);

    try {
      const resposta = await concluirRecuperacaoSenha({
        token_hash: route.params?.token_hash,
        access_token: route.params?.access_token,
        refresh_token: route.params?.refresh_token,
        password: senha,
      });

      let erroLimpeza = false;

      try {
        await removerCredenciaisDeAutenticacao();
      } catch {
        erroLimpeza = true;
      }

      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        })
      );

      Alert.alert(
        'Senha redefinida',
        erroLimpeza
          ? `${resposta.mensagem} Não foi possível remover todas as credenciais deste dispositivo.`
          : resposta.mensagem
      );
    } catch (error) {
      Alert.alert('Não foi possível redefinir', error.message);
    } finally {
      setSalvando(false);
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
            Redefinir senha do Frot
            <Text style={styles.titleX}>X</Text>
          </Text>

          <Text style={styles.subtitle}>
            Informe e confirme sua nova senha.
          </Text>
        </View>


        <View style={styles.formContainer}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Nova senha</Text>

            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Digite sua nova senha"
                placeholderTextColor="#666"
                value={senha}
                onChangeText={setSenha}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Confirmar nova senha</Text>

            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Confirme sua nova senha"
                placeholderTextColor="#666"
                value={confirmacao}
                onChangeText={setConfirmacao}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>
          </View>
        </View>


        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.loginButton}
            activeOpacity={0.8}
            onPress={redefinir}
            disabled={salvando}
          >
            {salvando ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.loginButtonText}>
                Salvar nova senha
              </Text>
            )}
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
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
