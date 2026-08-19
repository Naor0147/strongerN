// components/ui/BarChart.tsx
// Animated bar chart with two-tone gradient bars and value labels (120 FPS Reanimated UI-thread worklets)
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  LayoutChangeEvent,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withSpring,
  interpolate,
  Easing,
  SharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, font, spacing, radius, globalAnimation, getScaledDuration } from '../../theme';

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

// Sub-component: Individual animated active block executed on UI thread
const BarBlock: React.FC<{
  index: number;
  total: number;
  blockHeight: number;
  blockGap: number;
  animProgress: SharedValue<number>;
}> = ({ index: j, total, blockHeight, blockGap, animProgress }) => {
  const start = total > 1 ? (j * 0.4) / (total - 1) : 0;
  const end = start + 0.6;

  const blockAnimStyle = useAnimatedStyle(() => {
    const p = animProgress.value;
    const opacity = interpolate(
      p,
      [0, Math.max(0, start), Math.min(1, end), 1],
      [0, 0, 1, 1]
    );
    const scale = interpolate(
      p,
      [0, Math.max(0, start), Math.min(1, end), 1],
      [0.3, 0.3, 1, 1]
    );
    return {
      opacity,
      transform: [{ scale }],
    };
  });

  return (
    <Animated.View
      style={[
        styles.barBlockActive,
        {
          height: blockHeight,
          marginVertical: blockGap / 2,
        },
        blockAnimStyle,
      ]}
    >
      <LinearGradient
        colors={[colors.highlight, colors.accent]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
    </Animated.View>
  );
};

// Sub-component: Animated column with staggered entrance
const BarColumn: React.FC<{
  item: BarDataPoint;
  index: number;
  maxValue: number;
  trackHeight: number;
  chartReady: boolean;
  speed: number;
}> = React.memo(({ item, index, maxValue, trackHeight, chartReady, speed }) => {
  const animProgress = useSharedValue(speed === 0 ? 1 : 0);

  useEffect(() => {
    if (!chartReady) return;
    if (speed === 0) {
      animProgress.value = 1;
      return;
    }
    animProgress.value = 0;
    animProgress.value = withDelay(
      index * 90 * speed,
      withSpring(1, {
        stiffness: 130,
        damping: 15,
        mass: 0.8,
      })
    );
  }, [item.value, chartReady, index]);

  const trackPadding = 3;
  const blockGap = 3;
  const totalGapsHeight = maxValue * blockGap;
  const blockHeight = Math.max(0, (trackHeight - 2 * trackPadding - totalGapsHeight) / maxValue);

  return (
    <View style={styles.barCol}>
      <View style={[styles.barTrack, { height: trackHeight }]}>
        {Array.from({ length: item.value }).map((_, j) => (
          <BarBlock
            key={j}
            index={j}
            total={item.value}
            blockHeight={blockHeight}
            blockGap={blockGap}
            animProgress={animProgress}
          />
        ))}
      </View>
      <Text style={styles.xLabel} numberOfLines={1}>{item.label}</Text>
    </View>
  );
});

const BarChart: React.FC<BarChartProps> = ({ data, chartHeight: fixedHeight }) => {
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const chartHeight = fixedHeight ?? measuredHeight;

  const maxValue = useMemo(
    () => Math.max(...data.map(d => d.value), 1) + 1,
    [data]
  );

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0) setMeasuredHeight(h);
  }, []);

  const speed = (typeof globalAnimation !== 'undefined' && globalAnimation && typeof globalAnimation.speed === 'number')
    ? globalAnimation.speed
    : 1;

  const trackHeight = chartHeight - X_LABEL_HEIGHT - spacing.sm;
  const chartReady = chartHeight > 0;

  return (
    <View
      style={[styles.container, fixedHeight ? { height: fixedHeight } : {}]}
      onLayout={fixedHeight ? undefined : onLayout}
    >
      {chartReady && (
        <>
          {/* Y-axis */}
          <View style={[styles.yAxis, { height: chartHeight }]}>
            {[maxValue, Math.ceil(maxValue / 2), 0].map((val, i) => (
              <Text key={`y-label-${i}-${val}`} style={styles.yLabel}>{val}</Text>
            ))}
          </View>

          {/* Bars */}
          <View style={[styles.barsWrapper, { height: chartHeight }]}>
            {data.map((item, i) => (
              <BarColumn
                key={item.label}
                item={item}
                index={i}
                maxValue={maxValue}
                trackHeight={trackHeight}
                chartReady={chartReady}
                speed={speed}
              />
            ))}
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
    flexDirection:  'column-reverse',
    padding:        3, // trackPadding
    marginBottom:   spacing.xs,
    backgroundColor: 'rgba(255, 255, 255, 0.015)',
    borderColor:     'rgba(255, 255, 255, 0.04)',
    borderWidth:     1,
    borderRadius:    BAR_RADIUS,
    overflow:        'hidden',
  },
  barBlockActive: {
    width:          '100%',
    borderRadius:   4,
    overflow:       'hidden',
    position:       'relative',
  },
  xLabel: {
    color:      colors.textMuted,
    fontSize:   font.sizes.xs - 1,
    textAlign:  'center',
    width:      '100%',
    height:     X_LABEL_HEIGHT,
  },
});

export default React.memo(BarChart);
