// components/ui/Badge.tsx
import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { colors, font, radius, spacing } from '../../theme';

interface BadgeProps {
  label:      string;
  color?:     string;
  textColor?: string;
  style?:     StyleProp<ViewStyle>;
  testID?:    string;
}

const Badge: React.FC<BadgeProps> = ({
  label,
  color     = colors.accent,
  textColor = colors.textPrimary,
  style,
  testID,
}) => (
  <View
    style={[
      styles.badge,
      {
        backgroundColor: color + '22',
        borderColor:     color,
        boxShadow:       '0px 0px 6px ' + color + '73',
      },
      style,
    ]}
    testID={testID}
  >
    <Text style={[styles.text, { color: textColor }]}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  badge: {
    borderRadius:    radius.full,
    borderWidth:     1,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    alignSelf:       'flex-start',
  },
  text: {
    fontSize:   font.sizes.xs,
    fontFamily: font.semibold,
    letterSpacing: 0.4,
  },
});

export default Badge;
