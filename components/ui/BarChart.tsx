// components/ui/BarChart.tsx
// Animated bar chart with two-tone gradient bars and value labels
import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  LayoutChangeEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, font, spacing, radius } from '../../theme';

export interface BarDataPoint {
  label: string;
  value: number;
}

interface BarChartProps {
  data:         BarDataPoint[];
  /** Explicit chart area height in px (default 200) */
  chartHeight?: number;
}

const BAR_RADIUS     = 8;
const X_LABEL_HEIGHT = 20;

const BarChart: React.FC<BarChartProps> = ({ data, chartHeight: fixedHeight }) => {
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const chartHeight = fixedHeight ?? measuredHeight;

  const maxValue = useMemo(
    () => Math.max(...data.map(d => d.value), 1) + 1,
    [data]
  );

  const animValuesRef = useRef<Animated.Value[]>([]);
  if (animValuesRef.current.length !== data.length) {
    animValuesRef.current = data.map((_, i) => animValuesRef.current[i] ?? new Animated.Value(0));
  }
  const animValues = animValuesRef.current;
  const hasAnimated = useRef(false);

  const startAnimation = useCallback(() => {
    if (hasAnimated.current || chartHeight === 0 || animValues.length === 0) return;
    hasAnimated.current = true;

    Animated.stagger(
      60,
      animValues.map((anim, i) =>
        Animated.spring(anim, {
          toValue:         1,
          delay:           i * 30,
          useNativeDriver: false,
          stiffness:       130,
          damping:         15,
          mass:            0.8,
        })
      )
    ).start();
  }, [chartHeight, animValues]);

  useEffect(() => {
    hasAnimated.current = false;
    startAnimation();
  }, [data, startAnimation]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0) setMeasuredHeight(h);
  }, []);

  const trackHeight = chartHeight - X_LABEL_HEIGHT - spacing.sm;

  return (
    <View
      style={[styles.container, fixedHeight ? { height: fixedHeight } : {}]}
      onLayout={fixedHeight ? undefined : onLayout}
    >
      {chartHeight > 0 && (
        <>
          {/* Y-axis */}
          <View style={[styles.yAxis, { height: chartHeight }]}>
            {[maxValue, Math.ceil(maxValue / 2), 0].map((val, i) => (
              <Text key={i} style={styles.yLabel}>{val}</Text>
            ))}
          </View>

          {/* Bars */}
          <View style={[styles.barsWrapper, { height: chartHeight }]}>
            {data.map((item, i) => {
              const targetBarPx = trackHeight * (item.value / maxValue);
              const animHeight = animValues[i].interpolate({
                inputRange:  [0, 1],
                outputRange: [0, targetBarPx],
              });
              const animOpacity = animValues[i].interpolate({
                inputRange:  [0, 0.4, 1],
                outputRange: [0, 1, 1],
              });

              return (
                <View key={item.label} style={styles.barCol}>
                  <Animated.View style={{ opacity: animOpacity }}>
                    <View style={[styles.barTrack, { height: trackHeight }]}>
                      <Animated.View
                        style={[
                          styles.barOuter,
                          {
                            height:               animHeight,
                            borderTopLeftRadius:  BAR_RADIUS,
                            borderTopRightRadius: BAR_RADIUS,
                            overflow:             'hidden',
                          },
                        ]}
                      >
                        <LinearGradient
                          colors={[colors.highlight, colors.accent]}
                          style={StyleSheet.absoluteFill}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 0, y: 1 }}
                        />
                      </Animated.View>
                    </View>
                  </Animated.View>
                  <Text style={styles.xLabel} numberOfLines={1}>{item.label}</Text>
                </View>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height:        200,
    alignItems:    'stretch',
  },
  yAxis: {
    justifyContent: 'space-between',
    paddingRight:   spacing.sm,
    paddingBottom:  X_LABEL_HEIGHT,
  },
  yLabel: {
    color:      colors.textMuted,
    fontSize:   font.sizes.xs,
    textAlign:  'right',
    width:      22,
    lineHeight: font.sizes.xs + 4,
  },
  barsWrapper: {
    flex:           1,
    flexDirection:  'row',
    alignItems:     'flex-end',
    justifyContent: 'space-between',
  },
  barCol: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'flex-end',
    marginHorizontal: 3,
  },
  barTrack: {
    width:          '100%',
    justifyContent: 'flex-end',
    marginBottom:   spacing.xs,
  },
  barOuter: {
    width: '100%',
  },
  xLabel: {
    color:      colors.textMuted,
    fontSize:   font.sizes.xs - 1,
    textAlign:  'center',
    width:      '100%',
    height:     X_LABEL_HEIGHT,
  },
});

export default BarChart;
