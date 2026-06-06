// __tests__/ui-snapshots.test.tsx
import React from 'react';
import renderer from 'react-test-renderer';
import { View } from 'react-native';

import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import BarChart from '../components/ui/BarChart';

// Mock react-native completely for isolated snapshot testing of primitives
jest.mock('react-native', () => {
  const React = require('react');
  return {
    View: ({ children, style, ...props }: any) => React.createElement('View', { style, ...props }, children),
    Text: ({ children, style, ...props }: any) => React.createElement('Text', { style, ...props }, children),
    StyleSheet: {
      create: (styles: any) => styles,
    },
    Animated: {
      Value: class {
        val = 0;
        constructor(v: number) { this.val = v; }
        setValue(v: number) { this.val = v; }
        interpolate() { return 0; }
      },
      timing: () => ({ start: (cb: any) => cb && cb(), stop: () => {} }),
      spring: () => ({ start: (cb: any) => cb && cb(), stop: () => {} }),
      stagger: () => ({ start: (cb: any) => cb && cb(), stop: () => {} }),
      sequence: () => ({ start: (cb: any) => cb && cb(), stop: () => {} }),
      loop: () => ({ start: (cb: any) => cb && cb(), stop: () => {} }),
      View: ({ children, style, ...props }: any) => React.createElement('View', { style, ...props }, children),
    },
    Platform: {
      OS: 'ios',
      select: (obj: any) => obj.ios || obj.default || {},
    },
  };
});

// Mock expo-linear-gradient for BarChart testing
jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  return {
    LinearGradient: ({ children, ...props }: any) => React.createElement('LinearGradient', props, children),
  };
});

describe('UI Primitives Snapshot Tests', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Card Component', () => {
    test('renders default variant card correctly', () => {
      let tree: any;
      renderer.act(() => {
        tree = renderer.create(
          <Card variant="default">
            <View />
          </Card>
        );
      });
      expect(tree.toJSON()).toMatchSnapshot();
    });

    test('renders active variant card correctly', () => {
      let tree: any;
      renderer.act(() => {
        tree = renderer.create(
          <Card variant="active" padding={20}>
            <View />
          </Card>
        );
      });
      expect(tree.toJSON()).toMatchSnapshot();
    });

    test('renders highlight variant card correctly', () => {
      let tree: any;
      renderer.act(() => {
        tree = renderer.create(
          <Card variant="highlight">
            <View />
          </Card>
        );
      });
      expect(tree.toJSON()).toMatchSnapshot();
    });
  });

  describe('Badge Component', () => {
    test('renders default badge correctly', () => {
      let tree: any;
      renderer.act(() => {
        tree = renderer.create(<Badge label="WORKOUT" />);
      });
      expect(tree.toJSON()).toMatchSnapshot();
    });

    test('renders customized badge correctly', () => {
      let tree: any;
      renderer.act(() => {
        tree = renderer.create(
          <Badge label="PR" color="#FFD700" textColor="#0D0F14" />
        );
      });
      expect(tree.toJSON()).toMatchSnapshot();
    });
  });

  describe('BarChart Component', () => {
    test('renders bar chart with valid data correctly', () => {
      const mockData = [
        { label: 'Mon', value: 3 },
        { label: 'Tue', value: 5 },
        { label: 'Wed', value: 2 },
      ];
      
      let tree: any;
      renderer.act(() => {
        tree = renderer.create(
          <BarChart data={mockData} chartHeight={200} />
        );
        jest.runAllTimers();
      });
      expect(tree.toJSON()).toMatchSnapshot();
      
      renderer.act(() => {
        tree.unmount();
      });
    });
  });
});
