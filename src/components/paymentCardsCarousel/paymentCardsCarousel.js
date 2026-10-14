import React from 'react';
import { View, Text, StyleSheet, FlatList, ImageBackground } from 'react-native';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';

export default function PaymentCardsCarousel() {
  const cardsData = [
    {
      id: '1',
      type: 'vortex',
      backgroundImage: require('../../../assets/image/firstCard.png'), 
      name: 'DEBIT\nCARD',
      holder: 'Suzane',
      expires: '12/\n24',
    },
    {
      id: '2',
      type: 'debit', 
      name: 'DEBIT\nCARD',
      holder: 'Joy\nLaroy',
      expires: '12/\n24',
      backgroundImage: require('../../../assets/image/secondCard.png'), 
    },
    {
      id: '3',
      type: 'pix', 
    },
  ];

  const renderCard = ({ item }) => {
    if (item.type === 'vortex') {
      return (
        <View style={[styles.cardBase, styles.cardVortex]}>
          <ImageBackground 
            source={item.backgroundImage}
            style={styles.cardImageRotated}
            imageStyle={styles.cardImageStyle}
            resizeMode="cover"
          />

            <View style={styles.cardInnerContent}>
            <View style={styles.cardTopRight}>
              <Feather name="wifi" size={25} color="black" />
            </View>
            <View style={styles.cardContentMiddle}>
              <Text style={styles.debitTitleBlack}>{item.name}</Text>
            </View>
            <View style={styles.cardFooter}>
              <View>
                <Text style={styles.cardLabelSmallBlack}>Titular</Text>
                <Text style={styles.cardValueBoldBlack}>{item.holder}</Text>
              </View>
              <View>
                <Text style={styles.cardLabelSmallBlack}>Validade</Text>
                <Text style={styles.cardValueBoldBlack}>{item.expires}</Text>
              </View>
            </View>
          </View>
        </View>
      );
    }

    if (item.type === 'debit') {
      return (
        <View style={[styles.cardBase, styles.cardDebit]}>
          <ImageBackground 
            source={item.backgroundImage}
            style={styles.cardImageRotated}
            imageStyle={styles.cardImageStyle}
            resizeMode="cover"
          />
          <View style={styles.cardInnerContent}>
            <View style={styles.cardTopRight}>
              <Feather name="wifi" size={20} color="rgba(255,255,255,0.8)" />
            </View>
            <View style={styles.cardContentMiddle}>
              <Text style={styles.debitTitle}>{item.name}</Text>
            </View>
            <View style={styles.cardFooter}>
              <View>
                <Text style={styles.cardLabelSmall}>Titular</Text>
                <Text style={styles.cardValueBold}>{item.holder}</Text>
              </View>
              <View>
                <Text style={styles.cardLabelSmall}>Validade</Text>
                <Text style={styles.cardValueBold}>{item.expires}</Text>
              </View>
            </View>
          </View>
        </View>
      );
    }

    if (item.type === 'pix') {
      return (
        <View style={[styles.cardBase, styles.cardPix]}>
          <View style={styles.pixLogoContainer}>
            {/* Simulação estilizada do logo do Pix */}
            <View style={styles.pixDiamondShape} />
            <Text style={styles.pixTextLogo}>pix</Text>
          </View>
        </View>
      );
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={cardsData}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carouselContainer}
        keyExtractor={(item) => item.id}
        renderItem={renderCard}
      />
      <View style={styles.paginationDots}>
        <View style={styles.dotInactive} />
        <View style={styles.dotActive} />
        <View style={styles.dotInactive} />
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
    gap: 6,
    marginLeft: '42%',
    marginTop: 20,
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