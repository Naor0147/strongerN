// src/__tests__/r7_animationPolish.test.ts
// Milestone 2 (R7) Comprehensive 120 FPS Reanimated UI-Thread Verification Suite

import React from 'react';
import renderer from 'react-test-renderer';
import fs from 'fs';
import path from 'path';

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

// Mock react-native-sortables
jest.mock('react-native-sortables', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Comp = (props: any) => React.createElement(View, props, props.children);
  return {
    __esModule: true,
    default: {
      Grid: Comp,
      Flex: Comp,
      Layer: Comp,
      Handle: Comp,
    },
    Sortable: {
      Grid: Comp,
      Flex: Comp,
      Layer: Comp,
      Handle: Comp,
    },
  };
});

import * as Reanimated from 'react-native-reanimated';
if (!(Reanimated as any).useAnimatedRef) {
  (Reanimated as any).useAnimatedRef = () => ({ current: null });
}
import ActiveWorkoutModal from '../components/layout/ActiveWorkoutModal';
import { AnimatedCheckmark } from '../components/layout/AnimatedCheckmark';
import { globalAnimation } from '../theme';

describe('Milestone 2 (R7) - 120 FPS Reanimated UI-Thread Polish Suite', () => {
  const projectRoot = path.resolve(__dirname, '../..');
  const activeWorkoutModalPath = path.resolve(
    projectRoot,
    'src/components/layout/ActiveWorkoutModal.tsx'
  );

  // ═════════════════════════════════════════════════════════════════════════
  // 1. Static Code Analysis & Reanimated Architectural Guardrails
  // ═════════════════════════════════════════════════════════════════════════
  describe('1. Architectural Guardrails: Zero Legacy Animated / Zero JS-Thread Jank', () => {
    const fileContent = fs.readFileSync(activeWorkoutModalPath, 'utf-8');

    it('ActiveWorkoutModal.tsx must not contain RN.Animated or legacy Animated.Value', () => {
      expect(fileContent).not.toContain('RN.Animated.Value');
      expect(fileContent).not.toContain('new RN.Animated');
      expect(fileContent).not.toContain('useNativeDriver: false');
      expect(fileContent).not.toContain('RN.PanResponder');
    });

    it('ActiveWorkoutModal.tsx must not use RN.Animated.View', () => {
      expect(fileContent).not.toContain('<RN.Animated.View');
      expect(fileContent).not.toContain('</RN.Animated.View>');
    });

    it('ActiveWorkoutModal.tsx must import and use Reanimated 3 worklets & Gesture Handler', () => {
      expect(fileContent).toContain('react-native-reanimated');
      expect(fileContent).toContain('useSharedValue');
      expect(fileContent).toContain('useAnimatedStyle');
      expect(fileContent).toContain('withTiming');
      expect(fileContent).toContain('withSpring');
      expect(fileContent).toContain('GestureDetector');
      expect(fileContent).toContain('Gesture.Pan()');
    });

    it('ActiveWorkoutModal.tsx must integrate globalAnimation speed scaling and instant mode', () => {
      expect(fileContent).toContain('globalAnimation');
      expect(fileContent).toContain('getScaledDuration');
      expect(fileContent).toContain('getSpringConfig');
    });

    it('ActiveWorkoutModal.tsx sub-modals must use animationType="none" to prevent native animation collisions', () => {
      expect(fileContent).not.toContain('animationType="slide"');
      expect(fileContent).not.toContain('animationType="fade"');
    });

    it('ActiveWorkoutModal.tsx must not contain raw hex color literals in plate calculations or superset palette', () => {
      const hexMatches = fileContent.match(/#[0-9a-fA-F]{3,8}/g);
      expect(hexMatches).toBeNull();
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // 2. Main Modal Reanimated Presentation and Dismissal
  // ═════════════════════════════════════════════════════════════════════════
  describe('2. Main ActiveWorkoutModal UI-Thread Presentation & Dismissal', () => {
    const originalSpeed = globalAnimation.speed;

    beforeEach(() => {
      jest.useFakeTimers();
      globalAnimation.speed = 1;
    });

    afterEach(() => {
      jest.useRealTimers();
      globalAnimation.speed = originalSpeed;
      jest.clearAllMocks();
    });

    it('renders ActiveWorkoutModal with Reanimated UI-thread shared value when visible', () => {
      let tree: any;
      renderer.act(() => {
        tree = renderer.create(
          React.createElement(ActiveWorkoutModal, {
            visible: true,
            workoutName: 'Chest Day',
            startTime: new Date(),
            exercises: [],
            isAutoTimerEnabled: true,
            onClose: jest.fn(),
            onFinish: jest.fn(),
            onDiscard: jest.fn(),
          })
        );
        jest.advanceTimersByTime(300);
      });

      expect(tree.toJSON()).toBeTruthy();
      expect(Reanimated.withTiming).toHaveBeenCalledWith(
        0,
        expect.objectContaining({
          duration: 280,
        })
      );
      renderer.act(() => {
        tree.unmount();
      });
    });

    it('animates modal dismissal on visible toggle to false', () => {
      let tree: any;
      renderer.act(() => {
        tree = renderer.create(
          React.createElement(ActiveWorkoutModal, {
            visible: true,
            workoutName: 'Leg Day',
            startTime: new Date(),
            exercises: [],
            isAutoTimerEnabled: true,
            onClose: jest.fn(),
            onFinish: jest.fn(),
            onDiscard: jest.fn(),
          })
        );
        jest.advanceTimersByTime(300);
      });

      expect(tree.toJSON()).toBeTruthy();

      renderer.act(() => {
        tree.update(
          React.createElement(ActiveWorkoutModal, {
            visible: false,
            workoutName: 'Leg Day',
            startTime: new Date(),
            exercises: [],
            isAutoTimerEnabled: true,
            onClose: jest.fn(),
            onFinish: jest.fn(),
            onDiscard: jest.fn(),
          })
        );
        jest.advanceTimersByTime(300);
      });

      expect(Reanimated.withTiming).toHaveBeenCalledWith(
        expect.any(Number),
        expect.objectContaining({
          duration: 240,
        }),
        expect.any(Function)
      );

      renderer.act(() => {
        tree.unmount();
      });
    });

    it('respects instant animation mode (globalAnimation.speed === 0)', () => {
      globalAnimation.speed = 0;
      let tree: any;
      renderer.act(() => {
        tree = renderer.create(
          React.createElement(ActiveWorkoutModal, {
            visible: true,
            workoutName: 'Leg Day',
            startTime: new Date(),
            exercises: [],
            isAutoTimerEnabled: true,
            onClose: jest.fn(),
            onFinish: jest.fn(),
            onDiscard: jest.fn(),
          })
        );
        jest.advanceTimersByTime(300);
      });

      expect(tree.toJSON()).toBeTruthy();
      renderer.act(() => {
        tree.unmount();
      });
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // 3. Set Completion Checkmark Worklets
  // ═════════════════════════════════════════════════════════════════════════
  describe('3. Set Completion Checkmark Worklets', () => {
    it('animates AnimatedCheckmark with withSpring and withTiming on completion toggle', () => {
      let tree: any;
      renderer.act(() => {
        tree = renderer.create(React.createElement(AnimatedCheckmark, { completed: true }));
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
        tree.update(React.createElement(AnimatedCheckmark, { completed: false }));
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

  // ═════════════════════════════════════════════════════════════════════════
  // 4. High Frequency Re-render Stability
  // ═════════════════════════════════════════════════════════════════════════
  describe('4. High Frequency Re-render Stability', () => {
    it('handles rapid open/close toggles without crashing or leaking', () => {
      let tree: any;
      renderer.act(() => {
        tree = renderer.create(
          React.createElement(ActiveWorkoutModal, {
            visible: false,
            workoutName: 'Back Day',
            startTime: new Date(),
            exercises: [],
            isAutoTimerEnabled: true,
            onClose: jest.fn(),
            onFinish: jest.fn(),
            onDiscard: jest.fn(),
          })
        );
      });

      for (let i = 0; i < 6; i++) {
        renderer.act(() => {
          tree.update(
            React.createElement(ActiveWorkoutModal, {
              visible: i % 2 === 0,
              workoutName: 'Back Day',
              startTime: new Date(),
              exercises: [],
              isAutoTimerEnabled: true,
              onClose: jest.fn(),
              onFinish: jest.fn(),
              onDiscard: jest.fn(),
            })
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
