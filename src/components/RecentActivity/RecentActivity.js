import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { API_URL } from '../../config/api.js';

const INTERVALO_MS = 30000; 

export default function RecentActivity({ limite = 4, onMenuPress }) {
  const [atividades, setAtividades] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const montado = useRef(true);
  const buscando = useRef(false); 

  const carregar = useCallback(async () => {
    if (buscando.current) return;
    buscando.current = true;
    setCarregando(true);
    try {
      const r = await fetch(
        `${API_URL}/resumo/atividades-recentes?limite=${limite}&t=${Date.now()}`,
        { headers: { 'Cache-Control': 'no-cache' } }
      );
      const json = await r.json();
      if (montado.current && json.sucesso) setAtividades(json.atividades);
    } catch (e) {
      console.error('Erro ao buscar atividades:', e);
    } finally {
      buscando.current = false;
      if (montado.current) setCarregando(false);
    }
  }, [limite]);

  useEffect(() => {
    montado.current = true;
    carregar(); 
    const timer = setInterval(carregar, INTERVALO_MS);
    return () => {
      montado.current = false;
      clearInterval(timer); 
    };
  }, [carregar]);

  return (
    <View style={styles.sectionContainer}>
      <View style={styles.activityHeaderRow}>
        <Text style={styles.sectionTitle}>Atividade Recente</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={carregar}
            disabled={carregando}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Atualizar atividades"
          >
            {carregando ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Feather name="rotate-cw" size={18} color="#FFF" />
            )}
          </TouchableOpacity>
          {onMenuPress && (
            <TouchableOpacity onPress={onMenuPress} hitSlop={10}>
              <Feather name="more-horizontal" size={20} color="#FFF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {atividades.length === 0 && !carregando && (
        <Text style={styles.activityDate}>Nenhuma atividade recente.</Text>
      )}

      {atividades.map((item) => (
        <View key={item.id} style={styles.activityCard}>
          <View style={styles.activityLeft}>
            <View style={styles.activityIconBox}>
              <Feather
                name={item.tipo === 'entrada' ? 'arrow-up' : 'arrow-down'}
                size={16}
                color={item.tipo === 'entrada' ? '#2541ff' : '#b22222'}
              />
            </View>
            <View>
              <Text style={styles.activityTitle}>{item.titulo}</Text>
              <Text style={styles.activityDate}>{item.data}</Text>
            </View>
          </View>
          <View style={styles.activityRight}>
            <Text style={[styles.activityValueText, { color: item.tipo === 'entrada' ? '#2541ff' : 'black' }]}>
              {item.valor}
            </Text>
            <Text style={styles.activitySaldoApos}>{item.saldoApos}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionContainer: {
    paddingHorizontal: 30,
    marginLeft: 20,
    marginTop: 20,
    width: '100%', 
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 18,
    marginBottom: 15,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  activityHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activityCard: {
    backgroundColor: '#CBD0DC',
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderRadius: 16,
  },
  activityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  activityIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent'
  },
  activityTitle: {
    color: 'black',
    fontSize: 14,
    fontWeight: '500',
  },
  activityDate: {
    color: '#888',
    fontSize: 11,
    marginTop: 2,
  },
  activityRight: {
    alignItems: 'flex-end',
  },
  activityValueText: {
    fontSize: 14,
    fontWeight: '600',
  },
  activitySaldoApos: {
    color: '#888',
    fontSize: 10,
    marginTop: 2,
  },
});