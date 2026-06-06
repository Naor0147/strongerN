// components/ui/PressableRow.tsx
// Unified pressable row — replaces scattered TouchableNativeFeedback/TouchableOpacity patterns.
// Supports testID for automated testing.
import React from 'react';
import {
  Pressable,
  View,
  StyleSheet,
  ViewStyle,
  StyleProp,
  PressableAndroidRippleConfig,
} from 'react-native';
import { ripple as rippleTokens, spacing } from '../../theme';

interface PressableRowProps {
  children:    React.ReactNode;
  onPress?:    () => void;
  style?:      StyleProp<ViewStyle>;
  /** Padding applied to the inner view */
  padding?:    number | { vertical?: number; horizontal?: number };
  /** Override ripple config */
  ripple?:     PressableAndroidRippleConfig;
  testID?:     string;
  accessibilityLabel?: string;
  accessibilityRole?:  'button' | 'link' | 'menuitem' | 'none';
  disabled?:   boolean;
}

const PressableRow: React.FC<PressableRowProps> = ({
  children,
  onPress,
  style,
  padding,
  ripple: rippleOverride,
  testID,
  accessibilityLabel,
  accessibilityRole = 'button',
  disabled,
}) => {
  const paddingStyle: ViewStyle = React.useMemo(() => {
    if (padding === undefined) return {};
    if (typeof padding === 'number') {
      return { padding };
    }
    return {
      paddingVertical:   padding.vertical   ?? spacing.lg,
      paddingHorizontal: padding.horizontal ?? spacing.lg,
    };
  }, [padding]);

  return (
    <Pressable
      onPress={onPress}
      android_ripple={rippleOverride ?? rippleTokens.surface}
      style={({ pressed }) => [
        styles.base,
        style,
        paddingStyle,
        pressed && styles.pressed,
      ]}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      disabled={disabled}
    >
      {children}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden', // required for ripple clipping
  },
  pressed: {
    opacity: 0.88,
  },
});

export default PressableRow;
