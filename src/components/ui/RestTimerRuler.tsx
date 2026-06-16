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

// ── CONFIG ───────────────────────────────────────────────────────────────────
const CFG = {
  pps:        11,    // px per second — base density
  labelEvery: 5,     // label every N seconds
  tickH:      18,    // major tick height px
  tickHShort: 10,    // minor tick height px
  tickW:      2,     // base tick stroke width (not scaled — kept visible)
  canvasH:    72,    // ruler strip height px
  maxSecs:    600,   // 10-min cap
  sweepMs:    800,   // sweep-to-zero duration ms
  holdMs:     400,   // pause at zero before collapsing ms
  collapseMs: 320,   // collapse slide-up duration ms
  triW:       14,
  triH:       11,
};

const C_ACC  = '#4F8EF7';
const C_ERR  = '#F0506E';
const C_OK   = '#22D97A';
const C_OKTX = '#0A1F12';

const TICK_RGB: [number, number, number] = [139, 149, 165]; // colors.textSecondary (#8B95A5)
const BG_RGB:   [number, number, number] = [13, 15, 20];     // colors.bg (#0D0F14)

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
interface RulerProps { secs: number; width: number; }

const RulerSvg = React.memo(({ secs, width }: RulerProps) => {
  if (width <= 0) return null;

  const W  = width;
  const cx = W / 2;
  // Cylinder radius = half canvas width
  const R  = W / 2;

  const triY  = CFG.canvasH - 4;
  const tBot  = triY - CFG.triH - 4;
  const tTop  = tBot - CFG.tickH;
  const tTopS = tBot - CFG.tickHShort;

  // ✅ FIXED: correct range using full π/2 arc, not just R/pps
  // maxDeltaS = how many seconds fit within the ±π/2 visible cylinder arc
  const maxDeltaS = Math.ceil(R * Math.PI / 2 / CFG.pps) + 2;
  const s0 = Math.max(0,           Math.floor(secs - maxDeltaS));
  const s1 = Math.min(CFG.maxSecs, Math.ceil(secs  + maxDeltaS));
  const cs = Math.round(secs);

  const bgTicks:  JSX.Element[] = [];
  const bgLabels: JSX.Element[] = [];
  let   centerX = cx;

  for (let s = s0; s <= s1; s++) {
    // Cylindrical projection: angle from center
    const angle = (s - secs) * CFG.pps / R;
    if (Math.abs(angle) >= Math.PI / 2) continue; // back-face

    // Sine mapping → ticks bunch at edges (cylindrical distortion)
    const x = cx + R * Math.sin(angle);

    // cos gives depth: 1 at center, 0 at horizon
    const scale = Math.cos(angle);
    // ✅ GENTLER fade: cos^0.6 keeps distant ticks visible
    const fade  = Math.pow(scale, 0.6);

    const isCenter = s === cs;
    const isMaj    = s % CFG.labelEvery === 0;

    if (isCenter) { centerX = x; continue; }

    const [r, g, b] = lerpRgb(TICK_RGB, BG_RGB, fade);
    // ✅ Keep stroke width constant — only color/opacity encodes depth
    // Increase minimum alpha and keep ticks bright and highly visible
    const alpha = Math.max(0.25, fade * 0.85);
    const color = `rgba(${r},${g},${b},${alpha})`;
    const y1    = isMaj ? tTop : tTopS;

    bgTicks.push(
      <Line
        key={`t-${s}`}
        x1={x} y1={y1}
        x2={x} y2={tBot}
        stroke={color}
        strokeWidth={CFG.tickW}
      />,
    );

    if (isMaj && fade > 0.15) {
      const la = Math.min(1, fade * 1.1);
      bgLabels.push(
        <SvgText
          key={`l-${s}`}
          x={x} y={tTop - 4}
          fill={`rgba(${r},${g},${b},${la})`}
          fontSize={9} textAnchor="middle"
        >
          {s}
        </SvgText>,
      );
    }
  }

  const triPoints = `${cx - CFG.triW / 2},${triY} ${cx + CFG.triW / 2},${triY} ${cx},${triY - CFG.triH}`;

  return (
    <Svg width={W} height={CFG.canvasH}>
      <Defs>
        {/*
          Radial vignette:
          - transparent inner zone extended to 80 % (was 65 %)
          - only darkens the extreme edges/corners
          rx = 60 % of W, ry = 50 % of H
        */}
        <RadialGradient
          id="rtrVig"
          cx="50%"
          cy="50%"
          r="60%"
          fx="50%"
          fy="50%"
        >
          <Stop offset="75%" stopColor={colors.bg} stopOpacity={0} />
          <Stop offset="100%" stopColor={colors.bg} stopOpacity={1} />
        </RadialGradient>
      </Defs>

      {bgTicks}
      {bgLabels}

      {/* Center tick — accent, tallest, drawn last (on top) */}
      <Line
        x1={centerX} y1={tTop - 3}
        x2={centerX} y2={tBot}
        stroke={C_ACC} strokeWidth={CFG.tickW * 1.8}
      />

      {/* Fixed triangle pointer */}
      <Polygon points={triPoints} fill={C_ACC} />

      {/* Radial vignette — dims corners only */}
      <Rect x={0} y={0} width={W} height={CFG.canvasH} fill="url(#rtrVig)" />
    </Svg>
  );
});

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export interface RestTimerRulerProps {
  currentSecs:  number;
  defaultSecs:  number;
  isRunning:    boolean;
  onSecsChange: (secs: number) => void;
  onStop:       () => void;
  onStart:      () => void;
}

type Phase = 'armed' | 'sweeping' | 'zero';

const RestTimerRuler: React.FC<RestTimerRulerProps> = ({
  currentSecs,
  defaultSecs,
  isRunning,
  onSecsChange,
  onStop,
  onStart,
}) => {
  const [rulerWidth,  setRulerWidth]  = useState(360);
  const [phase,       setPhase]       = useState<Phase>(isRunning ? 'armed' : 'zero');
  // Float for sub-pixel ruler motion; display rounds to integer
  const [displaySecs, setDisplaySecs] = useState<number>(currentSecs);

  // ── Sweep / collapse refs ─────────────────────────────────────────────────
  const sweepRaf  = useRef<number | null>(null);
  const sweepRef  = useRef<{ from: number; t0: number } | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Collapse animation (slide-up + fade out) ──────────────────────────────
  const colY   = useSharedValue(0);
  const colOpa = useSharedValue(1);

  const collapseStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: colY.value }],
    opacity:   colOpa.value,
  }));

  // ── Gesture refs — PanResponder reads these directly ──────────────────────
  // Using plain refs (not state) so PanResponder callbacks are always current
  const isArmedRef      = useRef(isRunning);
  const lastTxRef       = useRef(0);
  const onSecsChangeRef = useRef(onSecsChange);

  useEffect(() => { isArmedRef.current      = phase === 'armed'; }, [phase]);
  useEffect(() => { onSecsChangeRef.current = onSecsChange;      }, [onSecsChange]);

  // ── Sync display to parent countdown ─────────────────────────────────────
  useEffect(() => {
    if (phase === 'armed') setDisplaySecs(currentSecs);
  }, [currentSecs, phase]);

  // ── External isRunning changes ────────────────────────────────────────────
  useEffect(() => {
    if (!isRunning && phase === 'armed') {
      setPhase('zero'); setDisplaySecs(0);
    } else if (isRunning && phase === 'zero') {
      setPhase('armed'); setDisplaySecs(currentSecs);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setRulerWidth(e.nativeEvent.layout.width);
  }, []);

  // ── Collapse then close ───────────────────────────────────────────────────
  const doCollapse = useCallback(() => {
    colY.value   = 0;
    colOpa.value = 1;
    colY.value   = withTiming(-64, { duration: CFG.collapseMs, easing: Easing.in(Easing.cubic) });
    colOpa.value = withTiming(0,   { duration: CFG.collapseMs, easing: Easing.in(Easing.quad) },
      (finished) => { if (finished) runOnJS(onStop)(); },
    );
  }, [onStop]);

  // ── Float sweep animation ─────────────────────────────────────────────────
  const startSweep = useCallback((from: number) => {
    if (sweepRaf.current)  cancelAnimationFrame(sweepRaf.current);
    if (holdTimer.current) clearTimeout(holdTimer.current);
    setPhase('sweeping');
    sweepRef.current = { from, t0: Date.now() };

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
    if (phase === 'armed') {
      startSweep(displaySecs);
    } else {
      colY.value   = 0;
      colOpa.value = 1;
      setPhase('armed');
      setDisplaySecs(defaultSecs);
      onStart();
    }
  }, [phase, displaySecs, defaultSecs, startSweep, onStart]);

  // ── Sub-pixel drag handler ────────────────────────────────────────────────
  const handleDragDelta = useCallback((dx: number) => {
    setDisplaySecs(prev => {
      const next = Math.max(0, Math.min(CFG.maxSecs, prev - dx / CFG.pps));
      onSecsChangeRef.current(Math.round(next));
      return next; // float stored internally
    });
  }, []);

  // ── PanResponder — created ONCE, reads live refs, works on all Android ────
  // Bypasses RNGH entirely → no conflict with parent ScrollView.
  const panResponder = useRef(
    PanResponder.create({
      // Capture start immediately so we win against ScrollView
      onStartShouldSetPanResponder:         () => isArmedRef.current,
      onStartShouldSetPanResponderCapture:  () => false,
      // Take over on clear horizontal movement
      onMoveShouldSetPanResponder:          (_, g) => isArmedRef.current && Math.abs(g.dx) > 3,
      onMoveShouldSetPanResponderCapture:   () => false,
      onPanResponderGrant: () => { lastTxRef.current = 0; },
      onPanResponderMove:  (_, g) => {
        const dx = g.dx - lastTxRef.current;
        lastTxRef.current = g.dx;
        if (Math.abs(dx) > 0.01) handleDragDelta(dx);
      },
    })
  ).current;

  // ── Derived UI ────────────────────────────────────────────────────────────
  const isZero    = phase === 'zero';
  const isSweep   = phase === 'sweeping';
  const btnBg     = isZero ? C_OK   : C_ERR;
  const btnLabel  = isZero ? 'Start': 'Stop';
  const btnTxt    = isZero ? C_OKTX : '#fff';
  const secsColor = isZero ? C_OK   : C_ACC;

  return (
    <Animated.View style={[styles.container, collapseStyle]}>

      {/* ── Cylindrical Ruler — PanResponder spread here ── */}
      <View
        style={styles.rulerWrap}
        onLayout={onLayout}
        {...panResponder.panHandlers}
      >
        <RulerSvg secs={displaySecs} width={rulerWidth} />
      </View>

      {/* ── Bottom row ── */}
      <View style={styles.bottomRow}>
        <Pressable
          style={[styles.actionBtn, { backgroundColor: btnBg, opacity: isSweep ? 0.5 : 1 }]}
          onPress={handleActionBtn}
          disabled={isSweep}
          android_ripple={{ color: 'rgba(255,255,255,0.25)', borderless: false }}
        >
          <Text style={[styles.actionBtnText, { color: btnTxt }]}>{btnLabel}</Text>
        </Pressable>

        {/* fmt() rounds internally — user sees clean integers */}
        <Text style={[styles.timeDisplay, { color: secsColor }]}>{fmt(displaySecs)}</Text>
      </View>
    </Animated.View>
  );
};

// ── STYLES ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bg,
    borderRadius:    26,
    overflow:        'hidden',
    paddingTop:      18,
  },
  rulerWrap: {
    width:  '100%',
    height: CFG.canvasH,
  },
  bottomRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 20,
    paddingTop:        12,
    paddingBottom:     20,
  },
  actionBtn: {
    width:           100,
    paddingVertical: 10,
    borderRadius:    20,
    alignItems:      'center',
    justifyContent:  'center',
  },
  actionBtnText: {
    fontSize:      15,
    fontFamily:    font.semibold,
    letterSpacing: -0.3,
  },
  timeDisplay: {
    fontSize:      50,
    fontWeight:    '100',
    letterSpacing: -2,
    lineHeight:    54,
    fontFamily:    font.regular,
  },
});

export default RestTimerRuler;

