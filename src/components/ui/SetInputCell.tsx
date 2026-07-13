import React, { useImperativeHandle, forwardRef, useEffect } from 'react';
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

export const SetInputCell = React.memo(forwardRef<SetInputCellHandle, SetInputCellProps>(({
  value,
  placeholder,
  isActive,
  isCompleted,
  onPress,
  style,
  textStyle,
}, ref) => {
  useImperativeHandle(ref, () => ({
    focus: () => {
      if (!isCompleted) {
        onPress();
      }
    },
  }), [onPress, isCompleted]);

  const showPlaceholder = !isActive && value === '';
  const showValueText = value !== '' || showPlaceholder;
  const displayValue = value !== '' ? value : placeholder;

  return (
    <Pressable
      style={[
        styles.cellContainer,
        style,
        isActive && styles.activeCell,
      ]}
      onPress={onPress}
      disabled={isCompleted}
    >
      <View style={styles.row}>
        {showValueText && (
          <Text
            style={[
              styles.text,
              textStyle,
              showPlaceholder && styles.placeholderText,
              isCompleted && styles.completedText,
            ]}
          >
            {displayValue}
          </Text>
        )}
        {isActive && <Caret />}
      </View>
    </Pressable>
  );
}));

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
