import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { colors } from '../../constants/theme.js';
import { listarAlertas } from '../../services/frotix.js';
import useDados from '../../hooks/useDados.js';

const NIVEIS = {
  critico: { cor: colors.redDanger, rotulo: 'Crítico', icone: 'alert-octagon' },
  atencao: { cor: colors.yellowWarning, rotulo: 'Atenção', icone: 'alert-triangle' },
  info: { cor: '#38B6E8', rotulo: 'Aviso', icone: 'info' },
};

/**
 * Alertas automáticos (Admin, Gestor e Financeiro). O backend decide quais alertas
 * cada perfil vê: contas vencidas, saldo previsto negativo, manutenção atrasada etc.
 * Tocar num alerta abre a tela relacionada.
 */
export default function AlertasCard({ navigation, usuario, limite = 4 }) {
  const { dados, carregando, erro } = useDados(listarAlertas, []);
  const alertas = dados || [];

  if (erro) return null; // os alertas são um complemento; o erro aparece nas outras partes da tela
  if (!carregando && alertas.length === 0) {
    return (
      <View style={[styles.card, styles.cardOk]}>
        <Feather name="check-circle" size={18} color={colors.greenSuccess} />
        <Text style={styles.okTexto}>Nenhum alerta no momento.</Text>
      </View>
    );
  }

  return (
    <View style={styles.bloco}>
      <Text style={styles.titulo}>Alertas e Pendências{alertas.length ? ` (${alertas.length})` : ''}</Text>
      {alertas.slice(0, limite).map((a) => {
        const nivel = NIVEIS[a.nivel] || NIVEIS.info;
        return (
          <TouchableOpacity
            key={a.id}
            style={[styles.card, { borderLeftColor: nivel.cor }]}
            activeOpacity={0.8}
            disabled={!a.tela}
            onPress={() => navigation.navigate(a.tela, { usuario, ...(a.params || {}) })}
          >
            <View style={styles.topo}>
              <Feather name={nivel.icone} size={14} color={nivel.cor} />
              <Text style={[styles.nivel, { color: nivel.cor }]}>{nivel.rotulo}</Text>
            </View>
            <Text style={styles.alertaTitulo}>{a.titulo}</Text>
            <Text style={styles.alertaTexto}>{a.descricao}</Text>
          </TouchableOpacity>
        );
      })}
      {alertas.length > limite ? <Text style={styles.mais}>+ {alertas.length - limite} alerta(s)</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bloco: { marginHorizontal: 20, marginTop: 20 },
  titulo: { color: '#FFF', fontSize: 18, marginBottom: 12 },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.border,
    padding: 14,
    marginBottom: 10,
  },
  cardOk: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginTop: 20, borderLeftColor: colors.greenSuccess },
  okTexto: { color: '#DDD', fontSize: 13 },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  nivel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  alertaTitulo: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  alertaTexto: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  mais: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
});
