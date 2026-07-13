// components/ui/RestTimerRuler.tsx
// Premium cylindrical dial rest-timer using react-native-svg & Reanimated
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
} from 'react-native-reanimated';
import Svg, { Path, Text as SvgText, Polygon, Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { colors, font } from '../../theme';
import * as Haptics from 'expo-haptics';

// ── CONFIG ───────────────────────────────────────────────────────────────────
const CFG = {
  pps: 22,
  labelEvery: 5,
  tickH: 36,
  tickW: 2,
  canvasH: 88,
  maxSecs: 600,
  sweepMs: 800,
  holdMs: 400,
  collapseMs: 320,
  triW: 14,
  triH: 11,
};

function fmt(s: number): string {
  const c = Math.max(0, Math.round(s));
  return `${Math.floor(c / 60)}:${(c % 60).toString().padStart(2, '0')}`;
}

type Phase = 'armed' | 'sweeping' | 'zero';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedSvgText = Animated.createAnimatedComponent(SvgText);
const AnimatedPolygon = Animated.createAnimatedComponent(Polygon);

// ── BOTTOM ROW COMPONENT ──────────────────────────────────────────────────────
const BottomRow = React.memo(({ roundedSecs, phase, isDisabled, onPress }: {
  roundedSecs: number;
  phase: Phase;
  isDisabled: boolean;
  onPress: () => void;
}) => {
  const isZero = phase === 'zero';
  const secsColor = colors.accent;
  return (
    <View style={styles.bottomRow}>
      {!isZero && (
        <Pressable
          style={({ pressed }) => [
            styles.actionBtn,
            { backgroundColor: colors.error, opacity: isDisabled ? 0.5 : (pressed ? 0.85 : 1) },
            pressed && !isDisabled && { transform: [{ scale: 0.96 }] }
          ]}
          onPress={onPress}
          disabled={isDisabled}
          android_ripple={{ color: 'rgba(255,255,255,0.25)', borderless: false }}
        >
          <Text style={[styles.actionBtnText, { color: colors.textPrimary }]}>Stop</Text>
        </Pressable>
      )}
      <Text style={[styles.timeDisplay, { color: secsColor }]}>{fmt(roundedSecs)}</Text>
    </View>
  );
});

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export interface RestTimerRulerProps {
  currentSecs: number;
  defaultSecs: number;
  isRunning: boolean;
  endTarget: number | null;
  onSecsChange: (secs: number) => void;
  onSecsChangeComplete?: (secs: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onStopStart: () => void;
  onStopComplete: () => void;
  onStart: () => void;
}

const RestTimerRuler: React.FC<RestTimerRulerProps> = React.memo(({
  currentSecs,
  defaultSecs,
  isRunning,
  endTarget,
  onSecsChange,
  onSecsChangeComplete,
  onDragStart,
  onDragEnd,
  onStopStart,
  onStopComplete,
  onStart,
}) => {
  const [rulerWidth, setRulerWidth] = useState(360);
  const [phase, setPhase] = useState<Phase>(isRunning ? 'armed' : 'zero');
  const [roundedSecs, setRoundedSecs] = useState(Math.round(currentSecs));

  // ── Reanimated Shared Values ───────────────────────────────────────────────
  const displaySecsSV = useSharedValue<number>(currentSecs);
  const dragProgressSV = useSharedValue<number>(0);
  const isDraggingSV = useSharedValue<boolean>(false);
  const lastRoundedSV = useSharedValue<number>(Math.round(currentSecs));
  const lastHapticTick = useSharedValue<number | null>(null);
  const labelSecsSV = useSharedValue<number[]>([]);

  // ── Animation / layout shared values ────────────────────────────────────────
  const colY = useSharedValue(0);
  const colOpa = useSharedValue(1);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const isStoppingRef = useRef(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDraggingRef = useRef(false);
  const prevCurrentSecs = useRef<number | null>(null);
  const currentSecsRef = useRef(currentSecs);
  const isRunningRef = useRef(isRunning);
  const justReleasedRef = useRef(false);

  // Keep references to props updated to avoid closures capturing stale state
  const onSecsChangeRef = useRef(onSecsChange);
  const onSecsChangeCompleteRef = useRef(onSecsChangeComplete);
  const onDragStartRef = useRef(onDragStart);
  const onDragEndRef = useRef(onDragEnd);
  const onStopStartRef = useRef(onStopStart);
  const onStopCompleteRef = useRef(onStopComplete);
  const onStartRef = useRef(onStart);

  useEffect(() => { currentSecsRef.current = currentSecs; }, [currentSecs]);
  useEffect(() => { isRunningRef.current = isRunning; }, [isRunning]);
  useEffect(() => { onSecsChangeRef.current = onSecsChange; }, [onSecsChange]);
  useEffect(() => { onSecsChangeCompleteRef.current = onSecsChangeComplete; }, [onSecsChangeComplete]);
  useEffect(() => { onDragStartRef.current = onDragStart; }, [onDragStart]);
  useEffect(() => { onDragEndRef.current = onDragEnd; }, [onDragEnd]);
  useEffect(() => { onStopStartRef.current = onStopStart; }, [onStopStart]);
  useEffect(() => { onStopCompleteRef.current = onStopComplete; }, [onStopComplete]);
  useEffect(() => { onStartRef.current = onStart; }, [onStart]);

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

  const startAnim = useCallback((to: number, duration: number) => {
    displaySecsSV.value = withTiming(to, { duration, easing: Easing.linear });
  }, [displaySecsSV]);

  // Continuous countdown using endTarget for precision (fixes ceil-rounding drift)
  const launchCountdown = useCallback(() => {
    cancelAnimation(displaySecsSV);
    if (endTarget == null) {
      displaySecsSV.value = currentSecsRef.current;
      return;
    }
    const ms = Math.max(0, endTarget - Date.now());
    displaySecsSV.value = ms / 1000;  // precise fractional start
    if (ms > 0) {
      displaySecsSV.value = withTiming(0, { duration: ms, easing: Easing.linear });
    }
  }, [displaySecsSV, endTarget]);

  const launchCountdownRef = useRef(launchCountdown);
  useEffect(() => { launchCountdownRef.current = launchCountdown; }, [launchCountdown]);

  // ── Sync display to parent countdown ─────────────────────────────────────
  useEffect(() => {
    if (phase !== 'armed' || isStoppingRef.current || isDraggingRef.current) {
      prevCurrentSecs.current = null;
      return;
    }

    const justReleased = justReleasedRef.current;
    justReleasedRef.current = false;

    if (justReleased) {
      prevCurrentSecs.current = currentSecs;
      launchCountdown();   // re-align to real time after drag
      return;
    }

    const prev = prevCurrentSecs.current;
    prevCurrentSecs.current = currentSecs;

    if (isRunning) {
      if (prev === null) {
        launchCountdown();             // start
      } else {
        // subsequent emits: only re-sync on large drift (backgrounding)
        if (Math.abs(displaySecsSV.value - currentSecs) > 1.5) {
          launchCountdown();
        }
      }
    } else {
      cancelAnimation(displaySecsSV);
      displaySecsSV.value = currentSecs;                     // paused: snap
    }
  }, [currentSecs, phase, isRunning, displaySecsSV, launchCountdown]);

  // ── External isRunning changes ────────────────────────────────────────────
  useEffect(() => {
    if (isRunning) {
      if (holdTimer.current) {
        clearTimeout(holdTimer.current);
        holdTimer.current = null;
      }
      isStoppingRef.current = false;

      // Reset layout animations
      colY.value = 0;
      colOpa.value = 1;

      setPhase('armed');
      launchCountdownRef.current();
    } else {
      isStoppingRef.current = false;
      if (phase === 'armed') {
        if (currentSecsRef.current === 0) {
          // Natural completion — play collapse animation
          setPhase('sweeping');
          isStoppingRef.current = true;
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          holdTimer.current = setTimeout(doCollapseRef.current, CFG.holdMs);
        } else {
          // Timer stopped/paused manually (not at zero)
          setPhase('zero');
          cancelAnimation(displaySecsSV);
          displaySecsSV.value = 0;
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setRulerWidth(e.nativeEvent.layout.width);
  }, []);

  // Cleanup hold timer on unmount
  useEffect(() => {
    return () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
    };
  }, []);

  // ── Collapse then close ───────────────────────────────────────────────────
  const doCollapse = useCallback(() => {
    colY.value = 0;
    colOpa.value = 1;
    colY.value = withTiming(-64, { duration: CFG.collapseMs, easing: Easing.in(Easing.cubic) });
    colOpa.value = withTiming(0, { duration: CFG.collapseMs, easing: Easing.in(Easing.quad) },
      (finished) => { if (finished) runOnJS(onStopCompleteRef.current)(); },
    );
  }, [colY, colOpa]);

  const doCollapseRef = useRef(doCollapse);
  useEffect(() => { doCollapseRef.current = doCollapse; }, [doCollapse]);

  const onSweepDone = useCallback(() => {
    // Don't set phase to 'zero' — keep 'sweeping' so Stop button stays mounted during collapse
    holdTimer.current = setTimeout(doCollapse, CFG.holdMs);
  }, [doCollapse]);

  const startSweep = useCallback((from: number) => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    setPhase('sweeping');
    isStoppingRef.current = true;

    if (onStopStartRef.current) {
      onStopStartRef.current();
    }

    cancelAnimation(displaySecsSV);
    displaySecsSV.value = withTiming(0, {
      duration: CFG.sweepMs,
      easing: Easing.in(Easing.cubic),
    }, (finished) => {
      if (finished) {
        runOnJS(onSweepDone)();
      }
    });
  }, [displaySecsSV, onSweepDone]);

  const handleActionBtn = useCallback(() => {
    if (phase === 'sweeping') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (phase === 'armed') {
      startSweep(displaySecsSV.value);
    } else {
      colY.value = 0;
      colOpa.value = 1;
      isStoppingRef.current = false;
      setPhase('armed');
      justReleasedRef.current = true;
      prevCurrentSecs.current = defaultSecs;
      launchCountdown();        // uses endTarget from props (set by parent's start())
      onStartRef.current();
    }
  }, [phase, defaultSecs, startSweep, launchCountdown, colY, colOpa, displaySecsSV]);

  // ── Gesture refs — PanResponder reads these directly ──────────────────────
  const isArmedRef = useRef(isRunning);
  const lastTxRef = useRef(0);
  const startDragProgressAnimRef = useRef(startDragProgressAnim);

  useEffect(() => { isArmedRef.current = phase === 'armed'; }, [phase]);
  useEffect(() => { startDragProgressAnimRef.current = startDragProgressAnim; }, [startDragProgressAnim]);

  // ── PanResponder — created ONCE, reads live refs, works on all devices ───
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => isArmedRef.current,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, g) => isArmedRef.current && Math.abs(g.dx) > 3,
      onMoveShouldSetPanResponderCapture: () => false,
      onPanResponderGrant: () => {
        isDraggingRef.current = true;
        isDraggingSV.value = true;
        cancelAnimation(displaySecsSV);
        lastTxRef.current = 0;
        startDragProgressAnimRef.current(1.0, 200);
        if (onDragStartRef.current) onDragStartRef.current();
      },
      onPanResponderMove: (_, g) => {
        const dx = g.dx - lastTxRef.current;
        lastTxRef.current = g.dx;
        displaySecsSV.value = Math.max(0, Math.min(CFG.maxSecs, displaySecsSV.value - dx / CFG.pps));
      },
      onPanResponderRelease: () => {
        isDraggingRef.current = false;
        isDraggingSV.value = false;
        const finalSecs = Math.round(displaySecsSV.value);
        onSecsChangeRef.current(finalSecs);
        startDragProgressAnimRef.current(0.0, 250);
        justReleasedRef.current = true;
        prevCurrentSecs.current = finalSecs;
        if (isRunningRef.current) {
          launchCountdownRef.current();
        } else {
          startAnim(finalSecs, 200);
        }
        if (onDragEndRef.current) onDragEndRef.current();
        if (onSecsChangeCompleteRef.current) {
          onSecsChangeCompleteRef.current(finalSecs);
        }
      },
      onPanResponderTerminate: () => {
        isDraggingRef.current = false;
        isDraggingSV.value = false;
        const finalSecs = Math.round(displaySecsSV.value);
        onSecsChangeRef.current(finalSecs);
        startDragProgressAnimRef.current(0.0, 250);
        justReleasedRef.current = true;
        prevCurrentSecs.current = finalSecs;
        if (isRunningRef.current) {
          launchCountdownRef.current();
        } else {
          startAnim(finalSecs, 200);
        }
        if (onDragEndRef.current) onDragEndRef.current();
        if (onSecsChangeCompleteRef.current) {
          onSecsChangeCompleteRef.current(finalSecs);
        }
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

    const maxDeltaS = Math.ceil(R * Math.PI / 2 / CFG.pps) + 2;
    const s0 = Math.max(0, Math.floor(secs - maxDeltaS));
    const s1 = Math.min(CFG.maxSecs, Math.ceil(secs + maxDeltaS));

    let d = '';
    for (let s = s0; s <= s1; s++) {
      const angle = (s - secs) * CFG.pps / R;
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

    const maxDeltaS = Math.ceil(R * Math.PI / 2 / CFG.pps) + 2;
    const s0 = Math.max(0, Math.floor(secs - maxDeltaS));
    const s1 = Math.min(CFG.maxSecs, Math.ceil(secs + maxDeltaS));

    let d = '';
    for (let s = s0; s <= s1; s++) {
      const angle = (s - secs) * CFG.pps / R;
      if (Math.abs(angle) >= Math.PI / 2) continue;
      if (s !== Math.round(secs)) continue;
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
    const maxDeltaS = Math.ceil(R * Math.PI / 2 / CFG.pps) + 2;
    for (let s = Math.max(0, Math.floor(c - maxDeltaS)); s <= Math.min(CFG.maxSecs, Math.ceil(c + maxDeltaS)); s++) {
      if (s % CFG.labelEvery !== 0) continue;
      const angle = (s - c) * CFG.pps / R;
      if (Math.abs(angle) >= Math.PI / 2) continue;
      const scale = Math.cos(angle);
      const fade = Math.pow(scale, 0.6);
      if (fade <= 0.15) continue;
      const isGlow = s === c;
      arr.push({
        s,
        text: String(s),
        fill: isGlow ? colors.accent : colors.textSecondary,
        fontFamily: isGlow ? font.bold : font.semibold,
        dist: Math.abs(s - c),
      });
    }
    // Sort by distance from center — most relevant labels first
    arr.sort((a, b) => a.dist - b.dist);
    // Slice to POOL_SIZE — only the nearest labels get rendered
    return arr.slice(0, POOL_SIZE);
  }, [roundedSecs, cx, R]);

  // Sync label seconds to SharedValue for worklet access
  useEffect(() => {
    labelSecsSV.value = labelData.map(d => d.s);
  }, [labelData, labelSecsSV]);

  // Pool of 32 animated label slots — each animates x + y + opacity on UI thread
  const slotAnimatedProps = Array.from({ length: POOL_SIZE }, (_, i) =>
    useAnimatedProps(() => {
      const secs = displaySecsSV.value;
      const labelSecs = labelSecsSV.value;
      const s = labelSecs[i];
      if (s === undefined) {
        return { x: -9999, y: -9999, opacity: 0 };
      }
      const angle = (s - secs) * CFG.pps / R;
      if (Math.abs(angle) >= Math.PI / 2) {
        return { x: -9999, y: -9999, opacity: 0 };
      }
      const x = cx + R * Math.sin(angle);
      const scale = Math.cos(angle);
      const fade = Math.pow(scale, 0.6);
      const rounded = Math.round(secs);
      const glow = s === rounded ? 1 : 0;
      const opacity = Math.min(1, fade * 1.1) * (1 - glow) + 1.0 * glow;

      const dp = dragProgressSV.value;
      const y = labelY - 10 * dp;
      return { x, y, opacity };
    }, [rulerWidth])
  );

  // ── Derived styles ─────────────────────────────────────────────────────────
  const collapseStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: colY.value }],
    opacity: colOpa.value,
  }));

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
    const offset = Platform.OS === 'android' ? (tw / 2 + CFG.tickW) : 0;
    const cxAdj = cx - offset;
    return {
      points: '' + (cxAdj - tw / 2) + ',' + triY + ' ' + (cxAdj + tw / 2) + ',' + triY + ' ' + cxAdj + ',' + (triY - th),
      opacity: 0.4 + 0.3 * dp,
    };
  }, [rulerWidth]);

  const isStopping = isStoppingRef.current;
  const isDisabled = phase === 'sweeping' || isStopping;

  return (
    <Animated.View style={[styles.container, collapseStyle]}>
      <View
        style={[styles.rulerWrap]}
        onLayout={onLayout}
        {...panResponder.panHandlers}
      >
        {/* Cylindrical ticks — viewport-sized SVG, d animated on UI thread */}
        <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: W, height: CFG.canvasH, overflow: 'hidden', pointerEvents: 'none' }, dragAnimStyle]}>
          <Svg width={W} height={CFG.canvasH} style={{ position: 'absolute', left: 0, top: 0 }} pointerEvents="none">
            {/* Glow ticks near center (behind normal ticks) */}
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
            {/* Labels — cylindrical-projected, x + opacity animated on UI thread */}
            {Array.from({ length: POOL_SIZE }, (_, i) => {
              const data = labelData[i];
              return (
                <AnimatedSvgText
                  key={i}
                  animatedProps={slotAnimatedProps[i]}
                  y={labelY}
                  fill={data?.fill ?? colors.textSecondary}
                  fontSize={10}
                  fontFamily={data?.fontFamily ?? font.semibold}
                  textAnchor="middle"
                >
                  {data?.text ?? ''}
                </AnimatedSvgText>
              );
            })}
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

          {/* Triangle pointer glow (animated opacity + scale, behind pointer) */}
          <AnimatedPolygon
            animatedProps={triGlowAnimProps}
            fill={colors.accent}
          />

          {/* Triangle pointer (animated scale) */}
          <AnimatedPolygon
            animatedProps={triPointsAnimProps}
            fill={colors.accent}
          />

          {/* Radial vignette — dims corners only */}
          <Rect x={0} y={0} width={W} height={CFG.canvasH} fill="url(#rtrVig)" />
        </Svg>
      </View>

      {/* ── Bottom row ── */}
      <BottomRow
        roundedSecs={roundedSecs}
        phase={phase}
        isDisabled={isDisabled}
        onPress={handleActionBtn}
      />
    </Animated.View>
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
    position: 'relative',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    minHeight: 80,
  },
  actionBtn: {
    position: 'absolute',
    left: 20,
    width: 100,
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
    fontSize: 50,
    letterSpacing: -1,
    lineHeight: 56,
    fontFamily: font.medium,
    textAlign: 'right',
    marginLeft: 'auto',
  },
});

export default RestTimerRuler;
