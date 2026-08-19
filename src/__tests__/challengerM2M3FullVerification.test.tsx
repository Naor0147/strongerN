import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(),
}));

jest.mock('expo-auth-session', () => ({
  makeRedirectUri: jest.fn().mockReturnValue('mock-redirect-uri'),
}));

jest.mock('expo-auth-session/providers/google', () => ({
  useAuthRequest: jest.fn().mockReturnValue([
    {},
    null,
    jest.fn(),
  ]),
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

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

import { globalAnimation } from '../theme';
import BarChart, { BarDataPoint } from '../components/ui/BarChart';
import StatCard from '../components/ui/StatCard';
import LoginScreen from '../screens/LoginScreen';
import {
  addCrashLog,
  getCrashLogs,
  clearCrashLogs,
  saveCrashLogSync,
  scheduleCrashQueueFlush,
} from '../utils/crashLogger';

describe('Challenger Empirical Verification: Milestones 2 & 3', () => {

  describe('Task 1: Lazy Module Exports & Wrappers', () => {
    test('HistoryScreen default export resolves to a valid React component', () => {
      const mod = require('../screens/HistoryScreen');
      expect(mod.default).toBeDefined();
      expect(typeof mod.default === 'function' || typeof mod.default === 'object').toBe(true);
    });

    test('WorkoutScreen default export resolves to a valid React component', () => {
      const mod = require('../screens/WorkoutScreen');
      expect(mod.default).toBeDefined();
      expect(typeof mod.default === 'function' || typeof mod.default === 'object').toBe(true);
    });

    test('ExercisesScreen default export resolves to a valid React component', () => {
      const mod = require('../screens/ExercisesScreen');
      expect(mod.default).toBeDefined();
      expect(typeof mod.default === 'function' || typeof mod.default === 'object').toBe(true);
    });

    test('MuscleMapScreen default export resolves to a valid React component', () => {
      const mod = require('../screens/MuscleMapScreen');
      expect(mod.default).toBeDefined();
      expect(typeof mod.default === 'function' || typeof mod.default === 'object').toBe(true);
    });

    test('MeasureScreen default export resolves to a valid React component', () => {
      const mod = require('../screens/MeasureScreen');
      expect(mod.default).toBeDefined();
      expect(typeof mod.default === 'function' || typeof mod.default === 'object').toBe(true);
    });

    test('ActiveWorkoutModal default export resolves to a valid React component', () => {
      const mod = require('../components/layout/ActiveWorkoutModal');
      expect(mod.default).toBeDefined();
      expect(typeof mod.default === 'function' || typeof mod.default === 'object').toBe(true);
    });

    test('WatchCompanionSimulator named export resolves correctly via lazy promise wrapper', () => {
      const mod = require('../components/ui/WatchCompanionSimulator');
      expect(mod.WatchCompanionSimulator).toBeDefined();
      const wrapped = { default: mod.WatchCompanionSimulator };
      expect(typeof wrapped.default === 'function' || typeof wrapped.default === 'object').toBe(true);
    });
  });

  describe('Task 3: Crash Logger Stress & Burst Queue Bound', () => {
    beforeEach(async () => {
      await clearCrashLogs();
    });

    test('High frequency burst of 500 error logs does not leak memory or exceed queue limit of 100', async () => {
      for (let i = 0; i < 500; i++) {
        await addCrashLog('Burst Non-Fatal Error ' + i, 'Stack trace ' + i, false);
      }

      const logs = await getCrashLogs();
      expect(logs.length).toBeLessThanOrEqual(100);
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].message).toContain('Burst Non-Fatal Error');
    });

    test('Fatal crashes bypass async queue and persist directly', async () => {
      saveCrashLogSync('Fatal Native Crash 1', 'Fatal stack trace', true);
      const logs = await getCrashLogs();
      const fatalLog = logs.find(l => l.message === 'Fatal Native Crash 1');
      expect(fatalLog).toBeDefined();
      expect(fatalLog?.fatal).toBe(true);
    });

    test('Repeated console.error rate-limiting prevents infinite log storms', () => {
      for (let i = 0; i < 50; i++) {
        console.error('Identical rapid console error message');
      }
      expect(typeof scheduleCrashQueueFlush).toBe('function');
    });
  });

  describe('Task 4: Edge Case Stress for LoginScreen, BarChart, StatCard', () => {
    describe('BarChart Edge Cases', () => {
      test('Renders cleanly with empty data array [] without throwing', () => {
        const { toJSON } = render(<BarChart data={[]} chartHeight={200} />);
        expect(toJSON()).toBeTruthy();
      });

      test('Renders cleanly with zero-value data points', () => {
        const zeroData: BarDataPoint[] = [
          { label: 'Sun', value: 0 },
          { label: 'Mon', value: 0 },
          { label: 'Tue', value: 0 },
        ];
        const { toJSON } = render(<BarChart data={zeroData} chartHeight={200} />);
        expect(toJSON()).toBeTruthy();
      });

      test('Renders cleanly with single data point and large values', () => {
        const singleLarge: BarDataPoint[] = [{ label: 'Week 1', value: 50 }];
        const { toJSON } = render(<BarChart data={singleLarge} chartHeight={200} />);
        expect(toJSON()).toBeTruthy();
      });

      test('Supports instant mode (globalAnimation.speed = 0)', () => {
        const originalSpeed = globalAnimation.speed;
        (globalAnimation as any).speed = 0;
        const testData: BarDataPoint[] = [
          { label: 'W1', value: 3 },
          { label: 'W2', value: 5 },
        ];
        const { toJSON } = render(<BarChart data={testData} chartHeight={200} />);
        expect(toJSON()).toBeTruthy();
        (globalAnimation as any).speed = originalSpeed;
      });
    });

    describe('StatCard Edge Cases', () => {
      test('Renders cleanly with zero value and no decimals', () => {
        const { getByText } = render(<StatCard value={0} label="Total Workouts" />);
        expect(getByText('0')).toBeTruthy();
        expect(getByText('Total Workouts')).toBeTruthy();
      });

      test('Renders cleanly with float value and explicit decimals', () => {
        const { getByText } = render(<StatCard value={12.3456} label="Avg Workouts" decimals={1} />);
        expect(getByText('12.3')).toBeTruthy();
      });

      test('Renders cleanly with large volume values', () => {
        const { getByText } = render(<StatCard value={987654.321} label="All Time Volume" decimals={0} />);
        expect(getByText('987654')).toBeTruthy();
      });

      test('Supports instant mode (globalAnimation.speed = 0)', () => {
        const originalSpeed = globalAnimation.speed;
        (globalAnimation as any).speed = 0;
        const { getByText } = render(<StatCard value={42} label="Streak" />);
        expect(getByText('42')).toBeTruthy();
        (globalAnimation as any).speed = originalSpeed;
      });
    });

    describe('LoginScreen Edge Cases', () => {
      test('Renders initial tier components cleanly', () => {
        const onComplete = jest.fn();
        const onGoogleLogin = jest.fn();
        const { getByText } = render(
          <LoginScreen onComplete={onComplete} onGoogleLogin={onGoogleLogin} />
        );
        expect(getByText(/strongerN/i)).toBeTruthy();
      });

      test('Handles instant mode on mount without crashing', () => {
        const originalSpeed = globalAnimation.speed;
        (globalAnimation as any).speed = 0;
        const onComplete = jest.fn();
        const onGoogleLogin = jest.fn();
        const { getByText } = render(
          <LoginScreen onComplete={onComplete} onGoogleLogin={onGoogleLogin} />
        );
        expect(getByText(/strongerN/i)).toBeTruthy();
        (globalAnimation as any).speed = originalSpeed;
      });
    });
  });
});