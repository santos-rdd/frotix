import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, ImageBackground } from 'react-native';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { formasPagamentoIniciais, labelTipo } from '../../constants/formasPagamentoMock.js';

// Largura do cartão + espaço entre cartões: usada para saber qual cartão está visível.
const LARGURA_CARTAO = 319;
const ESPACO = 15;

const imagensCartao = [
  require('../../../assets/image/firstCard.png'),
  require('../../../assets/image/secondCard.png'),
];

/**
 * Carrossel das formas de pagamento cadastradas.
 * formas: lista de formas (ver constants/formasPagamentoMock.js)
 * onChangeIndex(indice): avisa qual cartão está visível (usado pelo "Deletar").
 */
export default function PaymentCardsCarousel({ formas = formasPagamentoIniciais, onChangeIndex }) {
  const [indiceAtual, setIndiceAtual] = useState(0);

  const handleScroll = (event) => {
    const x = event.nativeEvent.contentOffset.x;
    const indice = Math.min(Math.max(Math.round(x / (LARGURA_CARTAO + ESPACO)), 0), formas.length - 1);
    if (indice !== indiceAtual) {
      setIndiceAtual(indice);
      onChangeIndex?.(indice);
    }
  };

  const renderCard = ({ item, index }) => {
    if (item.tipo === 'debito' || item.tipo === 'credito') {
      // O primeiro estilo (imagem clara) usa texto preto; o segundo, texto branco.
      const claro = index % 2 === 0;
      return (
        <View style={[styles.cardBase, claro ? styles.cardVortex : styles.cardDebit]}>
          <ImageBackground
            source={imagensCartao[index % imagensCartao.length]}
            style={styles.cardImageRotated}
            imageStyle={styles.cardImageStyle}
            resizeMode="cover"
          />
          <View style={styles.cardInnerContent}>
            <View style={styles.cardTopRight}>
              <Feather name="wifi" size={claro ? 25 : 20} color={claro ? 'black' : 'rgba(255,255,255,0.8)'} />
            </View>
            <View style={styles.cardContentMiddle}>
              <Text style={claro ? styles.debitTitleBlack : styles.debitTitle}>
                {item.tipo === 'debito' ? 'DEBIT\nCARD' : 'CREDIT\nCARD'}
              </Text>
            </View>
            <View style={styles.cardFooter}>
              <View>
                <Text style={claro ? styles.cardLabelSmallBlack : styles.cardLabelSmall}>Titular</Text>
                <Text style={claro ? styles.cardValueBoldBlack : styles.cardValueBold}>{item.titular}</Text>
              </View>
              <View>
                <Text style={claro ? styles.cardLabelSmallBlack : styles.cardLabelSmall}>Validade</Text>
                <Text style={claro ? styles.cardValueBoldBlack : styles.cardValueBold}>{item.validade}</Text>
              </View>
            </View>
          </View>
        </View>
      );
    }

    if (item.tipo === 'pix') {
      return (
        <View style={[styles.cardBase, styles.cardPix]}>
          <View style={styles.pixLogoContainer}>
            {/* Simulação estilizada do logo do Pix */}
            <View style={styles.pixDiamondShape} />
            <Text style={styles.pixTextLogo}>pix</Text>
          </View>
          {item.chave ? <Text style={styles.pixChave}>{item.chave}</Text> : null}
        </View>
      );
    }

    // Boleto, dinheiro e "Outros": cartão simples com ícone e descrição.
    const icones = { boleto: 'barcode', dinheiro: 'cash-multiple', outros: 'dots-horizontal-circle-outline' };
    return (
      <View style={[styles.cardBase, styles.cardPix]}>
        <MaterialCommunityIcons name={icones[item.tipo] || 'cash-multiple'} size={48} color="#FFF" />
        <Text style={styles.outroTitulo}>{labelTipo(item.tipo)}</Text>
        {item.descricao ? <Text style={styles.pixChave}>{item.descricao}</Text> : null}
      </View>
    );
  };

  if (formas.length === 0) {
    return (
      <View style={styles.container}>
        <View style={[styles.cardBase, styles.cardVazio]}>
          <Feather name="credit-card" size={36} color="#888" />
          <Text style={styles.vazioTexto}>Nenhuma forma de pagamento cadastrada</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={formas}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carouselContainer}
        keyExtractor={(item) => item.id}
        renderItem={renderCard}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        snapToInterval={LARGURA_CARTAO + ESPACO}
        decelerationRate="fast"
      />
      <View style={styles.paginationDots}>
        {formas.map((forma, i) => (
          <View key={forma.id} style={i === indiceAtual ? styles.dotActive : styles.dotInactive} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: 15,
  },
  carouselContainer: {
    paddingHorizontal: 20,
    gap: 15,
  },
  cardBase: {
    width: 319,
    height: 200,
    borderRadius: 22,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  // Inverte as dimensões e rotaciona APENAS a imagem de fundo
  cardImageRotated: {
    position: 'absolute',
    width: 200,
    height: 319,
    top: (200 - 319) / 2,
    left: (319 - 200) / 2,
    transform: [{ rotate: '270deg' }],
  },
  cardImageStyle: {
    borderRadius: 22,
  },
  // Container interno que garante o padding e mantém os textos na orientação normal (sem girar)
  cardInnerContent: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
    zIndex: 2,
  },
  // Estilo do Cartão 1 (Vortex / Halo)
  cardVortex: {
    backgroundColor: '#050b14',
  },
  vortexCore: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#2541ff',
    top: 20,
    left: -30,
    opacity: 0.8,
    shadowColor: '#FFF',
    shadowRadius: 30,
    elevation: 10,
  },
  cardTopRight: {
    alignItems: 'flex-end',
    zIndex: 2,
  },
  cardDebit: {
    backgroundColor: '#0c1b33',
  },
  cardContentMiddle: {
    marginVertical: 5,
  },
  debitTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1,
    lineHeight: 20,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    zIndex: 2,
  },
  cardLabelSmall: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 9,
  },
  cardValueBold: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 13,
  },
  // Estilo do Cartão 3 (Pix)
  cardPix: {
    backgroundColor: '#161b22',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pixLogoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pixDiamondShape: {
    width: 32,
    height: 32,
    backgroundColor: '#2dd4bf',
    borderRadius: 8,
    transform: [{ rotate: '45deg' }],
  },
  pixTextLogo: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: '300',
    letterSpacing: -1,
  },
  paginationDots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 20,
  },
  pixChave: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 14,
  },
  outroTitulo: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '300',
    marginTop: 10,
  },
  cardVazio: {
    marginHorizontal: 20,
    backgroundColor: '#1E1E1E',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  vazioTexto: {
    color: '#888',
    fontSize: 13,
  },
  dotActive: {
    width: 20,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2541ff',
  },
  dotInactive: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#555',
  },
  debitTitleBlack: {
    color: 'black',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1,
    lineHeight: 20,
  },
  cardLabelSmallBlack: {
    color: 'black',
    fontSize: 9,
    fontWeight: '600',
    lineHeight: 13,
  },
  cardValueBoldBlack: {
    color: 'black',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 13,
  },
  cardLabelSmallBlack:{
    color: 'black',
    fontSize: 9,
  },
});