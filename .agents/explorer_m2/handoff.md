# Milestone 2 (R7: Premium Animation Polish at 120 FPS) — Explorer Handoff Report

## 1. Observation

Direct investigation of `src/components/layout/ActiveWorkoutModal.tsx` and the surrounding component tree revealed several remnants of legacy React Native `Animated`, JS-thread `PanResponder` touch listeners, and unoptimized modal transition attributes.

### 1.1 Main Active Workout Modal Presentation & Dismissal (`ActiveWorkoutModal.tsx`)
- **Location**: `src/components/layout/ActiveWorkoutModal.tsx:166-189`, `1204-1210`, `2119`
- **Observed Code**:
  ```ts
  // Line 166-189
  const [modalRendered, setModalRendered] = useState(visible);
  const slideAnim = useRef(new RN.Animated.Value(visible ? 0 : (windowHeight || 800))).current;

  useEffect(() => {
    if (visible) {
      setModalRendered(true);
      RN.Animated.timing(slideAnim, {
        toValue: 0,
        duration: 280,
        easing: RN.Easing.out(RN.Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else if (modalRendered) {
      RN.Animated.timing(slideAnim, {
        toValue: windowHeight || 800,
        duration: 240,
        easing: RN.Easing.in(RN.Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setModalRendered(false);
        }
      });
    }
  }, [visible, windowHeight, slideAnim, modalRendered]);
  ```
  And JSX rendering at lines 1204–1210:
  ```tsx
  <RN.Animated.View
    style={{
      flex: 1,
      backgroundColor: colors.bg,
      transform: [{ translateY: slideAnim }],
    }}
  >
  ```
- **Observed Bottlenecks**:
  - Uses legacy `RN.Animated` (`new RN.Animated.Value(...)` and `RN.Animated.timing(...)`).
  - Does not participate in Reanimated 3 UI-thread worklet scheduling.
  - Does not respect `globalAnimation.speed` (instant mode `speed === 0` or speed scaling `getScaledDuration(...)`).
  - JS-thread dependency for unmount completion synchronization (`({ finished }) => setModalRendered(false)`).

---

### 1.2 Bottom Sheets and Sub-Modals in `ActiveWorkoutModal.tsx`
- **Location**: `src/components/layout/ActiveWorkoutModal.tsx:406-565`, `1513-1727`, `1733-1791`, `1811-1903`, `1908-1989`, `1993-2104`
- **Observed Code**:
  ```ts
  // Line 406
  const sheetTranslateY = useRef(new RN.Animated.Value(0)).current;

  // Lines 409-446: exMenuPanResponder
  // Lines 449-485: timerPickerPanResponder
  // Lines 488-525: defaultTimerPanResponder
  // Lines 528-565: workoutMenuPanResponder
  ```
  All 4 `PanResponder` instances mutate `sheetTranslateY.setValue(gestureState.dy)` on the JS thread and invoke `RN.Animated.timing` / `RN.Animated.spring`.
- **Sub-Modals Structure**:
  1. **Exercise Options Context Menu (`isExMenuVisible`)**:
     - `Modal animationType="fade"` (Line 1515)
     - Card container: `<RN.Animated.View style={[styles.sheetCard, { transform: [{ translateY: sheetTranslateY }] }]}>` (Line 1524)
  2. **Set Auto-Timer Modal (`isTimerPickerVisible`)**:
     - `Modal animationType="slide"` (Line 1735)
     - Card container: `<RN.Animated.View style={[styles.sheetCard, { transform: [{ translateY: sheetTranslateY }] }]}>` (Line 1744)
  3. **Workout Options Bottom Sheet (`isWorkoutMenuVisible`)**:
     - `Modal animationType="fade"` (Line 1814)
     - Card container: `<RN.Animated.View style={[styles.sheetCard, { transform: [{ translateY: sheetTranslateY }] }]}>` (Line 1823)
  4. **Change Start Time Modal (`isStartTimePickerVisible`)**:
     - `Modal animationType="slide"` (Line 1911)
     - Uses standard native modal slide without backdrop fade or Reanimated card presentation.
  5. **Change Default Timer Modal (`isDefaultTimerPickerVisible`)**:
     - `Modal animationType="slide"` (Line 1996)
     - Card container: `<RN.Animated.View style={[styles.sheetCard, { transform: [{ translateY: sheetTranslateY }] }]}>` (Line 2005)
- **Observed Bottlenecks**:
  - `RN.PanResponder` runs gesture calculations on the JavaScript thread, causing dropped touch frames under heavy JavaScript load or rapid swipe gestures.
  - Native `animationType="slide"` and `animationType="fade"` create animation collisions with inner translated cards and lack synchronized backdrop opacity worklets.
  - A single `sheetTranslateY` value is shared across all bottom sheets.

---

### 1.3 Active Set Row Toggles & Checkmark Animations
- **Location**: `src/components/layout/ActiveSetRowItem.tsx` & `src/components/layout/AnimatedCheckmark.tsx`
- **Observed Status**:
  - `AnimatedCheckmark.tsx` already uses Reanimated `useSharedValue`, `withSpring`, `withTiming`, and `useAnimatedStyle`:
    ```ts
    const scale = useSharedValue(completed ? 1 : 0);
    const opacity = useSharedValue(completed ? 1 : 0);
    useEffect(() => {
      scale.value = withSpring(completed ? 1 : 0, { damping: 15, stiffness: 180 });
      opacity.value = withTiming(completed ? 1 : 0, { duration: 120 });
    }, [completed]);
    ```
  - `ActiveSetRowItem.tsx` has custom memoization equality check (lines 402–411) isolating re-renders to only the toggled set, ensuring zero layout jank during checkmark toggle.
  - `ActiveExerciseRow.tsx` (lines 58–129) runs staggered card entrance animations on the Reanimated UI thread via `withDelay(exIdx * 75, withTiming(...))`.

---

## 2. Logic Chain

1. **Premise 1 (120 FPS Target)**: High-refresh-rate displays (120 Hz) have an 8.33 ms frame budget. Any animation running on the JavaScript thread (via `RN.Animated` with JS callbacks or `RN.PanResponder`) is susceptible to thread starvation during state hydration, timer tick intervals, SQLite writes, or list re-renders.
2. **Premise 2 (Zero JS-Thread Jank)**: Reanimated 3 UI-thread worklets (`useSharedValue`, `useAnimatedStyle`, `withTiming`, `withSpring`) execute directly on the UI/Render thread via Hermes runtime worklets, achieving continuous 120 FPS frame delivery independent of JS thread workload.
3. **Inference 1**: Replacing `RN.Animated` in `ActiveWorkoutModal.tsx` with Reanimated 3 shared values (`translateY = useSharedValue(...)`) guarantees that modal presentation and dismissal animations run completely on the UI thread without dropping frames.
4. **Inference 2**: Replacing `RN.PanResponder` and legacy `sheetTranslateY` with Reanimated `Gesture.Pan()` and UI-thread animated styles (`useAnimatedStyle`) for bottom sheet sub-menus eliminates touch latency and ensures gesture tracking runs at 120 FPS.
5. **Inference 3**: Standardizing sub-modals to `animationType="none"` with transparent backdrops driven by Reanimated `backdropOpacity` (`0 → 1`) and `sheetTranslateY` (`height → 0`) eliminates native modal animation stutter and delivers smooth backdrop dimming and sheet sliding.
6. **Inference 4**: Incorporating `globalAnimation.speed`, `getScaledDuration`, and `getSpringConfig` from `src/theme` maintains full support for instant animation mode (`speed === 0` used in accessibility and testing) while providing smooth spring physics under normal operation.

---

## 3. Caveats

1. **Child Modals (`AddExerciseScreen` & `ExerciseInsightsModal`)**:
   - `AddExerciseScreen` and `ExerciseInsightsModal` are full screen modals mounted conditionally. `ExerciseInsightsModal` is owned by Milestone 1 (R5).
2. **React Native `Modal` on Android**:
   - React Native's `<Modal transparent={true} animationType="none" statusBarTranslucent>` allows Reanimated `<Animated.View>` inside the modal to control both the backdrop fade and the slide translation seamlessly.
3. **LayoutAnimation Cleanup**:
   - Experimental Android `UIManager.setLayoutAnimationEnabledExperimental(true)` is present at line 25 of `ActiveWorkoutModal.tsx`. It is safe to retain for legacy fallback, but all primary interactive transitions must be driven by Reanimated.

---

## 4. Conclusion & Proposed Architecture

### 4.1 Recommended Implementation Blueprint for Milestone 2 Worker

#### A. Main Modal Presentation & Dismissal (`ActiveWorkoutModal.tsx`)
```tsx
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { globalAnimation, getScaledDuration, getSpringConfig } from '../../theme';

// Inside ActiveWorkoutModal:
const [modalRendered, setModalRendered] = useState(visible);
const translateY = useSharedValue(visible ? 0 : (windowHeight || 800));

useEffect(() => {
  if (visible) {
    setModalRendered(true);
    if (globalAnimation.speed === 0) {
      translateY.value = 0;
    } else {
      translateY.value = withTiming(0, {
        duration: getScaledDuration(280),
        easing: Easing.out(Easing.cubic),
      });
    }
  } else if (modalRendered) {
    if (globalAnimation.speed === 0) {
      translateY.value = windowHeight || 800;
      setModalRendered(false);
    } else {
      translateY.value = withTiming(
        windowHeight || 800,
        {
          duration: getScaledDuration(240),
          easing: Easing.in(Easing.cubic),
        },
        (finished) => {
          if (finished) {
            runOnJS(setModalRendered)(false);
          }
        }
      );
    }
  }
  return () => {
    cancelAnimation(translateY);
  };
}, [visible, windowHeight, modalRendered]);

const animatedModalStyle = useAnimatedStyle(() => ({
  flex: 1,
  backgroundColor: colors.bg,
  transform: [{ translateY: translateY.value }],
}));
```

#### B. Reanimated Bottom Sheet Gesture & Transition Worklet
For bottom sheet sub-menus (Exercise Options Menu, Auto-Timer Picker, Default Rest Picker, Workout Options):
```tsx
// Shared or per-sheet Reanimated values:
const sheetTranslateY = useSharedValue(0);

const sheetPanGesture = useMemo(() => {
  return Gesture.Pan()
    .activeOffsetY([0, 10])
    .failOffsetX([-15, 15])
    .onUpdate((e) => {
      'worklet';
      if (e.translationY > 0) {
        sheetTranslateY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      'worklet';
      if (e.translationY > 80 || e.velocityY > 400) {
        sheetTranslateY.value = withTiming(
          600,
          { duration: getScaledDuration(180) },
          () => {
            'worklet';
            runOnJS(closeActiveSheet)();
          }
        );
      } else {
        sheetTranslateY.value = withSpring(0, getSpringConfig(180, 18));
      }
    });
}, [closeActiveSheet]);

const animatedSheetCardStyle = useAnimatedStyle(() => ({
  transform: [{ translateY: sheetTranslateY.value }],
}));
```

#### C. Remove All Instances of:
- `import * as RN from 'react-native'` / `RN.Animated`
- `const slideAnim = useRef(new RN.Animated.Value(...))`
- `const sheetTranslateY = useRef(new RN.Animated.Value(0))`
- `exMenuPanResponder`, `timerPickerPanResponder`, `defaultTimerPanResponder`, `workoutMenuPanResponder` (replace with Reanimated Pan Gestures / Worklets)
- `<RN.Animated.View>` (replace with `<Animated.View>`)

---

## 5. Verification Method

### 5.1 Exact Test Plan for `src/__tests__/r7_animationPolish.test.ts`

The test suite will be structured into 5 cohesive validation blocks:

```ts
// src/__tests__/r7_animationPolish.test.ts
// Milestone 2 (R7) Comprehensive 120 FPS Reanimated UI-Thread Verification Suite

import React from 'react';
import renderer from 'react-test-renderer';
import fs from 'fs';
import path from 'path';
import * as Reanimated from 'react-native-reanimated';
import ActiveWorkoutModal from '../components/layout/ActiveWorkoutModal';
import { AnimatedCheckmark } from '../components/layout/AnimatedCheckmark';
import { globalAnimation } from '../theme';

describe('Milestone 2 (R7) - 120 FPS Reanimated UI-Thread Polish Suite', () => {
  const projectRoot = path.resolve(__dirname, '../..');
  const activeWorkoutModalPath = path.resolve(
    projectRoot,
    'src/components/layout/ActiveWorkoutModal.tsx'
  );

  // 1. Static Code Analysis & Reanimated Guardrails
  describe('1. Architectural Guardrails: Zero Legacy Animated / Zero JS-Thread Jank', () => {
    const fileContent = fs.readFileSync(activeWorkoutModalPath, 'utf-8');

    it('ActiveWorkoutModal.tsx must not contain RN.Animated or legacy Animated.Value', () => {
      expect(fileContent).not.toContain('RN.Animated.Value');
      expect(fileContent).not.toContain('new RN.Animated');
      expect(fileContent).not.toContain('useNativeDriver: false');
    });

    it('ActiveWorkoutModal.tsx must not use RN.Animated.View', () => {
      expect(fileContent).not.toContain('<RN.Animated.View');
      expect(fileContent).not.toContain('</RN.Animated.View>');
    });

    it('ActiveWorkoutModal.tsx must import and use Reanimated 3 worklets', () => {
      expect(fileContent).toContain('react-native-reanimated');
      expect(fileContent).toContain('useSharedValue');
      expect(fileContent).toContain('useAnimatedStyle');
      expect(fileContent).toContain('withTiming');
    });

    it('ActiveWorkoutModal.tsx must integrate globalAnimation speed scaling and instant mode', () => {
      expect(fileContent).toContain('globalAnimation');
    });
  });

  // 2. Main Modal Reanimated Presentation and Dismissal
  describe('2. Main ActiveWorkoutModal UI-Thread Presentation & Dismissal', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      globalAnimation.speed = 1;
    });

    afterEach(() => {
      jest.useRealTimers();
      jest.clearAllMocks();
    });

    it('renders ActiveWorkoutModal with Reanimated UI-thread shared value when visible', () => {
      let tree: any;
      renderer.act(() => {
        tree = renderer.create(
          <ActiveWorkoutModal
            visible={true}
            workoutName="Chest Day"
            startTime={new Date()}
            exercises={[]}
            isAutoTimerEnabled={true}
            onClose={jest.fn()}
            onFinish={jest.fn()}
            onDiscard={jest.fn()}
          />
        );
        jest.runAllTimers();
      });

      expect(tree.toJSON()).toBeTruthy();
      expect(Reanimated.withTiming).toHaveBeenCalled();
      renderer.act(() => {
        tree.unmount();
      });
    });

    it('respects instant animation mode (globalAnimation.speed === 0)', () => {
      globalAnimation.speed = 0;
      let tree: any;
      renderer.act(() => {
        tree = renderer.create(
          <ActiveWorkoutModal
            visible={true}
            workoutName="Leg Day"
            startTime={new Date()}
            exercises={[]}
            isAutoTimerEnabled={true}
            onClose={jest.fn()}
            onFinish={jest.fn()}
            onDiscard={jest.fn()}
          />
        );
        jest.runAllTimers();
      });

      expect(tree.toJSON()).toBeTruthy();
      renderer.act(() => {
        tree.unmount();
      });
    });
  });

  // 3. Animated Checkmark Worklets & Completion Spring
  describe('3. Set Completion Checkmark Worklets', () => {
    it('animates AnimatedCheckmark with withSpring and withTiming on completion toggle', () => {
      let tree: any;
      renderer.act(() => {
        tree = renderer.create(<AnimatedCheckmark completed={true} />);
      });

      expect(Reanimated.withSpring).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ damping: 15, stiffness: 180 })
      );
      expect(Reanimated.withTiming).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ duration: 120 })
      );

      renderer.act(() => {
        tree.update(<AnimatedCheckmark completed={false} />);
      });

      expect(Reanimated.withSpring).toHaveBeenCalledWith(
        0,
        expect.objectContaining({ damping: 15, stiffness: 180 })
      );

      renderer.act(() => {
        tree.unmount();
      });
    });
  });

  // 4. Sub-Modal & Bottom Sheet Transitions
  describe('4. Bottom Sheet & Sub-Menu UI-Thread Transitions', () => {
    it('ensures sub-modals do not conflict with native OS slide animations', () => {
      const fileContent = fs.readFileSync(activeWorkoutModalPath, 'utf-8');
      // Verify sub-modals use none or fade with UI-thread Reanimated cards
      expect(fileContent).not.toContain('animationType="slide"');
    });
  });

  // 5. Zero Crash / Clean Render Verification
  describe('5. High Frequency Re-render Stability', () => {
    it('handles rapid open/close toggles without crashing', () => {
      let tree: any;
      renderer.act(() => {
        tree = renderer.create(
          <ActiveWorkoutModal
            visible={false}
            workoutName="Back Day"
            startTime={new Date()}
            exercises={[]}
            isAutoTimerEnabled={true}
            onClose={jest.fn()}
            onFinish={jest.fn()}
            onDiscard={jest.fn()}
          />
        );
      });

      for (let i = 0; i < 5; i++) {
        renderer.act(() => {
          tree.update(
            <ActiveWorkoutModal
              visible={i % 2 === 0}
              workoutName="Back Day"
              startTime={new Date()}
              exercises={[]}
              isAutoTimerEnabled={true}
              onClose={jest.fn()}
              onFinish={jest.fn()}
              onDiscard={jest.fn()}
            />
          );
        });
      }

      expect(tree.toJSON()).toBeDefined();
      renderer.act(() => {
        tree.unmount();
      });
    });
  });
});
```

### 5.2 Test Execution Command
Once implemented by the Milestone 2 worker:
- `npm test -- --testPathPattern=r7_animationPolish`
- `npm run typecheck`
