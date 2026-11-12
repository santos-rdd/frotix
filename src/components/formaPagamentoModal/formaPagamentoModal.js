import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { TIPOS_FORMA_PAGAMENTO } from '../../constants/formasPagamentoMock.js';

// Validade no formato MM/AA, com mês de 01 a 12.
const validadeValida = (texto) => {
  const m = /^(\d{2})\/(\d{2})$/.exec(texto);
  if (!m) return false;
  const mes = Number(m[1]);
  return mes >= 1 && mes <= 12;
};

// Coloca a barra automaticamente enquanto digita: "1228" -> "12/28".
const formatarValidade = (texto) => {
  const numeros = texto.replace(/\D/g, '').slice(0, 4);
  return numeros.length > 2 ? `${numeros.slice(0, 2)}/${numeros.slice(2)}` : numeros;
};

/**
 * Modal "Adicionar forma de pagamento".
 * onSalvar(forma) recebe { tipo, titular?, validade?, chave?, descricao? } já validado.
 */
export default function FormaPagamentoModal({ visible, onClose, onSalvar }) {
  const [tipo, setTipo] = useState('debito');
  const [titular, setTitular] = useState('');
  const [validade, setValidade] = useState('');
  const [chave, setChave] = useState('');
  const [descricao, setDescricao] = useState('');

  // Limpa o formulário sempre que o modal abre.
  useEffect(() => {
    if (visible) {
      setTipo('debito');
      setTitular('');
      setValidade('');
      setChave('');
      setDescricao('');
    }
  }, [visible]);

  const ehCartao = tipo === 'debito' || tipo === 'credito';

  const salvar = () => {
    if (ehCartao) {
      if (!titular.trim()) {
        Alert.alert('Campo obrigatório', 'Informe o nome do titular do cartão.');
        return;
      }
      if (!validadeValida(validade)) {
        Alert.alert('Validade inválida', 'Use o formato MM/AA, por exemplo 12/28.');
        return;
      }
      onSalvar({ tipo, titular: titular.trim(), validade });
      return;
    }
    if (tipo === 'pix') {
      if (!chave.trim()) {
        Alert.alert('Campo obrigatório', 'Informe a chave Pix.');
        return;
      }
      onSalvar({ tipo, chave: chave.trim() });
      return;
    }
    onSalvar({ tipo, descricao: descricao.trim() });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.fundo}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.folha}>
          <View style={styles.cabecalho}>
            <Text style={styles.titulo}>Adicionar forma de pagamento</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Feather name="x" size={22} color="#FFF" />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Tipo</Text>
          <View style={styles.tipos}>
            {TIPOS_FORMA_PAGAMENTO.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={[styles.tipo, tipo === t.id && styles.tipoAtivo]}
                onPress={() => setTipo(t.id)}
              >
                <Text style={[styles.tipoTexto, tipo === t.id && styles.tipoTextoAtivo]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {ehCartao && (
            <>
              <Text style={styles.label}>Titular</Text>
              <TextInput
                style={styles.campo}
                value={titular}
                onChangeText={setTitular}
                placeholder="Nome impresso no cartão"
                placeholderTextColor="#666"
              />
              <Text style={styles.label}>Validade</Text>
              <TextInput
                style={styles.campo}
                value={validade}
                onChangeText={(t) => setValidade(formatarValidade(t))}
                placeholder="MM/AA"
                placeholderTextColor="#666"
                keyboardType="number-pad"
                maxLength={5}
              />
            </>
          )}

          {tipo === 'pix' && (
            <>
              <Text style={styles.label}>Chave Pix</Text>
              <TextInput
                style={styles.campo}
                value={chave}
                onChangeText={setChave}
                placeholder="E-mail, telefone, CPF/CNPJ ou chave aleatória"
                placeholderTextColor="#666"
                autoCapitalize="none"
              />
            </>
          )}

          {!ehCartao && tipo !== 'pix' && (
            <>
              <Text style={styles.label}>Descrição (opcional)</Text>
              <TextInput
                style={styles.campo}
                value={descricao}
                onChangeText={setDescricao}
                placeholder={tipo === 'boleto' ? 'Ex.: Banco do Brasil' : 'Ex.: Caixa do escritório'}
                placeholderTextColor="#666"
              />
            </>
          )}

          <TouchableOpacity style={styles.botaoSalvar} onPress={salvar}>
            <Text style={styles.botaoSalvarTexto}>Salvar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.botaoVoltar} onPress={onClose}>
            <Text style={styles.botaoVoltarTexto}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fundo: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  folha: {
    backgroundColor: '#1E1E1E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
  },
  cabecalho: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titulo: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  label: {
    color: '#888',
    fontSize: 13,
    marginTop: 14,
    marginBottom: 8,
  },
  tipos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tipo: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3A3A3A',
  },
  tipoAtivo: {
    backgroundColor: '#2541ff',
    borderColor: '#2541ff',
  },
  tipoTexto: {
    color: '#CCC',
    fontSize: 13,
  },
  tipoTextoAtivo: {
    color: '#FFF',
    fontWeight: '600',
  },
  campo: {
    backgroundColor: '#121212',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272A',
    color: '#FFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  botaoSalvar: {
    backgroundColor: '#2541ff',
    borderRadius: 14,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  botaoSalvarTexto: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  botaoVoltar: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  botaoVoltarTexto: {
    color: '#121212',
    fontSize: 16,
    fontWeight: '600',
  },
});
