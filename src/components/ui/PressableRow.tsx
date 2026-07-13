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
  /** Action slot that renders alongside the main pressable area, completely non-nested */
  actionSlot?: React.ReactNode;
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
  actionSlot,
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

  const { pressablePadding, actionPadding } = React.useMemo(() => {
    if (!actionSlot) {
      return { pressablePadding: paddingStyle, actionPadding: {} };
    }
    const vPadding = paddingStyle.paddingVertical ?? 0;
    const hPadding = paddingStyle.paddingHorizontal ?? 0;
    return {
      pressablePadding: {
        paddingVertical: vPadding,
        paddingLeft: hPadding,
        paddingRight: 0,
      },
      actionPadding: {
        paddingVertical: vPadding,
        paddingRight: hPadding,
        paddingLeft: spacing.xs,
      }
    };
  }, [actionSlot, paddingStyle]);

  if (actionSlot) {
    return (
      <View style={[styles.container, style]}>
        <Pressable
          onPress={onPress}
          android_ripple={rippleOverride ?? rippleTokens.surface}
          style={({ pressed }) => [
            styles.base,
            styles.pressableArea,
            pressablePadding,
            pressed && styles.pressed,
          ]}
          testID={testID}
          accessibilityLabel={accessibilityLabel}
          accessibilityRole={accessibilityRole}
          disabled={disabled}
        >
          {children}
        </Pressable>
        <View style={[styles.actionArea, actionPadding]}>
          {actionSlot}
        </View>
      </View>
    );
  }

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
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  base: {
    overflow: 'hidden', // required for ripple clipping
  },
  pressableArea: {
    flex: 1,
  },
  actionArea: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.88,
  },
});

export default React.memo(PressableRow);
