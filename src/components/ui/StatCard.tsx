// components/ui/StatCard.tsx
// Premium stat display card with icon, animated count-up number, and 120 FPS UI-thread entrance
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, font, spacing, radius, shadow, animation, globalAnimation, getScaledDuration } from '../../theme';

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
  const [displayVal, setDisplayVal] = React.useState(0);
  const prevValRef = useRef(0);

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

  useEffect(() => {
    const speed = (typeof globalAnimation !== 'undefined' && globalAnimation && typeof globalAnimation.speed === 'number')
      ? globalAnimation.speed
      : 1;

    if (speed === 0) {
      setDisplayVal(value);
      prevValRef.current = value;
      return;
    }

    const duration = animation.slow * speed;
    const startTime = Date.now();
    const startVal = prevValRef.current;
    let animId: number;

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out quad
      const easeProgress = progress * (2 - progress);
      const currentVal = startVal + (value - startVal) * easeProgress;

      setDisplayVal(parseFloat(currentVal.toFixed(decimals)));

      if (progress < 1) {
        animId = requestAnimationFrame(tick);
      } else {
        prevValRef.current = value;
      }
    };

    animId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(animId);
    };
  }, [value, decimals]);

  return (
    <Animated.View style={[styles.card, cardAnimStyle, style]} testID={testID}>
      {icon ? (
        <View style={[styles.iconWrap, { backgroundColor: iconColor + '20' }]}>
          <Ionicons name={icon} size={18} color={iconColor} />
        </View>
      ) : null}
      <Text style={styles.value} numberOfLines={1}>
        {decimals > 0 ? displayVal.toFixed(decimals) : Math.round(displayVal)}
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
