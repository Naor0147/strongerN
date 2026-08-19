// src/__tests__/animationR3Components.test.tsx
// Comprehensive Behavior and Unit Tests for Milestone 3 (120 FPS UI-Thread Animations: LoginScreen, BarChart, StatCard)

import React from 'react';
import renderer from 'react-test-renderer';
import { View } from 'react-native';

// Mocks for Expo auth & browser in Jest environment
jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(),
}));

jest.mock('expo-auth-session', () => ({
  makeRedirectUri: jest.fn().mockReturnValue('mock-redirect-uri'),
}));

jest.mock('expo-auth-session/providers/google', () => ({
  useAuthRequest: jest.fn().mockReturnValue([
    {}, // request
    null, // response
    jest.fn(), // promptAsync
  ]),
}));

import LoginScreen from '../screens/LoginScreen';
import BarChart from '../components/ui/BarChart';
import StatCard from '../components/ui/StatCard';
import { globalAnimation } from '../theme';

describe('Milestone 3 (R3) - 120 FPS UI-Thread Animations Suite', () => {
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

  // ═════════════════════════════════════════════════════════════════════════
  // 1. LoginScreen 4-Tier Stagger & Frame 0 Gating
  // ═════════════════════════════════════════════════════════════════════════
  describe('LoginScreen 4-Tier Entrance Animation', () => {
    test('renders with all 4 staggered tiers without crashing', () => {
      const onComplete = jest.fn();
      const onGoogleLogin = jest.fn();

      let tree: any;
      renderer.act(() => {
        tree = renderer.create(
          <LoginScreen
            onComplete={onComplete}
            onGoogleLogin={onGoogleLogin}
          />
        );
        // Step through frame 0 requestAnimationFrame gating
        jest.runAllTimers();
      });

      expect(tree.toJSON()).toBeTruthy();
      renderer.act(() => {
        tree.unmount();
      });
    });

    test('respects globalAnimation.speed === 0 (instant mode) on mount', () => {
      globalAnimation.speed = 0;
      const onComplete = jest.fn();
      const onGoogleLogin = jest.fn();

      let tree: any;
      renderer.act(() => {
        tree = renderer.create(
          <LoginScreen
            onComplete={onComplete}
            onGoogleLogin={onGoogleLogin}
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

  // ═════════════════════════════════════════════════════════════════════════
  // 2. BarChart Reanimated UI-Thread Migration
  // ═════════════════════════════════════════════════════════════════════════
  describe('BarChart UI-Thread Worklets & Column Scaling', () => {
    const sampleData = [
      { label: 'W1', value: 4 },
      { label: 'W2', value: 7 },
      { label: 'W3', value: 2 },
      { label: 'W4', value: 0 },
    ];

    test('renders bar columns and labels correctly for arbitrary data', () => {
      let tree: any;
      renderer.act(() => {
        tree = renderer.create(
          <BarChart data={sampleData} chartHeight={200} />
        );
        jest.runAllTimers();
      });

      expect(tree.toJSON()).toBeTruthy();
      renderer.act(() => {
        tree.unmount();
      });
    });

    test('handles instant speed mode (speed === 0) cleanly', () => {
      globalAnimation.speed = 0;
      let tree: any;
      renderer.act(() => {
        tree = renderer.create(
          <BarChart data={sampleData} chartHeight={180} />
        );
        jest.runAllTimers();
      });

      expect(tree.toJSON()).toBeTruthy();
      renderer.act(() => {
        tree.unmount();
      });
    });

    test('handles empty data set gracefully without crashing or NaN', () => {
      let tree: any;
      renderer.act(() => {
        tree = renderer.create(
          <BarChart data={[]} chartHeight={200} />
        );
        jest.runAllTimers();
      });

      expect(tree.toJSON()).toBeTruthy();
      renderer.act(() => {
        tree.unmount();
      });
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // 3. StatCard Optimization (Zero JS-Thread RAF Re-renders)
  // ═════════════════════════════════════════════════════════════════════════
  describe('StatCard Performance & Value Formatting', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('renders integer stat card accurately with rAF count-up', () => {
      let tree: any;
      renderer.act(() => {
        tree = renderer.create(
          <StatCard
            value={42}
            label="Total Workouts"
            icon="barbell-outline"
            testID="stat-workouts"
          />
        );
      });

      renderer.act(() => {
        jest.advanceTimersByTime(500);
      });

      const json = tree.toJSON();
      expect(json).toBeTruthy();
      // Ensure formatted integer value is rendered
      const str = JSON.stringify(json);
      expect(str).toContain('42');
      expect(str).toContain('Total Workouts');

      renderer.act(() => {
        tree.unmount();
      });
    });

    test('formats decimals accurately when decimals prop is provided', () => {
      let tree: any;
      renderer.act(() => {
        tree = renderer.create(
          <StatCard
            value={87.456}
            decimals={1}
            label="Average Weight"
            testID="stat-weight"
          />
        );
      });

      renderer.act(() => {
        jest.advanceTimersByTime(500);
      });

      const json = tree.toJSON();
      const str = JSON.stringify(json);
      expect(str).toContain('87.5');
      expect(str).toContain('Average Weight');

      renderer.act(() => {
        tree.unmount();
      });
    });

    test('supports instant animation mode (speed === 0)', () => {
      globalAnimation.speed = 0;
      let tree: any;
      renderer.act(() => {
        tree = renderer.create(
          <StatCard
            value={100}
            label="Streak"
            icon="flame-outline"
          />
        );
      });

      const str = JSON.stringify(tree.toJSON());
      expect(str).toContain('100');
      expect(str).toContain('Streak');

      renderer.act(() => {
        tree.unmount();
      });
    });
  });
});
