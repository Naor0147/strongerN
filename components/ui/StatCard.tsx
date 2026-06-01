// components/ui/StatCard.tsx
// Premium stat display card with icon, large animated count-up number, and label.
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, spacing, radius, shadow, animation } from '../../theme';

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
  // Animated count-up using Animated.Value + interpolation
  const anim   = useRef(new Animated.Value(0)).current;
  const valRef = useRef(0);

  useEffect(() => {
    Animated.timing(anim, {
      toValue:         value,
      duration:        animation.slow,
      useNativeDriver: false,
    }).start();
  }, [value, anim]);

  // Listen to native value for display
  const [displayVal, setDisplayVal] = React.useState(0);
  useEffect(() => {
    const listener = anim.addListener(({ value: v }) => {
      setDisplayVal(parseFloat(v.toFixed(decimals)));
    });
    return () => anim.removeListener(listener);
  }, [anim, decimals]);

  return (
    <View style={[styles.card, style]} testID={testID}>
      {icon ? (
        <View style={[styles.iconWrap, { backgroundColor: iconColor + '20' }]}>
          <Ionicons name={icon} size={18} color={iconColor} />
        </View>
      ) : null}
      <Text style={styles.value} numberOfLines={1}>
        {decimals > 0 ? displayVal.toFixed(decimals) : Math.round(displayVal)}
      </Text>
      <Text style={styles.label} numberOfLines={1}>{label}</Text>
    </View>
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

export default StatCard;
