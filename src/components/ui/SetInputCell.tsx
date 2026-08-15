import React, { useImperativeHandle, forwardRef, useEffect, useRef } from 'react';
import { Pressable, View, Text, TextInput, Platform, StyleSheet, StyleProp, ViewStyle, TextStyle } from 'react-native';
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
import { activeInputStore } from '../../utils/activeInputStore';

export interface SetInputCellHandle {
  focus: () => void;
  measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => void;
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
  exIdx?: number;
  setIdx?: number;
  fieldName?: string;
  exerciseId?: string;
  setId?: string;
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
  }, [opacity]);

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
  if (prevProps.exIdx !== nextProps.exIdx || prevProps.setIdx !== nextProps.setIdx || prevProps.fieldName !== nextProps.fieldName) return false;
  if (prevProps.exerciseId !== nextProps.exerciseId || prevProps.setId !== nextProps.setId) return false;

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
  exIdx,
  setIdx,
  fieldName,
  exerciseId,
  setId,
}, ref) => {
  const pressableRef = useRef<View>(null);

  useImperativeHandle(ref, () => ({
    focus: () => {
      if (!isCompleted) {
        onPress();
      }
    },
    measureInWindow: (callback) => pressableRef.current?.measureInWindow(callback),
  }), [onPress, isCompleted]);

  const textRef = useRef<any>(null);

  useEffect(() => {
    if (isActive) {
      return keyboardValueStore.subscribe((newValue: string) => {
        const currentActive = activeInputStore.getActiveInput();
        if (
          currentActive &&
          exIdx !== undefined &&
          setIdx !== undefined &&
          fieldName !== undefined &&
          ((currentActive.exerciseId && currentActive.setId)
            ? currentActive.exerciseId !== exerciseId || currentActive.setId !== setId || currentActive.fieldName !== fieldName
            : currentActive.exIdx !== exIdx || currentActive.setIdx !== setIdx || currentActive.fieldName !== fieldName)
        ) {
          return;
        }

        // Direct Native Element Ref Mutation (Instant Sub-millisecond Native Update)
        if (textRef.current) {
          const isValEmpty = newValue.trim() === '';
          const targetColor = isValEmpty ? colors.textMuted : colors.textPrimary;
          const targetOpacity = 1;
          const targetText = isValEmpty ? placeholder : newValue;

          // Native text inputs (Android/iOS)
          if (typeof (textRef.current as any).setNativeProps === 'function') {
            (textRef.current as any).setNativeProps({
              text: targetText,
              style: {
                color: targetColor,
                opacity: targetOpacity,
              }
            });
          }
          // Direct DOM node updates for web fallback
          const element = (textRef.current as any)._node || textRef.current;
          if (element) {
            if (typeof element.value !== 'undefined') {
              element.value = targetText;
            }
            if (typeof element.textContent !== 'undefined') {
              element.textContent = targetText;
            }
            if (element.style) {
              element.style.color = targetColor;
              element.style.opacity = String(targetOpacity);
            }
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
  }, [isActive, placeholder, exIdx, setIdx, fieldName, exerciseId, setId, isCompleted]);

  useEffect(() => {
    if (textRef.current) {
      const isValEmpty = String(value ?? '').trim() === '';
      const targetColor = isValEmpty ? colors.textMuted : colors.textPrimary;
      const targetOpacity = 1;
      const targetText = isValEmpty ? placeholder : value;

      if (typeof (textRef.current as any).setNativeProps === 'function') {
        (textRef.current as any).setNativeProps({
          text: targetText,
          style: {
            color: targetColor,
            opacity: targetOpacity,
          }
        });
      }
      const element = (textRef.current as any)._node || textRef.current;
      if (element) {
        if (typeof element.value !== 'undefined') {
          element.value = targetText;
        }
        if (typeof element.textContent !== 'undefined') {
          element.textContent = targetText;
        }
        if (element.style) {
          element.style.color = targetColor;
          element.style.opacity = String(targetOpacity);
        }
      }
    }
  }, [isCompleted, value, placeholder, isActive]);

  const showPlaceholder = String(value ?? '').trim() === '';
  const displayValue = !showPlaceholder ? value : placeholder;

  return (
    <Pressable
      ref={pressableRef}
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
        {Platform.OS === 'web' ? (
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
        ) : (
        <TextInput
            ref={textRef}
            editable={false}
            pointerEvents="none"
            underlineColorAndroid="transparent"
            defaultValue={displayValue}
            style={[
              styles.text,
              textStyle,
              showPlaceholder && styles.placeholderText,
              isCompleted && styles.completedText,
              { padding: 0, textAlign: 'center' },
            ]}
          />
        )}
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
    color: colors.textMuted,
  },
  completedText: {
    textDecorationLine: 'line-through',
  },
  caret: {
    width: 2,
    height: '70%',
    backgroundColor: colors.accent,
    marginLeft: 2,
  },
});
