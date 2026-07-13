import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import Svg, {
  Line,
  Circle,
  G,
  Text as SvgText,
  Rect as SvgRect,
  Path,
  Defs,
  LinearGradient,
  Stop,
  Polygon,
  RadialGradient
} from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
  withRepeat,
} from 'react-native-reanimated';
import { colors, font, spacing, radius, shadow } from '../../../theme';

export interface DistributionChartProps {
  percentile: number; // between 0 and 1
  title?: string;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedG = Animated.createAnimatedComponent(G);

// Helper component for animating individual bars to avoid calling hooks inside a loop
const BarItem = ({
  idx,
  xPos,
  barHPixels,
  height,
  paddingBottom,
  barWidth,
  isActive,
  isUserBar,
  colors,
  entryProgress,
  pulseProgress,
}: any) => {
  const getBarPath = (x: number, y: number, w: number, hVal: number) => {
    const r = Math.min(6, w / 2, hVal / 2);
    return `M ${x} ${y + hVal} L ${x} ${y + r} Q ${x} ${y} ${x + r} ${y} L ${x + w - r} ${y} Q ${x + w} ${y} ${x + w} ${y + r} L ${x + w} ${y + hVal} Z`;
  };

  const getCapPath = (x: number, y: number, w: number, hVal: number) => {
    const r = Math.min(6, w / 2, hVal / 2);
    return `M ${x} ${y + r} Q ${x} ${y} ${x + r} ${y} L ${x + w - r} ${y} Q ${x + w} ${y} ${x + w} ${y + r}`;
  };

  const animatedProps = useAnimatedProps(() => {
    const progress = entryProgress.value;
    
    // Stagger progress from left to right with smoothstep
    const delay = (idx / 6) * 0.25;
    const t = Math.max(0, Math.min(1, (progress - delay) / 0.75));
    const barProgress = t * t * (3 - 2 * t); // Smoothstep interpolation
    
    const currentHeight = barHPixels * barProgress;
    const currentY = height - paddingBottom - currentHeight;
    const path = getBarPath(xPos, currentY, barWidth, Math.max(3, currentHeight));
    return {
      d: path,
    };
  });

  const animatedCapProps = useAnimatedProps(() => {
    const progress = entryProgress.value;
    
    const delay = (idx / 6) * 0.25;
    const t = Math.max(0, Math.min(1, (progress - delay) / 0.75));
    const barProgress = t * t * (3 - 2 * t);
    
    const currentHeight = barHPixels * barProgress;
    const currentY = height - paddingBottom - currentHeight;
    const path = getCapPath(xPos, currentY, barWidth, Math.max(3, currentHeight));
    return {
      d: path,
    };
  });

  const animatedGlowProps = useAnimatedProps(() => {
    const progress = entryProgress.value;
    const pulse = pulseProgress.value;
    
    const delay = (idx / 6) * 0.25;
    const t = Math.max(0, Math.min(1, (progress - delay) / 0.75));
    const barProgress = t * t * (3 - 2 * t); // Smoothstep interpolation
    
    const currentHeight = barHPixels * barProgress;
    const currentY = height - paddingBottom - currentHeight;
    const path = getBarPath(xPos, currentY, barWidth, Math.max(3, currentHeight));
    return {
      d: path,
      strokeWidth: (3.5 + pulse * 3) * barProgress,
      opacity: (0.22 + pulse * 0.18) * barProgress,
    };
  });

  let fill = colors.surfaceHigh;
  let opacity = 1.0;
  let stroke = 'none';
  let strokeWidth = 0;

  if (isActive) {
    fill = "url(#activeGrad)";
    if (isUserBar) {
      opacity = 1.0;
      stroke = colors.highlight;
      strokeWidth = 1.5;
    } else {
      opacity = 0.55;
    }
  } else {
    opacity = 0.25; // low opacity for ghost look
    fill = colors.surface2;
    stroke = colors.accent;
    strokeWidth = 1.0;
  }

  return (
    <G>
      {isUserBar && (
        <AnimatedPath
          animatedProps={animatedGlowProps}
          fill="none"
          stroke={colors.highlight}
        />
      )}
      <AnimatedPath
        animatedProps={animatedProps}
        fill={fill}
        opacity={opacity}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
      {isActive && (
        <AnimatedPath
          animatedProps={animatedCapProps}
          fill="none"
          stroke={colors.highlight}
          strokeWidth={1.2}
          opacity={isUserBar ? 1.0 : 0.75}
        />
      )}
    </G>
  );
};

const DistributionChart: React.FC<DistributionChartProps> = ({
  percentile,
  title = "Strength Distribution",
}) => {
  const [width, setWidth] = useState(300);

  const onLayout = (e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  };

  const height = 135;
  const paddingLeft = 20;
  const paddingRight = 20;
  const paddingTop = 38; // room for the flag/tooltip
  const paddingBottom = 12;

  // Layout parameters locked to the 20% taller middle bar baseline
  const N = 7;
  const barHeights = [6, 20, 65, 100, 65, 20, 6]; // Original curve heights
  const extraPercent = 0.20; // Locked permanently to +20% middle bar height
  const barGap = 6; // Option 3 thick bar width
  const drawingWidth = width - paddingLeft - paddingRight;
  const barWidth = Math.max(6, (drawingWidth - barGap * (N - 1)) / N);

  const getBarX = (idx: number) => {
    return paddingLeft + idx * (barWidth + barGap);
  };

  // Find which bar the user falls into
  const userBarIdx = Math.min(N - 1, Math.max(0, Math.floor(percentile * N)));

  const pct = Math.round(percentile * 100);
  const percentText = `${pct}%`;
  
  // Dynamic subtitle copy
  const subtitleText = percentile >= 0.5 
    ? `Stronger than ${pct}% of lifters in this lift`
    : `Top ${Math.max(1, 100 - pct)}% of lifters in this lift`;

  const maxBarH = height - paddingTop - paddingBottom;
  
  // Calculate heights pixel-wise: middle bar (idx 3) is 20% taller in pixels, others stay at baseline
  const getBarHeightInPixels = (idx: number, originalH: number) => {
    const baselineH = (originalH / 100) * maxBarH;
    if (idx === 3) {
      return maxBarH * (1 + extraPercent);
    }
    return baselineH;
  };

  const targetBarH = getBarHeightInPixels(userBarIdx, barHeights[userBarIdx]);
  const targetX = width > 100 ? getBarX(userBarIdx) + barWidth / 2 : 0;
  const pinBottomY = height - paddingBottom - targetBarH;
  const pinTopY = 22; // top height target for flag

  // Animation values
  const entryProgress = useSharedValue(0);
  const pulseProgress = useSharedValue(0);

  useEffect(() => {
    entryProgress.value = withTiming(1, {
      duration: 1400, // a bit slower
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    }, (finished) => {
      if (finished) {
        pulseProgress.value = withRepeat(
          withTiming(1, {
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
          }),
          -1, // infinite
          true // reverse
        );
      }
    });

    // Run pulse animation for 1.4 seconds, then rest at 1.0 (final state)
    pulseProgress.value = withTiming(0, { duration: 0 });
    pulseProgress.value = withTiming(0.5, {
      duration: 1400, // a bit slower
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    });
  }, []);

  // Animated Props for Glow & Pin Elements (delayed until the sweep reaches the user's bar)
  const ambientGlowProps = useAnimatedProps(() => {
    const progress = entryProgress.value;
    const pulse = pulseProgress.value;
    
    const userDelay = (userBarIdx / 6) * 0.25;
    const t = Math.max(0, Math.min(1, (progress - userDelay) / 0.75));
    const userProgress = t * t * (3 - 2 * t); // Smoothstep interpolation
    
    return {
      r: (45 + pulse * 12) * userProgress,
      opacity: (0.16 + pulse * 0.12) * userProgress,
    };
  });

  const pinLineProps = useAnimatedProps(() => {
    const progress = entryProgress.value;
    
    const userDelay = (userBarIdx / 6) * 0.25;
    const t = Math.max(0, Math.min(1, (progress - userDelay) / 0.75));
    const userProgress = t * t * (3 - 2 * t); // Smoothstep interpolation
    
    const currentY2 = pinBottomY - (pinBottomY - pinTopY) * userProgress;
    return {
      y1: pinBottomY,
      y2: currentY2,
      opacity: userProgress,
    };
  });

  const pinBaseOuterProps = useAnimatedProps(() => {
    const progress = entryProgress.value;
    const pulse = pulseProgress.value;
    
    const userDelay = (userBarIdx / 6) * 0.25;
    const t = Math.max(0, Math.min(1, (progress - userDelay) / 0.75));
    const userProgress = t * t * (3 - 2 * t); // Smoothstep interpolation
    
    return {
      r: (10 + pulse * 4) * userProgress,
      opacity: (0.12 + pulse * 0.12) * userProgress,
    };
  });

  const pinBaseMiddleProps = useAnimatedProps(() => {
    const progress = entryProgress.value;
    const pulse = pulseProgress.value;
    
    const userDelay = (userBarIdx / 6) * 0.25;
    const t = Math.max(0, Math.min(1, (progress - userDelay) / 0.75));
    const userProgress = t * t * (3 - 2 * t); // Smoothstep interpolation
    
    return {
      r: (6 + pulse * 2) * userProgress,
      opacity: (0.24 + pulse * 0.12) * userProgress,
    };
  });

  const pinBaseInnerProps = useAnimatedProps(() => {
    const progress = entryProgress.value;
    
    const userDelay = (userBarIdx / 6) * 0.25;
    const t = Math.max(0, Math.min(1, (progress - userDelay) / 0.75));
    const userProgress = t * t * (3 - 2 * t); // Smoothstep interpolation
    
    return {
      r: 3 * userProgress,
      opacity: userProgress,
    };
  });

  const tooltipProps = useAnimatedProps(() => {
    const progress = entryProgress.value;
    
    const userDelay = (userBarIdx / 6) * 0.25;
    const t = Math.max(0, Math.min(1, (progress - userDelay) / 0.75));
    const userProgress = t * t * (3 - 2 * t); // Smoothstep interpolation
    
    const scale = userProgress;
    const transform = `translate(${targetX}, ${pinTopY}) scale(${scale}) translate(${-targetX}, ${-pinTopY})`;
    return {
      transform,
      opacity: userProgress,
    };
  });

  return (
    <View style={styles.container} onLayout={onLayout}>
      {/* Header section with Title & Subtitle */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {title && <Text style={styles.chartTitle}>{title}</Text>}
          <Text style={styles.chartSubtitle}>{subtitleText}</Text>
        </View>
      </View>

      <Svg width={width} height={height} style={{ overflow: 'visible' }}>
        <Defs>
          {/* Active bar gradient */}
          <LinearGradient id="activeGrad" x1="0" y1="1" x2="0" y2="0">
            <Stop offset="0%" stopColor={colors.accent} />
            <Stop offset="50%" stopColor="#44A6F7" />
            <Stop offset="100%" stopColor={colors.highlight} />
          </LinearGradient>
          
          {/* Grid line gradient to fade at edges */}
          <LinearGradient id="gridGrad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor={colors.border} stopOpacity={0.1} />
            <Stop offset="15%" stopColor={colors.border} stopOpacity={0.5} />
            <Stop offset="85%" stopColor={colors.border} stopOpacity={0.5} />
            <Stop offset="100%" stopColor={colors.border} stopOpacity={0.1} />
          </LinearGradient>

          {/* Ambient radial glow behind the user's position */}
          <RadialGradient id="ambientGlow" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0%" stopColor={colors.highlightGlow} stopOpacity={1} />
            <Stop offset="100%" stopColor={colors.highlightGlow} stopOpacity={0} />
          </RadialGradient>

          {/* Tooltip Gradient */}
          <LinearGradient id="tooltipGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={colors.highlight} />
            <Stop offset="100%" stopColor={colors.accent} />
          </LinearGradient>
        </Defs>

        {/* Ambient Glow Backdrop (rendered behind grid lines and bars) */}
        {width > 100 && (
          <AnimatedCircle
            cx={targetX}
            cy={pinBottomY}
            animatedProps={ambientGlowProps}
            fill="url(#ambientGlow)"
          />
        )}

        {/* Background Grid Lines */}
        {width > 100 && (() => {
          const y1 = height - paddingBottom - maxBarH;
          const y2 = height - paddingBottom - (maxBarH * 0.5);
          return (
            <G>
              <Line
                x1={paddingLeft}
                y1={y1}
                x2={width - paddingRight}
                y2={y1}
                stroke="url(#gridGrad)"
                strokeWidth={1}
                strokeDasharray="4,4"
              />
              <Line
                x1={paddingLeft}
                y1={y2}
                x2={width - paddingRight}
                y2={y2}
                stroke="url(#gridGrad)"
                strokeWidth={1}
                strokeDasharray="4,4"
              />
              {/* Solid baseline */}
              <Line
                x1={paddingLeft - 8}
                y1={height - paddingBottom}
                x2={width - paddingRight + 8}
                y2={height - paddingBottom}
                stroke={colors.border}
                strokeWidth={1.5}
              />
            </G>
          );
        })()}

        {/* Draw the distribution bars */}
        {width > 100 && barHeights.map((h, i) => {
          const xPos = getBarX(i);
          const barHPixels = getBarHeightInPixels(i, h);
          
          const isActive = i <= userBarIdx;
          const isUserBar = i === userBarIdx;

          return (
            <BarItem
              key={i}
              idx={i}
              xPos={xPos}
              barHPixels={barHPixels}
              height={height}
              paddingBottom={paddingBottom}
              barWidth={barWidth}
              isActive={isActive}
              isUserBar={isUserBar}
              colors={colors}
              entryProgress={entryProgress}
              pulseProgress={pulseProgress}
            />
          );
        })}

        {/* Draw the User Pin & Flag if width is loaded */}
        {width > 100 && (() => {
          const flagWidth = 56;
          const flagHeight = 22;
          
          // Constrain flag within bounds
          let flagX = targetX - flagWidth / 2;
          if (flagX < 6) {
            flagX = 6;
          } else if (flagX + flagWidth > width - 6) {
            flagX = width - flagWidth - 6;
          }

          const flagY = pinTopY - flagHeight - 4;
          const bubblePath = `M ${flagX + 6} ${flagY} H ${flagX + flagWidth - 6} Q ${flagX + flagWidth} ${flagY} ${flagX + flagWidth} ${flagY + 6} V ${flagY + flagHeight - 6} Q ${flagX + flagWidth} ${flagY + flagHeight} ${flagX + flagWidth - 6} ${flagY + flagHeight} L ${targetX + 5} ${flagY + flagHeight} Q ${targetX} ${flagY + flagHeight + 1} ${targetX} ${flagY + flagHeight + 4} Q ${targetX} ${flagY + flagHeight + 1} ${targetX - 5} ${flagY + flagHeight} L ${flagX + 6} ${flagY + flagHeight} Q ${flagX} ${flagY + flagHeight} ${flagX} ${flagY + flagHeight - 6} V ${flagY + 6} Q ${flagX} ${flagY} ${flagX + 6} ${flagY} Z`;

          return (
            <G>
              {/* Vertical Pin Line in Theme Highlight */}
              <AnimatedLine
                x1={targetX}
                x2={targetX}
                animatedProps={pinLineProps}
                stroke={colors.highlight}
                strokeWidth={1.5}
                strokeDasharray="3,3"
              />

              {/* Pin Base Multi-layered Glowing Circle */}
              <AnimatedCircle
                cx={targetX}
                cy={pinBottomY}
                animatedProps={pinBaseOuterProps}
                fill={colors.highlight}
              />
              <AnimatedCircle
                cx={targetX}
                cy={pinBottomY}
                animatedProps={pinBaseMiddleProps}
                fill={colors.highlight}
              />
              <AnimatedCircle
                cx={targetX}
                cy={pinBottomY}
                animatedProps={pinBaseInnerProps}
                fill={colors.highlight}
              />

              {/* Tooltip Group containing flag speech bubble and text */}
              <AnimatedG animatedProps={tooltipProps}>
                {/* Tooltip subtle glow (shadow) using same path with wider stroke */}
                <Path
                  d={bubblePath}
                  fill="none"
                  stroke={colors.highlightGlow}
                  strokeWidth={4}
                />

                {/* Flag speech bubble unified path */}
                <Path
                  d={bubblePath}
                  fill="url(#tooltipGrad)"
                  stroke={colors.highlight}
                  strokeWidth={0.8}
                />

                {/* Flag Percentile Text */}
                <SvgText
                  x={flagX + flagWidth / 2}
                  y={flagY + flagHeight / 2 + 4} // vertically centered
                  fill={colors.bg}
                  fontSize={12}
                  fontFamily={font.bold}
                  textAnchor="middle"
                >
                  {percentText}
                </SvgText>
              </AnimatedG>
            </G>
          );
        })()}
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
    ...shadow.card,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerLeft: {
    flex: 1,
  },
  chartTitle: {
    color: colors.textPrimary,
    fontFamily: font.semibold,
    fontSize: font.sizes.md,
    marginBottom: 2,
  },
  chartSubtitle: {
    color: colors.textSecondary,
    fontFamily: font.regular,
    fontSize: font.sizes.xs,
  },
});

export default DistributionChart;
