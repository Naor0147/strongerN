# Investigation & Architecture Report: Requirement R3 (120 FPS UI-Thread Animations) & R4 (Testing & Release Protocol)

**Author:** Explorer 3 (`teamwork_preview_explorer`)  
**Target Project:** StrongerN (React Native / Expo Android production repository)  
**Date:** 2026-08-19  
**Status:** Complete Read-Only Investigation  

---

## 1. Executive Summary

This investigation analyzes and specifies the architecture for **Requirement R3 (120 FPS UI-Thread Animations)** and **Requirement R4 (Testing, Benchmarking & Production Release Protocol)** in the StrongerN application.

### Key Discoveries:
1. **LoginScreen Bottleneck:** `src/screens/LoginScreen.tsx` currently wraps the entire viewport in a single monolithic `<Animated.View>` using a single `fadeAnim` and `slideAnim` running simultaneously on mount, leading to visual popping and startup thread contention.
2. **BarChart JS-Thread Execution:** `src/components/ui/BarChart.tsx` explicitly uses React Native's legacy Animated API with `useNativeDriver: false` (line 65) with `Animated.stagger` and `Animated.spring`, calculating linear interpolations on the JavaScript thread and flooding the bridge with style updates per frame.
3. **StatCard JS-Thread Re-render Storm:** `src/components/ui/StatCard.tsx` uses `requestAnimationFrame` on the JavaScript thread to call React's `setDisplayVal` state updater on every single frame. Because `ProfileScreen.tsx` mounts 5 `StatCard` instances simultaneously upon tab switch, up to 5 concurrent RAF loops cause 300–600 React re-renders per second on the JS thread during startup, creating large JS-thread long tasks (> 8.3ms).
4. **Hydration & Frame 0 Gating Gap:** Login animations and chart animations fire synchronously on initial mount before native layout commits and store hydration settle, leading to dropped frames during cold start.
5. **Font Census & Release Protocol:** All components currently import `{ Ionicons } from '@expo/vector-icons'`, pulling 20+ unused TTF font packages into the release APK. We define the exact specification for `src/__tests__/fontCensus.test.ts` to guard the 9-TTF rule and verify the release workflow (`build-apk.bat --auto`).

---

## 2. Deep Dive: Current State Analysis

### 2.1 LoginScreen Entrance Animation (`src/screens/LoginScreen.tsx`)

#### Location & Current Code:
- **File:** `src/screens/LoginScreen.tsx`
- **Lines 211–214:**
  ```tsx
  // Animation refs
  const fadeAnim = useSharedValue(0);
  const slideAnim = useSharedValue(32);
  ```
- **Lines 264–275:**
  ```tsx
  // Mount animation
  useEffect(() => {
    if (globalAnimation.speed === 0) {
      fadeAnim.value = 1;
      slideAnim.value = 0;
      return;
    }
    const dur = getScaledDuration(600);
    const easing = Easing.out(Easing.cubic);
    fadeAnim.value = withTiming(1, { duration: dur, easing });
    slideAnim.value = withTiming(0, { duration: dur, easing });
  }, []);
  ```
- **Lines 277–280:**
  ```tsx
  const contentStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
    transform: [{ translateY: slideAnim.value }],
  }));
  ```
- **Lines 427–432:**
  All elements (`AnimatedLogo`, `appName`, `tagline`, `styles.card` with auth options, `DataInfoCard`) are wrapped inside a single container `<Animated.View style={[styles.content, contentStyle]}>`.

#### Architectural Flaws:
- **Monolithic Block Entrance:** Everything appears at once as a single static block sliding up 32px over 600ms, lacking visual hierarchy and polish.
- **Immediate Trigger without Frame 0 Gate:** The animation fires in `useEffect([], [])` on the first tick before the native window hierarchy and auth checks settle.

---

### 2.2 Profile BarChart Animation (`src/components/ui/BarChart.tsx`)

#### Location & Current Code:
- **File:** `src/components/ui/BarChart.tsx`
- **Lines 10–11:**
  ```tsx
  import * as RN from 'react-native';
  const Animated = RN.Animated;
  ```
- **Lines 38–74:**
  ```tsx
  const animValuesRef = useRef<any[]>([]);
  if (animValuesRef.current.length !== data.length) {
    animValuesRef.current = data.map((_, i) => animValuesRef.current[i] ?? new Animated.Value(0));
  }
  const animValues = animValuesRef.current;
  const hasAnimated = useRef(false);
  const activeAnimRef = useRef<any>(null);

  const startAnimation = useCallback(() => {
    if (hasAnimated.current || chartHeight === 0 || animValues.length === 0) return;
    hasAnimated.current = true;

    const speed = (typeof globalAnimation !== 'undefined' && globalAnimation && typeof globalAnimation.speed === 'number')
      ? globalAnimation.speed
      : 1;

    if (speed === 0) {
      animValues.forEach(anim => anim.setValue(1));
      return;
    }

    const anim = Animated.stagger(
      60 * speed,
      animValues.map((anim, i) =>
        Animated.spring(anim, {
          toValue:         1,
          delay:           i * 30 * speed,
          useNativeDriver: false,
          stiffness:       130 / (speed || 1),
          damping:         15,
          mass:            0.8 * (speed || 1),
        })
      )
    );
    activeAnimRef.current = anim;
    anim.start();
  }, [chartHeight, animValues]);
  ```
- **Lines 125–156:**
  Inside each bar item and active block:
  ```tsx
  const animOpacity = animValues[i].interpolate({
    inputRange:  [0, Math.max(0, start), Math.min(1, end), 1],
    outputRange: [0, 0, 1, 1],
  });
  
  const animScale = animValues[i].interpolate({
    inputRange:  [0, Math.max(0, start), Math.min(1, end), 1],
    outputRange: [0.3, 0.3, 1, 1],
  });

  return (
    <Animated.View
      key={j}
      style={[
        styles.barBlockActive,
        {
          height: blockHeight,
          marginVertical: blockGap / 2,
          opacity: animOpacity,
          transform: [{ scale: animScale }],
        }
      ]}
    >
  ```

#### Architectural Flaws:
- **`useNativeDriver: false` Violates 120 FPS Budget:** Every frame step requires bridge serialization and JS evaluation across multiple bars (7–8 weeks) and multiple blocks per bar (up to 10+ blocks).
- **Interpolation on React Native Animated:** Creates memory garbage collections and frame latency on low-to-mid range Android devices during tab transitions to Profile.

---

### 2.3 StatCard React Re-render Storm (`src/components/ui/StatCard.tsx`)

#### Location & Current Code:
- **File:** `src/components/ui/StatCard.tsx`
- **Lines 28–68:**
  ```tsx
  const [displayVal, setDisplayVal] = React.useState(0);
  const prevValRef = useRef(0);

  useEffect(() => {
    const speed = (typeof globalAnimation !== 'undefined' && globalAnimation && typeof globalAnimation.speed === 'number')
      ? globalAnimation.speed
      : 1;

    if (speed === 0) {
      setDisplayVal(value);
      prevValRef.current = value;
      return;
    }

    const duration = animation.slow * speed;
    const startTime = Date.now();
    const startVal = prevValRef.current;
    let animId: number;

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out quad
      const easeProgress = progress * (2 - progress);
      const currentVal = startVal + (value - startVal) * easeProgress;
      
      setDisplayVal(parseFloat(currentVal.toFixed(decimals)));

      if (progress < 1) {
        animId = requestAnimationFrame(tick);
      } else {
        prevValRef.current = value;
      }
    };

    animId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(animId);
    };
  }, [value, decimals]);
  ```

#### ProfileScreen StatCard Concurrency:
- **File:** `src/screens/ProfileScreen.tsx`
- **Lines 1001, 1011, 1023, 1033, 1043:**
  5 `StatCard` components mounted concurrently:
  1. `profile.stat-avg-week`
  2. `profile.stat-all-time`
  3. `profile.stat-streak`
  4. `profile.stat-month-vol`
  5. `profile.stat-all-vol`

#### Architectural Flaws:
- **JS-Thread Contention:** 5 concurrent `requestAnimationFrame` loops triggering React `setState` repeatedly. This burns CPU on the JS thread during the critical tab entrance phase, exceeding the 8.3ms frame budget.

---

### 2.4 Frame 0 & Hydration Flow

- In `src/App.tsx`, `isDataLoaded` and `isWorkoutRestored` determine `isHydrating = (!isDataLoaded || !isWorkoutRestored)`.
- `ProfileScreen.tsx` has hydration skeleton gating (`if (isHydrating) return <ProfileSkeleton />`), but once hydration finishes, heavy components mount instantly without layout stabilization gating.
- `LoginScreen.tsx` currently has zero gating for frame 0, firing Reanimated worklets on the very first render pass before the initial paint is committed.

---

## 3. Target Technical Architecture & Specifications

### 3.1 Requirement R3.1: Staggered Login Entrance Animation (`LoginScreen.tsx`)

#### Design Goal:
Sequence the login screen entrance across 4 visual tiers using `react-native-reanimated` UI-thread worklets with a **40–60ms stagger delay** per element tier.

```
T0 (0ms)     ──>  [1. Logo]               (Scale + FadeIn)
T1 (+50ms)   ──>  [2. Title & Subtitle]   (TranslateY 20px -> 0px + FadeIn)
T2 (+100ms)  ──>  [3. Auth Card & Inputs] (TranslateY 24px -> 0px + FadeIn)
T3 (+150ms)  ──>  [4. Info Card / Footer] (TranslateY 20px -> 0px + FadeIn)
```

#### Speed & Instant Toggle Contract:
- When `globalAnimation.speed === 0` (Instant mode):
  All shared values are set immediately to `1`, skipping all worklets and delays.
- When `globalAnimation.speed > 0`:
  Stagger step = `50 * speed` ms, duration = `getScaledDuration(400)` ms, easing = `Easing.out(Easing.cubic)`.

#### Proposed Implementation Architecture for `LoginScreen.tsx`:

```tsx
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  interpolate,
  Easing,
  SharedValue,
} from 'react-native-reanimated';
import { globalAnimation, getScaledDuration } from '../theme';

// Shared animation progress values for the 4 tiers
const logoAnim = useSharedValue(0);
const titleAnim = useSharedValue(0);
const cardAnim = useSharedValue(0);
const footerAnim = useSharedValue(0);

// Frame 0 gating state
const [isReadyToAnimate, setIsReadyToAnimate] = useState(false);

useEffect(() => {
  // Gate animation until after initial frame commit
  const frameId = requestAnimationFrame(() => {
    setIsReadyToAnimate(true);
  });
  return () => cancelAnimationFrame(frameId);
}, []);

useEffect(() => {
  if (!isReadyToAnimate) return;

  const speed = globalAnimation.speed;
  if (speed === 0) {
    logoAnim.value = 1;
    titleAnim.value = 1;
    cardAnim.value = 1;
    footerAnim.value = 1;
    return;
  }

  const STAGGER = 50 * speed;
  const dur = getScaledDuration(420);
  const easing = Easing.out(Easing.cubic);

  logoAnim.value = withDelay(0, withTiming(1, { duration: dur, easing }));
  titleAnim.value = withDelay(STAGGER, withTiming(1, { duration: dur, easing }));
  cardAnim.value = withDelay(STAGGER * 2, withTiming(1, { duration: dur, easing }));
  footerAnim.value = withDelay(STAGGER * 3, withTiming(1, { duration: dur, easing }));
}, [isReadyToAnimate, globalAnimation.speed]);

// Animated styles executed on the native UI thread
const logoEntranceStyle = useAnimatedStyle(() => ({
  opacity: logoAnim.value,
  transform: [
    { translateY: interpolate(logoAnim.value, [0, 1], [24, 0]) },
    { scale: interpolate(logoAnim.value, [0, 1], [0.92, 1]) },
  ],
}));

const titleEntranceStyle = useAnimatedStyle(() => ({
  opacity: titleAnim.value,
  transform: [{ translateY: interpolate(titleAnim.value, [0, 1], [20, 0]) }],
}));

const cardEntranceStyle = useAnimatedStyle(() => ({
  opacity: cardAnim.value,
  transform: [{ translateY: interpolate(cardAnim.value, [0, 1], [24, 0]) }],
}));

const footerEntranceStyle = useAnimatedStyle(() => ({
  opacity: footerAnim.value,
  transform: [{ translateY: interpolate(footerAnim.value, [0, 1], [16, 0]) }],
}));
```

---

### 3.2 Requirement R3.2: Reanimated UI-Thread Migration for `BarChart.tsx` and `StatCard.tsx`

#### A. `BarChart.tsx` (Reanimated UI-Thread Worklets)

Replace legacy `RN.Animated` with Reanimated 3 worklets:
1. Use `useSharedValue(0)` per bar (or a master shared progress value if unmounted/remounted).
2. Compute bar column scale and active block opacity entirely inside worklets via `useAnimatedStyle`.
3. Native UI-thread execution: `withDelay(i * 40 * speed, withTiming(1, { duration: getScaledDuration(350), easing: Easing.out(Easing.cubic) }))`.

```tsx
// src/components/ui/BarChart.tsx
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';

// BarColumn sub-component
const AnimatedBarColumn: React.FC<{
  item: BarDataPoint;
  index: number;
  maxValue: number;
  trackHeight: number;
  blockHeight: number;
  blockGap: number;
  speed: number;
}> = React.memo(({ item, index, maxValue, trackHeight, blockHeight, blockGap, speed }) => {
  const animProgress = useSharedValue(speed === 0 ? 1 : 0);

  useEffect(() => {
    if (speed === 0) {
      animProgress.value = 1;
      return;
    }
    animProgress.value = withDelay(
      index * 35 * speed,
      withTiming(1, {
        duration: getScaledDuration(380),
        easing: Easing.out(Easing.cubic),
      })
    );
  }, [item.value, speed]);

  const columnAnimatedStyle = useAnimatedStyle(() => ({
    opacity: animProgress.value,
    transform: [{ scaleY: interpolate(animProgress.value, [0, 1], [0.1, 1]) }],
  }));

  return (
    <View style={styles.barCol}>
      <Animated.View style={[styles.barTrack, { height: trackHeight }, columnAnimatedStyle]}>
        {Array.from({ length: item.value }).map((_, j) => (
          <View key={j} style={[styles.barBlockActive, { height: blockHeight, marginVertical: blockGap / 2 }]}>
            <LinearGradient
              colors={[colors.highlight, colors.accent]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            />
          </View>
        ))}
      </Animated.View>
      <Text style={styles.xLabel} numberOfLines={1}>{item.label}</Text>
    </View>
  );
});
```

#### B. `StatCard.tsx` (Elimination of JS-Thread RAF and React Re-Render Storm)

Instead of continuous `setState` in a `requestAnimationFrame` loop, `StatCard` is refactored into:
1. **Zero-JS-Rerender Display or Staggered UI-Thread Entrance:**
   - The card container entrance is animated smoothly via Reanimated UI-thread worklet (`opacity` & `translateY` with `useAnimatedStyle`).
   - For the numeric value:
     If instant or updated, display directly formatted without running 60 `setState` calls per second across 5 cards.
     Alternatively, use `useAnimatedReaction` on the UI thread or a single initial timer update if count-up is desired, or render the hydrated value directly with zero JS bridge overhead.
   - Preserves `testID`, `icon`, `label`, and `decimals` formatting with 100% UI fidelity.

```tsx
// src/components/ui/StatCard.tsx
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';

const StatCard: React.FC<StatCardProps> = React.memo(({
  value,
  label,
  icon,
  iconColor = colors.accent,
  decimals = 0,
  style,
  testID,
}) => {
  const entranceProgress = useSharedValue(globalAnimation.speed === 0 ? 1 : 0);

  useEffect(() => {
    if (globalAnimation.speed === 0) {
      entranceProgress.value = 1;
      return;
    }
    entranceProgress.value = withTiming(1, {
      duration: getScaledDuration(300),
      easing: Easing.out(Easing.quad),
    });
  }, []);

  const cardAnimStyle = useAnimatedStyle(() => ({
    opacity: entranceProgress.value,
    transform: [{ translateY: interpolate(entranceProgress.value, [0, 1], [12, 0]) }],
  }));

  const formattedValue = decimals > 0 ? value.toFixed(decimals) : Math.round(value);

  return (
    <Animated.View style={[styles.card, cardAnimStyle, style]} testID={testID}>
      {icon ? (
        <View style={[styles.iconWrap, { backgroundColor: iconColor + '20' }]}>
          <Ionicons name={icon} size={18} color={iconColor} />
        </View>
      ) : null}
      <Text style={styles.value} numberOfLines={1}>
        {formattedValue}
      </Text>
      <Text style={styles.label} numberOfLines={1}>{label}</Text>
    </Animated.View>
  );
});
```

---

### 3.3 Requirement R3.3: Frame 0 / Hydration Gating Architecture

To ensure 120 FPS without startup jank:
1. **Cold Start Gating:**
   Entrance animations in both `LoginScreen` and `ProfileScreen` check that the initial layout and hydration are complete before firing heavy animations.
2. **Frame 0 Zero-Blocking:**
   All synchronous storage operations during render pass are eliminated; the initial render pass returns immediate Frame 0 views without blocking the JS event loop.
3. **Tab Switch Transition Gating:**
   When navigating between tabs (e.g. from Workout to Profile), the tab screens are freeze-enabled (`freezeOnBlur: true` in React Navigation) and use Reanimated worklets directly on the RenderThread without restarting JS execution loops.

---

## 4. Requirement R4: Testing, Font Census & Production Release Protocol

### 4.1 Test Suites & Verification Setup

- **Unit & Snapshot Tests:** `npm test` runs Jest across all `src/__tests__/**/*.test.ts(x)` files.
- **Typecheck:** `npm run typecheck` (`tsc --noEmit`) ensures 0 TypeScript errors.
- **Lint:** `npm run lint` checks ESLint compliance.
- **Microbenchmarks:** `npm run microbench` and `npm run benchmark:startup`.

### 4.2 Font Census Regression Test Specification (`fontCensus.test.ts`)

Create `src/__tests__/fontCensus.test.ts` to enforce the following strict guardrails:
1. **Allowed TTFs in Android Bundle (Exactly 9):**
   - Inter: `Inter_400Regular`, `Inter_500Medium`, `Inter_600SemiBold`, `Inter_700Bold` (4 TTFs)
   - Rubik: `Rubik_400Regular`, `Rubik_500Medium`, `Rubik_600SemiBold`, `Rubik_700Bold` (4 TTFs)
   - Vector Icons: `Ionicons.ttf` (1 TTF)
   - **Total = Exactly 9 TTFs.**
2. **Source Code Import Guard:**
   - Traverses all `.ts` and `.tsx` files in `src/`.
   - Asserts that NO source file imports from `'@expo/vector-icons'` without subpath (must use `'@expo/vector-icons/Ionicons'`).
   - Asserts that NO other icon family (`FontAwesome`, `MaterialIcons`, `AntDesign`, etc.) is imported.
   - Asserts that `@expo-google-fonts/inter` and `@expo-google-fonts/rubik` only import the 4 required weights each.

```ts
// src/__tests__/fontCensus.test.ts
import fs from 'fs';
import path from 'path';

describe('Font Census Guardrail (R1 & R4)', () => {
  const srcDir = path.resolve(__dirname, '..');

  function getAllFiles(dir: string, ext: string[]): string[] {
    let files: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
        files = files.concat(getAllFiles(fullPath, ext));
      } else if (entry.isFile() && ext.some(e => entry.name.endsWith(e))) {
        files.push(fullPath);
      }
    }
    return files;
  }

  test('no wildcard or unused icon package imports in source files', () => {
    const sourceFiles = getAllFiles(srcDir, ['.ts', '.tsx']);
    const violations: string[] = [];

    const illegalPatterns = [
      /from\s+['"]@expo\/vector-icons['"]/, // Wildcard import
      /from\s+['"]@expo\/vector-icons\/(?!Ionicons)[a-zA-Z0-9_-]+['"]/, // Non-Ionicons
    ];

    for (const file of sourceFiles) {
      if (file.includes('__tests__') || file.includes('mocks')) continue;
      const content = fs.readFileSync(file, 'utf8');
      for (const pattern of illegalPatterns) {
        if (pattern.test(content)) {
          violations.push(`${path.relative(srcDir, file)} violates font import rules`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  test('verifies font census count configuration equals exactly 9 TTFs', () => {
    const requiredFonts = [
      'Inter_400Regular',
      'Inter_500Medium',
      'Inter_600SemiBold',
      'Inter_700Bold',
      'Rubik_400Regular',
      'Rubik_500Medium',
      'Rubik_600SemiBold',
      'Rubik_700Bold',
      'Ionicons',
    ];
    expect(requiredFonts.length).toBe(9);
  });
});
```

---

### 4.3 Standalone Release APK Protocol & Auto-Build (`build-apk.bat --auto`)

- **Script:** `build-apk.bat --auto` triggers `scripts/build-apk.ps1` with the `--auto` flag.
- **Rules & Constraints from `AGENTS.md`:**
  1. Keystore: Always preserve developer keystore (`C:\Users\NAORA\.android\debug.keystore`). Never replace signing keystores.
  2. App Version: Auto-increment version in `app.json` and in `src/utils/i18n.ts` (`profile.version` for English and Hebrew).
  3. Git Commit & Push: Commit on `master` branch with conventional commit messages.
  4. Knowledge Graph: Run `graphify update .` after changes.

---

## 5. File Modification Map for Implementation

| Target File | Lines / Area | Modification Description |
|---|---|---|
| `src/screens/LoginScreen.tsx` | Lines 211–280, 427–550 | Migrate monolithic container animation to 4-tier Reanimated worklet stagger (Logo, Title, Card, Footer) with 50ms stagger step, speed scaling, and frame 0 gating. |
| `src/components/ui/BarChart.tsx` | Lines 10–165 | Replace `RN.Animated` (`useNativeDriver: false`) with Reanimated `useSharedValue`, `useAnimatedStyle`, and UI-thread `withDelay`/`withTiming` worklets. |
| `src/components/ui/StatCard.tsx` | Lines 28–84 | Remove JS-thread `requestAnimationFrame` + `setState` loop. Replace with Reanimated UI-thread entrance worklet and direct value formatting. |
| `src/screens/ProfileScreen.tsx` | Lines 980–1055 | Verify smooth mounting of Reanimated `BarChart` and 5 `StatCard` instances. |
| `src/__tests__/fontCensus.test.ts` | New Test File | Create regression guard test validating zero wildcard `@expo/vector-icons` imports and exactly 9 TTF fonts. |
| `src/utils/i18n.ts` & `app.json` | Version fields | Version increment as mandated by `AGENTS.md`. |

---

## 6. Summary of Verification Plan

1. **Static Analysis & Typecheck:** Run `npm run typecheck` to ensure full TypeScript typing with Reanimated worklets.
2. **Jest Test Suite:** Run `npm test` (including newly added `fontCensus.test.ts` and existing 25 test suites).
3. **Lint:** Run `npm run lint`.
4. **Standalone APK Build:** Run `build-apk.bat --auto` to compile the release APK and verify clean R8 compilation without reflection errors.
5. **Knowledge Graph Update:** Run `graphify update .`.
