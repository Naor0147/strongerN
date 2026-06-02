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
}

const IconButton: React.FC<IconButtonProps> = ({
  name,
  size  = 22,
  color = colors.iconActive,
  onPress,
  accessibilityLabel,
  style,
  testID,
}) => (
  <PressableRow
    onPress={onPress}
    ripple={rippleTokens.borderless}
    style={[styles.btn, style]}
    accessibilityLabel={accessibilityLabel || `${name} button`}
    testID={testID}
  >
    <Ionicons name={name} size={size} color={color} />
  </PressableRow>
);

const styles = StyleSheet.create({
  btn: {
    padding:      8,
    borderRadius: radius.full,
    alignItems:   'center',
    justifyContent: 'center',
  },
});

export default IconButton;
