// components/ui/IconButton.tsx
import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, ripple as rippleTokens } from '../../theme';
import PressableRow from './PressableRow';

interface IconButtonProps {
  name:               keyof typeof Ionicons.glyphMap;
  size?:              number;
  color?:             string;
  onPress?:           () => void;
  accessibilityLabel?: string;
  style?:             ViewStyle;
  testID?:            string;
  hitSlop?:           number | { top?: number; left?: number; bottom?: number; right?: number };
}

const DEFAULT_HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

const IconButton: React.FC<IconButtonProps> = ({
  name,
  size  = 22,
  color = colors.iconActive,
  onPress,
  accessibilityLabel,
  style,
  testID,
  hitSlop = DEFAULT_HIT_SLOP,
}) => (
  <PressableRow
    onPress={onPress}
    ripple={rippleTokens.borderless}
    style={[styles.btn, style]}
    accessibilityLabel={accessibilityLabel || `${name} button`}
    testID={testID}
    hitSlop={hitSlop}
  >
    <Ionicons name={name} size={size} color={color} />
  </PressableRow>
);

const styles = StyleSheet.create({
  btn: {
    padding:        8,
    minWidth:       44,
    minHeight:      44,
    borderRadius:   radius.full,
    alignItems:     'center',
    justifyContent: 'center',
  },
});

export default IconButton;
