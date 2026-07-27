// components/ui/RestTimerPicker.tsx
// Premium cylindrical dial picker using react-native-svg & Reanimated
// 120fps UI-thread driven, cross-platform and Expo Go compatible

import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, LayoutChangeEvent, PanResponder, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  useDerivedValue,
  withTiming,
  runOnJS,
  Easing,
  cancelAnimation,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path, Text as SvgText, Polygon, Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { colors, font, ripple } from '../../theme';
import * as Haptics from 'expo-haptics';
import i18n from '../../utils/i18n';

// ── CONFIG ───────────────────────────────────────────────────────────────────
const CFG = {
  pps: 22,
  tickStep: 5,
  labelEvery: 15,
  tickH: 36,
  tickW: 2,
  canvasH: 88,
  triW: 14,
  triH: 11,
};

function fmt(s: number): string {
  const c = Math.max(0, Math.round(s));
  return `${Math.floor(c / 60)}:${(c % 60).toString().padStart(2, '0')}`;
}

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedSvgText = Animated.createAnimatedComponent(SvgText);
const AnimatedPolygon = Animated.createAnimatedComponent(Polygon);

// ── RESET BUTTON COMPONENT ───────────────────────────────────────────────────
const ResetBtn = React.memo(({ onPress }: { onPress: () => void }) => {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.actionBtn,
        { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1, width: 100 },
        pressed && { transform: [{ scale: 0.96 }] }
      ]}
      onPress={onPress}
      testID="rest-timer-reset"
      android_ripple={{ color: 'rgba(255,255,255,0.25)', borderless: false }}
    >
      <Text style={[styles.actionBtnText, { color: colors.textPrimary }]}>{i18n.t('restTimer.reset')}</Text>
    </Pressable>
  );
});

// ── SAVE BUTTON COMPONENT ────────────────────────────────────────────────────
const SaveBtn = React.memo(({ onPress }: { onPress: () => void }) => {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.actionBtn,
        { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1, width: 84 },
        pressed && { transform: [{ scale: 0.96 }] }
      ]}
      onPress={onPress}
      testID="rest-timer-save"
      android_ripple={{ color: 'rgba(255,255,255,0.25)', borderless: false }}
    >
      <Text style={[styles.actionBtnText, { color: colors.textPrimary }]}>{i18n.t('common.save')}</Text>
    </Pressable>
  );
});

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export interface RestTimerPickerProps {
  value: number;            // current seconds (controlled parent value)
  defaultValue: number;     // reset target value
  max?: number;             // default 1000
  step?: number;            // default 5
  onChange?: (secs: number) => void; // live callback while dragging
  onCommit?: (secs: number) => void; // final callback on drag release
  onReset?: () => void;     // callback when reset chip is tapped
  onSave?: () => void;      // callback when save button is tapped
}

interface PickerLabelSlotProps {
  index: number;
  data?: { s: number; text: string; fill: string; fontFamily: string; dist: number };
  displaySecsSV: SharedValue<number>;
  labelSecsSV: SharedValue<number[]>;
  dragProgressSV: SharedValue<number>;
  cx: number;
  R: number;
  labelY: number;
  rulerWidth: number;
}

const PickerLabelSlot = React.memo<PickerLabelSlotProps>(({
  index,
  data,
  displaySecsSV,
  labelSecsSV,
  dragProgressSV,
  cx,
  R,
  labelY,
  rulerWidth,
}) => {
  const animatedProps = useAnimatedProps(() => {
    const secs = displaySecsSV.value;
    const labelSecs = labelSecsSV.value;
    const s = labelSecs[index];
    if (s === undefined) {
      return { x: -9999, y: -9999, opacity: 0 };
    }
    const ppsPerSec = CFG.pps / CFG.tickStep;
    const angle = (s - secs) * ppsPerSec / R;
    if (Math.abs(angle) >= Math.PI / 2) {
      return { x: -9999, y: -9999, opacity: 0 };
    }
    const x = cx + R * Math.sin(angle);
    const scale = Math.cos(angle);
    const fade = Math.pow(scale, 0.6);
    const rounded = Math.round(secs / CFG.tickStep) * CFG.tickStep;
    const glow = s === rounded ? 1 : 0;
    const opacity = Math.min(1, fade * 1.1) * (1 - glow) + 1.0 * glow;

    const dp = dragProgressSV.value;
    const y = labelY - 10 * dp;
    return { x, y, opacity };
  }, [rulerWidth, cx, R, labelY, index]);

  return (
    <AnimatedSvgText
      animatedProps={animatedProps}
      y={labelY}
      fill={data?.fill ?? colors.textSecondary}
      fontSize={10}
      fontFamily={data?.fontFamily ?? font.semibold}
      textAnchor="middle"
    >
      {data?.text ?? ''}
    </AnimatedSvgText>
  );
});

const RestTimerPicker: React.FC<RestTimerPickerProps> = React.memo(({
  value,
  defaultValue,
  max = 1000,
  step = 5,
  onChange,
  onCommit,
  onReset,
  onSave,
}) => {
  const [rulerWidth, setRulerWidth] = useState(360);
  const [roundedSecs, setRoundedSecs] = useState(Math.round(value));

  // ── Reanimated Shared Values ───────────────────────────────────────────────
  const displaySecsSV = useSharedValue<number>(value);
  const dragProgressSV = useSharedValue<number>(0);
  const isDraggingSV = useSharedValue<boolean>(false);
  const lastRoundedSV = useSharedValue<number>(Math.round(value));
  const lastHapticTick = useSharedValue<number | null>(null);
  const labelSecsSV = useSharedValue<number[]>([]);

  const isDraggingRef = useRef(false);

  // Keep references to props updated directly during render execution to prevent hook overhead
  const onChangeRef = useRef(onChange);
  const onCommitRef = useRef(onCommit);
  const stepRef = useRef(step);
  const maxRef = useRef(max);

  onChangeRef.current = onChange;
  onCommitRef.current = onCommit;
  stepRef.current = step;
  maxRef.current = max;

  // Sync display value to the incoming value prop (only when not actively dragging)
  useEffect(() => {
    if (!isDraggingRef.current) {
      displaySecsSV.value = withTiming(value, { duration: 250, easing: Easing.out(Easing.quad) });
    }
  }, [value, displaySecsSV]);

  // Haptic feedback selection trigger logic (runs on UI thread, triggered max 1x/sec)
  const triggerTickHaptic = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
  }, []);

  useDerivedValue(() => {
    const rounded = Math.round(displaySecsSV.value);
    if (isDraggingSV.value) {
      if (lastHapticTick.value !== null && lastHapticTick.value !== rounded) {
        runOnJS(triggerTickHaptic)();
      }
      lastHapticTick.value = rounded;
    } else {
      lastHapticTick.value = rounded;
    }
  });

  // Deduplicated JS update of the rounded timer state (triggered max 1x/sec)
  useDerivedValue(() => {
    const r = Math.round(displaySecsSV.value);
    if (r !== lastRoundedSV.value) {
      lastRoundedSV.value = r;
      runOnJS(setRoundedSecs)(r);
    }
  });

  const startDragProgressAnim = useCallback((to: number, duration: number) => {
    dragProgressSV.value = withTiming(to, { duration, easing: Easing.out(Easing.quad) });
  }, [dragProgressSV]);

  const startDragProgressAnimRef = useRef(startDragProgressAnim);
  useEffect(() => { startDragProgressAnimRef.current = startDragProgressAnim; }, [startDragProgressAnim]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setRulerWidth(e.nativeEvent.layout.width);
  }, []);

  // ── PanResponder — created ONCE, reads live refs, works on all devices ───
  const lastTxRef = useRef(0);
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 3,
      onMoveShouldSetPanResponderCapture: () => false,
      onPanResponderGrant: () => {
        isDraggingRef.current = true;
        isDraggingSV.value = true;
        cancelAnimation(displaySecsSV);
        lastTxRef.current = 0;
        startDragProgressAnimRef.current(1.0, 200);
      },
      onPanResponderMove: (_, g) => {
        const dx = g.dx - lastTxRef.current;
        lastTxRef.current = g.dx;
        const currentVal = displaySecsSV.value;
        const ppsPerSec = CFG.pps / CFG.tickStep;
        const newVal = Math.max(0, Math.min(maxRef.current, currentVal - dx / ppsPerSec));
        displaySecsSV.value = newVal;

        const stepVal = stepRef.current;
        const rounded = Math.round(newVal / stepVal) * stepVal;
        if (onChangeRef.current) {
          runOnJS(onChangeRef.current)(rounded);
        }
      },
      onPanResponderRelease: () => {
        isDraggingRef.current = false;
        isDraggingSV.value = false;
        const stepVal = stepRef.current;
        const finalSecs = Math.round(displaySecsSV.value / stepVal) * stepVal;
        if (onCommitRef.current) {
          runOnJS(onCommitRef.current)(finalSecs);
        }
        startDragProgressAnimRef.current(0.0, 250);
        displaySecsSV.value = withTiming(finalSecs, { duration: 200, easing: Easing.out(Easing.quad) });
      },
      onPanResponderTerminate: () => {
        isDraggingRef.current = false;
        isDraggingSV.value = false;
        const stepVal = stepRef.current;
        const finalSecs = Math.round(displaySecsSV.value / stepVal) * stepVal;
        if (onCommitRef.current) {
          runOnJS(onCommitRef.current)(finalSecs);
        }
        startDragProgressAnimRef.current(0.0, 250);
        displaySecsSV.value = withTiming(finalSecs, { duration: 200, easing: Easing.out(Easing.quad) });
      },
    })
  ).current;

  // ── Geometry calculations ──────────────────────────────────────────────────
  const W = rulerWidth;
  const cx = W / 2;
  const R = W / 2;

  // Normal ticks — cylindrical projection, animated d on UI thread
  const ticksAnimatedProps = useAnimatedProps(() => {
    const secs = displaySecsSV.value;
    const dp = dragProgressSV.value;
    const tickScale = 1.0 + 0.20 * dp;
    const triScale = 1.0 + 0.25 * dp;
    const dynamicTriH = CFG.triH * triScale;
    const dynamicTickH = CFG.tickH * tickScale;
    const triY = CFG.canvasH - 4;
    const tBot = triY - dynamicTriH - 4;
    const tTop = tBot - dynamicTickH;

    const ppsPerSec = CFG.pps / CFG.tickStep;
    const maxDeltaS = Math.ceil(R * Math.PI / 2 / ppsPerSec) + 2 * CFG.tickStep;
    const s0 = Math.max(0, Math.floor((secs - maxDeltaS) / CFG.tickStep) * CFG.tickStep);
    const s1 = Math.min(maxRef.current, Math.ceil(secs + maxDeltaS));

    let d = '';
    for (let s = s0; s <= s1; s += CFG.tickStep) {
      const angle = (s - secs) * ppsPerSec / R;
      if (Math.abs(angle) >= Math.PI / 2) continue;
      const x = cx + R * Math.sin(angle);
      d += 'M' + x + ' ' + tTop + 'L' + x + ' ' + tBot;
    }
    return { d };
  }, [rulerWidth]);

  // Glow ticks — only ticks within 0.6s of center, accent color
  const glowAnimatedProps = useAnimatedProps(() => {
    const secs = displaySecsSV.value;
    const dp = dragProgressSV.value;
    const tickScale = 1.0 + 0.20 * dp;
    const triScale = 1.0 + 0.25 * dp;
    const dynamicTriH = CFG.triH * triScale;
    const dynamicTickH = CFG.tickH * tickScale;
    const triY = CFG.canvasH - 4;
    const tBot = triY - dynamicTriH - 4;
    const tTop = tBot - dynamicTickH;

    const ppsPerSec = CFG.pps / CFG.tickStep;
    const maxDeltaS = Math.ceil(R * Math.PI / 2 / ppsPerSec) + 2 * CFG.tickStep;
    const s0 = Math.max(0, Math.floor((secs - maxDeltaS) / CFG.tickStep) * CFG.tickStep);
    const s1 = Math.min(maxRef.current, Math.ceil(secs + maxDeltaS));

    let d = '';
    for (let s = s0; s <= s1; s += CFG.tickStep) {
      const angle = (s - secs) * ppsPerSec / R;
      if (Math.abs(angle) >= Math.PI / 2) continue;
      if (s !== Math.round(secs / CFG.tickStep) * CFG.tickStep) continue;
      const x = cx + R * Math.sin(angle);
      d += 'M' + x + ' ' + tTop + 'L' + x + ' ' + tBot;
    }
    return { d };
  }, [rulerWidth]);

  const labelY = CFG.canvasH - 4 - CFG.triH - 4 - CFG.tickH - 8;

  const POOL_SIZE = 32;

  // Static label data (text, fill, fontFamily) — recomputed 1×/sec via roundedSecs
  const labelData = useMemo(() => {
    const arr: { s: number; text: string; fill: string; fontFamily: string; dist: number }[] = [];
    const c = roundedSecs;
    const ppsPerSec = CFG.pps / CFG.tickStep;
    const maxDeltaS = Math.ceil(R * Math.PI / 2 / ppsPerSec) + 2 * CFG.tickStep;
    const s0 = Math.max(0, Math.floor((c - maxDeltaS) / CFG.tickStep) * CFG.tickStep);
    const s1 = Math.min(max, Math.ceil(c + maxDeltaS));
    for (let s = s0; s <= s1; s += CFG.tickStep) {
      if (s % CFG.labelEvery !== 0) continue;
      const angle = (s - c) * ppsPerSec / R;
      if (Math.abs(angle) >= Math.PI / 2) continue;
      const scale = Math.cos(angle);
      const fade = Math.pow(scale, 0.6);
      if (fade <= 0.15) continue;
      const isGlow = s === Math.round(c / CFG.tickStep) * CFG.tickStep;
      arr.push({
        s,
        text: String(s),
        fill: isGlow ? colors.accent : colors.textSecondary,
        fontFamily: isGlow ? font.bold : font.semibold,
        dist: Math.abs(s - c),
      });
    }
    arr.sort((a, b) => a.dist - b.dist);
    return arr.slice(0, POOL_SIZE);
  }, [roundedSecs, cx, R, max]);

  // Sync label seconds to SharedValue for worklet access
  useEffect(() => {
    labelSecsSV.value = labelData.map(d => d.s);
  }, [labelData, labelSecsSV]);

  const dragAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -6 * dragProgressSV.value }],
  }));

  // Triangle pointer — scales up on drag
  const triPointsAnimProps = useAnimatedProps(() => {
    const dp = dragProgressSV.value;
    const triScale = 1.0 + 0.3 * dp;
    const tw = CFG.triW * triScale;
    const th = CFG.triH * triScale;
    const triY = CFG.canvasH - 4;
    const glowMargin = 4 + 2 * dp;
    const glowTw = CFG.triW * triScale + glowMargin;
    // TODO: The offset logic below (which matches RestTimerRuler.tsx) doesn't perfectly center the pointer on some screens and needs further work.
    const offset = Platform.OS === 'android' ? (glowTw / 2 + CFG.tickW) : 0;
    const cxAdj = cx - offset;
    return {
      points: '' + (cxAdj - tw / 2) + ',' + triY + ' ' + (cxAdj + tw / 2) + ',' + triY + ' ' + cxAdj + ',' + (triY - th),
    };
  }, [rulerWidth]);

  // Triangle glow — scales up + opacity increases on drag
  const triGlowAnimProps = useAnimatedProps(() => {
    const dp = dragProgressSV.value;
    const triScale = 1.0 + 0.3 * dp;
    const glowMargin = 4 + 2 * dp;
    const tw = CFG.triW * triScale + glowMargin;
    const th = CFG.triH * triScale + glowMargin;
    const triY = CFG.canvasH - 3;
    // TODO: The offset logic below (which matches RestTimerRuler.tsx) doesn't perfectly center the pointer on some screens and needs further work.
    const offset = Platform.OS === 'android' ? (tw / 2 + CFG.tickW) : 0;
    const cxAdj = cx - offset;
    return {
      points: '' + (cxAdj - tw / 2) + ',' + triY + ' ' + (cxAdj + tw / 2) + ',' + triY + ' ' + cxAdj + ',' + (triY - th),
      opacity: 0.4 + 0.3 * dp,
    };
  }, [rulerWidth]);

  const handleReset = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (onReset) {
      onReset();
    }
  }, [onReset]);

  return (
    <View style={styles.container}>
      <View
        style={styles.rulerWrap}
        onLayout={onLayout}
        testID="rest-timer-ruler"
        {...panResponder.panHandlers}
      >
        {/* Cylindrical ticks — viewport-sized SVG, d animated on UI thread */}
        <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: W, height: CFG.canvasH, overflow: 'hidden', pointerEvents: 'none' }, dragAnimStyle]}>
          <Svg width={W} height={CFG.canvasH} style={{ position: 'absolute', left: 0, top: 0 }} pointerEvents="none">
            {/* Glow ticks near center */}
            <AnimatedPath
              animatedProps={glowAnimatedProps}
              stroke={colors.accent}
              strokeWidth={CFG.tickW * 5}
              strokeLinecap="round"
              opacity={0.45}
            />
            {/* Normal ticks */}
            <AnimatedPath
              animatedProps={ticksAnimatedProps}
              stroke={colors.textSecondary}
              strokeWidth={CFG.tickW}
            />
            {/* Labels */}
            {Array.from({ length: POOL_SIZE }, (_, i) => (
              <PickerLabelSlot
                key={i}
                index={i}
                data={labelData[i]}
                displaySecsSV={displaySecsSV}
                labelSecsSV={labelSecsSV}
                dragProgressSV={dragProgressSV}
                cx={cx}
                R={R}
                labelY={labelY}
                rulerWidth={rulerWidth}
              />
            ))}
          </Svg>
        </Animated.View>

        {/* Overlay: FIXED at screen center — triangle pointer, glow, vignette */}
        <Svg width={W} height={CFG.canvasH} style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
          <Defs>
            <RadialGradient id="rtrVig" cx="50%" cy="50%" r="55%" fx="50%" fy="50%">
              <Stop offset="30%" stopColor={colors.surface} stopOpacity={0} />
              <Stop offset="100%" stopColor={colors.surface} stopOpacity={1} />
            </RadialGradient>
          </Defs>

          <AnimatedPolygon
            animatedProps={triGlowAnimProps}
            fill={colors.accent}
          />

          <AnimatedPolygon
            animatedProps={triPointsAnimProps}
            fill={colors.accent}
          />

          <Rect x={0} y={0} width={W} height={CFG.canvasH} fill="url(#rtrVig)" />
        </Svg>
      </View>

      {/* ── Bottom row ── */}
      <View style={styles.bottomRow}>
        <ResetBtn onPress={handleReset} />
        <Text style={[styles.timeDisplay, { color: colors.accent }]} testID="rest-timer-time-display">{fmt(roundedSecs)}</Text>
        {onSave ? (
          <SaveBtn onPress={onSave} />
        ) : (
          <View style={{ width: 84 }} />
        )}
      </View>
    </View>
  );
});

// ── STYLES ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    paddingTop: 18,
  },
  rulerWrap: {
    width: '100%',
    height: CFG.canvasH,
    position: 'relative',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    minHeight: 80,
  },
  actionBtn: {
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    fontSize: 15,
    fontFamily: font.semibold,
    letterSpacing: -0.3,
  },
  timeDisplay: {
    flex: 1,
    fontSize: 44,
    letterSpacing: -1,
    lineHeight: 56,
    fontFamily: font.medium,
    textAlign: 'center',
  },
});

export default RestTimerPicker;
