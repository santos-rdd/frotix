import React, { useEffect, useState } from 'react';

import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    Image,
    ActivityIndicator,
    Alert
} from 'react-native';
import { API_URL } from '../../config/api';

import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';


export default function ManageUserScreen() {
    const navigation = useNavigation();

    const [usuarios, setUsuarios] = useState([]);
    const [carregando, setCarregando] = useState(true);

    async function listarUsuarios() {
        try {
            setCarregando(true);

            const response = await fetch(`${API_URL}/usuarios/listar`);

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Não foi possível carregar os usuários.');
            }

            const listaUsuarios = Array.isArray(data)
                ? data
                : data.usuarios || data.data || [];

            setUsuarios(listaUsuarios);

        } catch (error) {
            console.error('Erro ao listar usuários:', error);

            Alert.alert(
                'Erro',
                'Não foi possível carregar a lista de usuários.'
            );

        } finally {
            setCarregando(false);
        }
    }

    useEffect(() => {
        listarUsuarios();
    }, []);

    const getRole = (user) => {
        const codigoPerfil =
            user.perfis?.codigo ||
            user.perfil?.codigo;

        if (codigoPerfil) {
            const perfis = {
                ADMIN: 'admin',
                GESTOR_FROTA: 'gestor',
                FINANCEIRO: 'financeiro',
                MOTORISTA: 'motorista'
            };

            return perfis[codigoPerfil.toUpperCase()] || 'motorista';
        }

        const perfisPorId = {
            1: 'admin',
            2: 'gestor',
            3: 'financeiro',
            4: 'motorista'
        };

        return perfisPorId[user.id_perfil] || 'motorista';
    };

    // Cor de identificação de cada perfil
    const getRoleColor = (role) => {
        switch (role) {
            case 'admin': return '#b22222';
            case 'gestor': return '#ff8c00';
            case 'financeiro': return '#ffd700';
            case 'motorista': return '#2ecc71';
            default: return '#2ecc71';
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

            <Text style={styles.title}>Gerenciar usuários</Text>

            {carregando ? (

                <ActivityIndicator
                    size="large"
                    color="#2541ff"
                    style={styles.loading}
                />

            ) : (

                <View style={styles.gridContainer}>

                    {usuarios.map((user) => {
                        const role = getRole(user);
                        const dotColor = getRoleColor(role);

                        const ativo = user.ativo !== false;

                        return (
                            <TouchableOpacity
                                key={user.id}
                                style={styles.userCard}
                                onPress={() =>
                                    navigation.navigate('UserDetail', {
                                        usuario: {
                                            ...user,
                                            foto: user.imagem || null,
                                            role
                                        }
                                    })
                                }
                            >

                                <View style={styles.statusBadge}>
                                    <Text
                                        style={[
                                            styles.statusText,
                                            ativo
                                                ? styles.activeText
                                                : styles.inactiveText
                                        ]}
                                    >
                                        {ativo ? 'Ativo' : 'Inativo'}
                                    </Text>
                                </View>

                                {user.imagem ? (

                                    <Image
                                        source={{ uri: user.imagem }}
                                        style={styles.userImage}
                                    />

                                ) : (

                                    <View style={styles.placeholderCard}>
                                        <Feather
                                            name="user"
                                            size={38}
                                            color="#FFF"
                                        />
                                    </View>

                                )}

                                <View style={styles.userInfoRow}>
                                    <View
                                        style={[
                                            styles.statusDot,
                                            { backgroundColor: dotColor }
                                        ]}
                                    />

                                    <Text
                                        style={styles.userName}
                                        numberOfLines={1}
                                    >
                                        {user.nome}
                                    </Text>
                                </View>

                            </TouchableOpacity>
                        );
                    })}

                </View>
            )}

            {!carregando && usuarios.length === 0 && (
                <Text style={styles.emptyText}>
                    Nenhum usuário encontrado.
                </Text>
            )}

            <View style={styles.legendContainer}>

                <View style={styles.legendItem}>
                    <View style={[styles.statusDot, { backgroundColor: '#b22222' }]} />
                    <Text style={styles.legendText}>Administrador</Text>
                </View>

                <View style={styles.legendItem}>
                    <View style={[styles.statusDot, { backgroundColor: '#ff8c00' }]} />
                    <Text style={styles.legendText}>Gestor de Frota</Text>
                </View>

                <View style={styles.legendItem}>
                    <View style={[styles.statusDot, { backgroundColor: '#ffd700' }]} />
                    <Text style={styles.legendText}>Financeiro</Text>
                </View>

                <View style={styles.legendItem}>
                    <View style={[styles.statusDot, { backgroundColor: '#2ecc71' }]} />
                    <Text style={styles.legendText}>Motorista</Text>
                </View>

            </View>

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
        textAlign: 'center',
        marginBottom: 25,
    },

    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 12,
    },

    userCard: {
        width: 99,
        height: 112,
        backgroundColor: '#2541ff',
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#2a2a2a',
        position: 'relative',
        display: 'flex'
    },

    statusBadge: {
        width: '90%',
        borderRadius: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.18)',
        borderColor: 'rgba(255, 255, 255, 0.25)',
        alignItems: 'center',
        justifyContent: 'center',
        top: 25,
        zIndex: 1
    },

    statusText: {
        fontSize: 12,
        fontWeight: '600',
    },

    activeText: {
        color: '#39FF64',
    },

    inactiveText: {
        color: '#FFF',
    },

    userImage: {
        width: '100%',
        height: '100%',
        borderRadius: 12,
        marginBottom: 1,
    },
    placeholderCard: {
        width: '100%',
        height: "100%",
        borderRadius: 12,
        backgroundColor: '#2541ff',
        justifyContent: 'center',
        alignItems: 'center',
    },

    userInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        justifyContent: 'center',
        gap: 6,
    },

    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        bottom: 20
    },

    userName: {
        color: '#FFF',
        fontSize: 11,
        fontWeight: '500',
        flexShrink: 1,
        bottom: 20
    },

    legendContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 15,
        marginTop: 20,
        paddingTop: 15,
        borderTopWidth: 1,
        borderTopColor: '#222',
    },

    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },

    legendText: {
        color: '#AAA',
        fontSize: 11,
    },

    loading: {
        marginTop: 40,
    },

    emptyText: {
        color: '#AAA',
        textAlign: 'center',
        marginTop: 30,
    },

});