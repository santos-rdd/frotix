
import React, { useEffect, useMemo, useRef, useState } from 'react';

import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    FlatList,
    Image,
    ActivityIndicator,
    Alert,
    Modal,
    useWindowDimensions
} from 'react-native';

import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';

import { listarUsuarios } from '../../services/frotix.js';
import { obterUsuarioLogado } from '../../services/api.js';

export default function ManageUserScreen() {
    const navigation = useNavigation();
    const route = useRoute();
    const { width: larguraTela } = useWindowDimensions();

    const listaRef = useRef(null);

    const [usuarios, setUsuarios] = useState([]);
    const [carregando, setCarregando] = useState(true);

    const [filtroStatus, setFiltroStatus] = useState('todos');
    const [filtroStatusTemp, setFiltroStatusTemp] = useState('todos');

    const [modalFiltros, setModalFiltros] = useState(false);

    const [filtroPerfil, setFiltroPerfil] = useState('todos');
    const [ordenacao, setOrdenacao] = useState('recentes');

    const [filtroPerfilTemp, setFiltroPerfilTemp] = useState('todos');
    const [ordenacaoTemp, setOrdenacaoTemp] = useState('recentes');

    const [paginaAtual, setPaginaAtual] = useState(0);

    const USUARIOS_POR_PAGINA = 12;

    const larguraCartao = (larguraTela - 40 - 24) / 3;

    const perfisFiltro = [
        { label: 'Todos', value: 'todos' },
        { label: 'Admin', value: 'admin' },
        { label: 'Gestor', value: 'gestor' },
        { label: 'Financeiro', value: 'financeiro' },
        { label: 'Motorista', value: 'motorista' }
    ];

    const ordenacoes = [
        { label: 'Mais recentes', value: 'recentes' },
        { label: 'Mais antigas', value: 'antigas' },
        { label: 'Ordem alfabética (A-Z)', value: 'alfabetica' }
    ];

    const carregarUsuarios = async () => {
        try {
            setCarregando(true);

            const lista = await listarUsuarios();

            setUsuarios(
                Array.isArray(lista) ? lista : []
            );

            setPaginaAtual(0);

        } catch (error) {
            console.error('Erro ao listar usuários:', error);

            Alert.alert(
                'Acesso Restrito',
                error.message || 'Não foi possível carregar a lista de usuários.'
            );
            if (error.message?.includes('perfil') || error.message?.includes('acesso')) {
                navigation.goBack();
            }

        } finally {
            setCarregando(false);
        }
    };

    useEffect(() => {
        let montado = true;
        const verificarPermissao = async () => {
            const user = await obterUsuarioLogado();
            const perfil = route?.params?.usuario?.role || user?.perfil;
            if (perfil && Number(perfil) !== 1) {
                if (montado) {
                    Alert.alert('Acesso Restrito', 'O gerenciamento de usuários é exclusivo do Administrador.');
                    navigation.goBack();
                }
                return false;
            }
            return true;
        };

        verificarPermissao().then((permitido) => {
            if (permitido && montado) {
                carregarUsuarios();
            }
        });

        const unsubscribe = navigation.addListener('focus', () => {
            verificarPermissao().then((permitido) => {
                if (permitido && montado) carregarUsuarios();
            });
        });

        return () => {
            montado = false;
            unsubscribe();
        };
    }, [navigation, route?.params?.usuario?.role]);

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

    const isUsuarioAtivo = (user) => {
        return (
            user.ativo === true ||
            user.ativo === 'true' ||
            user.ativo === 1 ||
            user.ativo === '1'
        );
    };

    const getRoleColor = (role) => {
        switch (role) {
            case 'admin':
                return '#b22222';

            case 'gestor':
                return '#ff8c00';

            case 'financeiro':
                return '#ffd700';

            case 'motorista':
                return '#2ecc71';

            default:
                return '#2ecc71';
        }
    };

    const usuariosFiltrados = useMemo(() => {
        let resultado = [...usuarios];

        if (filtroStatus === 'ativos') {
            resultado = resultado.filter(
                user => isUsuarioAtivo(user)
            );
        }

        if (filtroStatus === 'inativos') {
            resultado = resultado.filter(
                user => !isUsuarioAtivo(user)
            );
        }

        if (filtroPerfil !== 'todos') {
            resultado = resultado.filter(
                user => getRole(user) === filtroPerfil
            );
        }

        resultado.sort((a, b) => {
            if (ordenacao === 'alfabetica') {
                return String(a.nome || '').localeCompare(
                    String(b.nome || ''),
                    'pt-BR',
                    { sensitivity: 'base' }
                );
            }

            const dataA = Date.parse(a.criado_em) || 0;
            const dataB = Date.parse(b.criado_em) || 0;

            if (ordenacao === 'antigas') {
                return dataA - dataB;
            }

            return dataB - dataA;
        });

        return resultado;
    }, [usuarios, filtroPerfil, ordenacao, filtroStatus]);

    const paginas = useMemo(() => {
        const resultado = [];

        for (
            let i = 0;
            i < usuariosFiltrados.length;
            i += USUARIOS_POR_PAGINA
        ) {
            resultado.push(
                usuariosFiltrados.slice(
                    i,
                    i + USUARIOS_POR_PAGINA
                )
            );
        }

        return resultado;
    }, [usuariosFiltrados]);

    useEffect(() => {
        setPaginaAtual(0);

        listaRef.current?.scrollToOffset({
            offset: 0,
            animated: false
        });
    }, [filtroPerfil, filtroStatus, ordenacao, usuarios]);

    const navegarPagina = (novaPagina) => {
        if (novaPagina < 0 || novaPagina >= paginas.length) {
            return;
        }

        listaRef.current?.scrollToOffset({
            offset: novaPagina * larguraTela,
            animated: true
        });

        setPaginaAtual(novaPagina);
    };

    const abrirFiltros = () => {
        setFiltroPerfilTemp(filtroPerfil);
        setOrdenacaoTemp(ordenacao);
        setFiltroStatusTemp(filtroStatus);

        setModalFiltros(true);
    };

    const aplicarFiltros = () => {
        setFiltroPerfil(filtroPerfilTemp);
        setOrdenacao(ordenacaoTemp);
        setFiltroStatus(filtroStatusTemp);

        setModalFiltros(false);
    };

    const limparFiltros = () => {
        setFiltroPerfilTemp('todos');
        setOrdenacaoTemp('recentes');
        setFiltroStatusTemp('todos');

        setFiltroPerfil('todos');
        setOrdenacao('recentes');
        setFiltroStatus('todos');

        setModalFiltros(false);
    };

    const renderUsuario = (user) => {
        const role = getRole(user);
        const dotColor = getRoleColor(role);

        const ativo = isUsuarioAtivo(user);

        return (
            <TouchableOpacity
                key={user.id}
                style={[
                    styles.userCard,
                    { width: larguraCartao }
                ]}
                onPress={() =>
                    navigation.navigate('UserDetail', {
                        usuario: {
                            ...user,
                            foto: user.imagem || null,
                            role
                        },
                        usuarioLogado: route?.params?.usuario || { role: 1 }
                    })
                }
                activeOpacity={0.8}
            >

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
                        ellipsizeMode="tail"
                    >
                        {user.nome}
                    </Text>

                </View>

            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>

            <View style={styles.header}>

                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Feather
                        name="arrow-left"
                        size={22}
                        color="#FFF"
                    />
                </TouchableOpacity>

                <Text style={styles.title}>
                    Gerenciar usuários
                </Text>

                <View style={styles.toolbar}>

                    <View>
                        <Text style={styles.userCount}>
                            {usuariosFiltrados.length} usuários
                        </Text>
                    </View>

                    <TouchableOpacity
                        style={styles.filterButton}
                        onPress={abrirFiltros}
                    >
                        <Feather
                            name="filter"
                            size={16}
                            color="#FFF"
                        />

                        <Text style={styles.filterButtonText}>
                            Filtrar
                        </Text>
                    </TouchableOpacity>

                </View>

            </View>

            {carregando ? (

                <View style={styles.loadingContainer}>
                    <ActivityIndicator
                        size="large"
                        color="#2541ff"
                    />

                    <Text style={styles.loadingText}>
                        Carregando usuários...
                    </Text>
                </View>

            ) : usuariosFiltrados.length === 0 ? (

                <View style={styles.emptyContainer}>
                    <Feather
                        name="users"
                        size={42}
                        color="#555"
                    />

                    <Text style={styles.emptyText}>
                        Nenhum usuário encontrado.
                    </Text>
                </View>

            ) : (

                <>
                    <FlatList
                        ref={listaRef}
                        data={paginas}
                        keyExtractor={(pagina, index) =>
                            pagina[0]?.id || `pagina-${index}`
                        }
                        horizontal
                        pagingEnabled
                        snapToInterval={larguraTela}
                        decelerationRate="fast"
                        bounces={false}
                        showsHorizontalScrollIndicator={false}

                        initialNumToRender={1}
                        maxToRenderPerBatch={2}
                        windowSize={3}
                        removeClippedSubviews

                        getItemLayout={(_, index) => ({
                            length: larguraTela,
                            offset: larguraTela * index,
                            index
                        })}

                        onMomentumScrollEnd={({ nativeEvent }) => {
                            const novaPagina = Math.round(
                                nativeEvent.contentOffset.x / larguraTela
                            );

                            setPaginaAtual(novaPagina);
                        }}

                        renderItem={({ item: pagina }) => (

                            <View
                                style={[
                                    styles.carouselPage,
                                    { width: larguraTela }
                                ]}
                            >

                                <View style={styles.gridContainer}>

                                    {pagina.map(user =>
                                        renderUsuario(user)
                                    )}

                                </View>

                            </View>

                        )}
                    />

                    <View style={styles.paginationContainer}>

                        <TouchableOpacity
                            style={[
                                styles.pageArrow,
                                paginaAtual === 0 && styles.pageArrowDisabled
                            ]}
                            onPress={() => navegarPagina(paginaAtual - 1)}
                            disabled={paginaAtual === 0}
                        >
                            <Feather
                                name="chevron-left"
                                size={22}
                                color="#FFF"
                            />
                        </TouchableOpacity>

                        <Text style={styles.pageIndicator}>
                            Página {paginaAtual + 1} de {paginas.length}
                        </Text>

                        <TouchableOpacity
                            style={[
                                styles.pageArrow,
                                paginaAtual >= paginas.length - 1 &&
                                    styles.pageArrowDisabled
                            ]}
                            onPress={() => navegarPagina(paginaAtual + 1)}
                            disabled={paginaAtual >= paginas.length - 1}
                        >
                            <Feather
                                name="chevron-right"
                                size={22}
                                color="#FFF"
                            />
                        </TouchableOpacity>

                    </View>
                </>

            )}

            <View style={styles.legendContainer}>

                <View style={styles.legendItem}>
                    <View
                        style={[
                            styles.statusDot,
                            { backgroundColor: '#b22222' }
                        ]}
                    />

                    <Text style={styles.legendText}>
                        Administrador
                    </Text>
                </View>

                <View style={styles.legendItem}>
                    <View
                        style={[
                            styles.statusDot,
                            { backgroundColor: '#ff8c00' }
                        ]}
                    />

                    <Text style={styles.legendText}>
                        Gestor de Frota
                    </Text>
                </View>

                <View style={styles.legendItem}>
                    <View
                        style={[
                            styles.statusDot,
                            { backgroundColor: '#ffd700' }
                        ]}
                    />

                    <Text style={styles.legendText}>
                        Financeiro
                    </Text>
                </View>

                <View style={styles.legendItem}>
                    <View
                        style={[
                            styles.statusDot,
                            { backgroundColor: '#2ecc71' }
                        ]}
                    />

                    <Text style={styles.legendText}>
                        Motorista
                    </Text>
                </View>

            </View>

            <Modal
                visible={modalFiltros}
                transparent
                animationType="fade"
                onRequestClose={() => setModalFiltros(false)}
            >

                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setModalFiltros(false)}
                >

                    <View
                        style={styles.filterModalContent}
                        onStartShouldSetResponder={() => true}
                    >

                        <View style={styles.modalHeader}>

                            <Text style={styles.modalTitle}>
                                Filtrar usuários
                            </Text>

                            <TouchableOpacity
                                onPress={() => setModalFiltros(false)}
                            >
                                <Feather
                                    name="x"
                                    size={22}
                                    color="#FFF"
                                />
                            </TouchableOpacity>

                        </View>

                        <Text style={styles.modalLabel}>
                            Situação da conta
                        </Text>

                        <View style={styles.optionsContainer}>

                            {[
                                { label: 'Todos', value: 'todos' },
                                { label: 'Ativos', value: 'ativos' },
                                { label: 'Inativos', value: 'inativos' }
                            ].map(opcao => (

                                <TouchableOpacity
                                    key={opcao.value}
                                    style={[
                                        styles.filterOption,
                                        filtroStatusTemp === opcao.value &&
                                            styles.filterOptionActive
                                    ]}
                                    onPress={() => setFiltroStatusTemp(opcao.value)}
                                >

                                    <Text
                                        style={[
                                            styles.filterOptionText,
                                            filtroStatusTemp === opcao.value &&
                                                styles.filterOptionTextActive
                                        ]}
                                    >
                                        {opcao.label}
                                    </Text>

                                </TouchableOpacity>

                            ))}

                        </View>

                        <Text style={styles.modalLabel}>
                            Tipo de perfil
                        </Text>

                        <View style={styles.optionsContainer}>

                            {perfisFiltro.map(opcao => (

                                <TouchableOpacity
                                    key={opcao.value}
                                    style={[
                                        styles.filterOption,
                                        filtroPerfilTemp === opcao.value &&
                                            styles.filterOptionActive
                                    ]}
                                    onPress={() =>
                                        setFiltroPerfilTemp(opcao.value)
                                    }
                                >

                                    <Text
                                        style={[
                                            styles.filterOptionText,
                                            filtroPerfilTemp === opcao.value &&
                                                styles.filterOptionTextActive
                                        ]}
                                    >
                                        {opcao.label}
                                    </Text>

                                </TouchableOpacity>

                            ))}

                        </View>

                        <Text style={styles.modalLabel}>
                            Ordenar por
                        </Text>

                        <View style={styles.sortOptions}>

                            {ordenacoes.map(opcao => (

                                <TouchableOpacity
                                    key={opcao.value}
                                    style={[
                                        styles.sortOption,
                                        ordenacaoTemp === opcao.value &&
                                            styles.sortOptionActive
                                    ]}
                                    onPress={() =>
                                        setOrdenacaoTemp(opcao.value)
                                    }
                                >

                                    <View style={styles.sortOptionContent}>

                                        <Text
                                            style={[
                                                styles.sortOptionText,
                                                ordenacaoTemp === opcao.value &&
                                                    styles.sortOptionTextActive
                                            ]}
                                        >
                                            {opcao.label}
                                        </Text>

                                        {ordenacaoTemp === opcao.value && (
                                            <Feather
                                                name="check"
                                                size={18}
                                                color="#2541ff"
                                            />
                                        )}

                                    </View>

                                </TouchableOpacity>

                            ))}

                        </View>

                        <View style={styles.modalActions}>

                            <TouchableOpacity
                                style={styles.clearButton}
                                onPress={limparFiltros}
                            >
                                <Text style={styles.clearButtonText}>
                                    Limpar
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.applyButton}
                                onPress={aplicarFiltros}
                            >
                                <Text style={styles.applyButtonText}>
                                    Aplicar filtros
                                </Text>
                            </TouchableOpacity>

                        </View>

                    </View>

                </TouchableOpacity>

            </Modal>

        </View>
    );
}

const styles = StyleSheet.create({

    container: {
        flex: 1,
        backgroundColor: '#121212',
    },

    header: {
        paddingHorizontal: 20,
        paddingTop: 50,
    },

    backButton: {
        marginBottom: 20,
    },

    title: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 20,
    },

    toolbar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },

    userCount: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: '600',
    },

    pageDescription: {
        color: '#777',
        fontSize: 11,
        marginTop: 3,
    },

    filterButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#1a1a1a',
        borderWidth: 1,
        borderColor: '#2541ff',
        paddingHorizontal: 16,
        paddingVertical: 9,
        borderRadius: 12,
    },

    filterButtonText: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: '600',
    },

    carouselPage: {
        flex: 1,
        paddingTop: 4,
    },

    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
        columnGap: 12,
        rowGap: 12,
        paddingHorizontal: 20,
    },

    userCard: {
        height: 112,
        backgroundColor: '#2541ff',
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#2a2a2a',
        position: 'relative',
        overflow: 'hidden',
    },

    userImage: {
        width: '100%',
        height: '100%',
        position: 'absolute',
    },

    placeholderCard: {
        width: '100%',
        height: '100%',
        backgroundColor: '#2541ff',
        justifyContent: 'center',
        alignItems: 'center',
    },

    statusBadge: {
        position: 'absolute',
        top: 8,
        width: '90%',
        borderRadius: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.18)',
        borderColor: 'rgba(255, 255, 255, 0.25)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1,
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

    userInfoRow: {
        position: 'absolute',
        bottom: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '94%',
        gap: 5,
    },

    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        flexShrink: 0,
    },

    userName: {
        color: '#FFF',
        fontSize: 11,
        fontWeight: '500',
        flexShrink: 1,
    },

    paginationContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 25,
        paddingVertical: 14,
    },

    pageArrow: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#2541ff',
        justifyContent: 'center',
        alignItems: 'center',
    },

    pageArrowDisabled: {
        opacity: 0.3,
    },

    pageIndicator: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: '600',
    },

    legendContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 15,
        marginHorizontal: 20,
        marginTop: 5,
        marginBottom: 50,
        paddingTop: 12,
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

    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },

    loadingText: {
        color: '#AAA',
        fontSize: 13,
    },

    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },

    emptyText: {
        color: '#AAA',
        fontSize: 14,
        textAlign: 'center',
    },

    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },

    filterModalContent: {
        width: '100%',
        backgroundColor: '#1a1a1a',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: '#333',
    },

    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 25,
    },

    modalTitle: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
    },

    modalLabel: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 12,
        marginTop: 5,
    },

    optionsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 22,
    },

    filterOption: {
        paddingHorizontal: 13,
        paddingVertical: 9,
        borderRadius: 10,
        backgroundColor: '#252525',
        borderWidth: 1,
        borderColor: '#333',
    },

    filterOptionActive: {
        backgroundColor: '#2541ff',
        borderColor: '#2541ff',
    },

    filterOptionText: {
        color: '#AAA',
        fontSize: 12,
    },

    filterOptionTextActive: {
        color: '#FFF',
        fontWeight: '600',
    },

    sortOptions: {
        gap: 8,
        marginBottom: 25,
    },

    sortOption: {
        padding: 13,
        borderRadius: 10,
        backgroundColor: '#252525',
        borderWidth: 1,
        borderColor: '#333',
    },

    sortOptionActive: {
        borderColor: '#2541ff',
    },

    sortOptionContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },

    sortOptionText: {
        color: '#AAA',
        fontSize: 13,
    },

    sortOptionTextActive: {
        color: '#FFF',
        fontWeight: '600',
    },

    modalActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
    },

    clearButton: {
        flex: 1,
        height: 46,
        borderRadius: 12,
        backgroundColor: '#252525',
        justifyContent: 'center',
        alignItems: 'center',
    },

    clearButtonText: {
        color: '#AAA',
        fontSize: 14,
        fontWeight: '600',
    },

    applyButton: {
        flex: 1.5,
        height: 46,
        borderRadius: 12,
        backgroundColor: '#2541ff',
        justifyContent: 'center',
        alignItems: 'center',
    },

    applyButtonText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
    },

});
