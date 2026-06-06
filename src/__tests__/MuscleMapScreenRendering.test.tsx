import React from 'react';
import renderer from 'react-test-renderer';
import MuscleMapScreen from '../screens/MuscleMapScreen';

jest.mock('react-native', () => {
  const React = require('react');
  return {
    View: ({ children, style, ...props }: any) => React.createElement('View', { style, ...props }, children),
    Text: ({ children, style, ...props }: any) => React.createElement('Text', { style, ...props }, children),
    ScrollView: ({ children, style, ...props }: any) => React.createElement('ScrollView', { style, ...props }, children),
    Pressable: ({ children, style, onPress, ...props }: any) => {
      return React.createElement('Pressable', { style, onPress, ...props }, children);
    },
    Image: ({ children, style, ...props }: any) => React.createElement('Image', { style, ...props }, children),
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
      parallel: (anims: any[]) => ({
        start: (cb: any) => {
          cb && cb();
        }
      }),
    },
    Platform: {
      OS: 'ios',
      select: (obj: any) => obj.ios || obj.default || {},
    },
    Dimensions: {
      get: jest.fn().mockReturnValue({ width: 375, height: 812 }),
    },
    useWindowDimensions: jest.fn().mockReturnValue({ width: 375, height: 812 }),
    PanResponder: {
      create: jest.fn().mockReturnValue({ panHandlers: {} }),
    },
    Alert: {
      alert: jest.fn(),
    },
  };
});

jest.mock('react-native-safe-area-context', () => {
  const inset = { top: 44, right: 0, bottom: 34, left: 0 };
  return {
    SafeAreaProvider: ({ children }: any) => children,
    SafeAreaView: ({ children }: any) => children,
    useSafeAreaInsets: () => inset,
  };
});

jest.mock('react-native-svg', () => {
  const React = require('react');
  const mockComponent = (name: string) => {
    const Component = ({ children, ...props }: any) => React.createElement(name, props, children);
    Component.displayName = name;
    return Component;
  };
  return {
    __esModule: true,
    default: mockComponent('Svg'),
    Svg: mockComponent('Svg'),
    Path: mockComponent('Path'),
    Ellipse: mockComponent('Ellipse'),
    Line: mockComponent('Line'),
    Defs: mockComponent('Defs'),
    RadialGradient: mockComponent('RadialGradient'),
    Stop: mockComponent('Stop'),
    G: mockComponent('G'),
  };
});

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

describe('MuscleMapScreen', () => {
  it('renders correctly and handles pressing a muscle group', () => {
    const weeklyMuscleSets = {
      Chest: 4,
      Back: 8,
    };
    const sessions = [
      {
        id: '1',
        title: 'Push Day',
        datetime: new Date().toISOString(),
        exercises: [
          { name: 'Bench Press', sets: 4, bestWeight: 80, bestReps: 8 },
        ],
      },
    ];
    const exercisesList = [
      { id: 'ex-1', name: 'Bench Press', muscleGroup: 'Chest', equipment: 'Barbell' },
      { id: 'ex-2', name: 'Pull-up', muscleGroup: 'Back', equipment: 'Bodyweight' },
    ];

    let tree: any;
    renderer.act(() => {
      tree = renderer.create(
        <MuscleMapScreen
          weeklyMuscleSets={weeklyMuscleSets}
          sessions={sessions}
          exercisesList={exercisesList}
        />
      );
    });

    expect(tree.toJSON()).toBeTruthy();

    // Find the pressable item in the legend representing Chest
    const instance = tree.root;
    const legendItems = instance.findAll((el: any) => el.type === 'Pressable');
    
    // Find Chest legend item and press it
    const chestLegend = legendItems.find((item: any) => {
      const texts = item.findAll((el: any) => el.type === 'Text');
      return texts.some((t: any) => t.props.children === 'Chest');
    });

    expect(chestLegend).toBeDefined();

    renderer.act(() => {
      chestLegend.props.onPress();
    });

    // Check if bottom sheet is shown with selected muscle
    const sheetTitle = instance.find((el: any) => el.props.style && el.props.style.color === '#EEF1F6' && el.props.children === 'CHEST');
    expect(sheetTitle).toBeDefined();
  });
});
