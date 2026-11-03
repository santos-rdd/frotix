import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

// Saudação conforme o horário do aparelho.
const saudacao = () => {
  const hora = new Date().getHours();
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
};

/**
 * Cabeçalho padrão das telas do Gestor: saudação, nome, avatar e título da tela.
 * usuario: { nome, foto } (mesmo formato que a HomePage repassa nas rotas).
 */
export default function ScreenHeader({ usuario, titulo }) {
  const nome = usuario?.nome || 'Usuário';
  const foto = usuario?.foto;

  return (
    <View>
      <View style={styles.linha}>
        <View>
          <Text style={styles.saudacao}>{saudacao()}</Text>
          <Text style={styles.nome}>{nome}</Text>
        </View>
        <Image
          source={foto ? { uri: foto } : require('../../../assets/icons/user.png')}
          style={styles.avatar}
        />
      </View>
      {titulo ? <Text style={styles.titulo}>{titulo}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  linha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
  },
  saudacao: { color: '#888', fontSize: 14 },
  nome: { color: '#FFF', fontSize: 22, fontWeight: 'bold' },
  avatar: { width: 45, height: 45, borderRadius: 22.5 },
  titulo: {
    color: '#FFF',
    fontSize: 24,
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 14,
  },
});
