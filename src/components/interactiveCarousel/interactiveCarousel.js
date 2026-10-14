import React, { useState } from 'react';
import { View, StyleSheet, Dimensions, FlatList } from 'react-native';
import OptionsPanel from '../optionsPanel/optionsPanel.js'; 
import RecentActivity from '../RecentActivity/RecentActivity.js';

const { width } = Dimensions.get('window');

export default function InteractiveCarousel({ onOpenSlider, atividades }) {
  const [activeIndex, setActiveIndex] = useState(0);

  const carouselData = [
    { id: '1', type: 'options' },
    { id: '2', type: 'activity' },
  ];

  const handleScroll = (event) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const currentIndex = Math.floor(event.nativeEvent.contentOffset.x / slideSize);
    setActiveIndex(currentIndex);
  };

  const renderItem = ({ item }) => {
    return (
      <View style={styles.slideContainer}>
        {item.type === 'options' ? (
          <OptionsPanel onOpenSlider={onOpenSlider} />
        ) : (
          <RecentActivity atividades={atividades} />
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={carouselData}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        snapToInterval={width} // Trava o arraste exatamente na largura da tela
        decelerationRate="fast" // Faz a animação de parada ser imediata
      />

      <View style={styles.paginationDots}>
        {carouselData.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              activeIndex === index ? styles.dotActive : styles.dotInactive,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: 10,
  },
  slideContainer: {
    width: width, 
    paddingHorizontal: 20,
  },
  paginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 15,
  },
  dotActive: {
    width: 24,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2541ff',
  },
  dotInactive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#555',
  },
});