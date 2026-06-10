// components/ui/Card.tsx
import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { colors, radius, shadow, spacing } from '../../theme';

type CardVariant = 'default' | 'active' | 'accent' | 'highlight';

interface CardProps {
  children:   React.ReactNode;
  style?:     StyleProp<ViewStyle>;
  padding?:   number;
  /** Visual variant — 'active' adds accent border; 'accent' adds left accent bar */
  variant?:   CardVariant;
  testID?:    string;
}

const Card: React.FC<CardProps> = ({
  children,
  style,
  padding = spacing.lg,
  variant = 'default',
  testID,
}) => {
  const variantStyle: ViewStyle = (() => {
    switch (variant) {
      case 'active':    return { borderColor: colors.accent, borderWidth: 1.5 };
      case 'accent':    return { borderLeftColor: colors.accent, borderLeftWidth: 3 };
      case 'highlight': return { borderLeftColor: colors.accent, borderLeftWidth: 3 };
      default:          return {};
    }
  })();

  return (
    <View
      style={[styles.card, variantStyle, { padding }, style]}
      testID={testID}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius:    radius.md,
    borderWidth:     1,
    borderColor:     colors.border,
    overflow:        'hidden',
    ...(shadow.card as object),
  },
});

export default Card;
