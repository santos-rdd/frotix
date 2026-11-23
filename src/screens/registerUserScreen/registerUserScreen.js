
import React, { useState, useEffect } from 'react';

import {
    StyleSheet,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Modal,
    FlatList,
    ActivityIndicator,
    Alert
} from 'react-native';

import { Feather, Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { criarUsuarioEmail, criarUsuarioGoogle, reenviarConfirmacao } from '../../services/frotix.js';
import { obterUsuarioLogado } from '../../services/api.js';

export default function RegisterUserScreen() {
    const navigation = useNavigation();
    const route = useRoute();

    useEffect(() => {
        let montado = true;
        obterUsuarioLogado().then((user) => {
            const perfil = route?.params?.usuario?.role || user?.perfil;
            if (perfil && Number(perfil) !== 1) {
                if (montado) {
                    Alert.alert('Acesso Restrito', 'O cadastro de usuários é exclusivo do Administrador.');
                    navigation.goBack();
                }
            }
        });
        return () => { montado = false; };
    }, [navigation, route?.params?.usuario?.role]);

    const [metodoCadastroConcluido, setMetodoCadastroConcluido] = useState('email');
    const [nome, setNome] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const [accessMethod, setAccessMethod] = useState('email');
    const [perfil, setPerfil] = useState('Motorista');

    const [modalVisible, setModalVisible] = useState(false);

    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);

    const [cadastroConcluido, setCadastroConcluido] = useState(false);
    const [emailCadastrado, setEmailCadastrado] = useState('');

    const perfisDisponiveis = [
        'Motorista',
        'Gestor de Frota',
        'Financeiro',
        'Admin'
    ];

    const perfisIDs = {
        'Admin': 1,
        'Gestor de Frota': 2,
        'Financeiro': 3,
        'Motorista': 4
    };

    
const handleSave = async () => {
    if (loading) return;

    const nomeLimpo = nome.trim();
    const emailLimpo = email.trim().toLowerCase();

    if (!nomeLimpo || !emailLimpo) {
        Alert.alert('Atenção', 'Preencha seu nome e e-mail.');
        return;
    }

    const formatoEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    if (!formatoEmail.test(emailLimpo)) {
        Alert.alert('E-mail inválido', 'Informe um endereço válido.');
        return;
    }


    if (accessMethod === 'email' && !password) {
        Alert.alert('Atenção', 'Informe uma senha.');
        return;
    }

    if (accessMethod === 'email' && password.length < 6) {
        Alert.alert(
            'Senha inválida',
            'A senha deve possuir pelo menos 6 caracteres.'
        );
        return;
    }

    try {
        setLoading(true);
        setCadastroConcluido(false);



        const userData = {
            nome: nomeLimpo,
            email: emailLimpo,
            id_perfil: perfisIDs[perfil],
            imagem: null,
            accessMethod
        };


        if (accessMethod === 'email') {
            userData.password = password;
            await criarUsuarioEmail(userData);
        } else {
            await criarUsuarioGoogle({
                nome: nomeLimpo,
                email: emailLimpo,
                perfil: perfisIDs[perfil]
            });
        }

        setEmailCadastrado(emailLimpo);
        setMetodoCadastroConcluido(accessMethod);
        setCadastroConcluido(true);

        setNome('');
        setEmail('');
        setPassword('');
        setAccessMethod('email');
        setPerfil('Motorista');

    } catch (error) {
        console.error('Erro ao cadastrar usuário:', error);

        const mensagem = error instanceof Error
            ? error.message
            : 'Não foi possível cadastrar o usuário.';

        const ehErroConexao = /conexão|internet|network|failed|timeout|servidor|offline|econnrefused/i.test(mensagem);
        if (ehErroConexao) {
            Alert.alert(
                'Sem conexão com a internet',
                'Não foi possível conectar ao servidor. O cadastro de novos usuários requer conexão ativa para provisionar as credenciais de acesso com segurança.'
            );
        } else {
            Alert.alert('Erro no cadastro', mensagem);
        }

    } finally {
        setLoading(false);
    }
};


    const handleResendConfirmation = async () => {
        if (resending || !emailCadastrado) return;

        try {
            setResending(true);

            await reenviarConfirmacao(emailCadastrado);

            Alert.alert(
                'E-mail enviado!',
                'Verifique sua caixa de entrada e a pasta de spam.'
            );

       } catch (error) {
            console.error('Erro ao reenviar confirmação:', error);

            const mensagem = error instanceof Error
                ? error.message
                : 'Não foi possível reenviar a confirmação.';

            Alert.alert('Erro no reenvio', mensagem);

        } finally {
            setResending(false);
        }
    };

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
        >
            <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.goBack()}
            >
                <Feather name="arrow-left" size={22} color="#FFF" />
            </TouchableOpacity>

            <Text style={styles.title}>
                Cadastrar usuário no Froti
                <Text style={{ color: '#2541ff' }}>X</Text>
            </Text>


            <View style={styles.inputGroup}>
                <Text style={styles.label}>Nome</Text>

                <TextInput
                    style={styles.inputLine}
                    placeholder="Nome completo"
                    placeholderTextColor="#888"
                    value={nome}
                    onChangeText={setNome}
                    editable={!loading}
                />
            </View>


            <View style={styles.inputGroup}>
                <Text style={styles.label}>E-mail</Text>

                <TextInput
                    style={styles.inputLine}
                    placeholder="usuario@email.com"
                    placeholderTextColor="#888"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading}
                />
            </View>

            {accessMethod === 'email' && (
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Senha</Text>

                    <TextInput
                        style={styles.inputLine}
                        placeholder="Mínimo de 6 caracteres"
                        placeholderTextColor="#888"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        editable={!loading}
                    />
                </View>
            )}


            <Text style={styles.sectionLabel}>
                Forma de acesso:
            </Text>

            <TouchableOpacity
                style={[
                    styles.accessButton,
                    accessMethod === 'email'
                        ? styles.accessButtonActive
                        : styles.accessButtonInactive
                ]}
                onPress={() => setAccessMethod('email')}
                disabled={loading}
            >
                <Text style={styles.accessButtonText}>
                    E-mail e Senha
                </Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={[
                    styles.accessButton,
                    accessMethod === 'gmail'
                        ? styles.accessButtonActive
                        : styles.accessButtonInactive
                ]}
                onPress={() => {
                    setAccessMethod('gmail');
                    setPassword('');
                }}
                disabled={loading}
            >
                <Ionicons
                    name="logo-google"
                    size={18}
                    color="#4285F4"
                    style={{ marginRight: 8 }}
                />

                <Text style={styles.accessButtonText}>
                    Entrar com Gmail
                </Text>
            </TouchableOpacity>

           {accessMethod === 'gmail' && (
                <Text style={styles.googleNotice}>
                    O usuário deverá autenticar utilizando a conta Google
                    correspondente ao e-mail cadastrado.
                </Text>
            )}


            <Text style={styles.sectionLabel}>
                Perfil:
            </Text>

            <TouchableOpacity
                style={styles.selectBox}
                onPress={() => setModalVisible(true)}
                disabled={loading}
            >
                <Text style={styles.selectBoxText}>
                    {perfil}
                </Text>

                <Feather
                    name="chevron-down"
                    size={20}
                    color="#121212"
                />
            </TouchableOpacity>


            <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSave}
                disabled={loading}
            >
                {loading ? (
                    <ActivityIndicator color="#FFF" />
                ) : (
                    <Text style={styles.saveButtonText}>
                        Salvar
                    </Text>
                )}
            </TouchableOpacity>

           
            {cadastroConcluido && (
                <View style={styles.successBox}>

                    <Feather
                        name={metodoCadastroConcluido === 'email' ? 'mail' : 'check-circle'}
                        size={28}
                        color="#2541ff"
                    />

                    {metodoCadastroConcluido === 'email' ? (
                        <>
                            <Text style={styles.successTitle}>
                                Cadastro realizado!
                            </Text>

                            <Text style={styles.successText}>
                                O usuário precisa confirmar o endereço:
                            </Text>

                            <Text style={styles.successEmail}>
                                {emailCadastrado}
                            </Text>

                            <Text style={styles.successText}>
                                Oriente o usuário a verificar a caixa de entrada
                                e a pasta de spam.
                            </Text>

                            <TouchableOpacity
                                style={styles.resendButton}
                                onPress={handleResendConfirmation}
                                disabled={resending}
                            >
                                {resending ? (
                                    <ActivityIndicator color="#FFF" />
                                ) : (
                                    <Text style={styles.resendButtonText}>
                                        Reenviar confirmação
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            <Text style={styles.successTitle}>
                                Pré-cadastro Google realizado!
                            </Text>

                            <Text style={styles.successText}>
                                O usuário foi cadastrado para utilizar autenticação Google.
                            </Text>

                            <Text style={styles.successEmail}>
                                {emailCadastrado}
                            </Text>

                            <Text style={styles.successText}>
                                Para acessar o Frotix, deverá selecionar
                                "Entrar com Gmail" e utilizar essa mesma conta Google.
                            </Text>
                        </>
                    )}

                </View>
            )}

            <Modal
                visible={modalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setModalVisible(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setModalVisible(false)}
                >
                    <View
                        style={styles.modalContent}
                        onStartShouldSetResponder={() => true}
                    >
                        <Text style={styles.modalTitle}>
                            Selecione o Perfil
                        </Text>

                        <FlatList
                            data={perfisDisponiveis}
                            keyExtractor={(item) => item}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.modalItem}
                                    onPress={() => {
                                        setPerfil(item);
                                        setModalVisible(false);
                                    }}
                                >
                                    <Text
                                        style={[
                                            styles.modalItemText,
                                            perfil === item &&
                                                styles.modalItemTextActive
                                        ]}
                                    >
                                        {item}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </TouchableOpacity>
            </Modal>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
    },

    content: {
        padding: 20,
        paddingTop: 50,
        paddingBottom: 40,
    },

    backButton: {
        marginBottom: 20,
    },

    title: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 30,
    },

    inputGroup: {
        marginBottom: 20,
    },

    label: {
        color: '#FFF',
        fontSize: 14,
        marginBottom: 6,
    },

    inputLine: {
        borderBottomWidth: 1,
        borderBottomColor: '#555',
        color: '#FFF',
        fontSize: 14,
        paddingBottom: 4,
    },

    sectionLabel: {
        color: '#FFF',
        fontSize: 14,
        marginBottom: 12,
        marginTop: 5,
    },

    accessButton: {
        width: '100%',
        height: 50,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
        marginBottom: 12,
    },

    accessButtonActive: {
        backgroundColor: '#2541ff',
        borderWidth: 0,
    },

    accessButtonInactive: {
        backgroundColor: '#1a1a1a',
        borderWidth: 1,
        borderColor: '#2541ff',
    },

    accessButtonText: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '600',
    },

    googleNotice: {
        color: '#AAA',
        fontSize: 12,
        marginBottom: 16,
        lineHeight: 18,
    },

    selectBox: {
        width: '100%',
        height: 50,
        borderRadius: 14,
        backgroundColor: '#FFF',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginBottom: 30,
    },

    selectBoxText: {
        color: '#121212',
        fontSize: 15,
        fontWeight: '600',
    },

    saveButton: {
        width: '80%',
        height: 50,
        borderRadius: 14,
        backgroundColor: '#2541ff',
        justifyContent: 'center',
        alignItems: 'center',
        alignSelf: 'center',
    },

    saveButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
    successBox: {
        marginBottom: 35,
        marginTop: 25,
        padding: 20,
        borderRadius: 14,
        backgroundColor: '#1a1a1a',
        borderWidth: 1,
        borderColor: '#333',
        alignItems: 'center',
    },

    successTitle: {
        color: '#FFF',
        fontSize: 17,
        fontWeight: 'bold',
        marginTop: 12,
        marginBottom: 8,
    },

    successText: {
        color: '#AAA',
        fontSize: 13,
        textAlign: 'center',
        lineHeight: 19,
        marginTop: 5,
    },

    successEmail: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
        marginTop: 10,
        marginBottom: 5,
    },

    resendButton: {
        width: '100%',
        height: 46,
        borderRadius: 12,
        backgroundColor: '#2541ff',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 18,
    },

    resendButtonText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
    },

    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },

    modalContent: {
        width: '100%',
        backgroundColor: '#1a1a1a',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: '#333',
    },

    modalTitle: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 15,
        textAlign: 'center',
    },

    modalItem: {
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#2a2a2a',
    },

    modalItemText: {
        color: '#AAA',
        fontSize: 16,
        textAlign: 'center',
    },

    modalItemTextActive: {
        color: '#2541ff',
        fontWeight: 'bold',
    },
});
