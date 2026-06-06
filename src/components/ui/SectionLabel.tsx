// components/ui/SectionLabel.tsx
// Unified section heading with optional right-side CTA icon button.
import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, spacing } from '../../theme';
import PressableRow from './PressableRow';

interface SectionLabelProps {
  title:          string;
  subtitle?:      string;
  rightIcon?:     keyof typeof Ionicons.glyphMap;
  rightIconColor?: string;
  onRightPress?:  () => void;
  rightLabel?:    string;
  style?:         StyleProp<ViewStyle>;
  testID?:        string;
}

const SectionLabel: React.FC<SectionLabelProps> = ({
  title,
  subtitle,
  rightIcon,
  rightIconColor = colors.accent,
  onRightPress,
  rightLabel,
  style,
  testID,
}) => (
  <View style={[styles.container, style]} testID={testID}>
    <View style={styles.left}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>

    {(rightIcon || rightLabel) && (
      <PressableRow
        onPress={onRightPress}
        ripple={{ color: '#FFFFFF10', borderless: true }}
        style={styles.rightButton}
        accessibilityLabel={rightLabel ?? 'Section action'}
        testID={testID ? `${testID}.cta` : undefined}
      >
        <View style={styles.rightInner}>
          {rightLabel ? (
            <Text style={[styles.rightLabel, { color: rightIconColor }]}>
              {rightLabel}
            </Text>
          ) : null}
          {rightIcon ? (
            <Ionicons name={rightIcon} size={20} color={rightIconColor} />
          ) : null}
        </View>
      </PressableRow>
    )}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  left: {
    flex: 1,
  },
  title: {
    color:      colors.textPrimary,
    fontSize:   font.sizes.base,
    fontFamily: font.semibold,
  },
  subtitle: {
    color:     colors.textSecondary,
    fontSize:  font.sizes.sm,
    fontFamily: font.regular,
    marginTop: 2,
  },
  rightButton: {
    borderRadius: 8,
    marginLeft: spacing.sm,
  },
  rightInner: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  rightLabel: {
    fontSize:   font.sizes.sm,
    fontFamily: font.medium,
  },
});

export default SectionLabel;
