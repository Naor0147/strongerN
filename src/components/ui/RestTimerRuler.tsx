// components/ui/RestTimerRuler.tsx
// Premium cylindrical dial rest-timer
// PanResponder (works everywhere) · sub-pixel float · 3-D depth · radial vignette

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  LayoutChangeEvent,
  PanResponder,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import Svg, {
  Line,
  Text as SvgText,
  Polygon,
  Defs,
  RadialGradient,
  Stop,
  Rect,
} from 'react-native-svg';
import { colors, font } from '../../theme';
import * as Haptics from 'expo-haptics';

// ── CONFIG ───────────────────────────────────────────────────────────────────
const CFG = {
  pps: 22,    // px per second — base density (wider spacing)
  labelEvery: 5,     // label every N seconds
  tickH: 36,    // major tick height px (2X taller)
  tickHShort: 36,    // minor tick height px (2X taller)
  tickW: 2,     // base tick stroke width (not scaled — kept visible)
  canvasH: 88,    // ruler strip height px (breathing room for taller ticks)
  maxSecs: 600,   // 10-min cap
  sweepMs: 800,   // sweep-to-zero duration ms
  holdMs: 400,   // pause at zero before collapsing ms
  collapseMs: 320,   // collapse slide-up duration ms
  triW: 14,
  triH: 11,
};

// Helper to convert hex to RGB array dynamically
function hexToRgb(hex: string): [number, number, number] {
  const cleanHex = hex.replace('#', '');
  let r = 79, g = 142, b = 247;
  if (cleanHex.length === 3) {
    r = parseInt(cleanHex[0] + cleanHex[0], 16);
    g = parseInt(cleanHex[1] + cleanHex[1], 16);
    b = parseInt(cleanHex[2] + cleanHex[2], 16);
  } else if (cleanHex.length === 6) {
    r = parseInt(cleanHex.substring(0, 2), 16);
    g = parseInt(cleanHex.substring(2, 4), 16);
    b = parseInt(cleanHex.substring(4, 6), 16);
  }
  return [
    isNaN(r) ? 79 : r,
    isNaN(g) ? 142 : g,
    isNaN(b) ? 247 : b,
  ];
}

// ── HELPERS ──────────────────────────────────────────────────────────────────
function fmt(s: number): string {
  const c = Math.max(0, Math.round(s));
  return `${Math.floor(c / 60)}:${(c % 60).toString().padStart(2, '0')}`;
}

function lerpRgb(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [
    Math.round(a[0] * t + b[0] * (1 - t)),
    Math.round(a[1] * t + b[1] * (1 - t)),
    Math.round(a[2] * t + b[2] * (1 - t)),
  ];
}

// ── RULER SVG — Cylindrical Dial ─────────────────────────────────────────────
interface RulerProps { secs: number; width: number; dragProgress: number; }

const RulerSvg = React.memo(({ secs, width, dragProgress }: RulerProps) => {
  if (width <= 0) return null;

  const W = width;
  const cx = W / 2;
  // Cylinder radius = half canvas width
  const R = W / 2;

  const triScale = 1.0 + 0.25 * dragProgress;
  const tickScale = 1.0 + 0.25 * dragProgress;

  const dynamicTriW = CFG.triW * triScale;
  const dynamicTriH = CFG.triH * triScale;
  const dynamicTickH = CFG.tickH * tickScale;

  const triY = CFG.canvasH - 4;
  const tBot = triY - dynamicTriH - 4;
  const tTop = tBot - dynamicTickH;
  const y1 = tTop;

  // Get dynamic RGB colors based on current theme tokens
  const tickRgb = hexToRgb(colors.textSecondary);
  const bgRgb = hexToRgb(colors.surface); // ticks fade to surface background
  const accRgb = hexToRgb(colors.accent);

  // ✅ FIXED: correct range using full π/2 arc, not just R/pps
  // maxDeltaS = how many seconds fit within the ±π/2 visible cylinder arc
  const maxDeltaS = Math.ceil(R * Math.PI / 2 / CFG.pps) + 2;
  const s0 = Math.max(0, Math.floor(secs - maxDeltaS));
  const s1 = Math.min(CFG.maxSecs, Math.ceil(secs + maxDeltaS));

  const minDiff = Math.abs(secs - Math.round(secs));
  const triGlowFactor = Math.max(0, 1 - minDiff / 0.4);

  const bgTicks: React.ReactElement[] = [];
  const bgLabels: React.ReactElement[] = [];

  const strokeScale = 1.0 + 0.3 * dragProgress;

  for (let s = s0; s <= s1; s++) {
    // Cylindrical projection: angle from center
    const angle = (s - secs) * CFG.pps / R;
    if (Math.abs(angle) >= Math.PI / 2) continue; // back-face

    // Sine mapping → ticks bunch at edges (cylindrical distortion)
    const x = cx + R * Math.sin(angle);

    // cos gives depth: 1 at center, 0 at horizon
    const scale = Math.cos(angle);
    // ✅ GENTLER fade: cos^0.6 keeps distant ticks visible
    const fade = Math.pow(scale, 0.6);

    const isMaj = s % CFG.labelEvery === 0;

    const diff = Math.abs(s - secs);
    const glowFactor = Math.max(0, 1 - diff / 0.6); // glows when tick is close to the triangle pointer

    const [normalR, normalG, normalB] = lerpRgb(tickRgb, bgRgb, fade);

    // Smoothly interpolate color to active accent color when glowing
    const r = Math.round(normalR * (1 - glowFactor) + accRgb[0] * glowFactor);
    const g = Math.round(normalG * (1 - glowFactor) + accRgb[1] * glowFactor);
    const b = Math.round(normalB * (1 - glowFactor) + accRgb[2] * glowFactor);

    const alpha = Math.max(0.25, fade * 0.85) * (1 - glowFactor) + 1.0 * glowFactor;
    const color = `rgba(${r},${g},${b},${alpha})`;
    const strokeW = (CFG.tickW + 1.2 * glowFactor) * strokeScale;

    // Draw secondary neon glow behind the main line if it's close to the center
    if (glowFactor > 0) {
      bgTicks.push(
        <Line
          key={`glow-${s}`}
          x1={x} y1={y1}
          x2={x} y2={tBot}
          stroke={`rgba(${accRgb[0]},${accRgb[1]},${accRgb[2]},0.35)`}
          strokeWidth={CFG.tickW * 4 * glowFactor * strokeScale}
          strokeLinecap="round"
        />
      );
    }

    bgTicks.push(
      <Line
        key={`t-${s}`}
        x1={x} y1={y1}
        x2={x} y2={tBot}
        stroke={color}
        strokeWidth={strokeW}
      />,
    );

    if (isMaj && fade > 0.15) {
      const normalLa = Math.min(1, fade * 1.1);
      const la = normalLa * (1 - glowFactor) + 1.0 * glowFactor;
      bgLabels.push(
        <SvgText
          key={`l-${s}`}
          x={x} y={tTop - 6}
          fill={`rgba(${r},${g},${b},${la})`}
          fontSize={10 * (1.0 + 0.15 * dragProgress)}
          fontFamily={glowFactor > 0.5 ? font.bold : font.semibold}
          textAnchor="middle"
        >
          {s}
        </SvgText>,
      );
    }
  }

  const triPoints = `${cx - dynamicTriW / 2},${triY} ${cx + dynamicTriW / 2},${triY} ${cx},${triY - dynamicTriH}`;
  const glowW = dynamicTriW + 4; // 2px margin on each side (smaller, cleaner)
  const glowH = dynamicTriH + 3.5; // slightly taller than pointer
  const triGlowPoints = `${cx - glowW / 2},${triY + 1.2} ${cx + glowW / 2},${triY + 1.2} ${cx},${triY + 1.2 - glowH}`;

  return (
    <Svg width={W} height={CFG.canvasH}>
      <Defs>
        {/*
          Radial vignette:
          - transparent inner zone extended to 30% (was 75%)
          - only darkens the extreme edges/corners
          rx = 55% of W, ry = 50% of H
        */}
        <RadialGradient
          id="rtrVig"
          cx="50%"
          cy="50%"
          r="55%"
          fx="50%"
          fy="50%"
        >
          <Stop offset="30%" stopColor={colors.surface} stopOpacity={0} />
          <Stop offset="100%" stopColor={colors.surface} stopOpacity={1} />
        </RadialGradient>
      </Defs>

      {bgTicks}
      {bgLabels}

      {/* Fixed triangle pointer glow — smoothly animated opacity */}
      <Polygon
        points={triGlowPoints}
        fill={`rgba(${accRgb[0]},${accRgb[1]},${accRgb[2]},${0.45 * triGlowFactor})`}
      />

      {/* Fixed triangle pointer */}
      <Polygon points={triPoints} fill={colors.accent} />

      {/* Radial vignette — dims corners only */}
      <Rect x={0} y={0} width={W} height={CFG.canvasH} fill="url(#rtrVig)" />
    </Svg>
  );
});

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export interface RestTimerRulerProps {
  currentSecs: number;
  defaultSecs: number;
  isRunning: boolean;
  onSecsChange: (secs: number) => void;
  onSecsChangeComplete?: (secs: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onStopStart: () => void;
  onStopComplete: () => void;
  onStart: () => void;
}

type Phase = 'armed' | 'sweeping' | 'zero';

const RestTimerRuler: React.FC<RestTimerRulerProps> = ({
  currentSecs,
  defaultSecs,
  isRunning,
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
  // Float for sub-pixel ruler motion; display rounds to integer
  const [displaySecs, setDisplaySecs] = useState<number>(currentSecs);
  const [dragProgress, setDragProgress] = useState(0);
  const isStoppingRef = useRef(false);

  // ── Sweep / collapse refs ─────────────────────────────────────────────────
  const sweepRaf = useRef<number | null>(null);
  const sweepRef = useRef<{ from: number; t0: number } | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Animation / drag refs for smooth transition ───────────────────────────
  const isDraggingRef = useRef(false);
  const prevCurrentSecs = useRef<number | null>(null);
  const animRaf = useRef<number | null>(null);
  const displaySecsRef = useRef(displaySecs);
  const currentSecsRef = useRef(currentSecs);
  const isRunningRef = useRef(isRunning);
  const justReleasedRef = useRef(false);
  const dragProgressRef = useRef(dragProgress);
  const dragProgressRaf = useRef<number | null>(null);

  // Keep refs updated to avoid stale closures
  useEffect(() => {
    displaySecsRef.current = displaySecs;
  }, [displaySecs]);

  useEffect(() => {
    currentSecsRef.current = currentSecs;
  }, [currentSecs]);

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    dragProgressRef.current = dragProgress;
  }, [dragProgress]);

  const lastHapticTickRef = useRef<number | null>(null);

  // Trigger subtle tick haptic feedback
  const triggerTickHaptic = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
  }, []);

  // Trigger light impact haptic feedback for button presses
  const triggerLightImpactHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  // Trigger success haptic feedback for timer completion
  const triggerSuccessHaptic = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, []);

  // Track tick changes during dragging to trigger haptic feedback
  useEffect(() => {
    if (isDraggingRef.current) {
      const rounded = Math.round(displaySecs);
      if (lastHapticTickRef.current !== null && lastHapticTickRef.current !== rounded) {
        triggerTickHaptic();
      }
      lastHapticTickRef.current = rounded;
    } else {
      lastHapticTickRef.current = Math.round(displaySecs);
    }
  }, [displaySecs, triggerTickHaptic]);

  const startDragProgressAnim = useCallback((to: number, duration: number) => {
    if (dragProgressRaf.current) cancelAnimationFrame(dragProgressRaf.current);
    const from = dragProgressRef.current;
    if (Math.abs(from - to) < 0.001) {
      setDragProgress(to);
      return;
    }
    const t0 = Date.now();

    function frame() {
      const elapsed = Date.now() - t0;
      const p = Math.min(1, elapsed / duration);
      // Ease out quadratic
      const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      const current = from + (to - from) * e;
      setDragProgress(current);

      if (p < 1) {
        dragProgressRaf.current = requestAnimationFrame(frame);
      }
    }
    dragProgressRaf.current = requestAnimationFrame(frame);
  }, []);

  // Cleanup timers & animation frames on unmount
  useEffect(() => {
    return () => {
      if (sweepRaf.current) cancelAnimationFrame(sweepRaf.current);
      if (animRaf.current) cancelAnimationFrame(animRaf.current);
      if (dragProgressRaf.current) cancelAnimationFrame(dragProgressRaf.current);
      if (holdTimer.current) clearTimeout(holdTimer.current);
    };
  }, []);

  // ── Collapse animation (slide-up + fade out) ──────────────────────────────
  const colY = useSharedValue(0);
  const colOpa = useSharedValue(1);

  const collapseStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: colY.value }],
    opacity: colOpa.value,
  }));

  // ── Gesture refs — PanResponder reads these directly ──────────────────────
  // Using plain refs (not state) so PanResponder callbacks are always current
  const isArmedRef = useRef(isRunning);
  const lastTxRef = useRef(0);
  const onSecsChangeRef = useRef(onSecsChange);
  const onSecsChangeCompleteRef = useRef(onSecsChangeComplete);
  const onDragStartRef = useRef(onDragStart);
  const onDragEndRef = useRef(onDragEnd);
  const onStopStartRef = useRef(onStopStart);
  const onStopCompleteRef = useRef(onStopComplete);
  const startDragProgressAnimRef = useRef(startDragProgressAnim);

  useEffect(() => { isArmedRef.current = phase === 'armed'; }, [phase]);
  useEffect(() => { onSecsChangeRef.current = onSecsChange; }, [onSecsChange]);
  useEffect(() => { onSecsChangeCompleteRef.current = onSecsChangeComplete; }, [onSecsChangeComplete]);
  useEffect(() => { onDragStartRef.current = onDragStart; }, [onDragStart]);
  useEffect(() => { onDragEndRef.current = onDragEnd; }, [onDragEnd]);
  useEffect(() => { onStopStartRef.current = onStopStart; }, [onStopStart]);
  useEffect(() => { onStopCompleteRef.current = onStopComplete; }, [onStopComplete]);
  useEffect(() => { startDragProgressAnimRef.current = startDragProgressAnim; }, [startDragProgressAnim]);

  // ── Smooth Animation Helper ────────────────────────────────────────────────
  const startAnim = useCallback((to: number, duration: number) => {
    if (animRaf.current) cancelAnimationFrame(animRaf.current);
    const from = displaySecsRef.current;
    if (Math.abs(from - to) < 0.001) {
      setDisplaySecs(to);
      return;
    }
    const t0 = Date.now();

    function frame() {
      const elapsed = Date.now() - t0;
      const p = Math.min(1, elapsed / duration);
      const current = from + (to - from) * p;
      setDisplaySecs(current);

      if (p < 1) {
        animRaf.current = requestAnimationFrame(frame);
      }
    }
    animRaf.current = requestAnimationFrame(frame);
  }, []);

  // ── Sync display to parent countdown ─────────────────────────────────────
  useEffect(() => {
    if (phase !== 'armed' || isStoppingRef.current) {
      prevCurrentSecs.current = null;
      return;
    }
    if (isDraggingRef.current) return;

    const justReleased = justReleasedRef.current;
    justReleasedRef.current = false;

    if (justReleased) {
      prevCurrentSecs.current = currentSecs;
      return;
    }

    const prev = prevCurrentSecs.current;
    prevCurrentSecs.current = currentSecs;

    if (isRunning) {
      if (prev === null || Math.abs(prev - currentSecs) !== 1) {
        // First load or large jump: set immediately and then animate to next second
        setDisplaySecs(currentSecs);
        startAnim(currentSecs - 1, 1000);
      } else {
        // Normal countdown tick: animate smoothly over 1000ms
        startAnim(currentSecs - 1, 1000);
      }
    } else {
      // Paused: set immediately and cancel any current animation
      setDisplaySecs(currentSecs);
      if (animRaf.current) cancelAnimationFrame(animRaf.current);
    }
  }, [currentSecs, phase, isRunning, startAnim]);

  // ── External isRunning changes ────────────────────────────────────────────
  useEffect(() => {
    if (isRunning) {
      // Cancel any ongoing sweep/collapse and restore layout
      if (sweepRaf.current) {
        cancelAnimationFrame(sweepRaf.current);
        sweepRaf.current = null;
      }
      if (holdTimer.current) {
        clearTimeout(holdTimer.current);
        holdTimer.current = null;
      }
      sweepRef.current = null;
      isStoppingRef.current = false;

      // Reset layout animations
      colY.value = 0;
      colOpa.value = 1;

      setPhase('armed');
      setDisplaySecs(currentSecs);
    } else {
      isStoppingRef.current = false;
      // If parent says timer is not running
      if (phase === 'armed') {
        // Go to zero phase immediately
        setPhase('zero');
        setDisplaySecs(0);
        if (currentSecsRef.current === 0) {
          triggerSuccessHaptic();
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setRulerWidth(e.nativeEvent.layout.width);
  }, []);

  // ── Collapse then close ───────────────────────────────────────────────────
  const doCollapse = useCallback(() => {
    colY.value = 0;
    colOpa.value = 1;
    colY.value = withTiming(-64, { duration: CFG.collapseMs, easing: Easing.in(Easing.cubic) });
    colOpa.value = withTiming(0, { duration: CFG.collapseMs, easing: Easing.in(Easing.quad) },
      (finished) => { if (finished) runOnJS(onStopCompleteRef.current)(); },
    );
  }, []);

  // ── Float sweep animation ─────────────────────────────────────────────────
  const startSweep = useCallback((from: number) => {
    if (sweepRaf.current) cancelAnimationFrame(sweepRaf.current);
    if (animRaf.current) cancelAnimationFrame(animRaf.current);
    if (holdTimer.current) clearTimeout(holdTimer.current);
    setPhase('sweeping');
    isStoppingRef.current = true;
    sweepRef.current = { from, t0: Date.now() };

    if (onStopStartRef.current) {
      onStopStartRef.current();
    }

    function frame() {
      const ref = sweepRef.current;
      if (!ref) return;
      const p = Math.min(1, (Date.now() - ref.t0) / CFG.sweepMs);
      // Quartic ease-in: gentle start → accelerating rush to zero
      const e = 1 - Math.pow(1 - p, 4);
      // Float — no Math.round — silky ruler motion
      const s = Math.max(0, ref.from * (1 - e));
      setDisplaySecs(s);
      if (p < 1) {
        sweepRaf.current = requestAnimationFrame(frame);
      } else {
        sweepRef.current = null;
        setDisplaySecs(0);
        setPhase('zero');
        holdTimer.current = setTimeout(doCollapse, CFG.holdMs);
      }
    }
    sweepRaf.current = requestAnimationFrame(frame);
  }, [doCollapse]);

  const handleActionBtn = useCallback(() => {
    if (phase === 'sweeping') return;
    triggerLightImpactHaptic();
    if (phase === 'armed') {
      startSweep(displaySecs);
    } else {
      colY.value = 0;
      colOpa.value = 1;
      isStoppingRef.current = false;
      setPhase('armed');
      setDisplaySecs(defaultSecs);
      justReleasedRef.current = true;
      prevCurrentSecs.current = defaultSecs;
      startAnim(defaultSecs - 1, 1000);
      onStart();
    }
  }, [phase, displaySecs, defaultSecs, startSweep, onStart, startAnim, triggerLightImpactHaptic]);

  // ── Sub-pixel drag handler ────────────────────────────────────────────────
  const handleDragDelta = useCallback((dx: number) => {
    setDisplaySecs(prev => {
      const next = Math.max(0, Math.min(CFG.maxSecs, prev - dx / CFG.pps));
      return next;
    });
  }, []);

  // ── PanResponder — created ONCE, reads live refs, works on all Android ────
  // Bypasses RNGH entirely → no conflict with parent ScrollView.
  const panResponder = useRef(
    PanResponder.create({
      // Capture start immediately so we win against ScrollView
      onStartShouldSetPanResponder: () => isArmedRef.current,
      onStartShouldSetPanResponderCapture: () => false,
      // Take over on clear horizontal movement
      onMoveShouldSetPanResponder: (_, g) => isArmedRef.current && Math.abs(g.dx) > 3,
      onMoveShouldSetPanResponderCapture: () => false,
      onPanResponderGrant: () => {
        isDraggingRef.current = true;
        lastTxRef.current = 0;
        if (animRaf.current) cancelAnimationFrame(animRaf.current);
        startDragProgressAnimRef.current(1.0, 200);
        if (onDragStartRef.current) onDragStartRef.current();
      },
      onPanResponderMove: (_, g) => {
        const dx = g.dx - lastTxRef.current;
        lastTxRef.current = g.dx;
        if (Math.abs(dx) > 0.01) handleDragDelta(dx);
      },
      onPanResponderRelease: () => {
        isDraggingRef.current = false;
        const finalSecs = Math.round(displaySecsRef.current);
        onSecsChangeRef.current(finalSecs);
        startDragProgressAnimRef.current(0.0, 250);
        if (isRunningRef.current) {
          justReleasedRef.current = true;
          prevCurrentSecs.current = finalSecs;
          startAnim(finalSecs - 1, 1000);
        } else {
          justReleasedRef.current = true;
          prevCurrentSecs.current = finalSecs;
          startAnim(finalSecs, 200);
        }
        if (onDragEndRef.current) onDragEndRef.current();
        if (onSecsChangeCompleteRef.current) {
          onSecsChangeCompleteRef.current(finalSecs);
        }
      },
      onPanResponderTerminate: () => {
        isDraggingRef.current = false;
        const finalSecs = Math.round(displaySecsRef.current);
        onSecsChangeRef.current(finalSecs);
        startDragProgressAnimRef.current(0.0, 250);
        if (isRunningRef.current) {
          justReleasedRef.current = true;
          prevCurrentSecs.current = finalSecs;
          startAnim(finalSecs - 1, 1000);
        } else {
          justReleasedRef.current = true;
          prevCurrentSecs.current = finalSecs;
          startAnim(finalSecs, 200);
        }
        if (onDragEndRef.current) onDragEndRef.current();
        if (onSecsChangeCompleteRef.current) {
          onSecsChangeCompleteRef.current(finalSecs);
        }
      },
    })
  ).current;

  // ── Derived UI ────────────────────────────────────────────────────────────
  const isStopping = isStoppingRef.current;
  const isZero = phase === 'zero' && !isStopping;
  const isSweep = phase === 'sweeping';
  const btnBg = colors.error;
  const btnLabel = 'Stop';
  const btnTxt = colors.textPrimary;
  const secsColor = isZero ? colors.error : colors.accent;
  const isDisabled = isSweep || isStopping;

  return (
    <Animated.View style={[styles.container, collapseStyle]}>

      {/* ── Cylindrical Ruler — PanResponder spread here ── */}
      <View
        style={[styles.rulerWrap, { transform: [{ translateY: 10 * dragProgress }] }]}
        onLayout={onLayout}
        {...panResponder.panHandlers}
      >
        <RulerSvg secs={displaySecs} width={rulerWidth} dragProgress={dragProgress} />
      </View>

      {/* ── Bottom row ── */}
      <View style={styles.bottomRow}>
        {!isZero && (
          <Pressable
            style={({ pressed }) => [
              styles.actionBtn,
              { backgroundColor: btnBg, opacity: isDisabled ? 0.5 : (pressed ? 0.85 : 1) },
              pressed && !isDisabled && { transform: [{ scale: 0.96 }] }
            ]}
            onPress={handleActionBtn}
            disabled={isDisabled}
            android_ripple={{ color: 'rgba(255,255,255,0.25)', borderless: false }}
          >
            <Text style={[styles.actionBtnText, { color: btnTxt }]}>{btnLabel}</Text>
          </Pressable>
        )}

        {/* fmt() rounds internally — user sees clean integers */}
        <Text style={[styles.timeDisplay, { color: secsColor }]}>{fmt(displaySecs)}</Text>
      </View>
    </Animated.View>
  );
};

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
