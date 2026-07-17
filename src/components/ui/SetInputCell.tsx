import React, { useImperativeHandle, forwardRef, useEffect, useRef } from 'react';
import { Pressable, View, Text, StyleSheet, StyleProp, ViewStyle, TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  cancelAnimation,
} from 'react-native-reanimated';
import { colors, font } from '../../theme';
import { keyboardValueStore } from '../../utils/keyboardValueStore';

export interface SetInputCellHandle {
  focus: () => void;
}

interface SetInputCellProps {
  value: string;
  placeholder: string;
  isActive: boolean;
  isCompleted: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  testID?: string;
}

const Caret = () => {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 530 }),
        withTiming(1, { duration: 530 })
      ),
      -1,
      false
    );
    return () => {
      cancelAnimation(opacity);
    };
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      opacity: opacity.value,
    };
  });

  return (
    <Animated.View
      style={[
        styles.caret,
        animatedStyle,
      ]}
    />
  );
};

const compareProps = (prevProps: SetInputCellProps, nextProps: SetInputCellProps) => {
  // If active state changes, we must re-render
  if (prevProps.isActive !== nextProps.isActive) return false;
  
  // If completion state changes, we must re-render
  if (prevProps.isCompleted !== nextProps.isCompleted) return false;
  
  // If testID, style, or placeholder changes, we must re-render
  if (prevProps.testID !== nextProps.testID) return false;
  if (prevProps.style !== nextProps.style) return false;
  if (prevProps.textStyle !== nextProps.textStyle) return false;
  if (prevProps.onPress !== nextProps.onPress) return false;
  if (prevProps.placeholder !== nextProps.placeholder) return false;

  // If the cell is active, we bypass any changes to the 'value' prop
  // because the native ref is handling updates directly.
  if (nextProps.isActive) {
    return true; // no need to re-render
  }

  // If the cell is not active, we must re-render if the value changes
  return prevProps.value === nextProps.value;
};

export const SetInputCell = React.memo(forwardRef<SetInputCellHandle, SetInputCellProps>(({
  value,
  placeholder,
  isActive,
  isCompleted,
  onPress,
  style,
  textStyle,
  testID,
}, ref) => {
  useImperativeHandle(ref, () => ({
    focus: () => {
      if (!isCompleted) {
        onPress();
      }
    },
  }), [onPress, isCompleted]);

  const textRef = useRef<any>(null);

  useEffect(() => {
    if (isActive) {
      return keyboardValueStore.subscribe((newValue: string) => {
        // Direct Native Element Ref Mutation (Instant Sub-millisecond Native Update)
        if (textRef.current) {
          if (typeof (textRef.current as any).textContent !== 'undefined') {
            (textRef.current as any).textContent = newValue || placeholder;
          } else if (typeof (textRef.current as any).setNativeProps === 'function') {
            (textRef.current as any).setNativeProps({ text: newValue || placeholder });
          }
        }

        // Benchmark: measure keystroke render time
        try {
          if (typeof performance !== 'undefined' && typeof performance.mark === 'function') {
            performance.mark('keystroke-end');
            performance.measure('keystroke-render', 'keystroke-start', 'keystroke-end');
            const measures = performance.getEntriesByName('keystroke-render');
            if (measures.length > 0) {
              const duration = measures[measures.length - 1].duration;
              console.log(`[BENCHMARK] Keystroke render took: ${duration.toFixed(2)}ms`);
            }
            performance.clearMarks('keystroke-start');
            performance.clearMarks('keystroke-end');
            performance.clearMeasures('keystroke-render');
          }
        } catch (_) {}
      });
    }
  }, [isActive, placeholder]);

  const showPlaceholder = !isActive && value === '';
  const displayValue = value !== '' ? value : placeholder;

  return (
    <Pressable
      testID={testID}
      style={[
        styles.cellContainer,
        style,
        isActive && styles.activeCell,
      ]}
      onPress={onPress}
      disabled={isCompleted}
    >
      <View style={styles.row}>
        <Text
          ref={textRef}
          style={[
            styles.text,
            textStyle,
            showPlaceholder && styles.placeholderText,
            isCompleted && styles.completedText,
          ]}
        >
          {displayValue}
        </Text>
        {isActive && <Caret />}
      </View>
    </Pressable>
  );
}), compareProps);

const styles = StyleSheet.create({
  cellContainer: {
    height: '100%',
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeCell: {
    borderColor: colors.accent,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    width: '100%',
  },
  text: {
    color: colors.textPrimary,
    fontFamily: 'monospace',
    fontSize: font.sizes.sm,
  },
  placeholderText: {
    color: colors.textSecondary,
    opacity: 0.5,
  },
  completedText: {
    textDecorationLine: 'line-through',
    color: colors.textMuted,
  },
  caret: {
    width: 2,
    height: '70%',
    backgroundColor: colors.accent,
    marginLeft: 2,
  },
});
