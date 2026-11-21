import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { colors } from '../../constants/theme.js';
import { assinarFila, sincronizar, tentarNovamente, descartarItem } from '../../services/offline.js';

/**
 * Aviso do modo offline (telas do motorista).
 * - Sem internet: avisa que o que for registrado fica salvo no aparelho.
 * - Com itens na fila: mostra quantos faltam enviar e o botão "Enviar agora".
 * - Itens que o servidor recusou: mostra o motivo, com "Tentar de novo" e "Descartar".
 * Não aparece nada quando está tudo enviado e há internet.
 */
export default function BannerOffline({ style }) {
  const [estado, setEstado] = useState({ online: true, pendentes: 0, falhas: [], sincronizando: false });

  useEffect(() => assinarFila(setEstado), []);

  const { online, pendentes, falhas, sincronizando } = estado;
  if (online && pendentes === 0 && falhas.length === 0) return null;

  const descartar = (item) => {
    Alert.alert('Descartar envio', `"${item.descricao}" não será enviado. Continuar?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Descartar', style: 'destructive', onPress: () => descartarItem(item.id) },
    ]);
  };

  return (
    <View style={[styles.caixa, !online && styles.caixaOffline, style]}>
      <View style={styles.linha}>
        <Feather name={online ? 'upload-cloud' : 'wifi-off'} size={18} color="#FFF" />
        <View style={styles.flex}>
          <Text style={styles.titulo}>{online ? 'Envios pendentes' : 'Sem internet'}</Text>
          <Text style={styles.texto}>
            {!online
              ? 'O que você registrar fica salvo no celular e é enviado quando a internet voltar.'
              : `${pendentes} item(ns) aguardando envio.`}
            {!online && pendentes > 0 ? `\n${pendentes} item(ns) aguardando envio.` : ''}
          </Text>
        </View>
        {online && pendentes > 0 ? (
          <TouchableOpacity style={styles.botao} onPress={sincronizar} disabled={sincronizando}>
            {sincronizando ? <ActivityIndicator color="#121212" size="small" /> : <Text style={styles.botaoTexto}>Enviar agora</Text>}
          </TouchableOpacity>
        ) : null}
      </View>

      {falhas.map((item) => (
        <View key={item.id} style={styles.falha}>
          <Text style={styles.falhaTitulo}>Não enviado: {item.descricao}</Text>
          <Text style={styles.falhaTexto}>{item.erro}</Text>
          <View style={styles.falhaBotoes}>
            <TouchableOpacity onPress={tentarNovamente} hitSlop={8}>
              <Text style={styles.link}>Tentar de novo</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => descartar(item)} hitSlop={8}>
              <Text style={[styles.link, styles.linkPerigo]}>Descartar</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  caixa: {
    backgroundColor: '#1F2156',
    borderWidth: 1,
    borderColor: colors.primaryBlue,
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginTop: 16,
  },
  caixaOffline: { backgroundColor: '#3A2A0A', borderColor: colors.yellowWarning },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
  titulo: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  texto: { color: '#DDD', fontSize: 12, marginTop: 2 },
  botao: { backgroundColor: '#E5E7EB', borderRadius: 16, paddingVertical: 8, paddingHorizontal: 12, minWidth: 96, alignItems: 'center' },
  botaoTexto: { color: '#121212', fontSize: 12, fontWeight: '700' },
  falha: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)', marginTop: 10, paddingTop: 10 },
  falhaTitulo: { color: '#FFCDD2', fontSize: 12, fontWeight: '700' },
  falhaTexto: { color: '#DDD', fontSize: 12, marginTop: 2 },
  falhaBotoes: { flexDirection: 'row', gap: 20, marginTop: 6 },
  link: { color: '#93C5FD', fontSize: 12, fontWeight: '700' },
  linkPerigo: { color: '#FF8A80' },
});
