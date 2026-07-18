import React, { useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import Svg, { Path, Text as SvgText, Defs, LinearGradient, Stop, Circle, Line, G } from 'react-native-svg';
import { colors, font, spacing, radius } from '../../../theme';

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

const TrendingUpIcon = () => (
  <Svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: spacing.xs }}>
    <Path d="m22 7-8.5 8.5-5-5L2 17" />
    <Path d="M16 7h6v6" />
  </Svg>
);

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
    const w = e.nativeEvent.layout.width;
    if (w > 0) setWidth(w);
  };

  const validData = React.useMemo(() => {
    if (!Array.isArray(data)) return [];
    return data.filter((d) => d && typeof d.x === 'number' && !isNaN(d.x) && typeof d.y === 'number' && !isNaN(d.y));
  }, [data]);

  if (validData.length < 2) {
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
  const plotPaddingHorizontal = 16;

  // Limits
  const xValues = validData.map((d) => d.x);
  const yValues = validData.map((d) => d.y);
  
  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);
  
  const yMinVal = Math.min(...yValues);
  const yMaxVal = Math.max(...yValues);
  const yRange = isNaN(yMaxVal - yMinVal) ? 0 : yMaxVal - yMinVal;
  
  const yPadMin = Math.max(5, yRange * 1.2);
  const yPadMax = Math.max(2, yRange * 0.3);
  const yMin = Math.max(0, yMinVal - yPadMin);
  const yMax = yMaxVal + yPadMax;

  const getX = (xVal: number) => {
    if (xMax === xMin || isNaN(xMin) || isNaN(xMax)) return paddingLeft + (width - paddingLeft - paddingRight) / 2;
    const res = paddingLeft + plotPaddingHorizontal + 
      ((xVal - xMin) / (xMax - xMin)) * (width - paddingLeft - paddingRight - 2 * plotPaddingHorizontal);
    return isNaN(res) ? paddingLeft : res;
  };

  const getY = (yVal: number) => {
    if (yMax === yMin || isNaN(yMin) || isNaN(yMax)) return paddingTop + (height - paddingTop - paddingBottom) / 2;
    const res = height - paddingBottom - ((yVal - yMin) / (yMax - yMin)) * (height - paddingTop - paddingBottom);
    return isNaN(res) ? height - paddingBottom : res;
  };

  const linePath = validData.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(d.x)} ${getY(d.y)}`).join(' ');
  const shadowPath = validData.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(d.x)} ${getY(d.y) + 3}`).join(' ');
  const fillPath = `${linePath} L ${getX(validData[validData.length - 1].x)} ${height - paddingBottom} L ${getX(validData[0].x)} ${height - paddingBottom} Z`;

  const yTicks = [yMin, yMin + (yMax - yMin) / 2, yMax];
  
  const xTickPoints = React.useMemo(() => {
    if (validData.length === 0) return [];
    const points: { xPos: number; label: string }[] = [];
    let lastX = -999;
    
    validData.forEach((d, i) => {
      const xPos = getX(d.x);
      const label = d.label || (xAxisFormatter ? xAxisFormatter(d.x) : String(d.x));
      const isFirst = i === 0;
      const isLast = i === validData.length - 1;

      if (isFirst || (xPos - lastX >= 60 && (width - paddingRight - xPos) >= 45) || isLast) {
        if (isLast && points.length > 1 && (xPos - lastX < 50)) {
          points.pop();
        }
        points.push({ xPos, label });
        lastX = xPos;
      }
    });

    return points;
  }, [validData, width, getX, xAxisFormatter, paddingRight]);

  return (
    <View style={styles.container} onLayout={onLayout}>
      {title && <Text style={styles.chartTitle}>{title}</Text>}
      <Svg width={width} height={height} style={{ overflow: 'visible' }}>
        <Defs>
          <LinearGradient id="chartGlow" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={color} stopOpacity={0.30} />
            <Stop offset="40%" stopColor={color} stopOpacity={0.12} />
            <Stop offset="100%" stopColor={color} stopOpacity={0.0} />
          </LinearGradient>
          
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
        <Path d={fillPath} fill="url(#chartGlow)" />

        {/* Line drop shadow */}
        <Path
          d={shadowPath}
          fill="none"
          stroke="#000"
          strokeWidth={2.5}
          opacity={0.35}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Glow path */}
        {glow && (
          <G>
            <Path
              d={linePath}
              fill="none"
              stroke={color}
              strokeWidth={8}
              opacity={0.08}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path
              d={linePath}
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
        <Path d={linePath} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

        {/* Data points (circles) */}
        {validData.map((d, i) => {
          const isLast = i === validData.length - 1;
          const cx = getX(d.x);
          const cy = getY(d.y);
          if (isLast) {
            return (
              <G key={i}>
                <Circle cx={cx} cy={cy} r={11} fill={colors.highlight} opacity={0.2} />
                <Circle cx={cx} cy={cy} r={7} fill="none" stroke={colors.highlight} strokeWidth={1.5} opacity={0.6} />
                <Circle cx={cx} cy={cy} r={5} fill={colors.bg} stroke={colors.highlight} strokeWidth={2.5} />
              </G>
            );
          }
          return (
            <G key={i}>
              <Circle cx={cx} cy={cy} r={6} fill="none" stroke={color} strokeWidth={1.5} opacity={0.2} />
              <Circle cx={cx} cy={cy} r={4} fill={colors.bg} stroke={color} strokeWidth={2} />
            </G>
          );
        })}

        {/* x-axis labels */}
        {xTickPoints.map((pt, idx) => (
          <SvgText
            key={idx}
            x={pt.xPos}
            y={height - 8}
            fill={colors.textSecondary}
            fontSize={9}
            fontFamily={font.regular}
            textAnchor="middle"
          >
            {pt.label}
          </SvgText>
        ))}
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
