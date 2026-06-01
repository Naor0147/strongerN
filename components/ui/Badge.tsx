// components/ui/Badge.tsx
import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { font, radius, spacing } from '../../theme';

interface BadgeProps {
  label:      string;
  color?:     string;
  textColor?: string;
  style?:     StyleProp<ViewStyle>;
  testID?:    string;
}

const Badge: React.FC<BadgeProps> = ({
  label,
  color     = '#4F8EF7',
  textColor = '#FFFFFF',
  style,
  testID,
}) => (
  <View
    style={[
      styles.badge,
      {
        backgroundColor: color + '22',
        borderColor:     color,
        shadowColor:     color,
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
    shadowOpacity:   0.45,
    shadowRadius:    6,
    shadowOffset:    { width: 0, height: 0 },
    elevation:       4,
    alignSelf:       'flex-start',
  },
  text: {
    fontSize:   font.sizes.xs,
    fontFamily: font.semibold,
    letterSpacing: 0.4,
  },
});

export default Badge;
