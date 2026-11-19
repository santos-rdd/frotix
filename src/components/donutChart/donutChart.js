import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

/**
 * Gráfico Donut proporcional desenhado com react-native-svg.
 * data: [{ value: number, color: string }]
 * Cada fatia ocupa no anel a fração value / soma de todos os values.
 * `children` é renderizado no centro (ex.: total).
 */
export default function DonutChart({
  data = [],
  radius = 50,
  innerRadius = 35,
  innerCircleColor = '#2541FF',
  trackColor = 'rgba(255,255,255,0.08)',
  children,
}) {
  const size = radius * 2;
  const strokeWidth = radius - innerRadius;
  const r = radius - strokeWidth / 2; // raio da linha central do anel
  const circunferencia = 2 * Math.PI * r;
  const total = data.reduce((soma, item) => soma + (item.value || 0), 0);

  let acumulado = 0;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={radius} cy={radius} r={innerRadius} fill={innerCircleColor} />
        <Circle cx={radius} cy={radius} r={r} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
        {/* Rotaciona -90° para a primeira fatia começar no topo */}
        <G rotation={-90} origin={`${radius}, ${radius}`}>
          {total > 0 &&
            data.map((item, index) => {
              const comprimento = ((item.value || 0) / total) * circunferencia;
              const deslocamento = -acumulado;
              acumulado += comprimento;
              if (!item.value) return null;
              return (
                <Circle
                  key={index}
                  cx={radius}
                  cy={radius}
                  r={r}
                  stroke={item.color}
                  strokeWidth={strokeWidth}
                  fill="none"
                  strokeDasharray={`${comprimento} ${circunferencia - comprimento}`}
                  strokeDashoffset={deslocamento}
                />
              );
            })}
        </G>
      </Svg>
      {children ? <View style={styles.centro}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  centro: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
