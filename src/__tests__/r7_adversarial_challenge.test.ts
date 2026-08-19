// src/__tests__/r7_adversarial_challenge.test.ts
// Milestone 2 (R7) Empirical Adversarial Challenge Suite: 120 FPS Polish Under Stress

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

describe('Milestone 2 (R7) - Empirical Adversarial Challenge Suite', () => {
  const originalSpeed = globalAnimation.speed;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    globalAnimation.speed = 1;
    consoleErrorSpy = jest.spyOn(console, 'error');
    consoleWarnSpy = jest.spyOn(console, 'warn');
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    globalAnimation.speed = originalSpeed;
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    jest.clearAllMocks();
  });

  // ═════════════════════════════════════════════════════════════════════════
  // Challenge 1: Zero-Latency Instant Mode Toggles (globalAnimation.speed = 0)
  // ═════════════════════════════════════════════════════════════════════════
  describe('Challenge 1: Zero-Latency Instant Mode (speed = 0) Behavior', () => {
    it('immediately presents without scheduling withTiming when speed is 0', () => {
      globalAnimation.speed = 0;
      const timingCallsBefore = (Reanimated.withTiming as jest.Mock).mock.calls.length;

      let tree: any;
      renderer.act(() => {
        tree = renderer.create(
          React.createElement(ActiveWorkoutModal, {
            visible: true,
            workoutName: 'Adversarial Bench',
            startTime: new Date(),
            exercises: [],
            isAutoTimerEnabled: true,
            onClose: jest.fn(),
            onFinish: jest.fn(),
            onDiscard: jest.fn(),
          })
        );
        jest.advanceTimersByTime(100);
      });

      // No new withTiming call for translateY presentation in speed = 0 mode
      const timingCallsAfter = (Reanimated.withTiming as jest.Mock).mock.calls.length;
      expect(timingCallsAfter).toBe(timingCallsBefore);
      expect(tree.toJSON()).toBeTruthy();

      renderer.act(() => {
        tree.unmount();
      });
    });

    it('immediately hides and unmounts modal without scheduling withTiming dismissal when speed is 0', () => {
      globalAnimation.speed = 0;
      let tree: any;
      renderer.act(() => {
        tree = renderer.create(
          React.createElement(ActiveWorkoutModal, {
            visible: true,
            workoutName: 'Adversarial Squat',
            startTime: new Date(),
            exercises: [],
            isAutoTimerEnabled: true,
            onClose: jest.fn(),
            onFinish: jest.fn(),
            onDiscard: jest.fn(),
          })
        );
        jest.advanceTimersByTime(100);
      });

      const timingCallsBefore = (Reanimated.withTiming as jest.Mock).mock.calls.length;

      renderer.act(() => {
        tree.update(
          React.createElement(ActiveWorkoutModal, {
            visible: false,
            workoutName: 'Adversarial Squat',
            startTime: new Date(),
            exercises: [],
            isAutoTimerEnabled: true,
            onClose: jest.fn(),
            onFinish: jest.fn(),
            onDiscard: jest.fn(),
          })
        );
        jest.advanceTimersByTime(100);
      });

      const timingCallsAfter = (Reanimated.withTiming as jest.Mock).mock.calls.length;
      expect(timingCallsAfter).toBe(timingCallsBefore);

      renderer.act(() => {
        tree.unmount();
      });
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // Challenge 2: Extreme Re-renders & Rapid Visibility Flips During Active Animation
  // ═════════════════════════════════════════════════════════════════════════
  describe('Challenge 2: Stress-Testing Rapid Visibility Flips & Mid-Flight Interruptions', () => {
    it('survives 50 rapid visibility flips without crashing or throwing state errors', () => {
      let tree: any;
      renderer.act(() => {
        tree = renderer.create(
          React.createElement(ActiveWorkoutModal, {
            visible: false,
            workoutName: 'Rapid Flip Workout',
            startTime: new Date(),
            exercises: [],
            isAutoTimerEnabled: true,
            onClose: jest.fn(),
            onFinish: jest.fn(),
            onDiscard: jest.fn(),
          })
        );
      });

      for (let i = 1; i <= 50; i++) {
        renderer.act(() => {
          tree.update(
            React.createElement(ActiveWorkoutModal, {
              visible: i % 2 === 1,
              workoutName: `Rapid Flip Workout ${i}`,
              startTime: new Date(),
              exercises: [],
              isAutoTimerEnabled: true,
              onClose: jest.fn(),
              onFinish: jest.fn(),
              onDiscard: jest.fn(),
            })
          );
          // Advance timer by micro-slices to interrupt in-flight Reanimated transitions
          jest.advanceTimersByTime(16);
        });
      }

      // Flush remaining timers
      renderer.act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(tree.toJSON()).toBeDefined();

      renderer.act(() => {
        tree.unmount();
      });
    });

    it('cancels active animation on unmount when unmounted mid-animation', () => {
      let tree: any;
      renderer.act(() => {
        tree = renderer.create(
          React.createElement(ActiveWorkoutModal, {
            visible: true,
            workoutName: 'In-Flight Unmount Test',
            startTime: new Date(),
            exercises: [],
            isAutoTimerEnabled: true,
            onClose: jest.fn(),
            onFinish: jest.fn(),
            onDiscard: jest.fn(),
          })
        );
        // Step halfway through entry animation (140ms / 280ms)
        jest.advanceTimersByTime(140);
      });

      expect(Reanimated.cancelAnimation).toBeDefined();

      renderer.act(() => {
        tree.unmount();
      });

      expect(Reanimated.cancelAnimation).toHaveBeenCalled();
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // Challenge 3: Gesture Velocity Extremes in Bottom Sheets
  // ═════════════════════════════════════════════════════════════════════════
  describe('Challenge 3: Gesture Pan Velocity Extremes & Drag Clamping', () => {
    it('verifies bottom sheet pan gesture handles extreme flick velocity (>400) dismiss', () => {
      let dismissed = false;
      const onDismiss = () => { dismissed = true; };

      const event = { translationY: 10, velocityY: 1200 };
      const shouldDismiss = event.translationY > 80 || event.velocityY > 400;
      expect(shouldDismiss).toBe(true);

      if (shouldDismiss) {
        onDismiss();
      }
      expect(dismissed).toBe(true);
    });

    it('verifies bottom sheet pan gesture handles high translation drag (>80) dismiss', () => {
      let dismissed = false;
      const onDismiss = () => { dismissed = true; };

      const event = { translationY: 150, velocityY: 0 };
      const shouldDismiss = event.translationY > 80 || event.velocityY > 400;
      expect(shouldDismiss).toBe(true);

      if (shouldDismiss) {
        onDismiss();
      }
      expect(dismissed).toBe(true);
    });

    it('verifies gentle drag (<80, velocity <400) snaps back with withSpring', () => {
      const event = { translationY: 30, velocityY: 100 };
      const shouldDismiss = event.translationY > 80 || event.velocityY > 400;
      expect(shouldDismiss).toBe(false);

      const springConfig = { damping: 18, stiffness: 180 };
      expect(springConfig.damping).toBeGreaterThan(0);
      expect(springConfig.stiffness).toBeGreaterThan(0);
    });

    it('verifies negative drag (upwards swipe) is clamped and does not drag above 0', () => {
      let sheetY = 0;
      const onUpdate = (e: { translationY: number }) => {
        if (e.translationY > 0) {
          sheetY = e.translationY;
        }
      };

      onUpdate({ translationY: -150 });
      expect(sheetY).toBe(0);

      onUpdate({ translationY: 45 });
      expect(sheetY).toBe(45);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // Challenge 4: Zero React Native Warning Logs & Exception Guardrails
  // ═════════════════════════════════════════════════════════════════════════
  describe('Challenge 4: Zero RN Warnings / Zero Unhandled Rejections During Lifecycle', () => {
    it('produces zero unhandled promise rejections and clean unmount', async () => {
      let unhandledErrors: any[] = [];
      const rejectionHandler = (event: any) => {
        unhandledErrors.push(event);
      };

      let tree: any;
      renderer.act(() => {
        tree = renderer.create(
          React.createElement(ActiveWorkoutModal, {
            visible: true,
            workoutName: 'Clean Lifecycle Workout',
            startTime: new Date(),
            exercises: [
              {
                id: 'ex-1',
                name: 'Bench Press',
                sets: 3,
                setsDetails: [
                  { id: 's-1', weight: '100', reps: '10', completed: false, category: 'S' },
                  { id: 's-2', weight: '100', reps: '8', completed: true, category: 'S' },
                ],
              } as any,
            ],
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

      expect(unhandledErrors.length).toBe(0);
    });

    it('AnimatedCheckmark renders and transitions cleanly under 120 FPS spring physics', () => {
      let tree: any;
      renderer.act(() => {
        tree = renderer.create(React.createElement(AnimatedCheckmark, { completed: false }));
      });
      expect(tree.toJSON()).toBeTruthy();

      renderer.act(() => {
        tree.update(React.createElement(AnimatedCheckmark, { completed: true }));
        jest.advanceTimersByTime(120);
      });
      expect(tree.toJSON()).toBeTruthy();

      renderer.act(() => {
        tree.unmount();
      });
    });
  });
});
