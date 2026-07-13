import React, { useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import Svg, { Path, Text as SvgText, Rect } from 'react-native-svg';
import { colors, font, spacing, radius } from '../../../theme';

export interface DataPoint {
  x: number;
  y: number;
  label?: string;
}

export interface BarChartProps {
  data: DataPoint[];
  color?: string;
  height: number;
  yAxisFormatter?: (val: number) => string;
  xAxisFormatter?: (val: number) => string;
  title?: string;
}

const BarChart: React.FC<BarChartProps> = ({
  data,
  color = colors.accent,
  height,
  yAxisFormatter,
  xAxisFormatter,
  title,
}) => {
  const [width, setWidth] = useState(300);

  const onLayout = (e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  };

  if (!data || data.length < 2) {
    return (
      <View style={[styles.container, styles.emptyContainer, { height: height + 30 }]}>
        {title && <Text style={[styles.chartTitle, { width: '100%' }]}>{title}</Text>}
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%' }}>
          <Text style={styles.emptyText}>Complete a few workouts to see your progress</Text>
        </View>
      </View>
    );
  }

  // Margins
  const paddingTop = 20;
  const paddingBottom = 30;
  const paddingLeft = 45;
  const paddingRight = 20;

  const yValues = data.map((d) => d.y);
  const yMaxVal = Math.max(...yValues);
  const yMax = yMaxVal * 1.15 || 10;
  const yMin = 0;

  const getY = (yVal: number) => {
    return height - paddingBottom - (yVal / yMax) * (height - paddingTop - paddingBottom);
  };

  const N = data.length;
  const drawingWidth = width - paddingLeft - paddingRight;
  const barGap = 8;
  const barWidth = Math.max(4, (drawingWidth - barGap * (N - 1)) / N);

  const getBarX = (idx: number) => {
    return paddingLeft + idx * (barWidth + barGap);
  };

  // Grid tick values (3 steps)
  const yTicks = [yMin, yMax / 2, yMax];
  
  // Decide how many x labels to show
  const xTicksIndices = N <= 6 
    ? data.map((_, i) => i) 
    : [0, Math.floor((N - 1) / 3), Math.floor((N - 1) * 2 / 3), N - 1];

  return (
    <View style={styles.container} onLayout={onLayout}>
      {title && <Text style={styles.chartTitle}>{title}</Text>}
      <Svg width={width} height={height}>
        {/* Horizontal grid lines & y-axis labels */}
        {yTicks.map((tick, i) => {
          const yPos = getY(tick);
          return (
            <React.Fragment key={i}>
              <Path
                d={`M ${paddingLeft} ${yPos} L ${width - paddingRight} ${yPos}`}
                stroke={colors.border}
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

        {/* Vertical bars */}
        {data.map((d, i) => {
          const xPos = getBarX(i);
          const yPos = getY(d.y);
          const barHeight = height - paddingBottom - yPos;
          const isLatest = i === N - 1;
          const barColor = isLatest ? colors.highlight : color;

          return (
            <Rect
              key={i}
              x={xPos}
              y={yPos}
              width={barWidth}
              height={Math.max(1, barHeight)} // ensure at least 1px height is visible
              fill={barColor}
              rx={Math.min(4, barWidth / 2)} // slightly rounded top edges
              ry={Math.min(4, barWidth / 2)}
            />
          );
        })}

        {/* x-axis labels */}
        {xTicksIndices.map((idx) => {
          const d = data[idx];
          if (!d) return null;
          const xPos = getBarX(idx) + barWidth / 2;
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
    padding: spacing.sm,
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
    fontSize: font.sizes.sm,
    marginBottom: spacing.sm,
    paddingLeft: spacing.xs,
  },
});

export default React.memo(BarChart);
