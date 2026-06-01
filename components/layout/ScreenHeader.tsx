// components/layout/ScreenHeader.tsx
import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { colors, font, spacing } from '../../theme';
import IconButton from '../ui/IconButton';
import { Ionicons } from '@expo/vector-icons';

interface IconAction {
  icon:   keyof typeof Ionicons.glyphMap;
  label:  string;
  onPress?: () => void;
  testID?: string;
  color?: string;
}

interface ScreenHeaderProps {
  title:      string;
  subtitle?:  string;
  /** Pass a single icon or an array for multiple icon buttons */
  actions?:   IconAction | IconAction[];
  style?:     StyleProp<ViewStyle>;
  testID?:    string;
}

const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  subtitle,
  actions,
  style,
  testID,
}) => {
  const actionList: IconAction[] = actions
    ? Array.isArray(actions) ? actions : [actions]
    : [];

  return (
    <View style={[styles.container, style]} testID={testID}>
      <View style={styles.titleBlock}>
        <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
        ) : null}
      </View>

      {actionList.length > 0 && (
        <View style={styles.actions}>
          {actionList.map(a => (
            <IconButton
              key={a.label}
              name={a.icon}
              accessibilityLabel={a.label}
              onPress={a.onPress}
              color={a.color ?? colors.textPrimary}
              size={24}
              testID={a.testID}
            />
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.lg,
    paddingBottom:     spacing.md,
  },
  titleBlock: {
    flex: 1,
  },
  title: {
    color:      colors.textPrimary,
    fontSize:   font.sizes.xxl,
    fontFamily: font.bold,
    letterSpacing: -0.5,
  },
  subtitle: {
    color:     colors.textSecondary,
    fontSize:  font.sizes.sm,
    fontFamily: font.regular,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems:    'center',
    marginLeft:    spacing.sm,
  },
});

export default ScreenHeader;
