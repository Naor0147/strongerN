import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import Svg, { Path, Text as SvgText, Defs, LinearGradient, Stop, Circle, Line, G } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
  withRepeat,
  withDelay,
} from 'react-native-reanimated';
import { colors, font, spacing, radius } from '../../../theme';

const ENTRY_DURATION = 1400;

export interface DataPoint {
  x: number;
  y: number;
  label?: string;
}

export interface LineChartProps {
  data: DataPoint[];
  color?: string;
  height: number;
  yAxisFormatter?: (val: number) => string;
  xAxisFormatter?: (val: number) => string;
  glow?: boolean;
  title?: string;
}

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const TrendingUpIcon = () => (
  <Svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: spacing.xs }}>
    <Path d="m22 7-8.5 8.5-5-5L2 17" />
    <Path d="M16 7h6v6" />
  </Svg>
);

// Helper component for animating individual circles to avoid calling hooks inside a loop
const CircleItem = React.memo(({
  point,
  idx,
  totalPoints,
  getX,
  getY,
  height,
  paddingBottom,
  color,
  entryProgress,
  isLast,
}: any) => {
  const pulseProgress = useSharedValue(0);

  useEffect(() => {
    if (isLast) {
      const delay = totalPoints > 1 ? 0.25 : 0;
      const startDelay = ENTRY_DURATION * delay;
      const activeDuration = 1400; // 1400ms duration
      
      pulseProgress.value = 0;
      pulseProgress.value = withDelay(
        startDelay,
        withRepeat(
          withTiming(1, {
            duration: activeDuration / 4, // 4 repetitions: 350ms per step (smoother)
            easing: Easing.bezier(0.25, 1, 0.5, 1),
          }),
          4, // 4 repetitions (2 full beats: up/down)
          true
        )
      );
    }
  }, [isLast, totalPoints]);

  const animatedProps = useAnimatedProps(() => {
    const progress = entryProgress.value;
    const targetY = getY(point.y);
    const baselineY = height - paddingBottom;
    
    // Left-to-right staggered delay
    const delay = totalPoints > 1 ? (idx / (totalPoints - 1)) * 0.25 : 0;
    const t = Math.max(0, Math.min(1, (progress - delay) / 0.75));
    const pointProgress = t * t * (3 - 2 * t); // Smoothstep interpolation
    
    const y = baselineY - (baselineY - targetY) * pointProgress;
    return {
      cx: getX(point.x),
      cy: y,
      opacity: pointProgress,
    };
  });

  const animatedGlowRingProps = useAnimatedProps(() => {
    const progress = entryProgress.value;
    const targetY = getY(point.y);
    const baselineY = height - paddingBottom;
    
    const delay = totalPoints > 1 ? (idx / (totalPoints - 1)) * 0.25 : 0;
    const t = Math.max(0, Math.min(1, (progress - delay) / 0.75));
    const pointProgress = t * t * (3 - 2 * t);
    
    const y = baselineY - (baselineY - targetY) * pointProgress;
    return {
      cx: getX(point.x),
      cy: y,
      opacity: pointProgress * 0.18,
    };
  });

  const animatedHaloProps = useAnimatedProps(() => {
    const progress = entryProgress.value;
    const pulse = pulseProgress.value;
    const targetY = getY(point.y);
    const baselineY = height - paddingBottom;
    
    const delay = totalPoints > 1 ? (idx / (totalPoints - 1)) * 0.25 : 0;
    const t = Math.max(0, Math.min(1, (progress - delay) / 0.75));
    const pointProgress = t * t * (3 - 2 * t);
    
    const y = baselineY - (baselineY - targetY) * pointProgress;
    
    return {
      cx: getX(point.x),
      cy: y,
      r: (10 + pulse * 4) * pointProgress, // radius pulses between 10 and 14
      opacity: (0.15 + pulse * 0.15) * pointProgress,
    };
  });

  if (isLast) {
    return (
      <G>
        {/* Pulsing halo */}
        <AnimatedCircle
          animatedProps={animatedHaloProps}
          fill={colors.highlight}
        />
        {/* Glow ring */}
        <AnimatedCircle
          animatedProps={animatedGlowRingProps}
          r={7}
          fill="none"
          stroke={colors.highlight}
          strokeWidth={1.5}
        />
        {/* Main Circle */}
        <AnimatedCircle
          animatedProps={animatedProps}
          r={6}
          fill={colors.bg}
          stroke={colors.highlight}
          strokeWidth={2.5}
        />
      </G>
    );
  }

  return (
    <G>
      {/* Glow ring */}
      <AnimatedCircle
        animatedProps={animatedGlowRingProps}
        r={7}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
      />
      {/* Main Circle */}
      <AnimatedCircle
        animatedProps={animatedProps}
        r={4}
        fill={colors.bg}
        stroke={color}
        strokeWidth={2}
      />
    </G>
  );
});

const LineChart: React.FC<LineChartProps> = ({
  data,
  color = colors.accent,
  height,
  yAxisFormatter,
  xAxisFormatter,
  glow = true,
  title,
}) => {
  const [width, setWidth] = useState(300);

  const onLayout = (e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  };

  const entryProgress = useSharedValue(0);

  useEffect(() => {
    entryProgress.value = 0;
    entryProgress.value = withTiming(1, {
      duration: ENTRY_DURATION,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    });
  }, [data]);

  if (!data || data.length < 2) {
    return (
      <View style={[styles.container, styles.emptyContainer, { height: height + 30, backgroundColor: colors.surfaceHigh }]}>
        {title && <Text style={[styles.chartTitle, { width: '100%' }]}>{title}</Text>}
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%', gap: spacing.xs }}>
          <TrendingUpIcon />
          <Text style={styles.emptyText}>Log your workouts to visualize your progress over time</Text>
        </View>
      </View>
    );
  }

  // Margins
  const paddingTop = 20;
  const paddingBottom = 30;
  const paddingLeft = 45;
  const paddingRight = 20;

  // Limits
  const xValues = data.map((d) => d.x);
  const yValues = data.map((d) => d.y);
  
  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);
  
  const yMinVal = Math.min(...yValues);
  const yMaxVal = Math.max(...yValues);
  const yRange = yMaxVal - yMinVal;
  
  // Pad the y-axis range so that there is a comfortable baseline height.
  const yPadMin = Math.max(5, yRange * 1.2);
  const yPadMax = Math.max(2, yRange * 0.3);
  const yMin = Math.max(0, yMinVal - yPadMin);
  const yMax = yMaxVal + yPadMax;

  // Add horizontal margin to the plotting area so points aren't cut off at the left/right boundaries.
  const plotPaddingHorizontal = 16;

  const getX = (xVal: number) => {
    if (xMax === xMin) return paddingLeft + (width - paddingLeft - paddingRight) / 2;
    return paddingLeft + plotPaddingHorizontal + 
      ((xVal - xMin) / (xMax - xMin)) * (width - paddingLeft - paddingRight - 2 * plotPaddingHorizontal);
  };

  const getY = (yVal: number) => {
    if (yMax === yMin) return paddingTop + (height - paddingTop - paddingBottom) / 2;
    return height - paddingBottom - ((yVal - yMin) / (yMax - yMin)) * (height - paddingTop - paddingBottom);
  };

  // Animated props for the line path
  const animatedLineProps = useAnimatedProps(() => {
    const progress = entryProgress.value;
    const N = data.length;
    const path = data.map((d, i) => {
      const x = getX(d.x);
      const targetY = getY(d.y);
      const baselineY = height - paddingBottom;
      
      const delay = (i / (N - 1)) * 0.25;
      const t = Math.max(0, Math.min(1, (progress - delay) / 0.75));
      const pointProgress = t * t * (3 - 2 * t); // Smoothstep interpolation
      
      const y = baselineY - (baselineY - targetY) * pointProgress;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
    
    return { d: path };
  });

  // Animated props for the line drop shadow path (offset down by 3px)
  const animatedShadowProps = useAnimatedProps(() => {
    const progress = entryProgress.value;
    const N = data.length;
    const path = data.map((d, i) => {
      const x = getX(d.x);
      const targetY = getY(d.y) + 3; // offset down
      const baselineY = height - paddingBottom + 3;
      
      const delay = (i / (N - 1)) * 0.25;
      const t = Math.max(0, Math.min(1, (progress - delay) / 0.75));
      const pointProgress = t * t * (3 - 2 * t);
      
      const y = baselineY - (baselineY - targetY) * pointProgress;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
    
    return { d: path };
  });

  // Animated props for the gradient fill path
  const animatedFillProps = useAnimatedProps(() => {
    const progress = entryProgress.value;
    const N = data.length;
    const linePoints = data.map((d, i) => {
      const x = getX(d.x);
      const targetY = getY(d.y);
      const baselineY = height - paddingBottom;
      
      const delay = (i / (N - 1)) * 0.25;
      const t = Math.max(0, Math.min(1, (progress - delay) / 0.75));
      const pointProgress = t * t * (3 - 2 * t); // Smoothstep interpolation
      
      const y = baselineY - (baselineY - targetY) * pointProgress;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
    
    const path = `${linePoints} L ${getX(data[data.length - 1].x)} ${height - paddingBottom} L ${getX(data[0].x)} ${height - paddingBottom} Z`;
    return { d: path };
  });

  // Grid tick values (3 steps) - Memorized
  const yTicks = React.useMemo(() => {
    return [yMin, yMin + (yMax - yMin) / 2, yMax];
  }, [yMin, yMax]);

  const xTicksIndices = React.useMemo(() => {
    return data.length <= 4 
      ? data.map((_, i) => i) 
      : [0, Math.floor((data.length - 1) / 3), Math.floor((data.length - 1) * 2 / 3), data.length - 1];
  }, [data.length]);

  return (
    <View style={styles.container} onLayout={onLayout}>
      {title && <Text style={styles.chartTitle}>{title}</Text>}
      <Svg width={width} height={height} style={{ overflow: 'visible' }}>
        <Defs>
          {/* Richer 3-stop gradient fill */}
          <LinearGradient id="chartGlow" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={color} stopOpacity={0.30} />
            <Stop offset="40%" stopColor={color} stopOpacity={0.12} />
            <Stop offset="100%" stopColor={color} stopOpacity={0.0} />
          </LinearGradient>
          
          {/* Edge-fade grid lines gradient */}
          <LinearGradient id="gridLineGrad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor={colors.border} stopOpacity={0.1} />
            <Stop offset="15%" stopColor={colors.border} stopOpacity={0.7} />
            <Stop offset="85%" stopColor={colors.border} stopOpacity={0.7} />
            <Stop offset="100%" stopColor={colors.border} stopOpacity={0.1} />
          </LinearGradient>
        </Defs>

        {/* Horizontal grid lines & y-axis labels */}
        {yTicks.map((tick, i) => {
          const yPos = getY(tick);
          return (
            <React.Fragment key={i}>
              <Path
                d={`M ${paddingLeft} ${yPos} L ${width - paddingRight} ${yPos}`}
                stroke="url(#gridLineGrad)"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <SvgText
                x={paddingLeft - 8}
                y={yPos + 3}
                fill={colors.textSecondary}
                fontSize={9}
                fontFamily={font.regular}
                textAnchor="end"
              >
                {yAxisFormatter ? yAxisFormatter(tick) : String(Math.round(tick))}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* Solid X-axis grounding line */}
        <Line
          x1={paddingLeft - 8}
          y1={height - paddingBottom}
          x2={width - paddingRight + 8}
          y2={height - paddingBottom}
          stroke={colors.border}
          strokeWidth={1.5}
        />

        {/* Gradient fill */}
        <AnimatedPath animatedProps={animatedFillProps} fill="url(#chartGlow)" />

        {/* Line drop shadow */}
        <AnimatedPath
          animatedProps={animatedShadowProps}
          fill="none"
          stroke="#000"
          strokeWidth={2.5}
          opacity={0.35}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Glow path - wider and semi-transparent */}
        {glow && (
          <G>
            <AnimatedPath
              animatedProps={animatedLineProps}
              fill="none"
              stroke={color}
              strokeWidth={8}
              opacity={0.08}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <AnimatedPath
              animatedProps={animatedLineProps}
              fill="none"
              stroke={color}
              strokeWidth={5}
              opacity={0.15}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </G>
        )}

        {/* Line stroke */}
        <AnimatedPath animatedProps={animatedLineProps} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

        {/* Data points (circles) */}
        {data.map((d, i) => (
          <CircleItem
            key={i}
            point={d}
            idx={i}
            totalPoints={data.length}
            getX={getX}
            getY={getY}
            height={height}
            paddingBottom={paddingBottom}
            color={color}
            entryProgress={entryProgress}
            isLast={i === data.length - 1}
          />
        ))}

        {/* x-axis labels */}
        {xTicksIndices.map((idx) => {
          const d = data[idx];
          if (!d) return null;
          const xPos = getX(d.x);
          const label = d.label || (xAxisFormatter ? xAxisFormatter(d.x) : String(d.x));
          return (
            <SvgText
              key={idx}
              x={xPos}
              y={height - 8}
              fill={colors.textSecondary}
              fontSize={9}
              fontFamily={font.regular}
              textAnchor="middle"
            >
              {label}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    width: '100%',
    marginVertical: spacing.sm,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: font.sizes.sm,
    fontFamily: font.medium,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  chartTitle: {
    color: colors.textPrimary,
    fontFamily: font.semibold,
    fontSize: font.sizes.md,
    marginBottom: spacing.sm,
    paddingLeft: spacing.xs,
  },
});

export default React.memo(LineChart);
