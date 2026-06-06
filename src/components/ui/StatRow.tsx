// components/ui/StatRow.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, spacing } from '../../theme';

interface StatRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  label: string;
  value: string;
}

const StatRow: React.FC<StatRowProps> = ({
  icon,
  iconColor = colors.textSecondary,
  label,
  value,
}) => {
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Ionicons name={icon} size={14} color={iconColor} />
        <Text style={styles.label}>{label}</Text>
      </View>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingVertical: spacing.xs,
  },
  left: {
    flexDirection: 'row',
    alignItems:    'center',
    columnGap:     spacing.xs,
  },
  label: {
    color:      colors.textSecondary,
    fontSize:   font.sizes.sm,
    fontFamily: font.regular,
  },
  value: {
    color:      colors.textPrimary,
    fontSize:   font.sizes.sm,
    fontFamily: font.medium,
  },
});

export default StatRow;
