import React, { useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import Svg, {
  Line,
  Circle,
  G,
  Text as SvgText,
  Path,
  Defs,
  LinearGradient,
  Stop,
  RadialGradient
} from 'react-native-svg';
import { colors, font, spacing, radius, shadow } from '../../../theme';

export interface DistributionChartProps {
  percentile: number; // between 0 and 1
  title?: string;
}

const getBarPath = (x: number, y: number, w: number, hVal: number) => {
  const r = Math.min(6, w / 2, hVal / 2);
  return `M ${x} ${y + hVal} L ${x} ${y + r} Q ${x} ${y} ${x + r} ${y} L ${x + w - r} ${y} Q ${x + w} ${y} ${x + w} ${y + r} L ${x + w} ${y + hVal} Z`;
};

const getCapPath = (x: number, y: number, w: number, hVal: number) => {
  const r = Math.min(6, w / 2, hVal / 2);
  return `M ${x} ${y + r} Q ${x} ${y} ${x + r} ${y} L ${x + w - r} ${y} Q ${x + w} ${y} ${x + w} ${y + r}`;
};

const DistributionChart: React.FC<DistributionChartProps> = ({
  percentile,
  title = "Strength Distribution",
}) => {
  const [width, setWidth] = useState(300);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setWidth(w);
  };

  const height = 165;
  const paddingLeft = 20;
  const paddingRight = 20;
  const paddingTop = 58;
  const paddingBottom = 16;

  const N = 7;
  const barHeights = [6, 20, 65, 100, 65, 20, 6];
  const extraPercent = 0.20;
  const barGap = 6;
  const drawingWidth = width - paddingLeft - paddingRight;
  const barWidth = Math.max(6, (drawingWidth - barGap * (N - 1)) / N);

  const getBarX = (idx: number) => {
    return paddingLeft + idx * (barWidth + barGap);
  };

  const safePercentile = typeof percentile === 'number' && !isNaN(percentile)
    ? Math.min(0.99, Math.max(0.01, percentile))
    : 0.5;

  const userBarIdx = Math.min(N - 1, Math.max(0, Math.floor(safePercentile * N)));
  const pct = Math.round(safePercentile * 100);
  const percentText = `${pct}%`;
  
  const subtitleText = safePercentile >= 0.5 
    ? `Stronger than ${pct}% of lifters in this lift`
    : `Top ${Math.max(1, 100 - pct)}% of lifters in this lift`;

  const maxBarH = height - paddingTop - paddingBottom;
  
  const getBarHeightInPixels = (idx: number, originalH: number = 20) => {
    const orig = typeof originalH === 'number' && !isNaN(originalH) ? originalH : 20;
    const baselineH = (orig / 100) * maxBarH;
    if (idx === 3) {
      return maxBarH * (1 + extraPercent);
    }
    return baselineH;
  };

  const targetBarH = getBarHeightInPixels(userBarIdx, barHeights[userBarIdx] || 20);
  const targetX = width > 100 ? getBarX(userBarIdx) + barWidth / 2 : 0;
  const pinBottomY = height - paddingBottom - targetBarH;
  const pinTopY = 40;

  const flagWidth = 56;
  const flagHeight = 22;
  
  let flagX = targetX - flagWidth / 2;
  if (flagX < 6) {
    flagX = 6;
  } else if (flagX + flagWidth > width - 6) {
    flagX = width - flagWidth - 6;
  }

  const flagY = pinTopY - flagHeight - 4;
  const bubblePath = `M ${flagX + 6} ${flagY} H ${flagX + flagWidth - 6} Q ${flagX + flagWidth} ${flagY} ${flagX + flagWidth} ${flagY + 6} V ${flagY + flagHeight - 6} Q ${flagX + flagWidth} ${flagY + flagHeight} ${flagX + flagWidth - 6} ${flagY + flagHeight} L ${targetX + 5} ${flagY + flagHeight} Q ${targetX} ${flagY + flagHeight + 1} ${targetX} ${flagY + flagHeight + 4} Q ${targetX} ${flagY + flagHeight + 1} ${targetX - 5} ${flagY + flagHeight} L ${flagX + 6} ${flagY + flagHeight} Q ${flagX} ${flagY + flagHeight} ${flagX} ${flagY + flagHeight - 6} V ${flagY + 6} Q ${flagX} ${flagY} ${flagX + 6} ${flagY} Z`;

  return (
    <View style={styles.container} onLayout={onLayout}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {title && <Text style={styles.chartTitle}>{title}</Text>}
          <Text style={styles.chartSubtitle}>{subtitleText}</Text>
        </View>
      </View>

      <Svg width={width} height={height} style={{ overflow: 'visible' }}>
        <Defs>
          <LinearGradient id="activeGrad" x1="0" y1="1" x2="0" y2="0">
            <Stop offset="0%" stopColor={colors.accent} />
            <Stop offset="50%" stopColor="#44A6F7" />
            <Stop offset="100%" stopColor={colors.highlight} />
          </LinearGradient>
          
          <LinearGradient id="gridGrad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor={colors.border} stopOpacity={0.1} />
            <Stop offset="15%" stopColor={colors.border} stopOpacity={0.5} />
            <Stop offset="85%" stopColor={colors.border} stopOpacity={0.5} />
            <Stop offset="100%" stopColor={colors.border} stopOpacity={0.1} />
          </LinearGradient>

          <RadialGradient id="ambientGlow" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0%" stopColor={colors.highlightGlow} stopOpacity={1} />
            <Stop offset="100%" stopColor={colors.highlightGlow} stopOpacity={0} />
          </RadialGradient>

          <LinearGradient id="tooltipGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={colors.highlight} />
            <Stop offset="100%" stopColor={colors.accent} />
          </LinearGradient>
        </Defs>

        {width > 100 && (
          <Circle
            cx={targetX}
            cy={pinBottomY}
            r={48}
            fill="url(#ambientGlow)"
            opacity={0.25}
          />
        )}

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

        {width > 100 && barHeights.map((h, i) => {
          const xPos = getBarX(i);
          const barHPixels = getBarHeightInPixels(i, h);
          const currentY = height - paddingBottom - barHPixels;
          const path = getBarPath(xPos, currentY, barWidth, Math.max(3, barHPixels));
          const capPath = getCapPath(xPos, currentY, barWidth, Math.max(3, barHPixels));

          const isActive = i <= userBarIdx;
          const isUserBar = i === userBarIdx;

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
            opacity = 0.25;
            fill = colors.surface2;
            stroke = colors.accent;
            strokeWidth = 1.0;
          }

          return (
            <G key={i}>
              {isUserBar && (
                <Path
                  d={path}
                  fill="none"
                  stroke={colors.highlight}
                  strokeWidth={4}
                  opacity={0.3}
                />
              )}
              <Path
                d={path}
                fill={fill}
                opacity={opacity}
                stroke={stroke}
                strokeWidth={strokeWidth}
              />
              {isActive && (
                <Path
                  d={capPath}
                  fill="none"
                  stroke={colors.highlight}
                  strokeWidth={1.2}
                  opacity={isUserBar ? 1.0 : 0.75}
                />
              )}
            </G>
          );
        })}

        {width > 100 && (
          <G>
            <Line
              x1={targetX}
              y1={pinBottomY}
              x2={targetX}
              y2={pinTopY}
              stroke={colors.highlight}
              strokeWidth={1.5}
              strokeDasharray="3,3"
            />

            <Circle cx={targetX} cy={pinBottomY} r={10} fill={colors.highlight} opacity={0.15} />
            <Circle cx={targetX} cy={pinBottomY} r={6} fill={colors.highlight} opacity={0.3} />
            <Circle cx={targetX} cy={pinBottomY} r={3} fill={colors.highlight} />

            <G>
              <Path
                d={bubblePath}
                fill="none"
                stroke={colors.highlightGlow}
                strokeWidth={4}
              />

              <Path
                d={bubblePath}
                fill="url(#tooltipGrad)"
                stroke={colors.highlight}
                strokeWidth={0.8}
              />

              <SvgText
                x={flagX + flagWidth / 2}
                y={flagY + flagHeight / 2 + 4}
                fill={colors.bg}
                fontSize={12}
                fontFamily={font.bold}
                textAnchor="middle"
              >
                {percentText}
              </SvgText>
            </G>
          </G>
        )}
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

export default React.memo(DistributionChart);
