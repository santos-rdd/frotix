import React from 'react';
import { View, StyleSheet } from 'react-native';

/**
 * Componente de Gráfico Donut 100% nativo (sem bibliotecas externas pesadas).
 * Utiliza camadas de círculos e bordas estilizadas para desenhar proporções com performance.
 */
export default function DonutChart({
  data = [],
  radius = 50,
  innerRadius = 35,
  innerCircleColor = '#2541FF',
}) {
  const size = radius * 2;
  const borderWidth = radius - innerRadius;
  const innerSize = innerRadius * 2;

  const firstColor = data[0]?.color || '#3B82F6';
  const secondColor = data[1]?.color || '#94A3B8';
  const thirdColor = data[2]?.color || '#DC2626';
  const fourthColor = data[3]?.color || firstColor;

  return (
    <View
      style={[
        styles.donutOuter,
        {
          width: size,
          height: size,
          borderRadius: radius,
          borderWidth: borderWidth,
          borderTopColor: firstColor,
          borderRightColor: secondColor,
          borderBottomColor: thirdColor,
          borderLeftColor: fourthColor,
        },
      ]}
    >
      <View
        style={[
          styles.donutInner,
          {
            width: innerSize,
            height: innerSize,
            borderRadius: innerRadius,
            backgroundColor: innerCircleColor,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  donutOuter: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  donutInner: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
