// components/ui/StatCard.tsx
// Premium stat display card with icon, direct formatted value, and 120 FPS UI-thread entrance
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, font, spacing, radius, shadow, globalAnimation, getScaledDuration } from '../../theme';

interface StatCardProps {
  value:      number;
  label:      string;
  icon?:      keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  /** Decimal places to display (default 0) */
  decimals?:  number;
  style?:     ViewStyle;
  testID?:    string;
}

const StatCard: React.FC<StatCardProps> = ({
  value,
  label,
  icon,
  iconColor = colors.accent,
  decimals = 0,
  style,
  testID,
}) => {
  const isInstant = typeof globalAnimation !== 'undefined' && globalAnimation && globalAnimation.speed === 0;
  const entranceAnim = useSharedValue(isInstant ? 1 : 0);

  useEffect(() => {
    if (isInstant) {
      entranceAnim.value = 1;
      return;
    }
    entranceAnim.value = withTiming(1, {
      duration: getScaledDuration(320),
      easing: Easing.out(Easing.quad),
    });
  }, [isInstant]);

  const cardAnimStyle = useAnimatedStyle(() => ({
    opacity: entranceAnim.value,
    transform: [
      { translateY: interpolate(entranceAnim.value, [0, 1], [12, 0]) },
    ],
  }));

  const formattedValue = decimals > 0 ? value.toFixed(decimals) : Math.round(value);

  return (
    <Animated.View style={[styles.card, cardAnimStyle, style]} testID={testID}>
      {icon ? (
        <View style={[styles.iconWrap, { backgroundColor: iconColor + '20' }]}>
          <Ionicons name={icon} size={18} color={iconColor} />
        </View>
      ) : null}
      <Text style={styles.value} numberOfLines={1}>
        {formattedValue}
      </Text>
      <Text style={styles.label} numberOfLines={1}>{label}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    flex:            1,
    backgroundColor: colors.surface,
    borderRadius:    radius.md,
    borderWidth:     1,
    borderColor:     colors.border,
    padding:         spacing.md,
    alignItems:      'center',
    ...(shadow.card as object),
  },
  iconWrap: {
    width:          34,
    height:         34,
    borderRadius:   radius.sm,
    alignItems:     'center',
    justifyContent: 'center',
    marginBottom:   spacing.sm,
  },
  value: {
    color:      colors.textPrimary,
    fontSize:   font.sizes.xl,
    fontFamily: font.bold,
    lineHeight: font.sizes.xl + 4,
  },
  label: {
    color:      colors.textSecondary,
    fontSize:   font.sizes.xs,
    fontFamily: font.regular,
    marginTop:  4,
    textAlign:  'center',
  },
});

export default React.memo(StatCard);
