// components/layout/ActiveWorkoutBar.tsx
// Premium live workout status bar — accent left glow, pulsing dot, finish button
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, font, spacing, ripple as rippleTokens, radius } from '../../theme';
import i18n from '../../utils/i18n';

interface ActiveWorkoutBarProps {
  workoutName: string;
  startTime:   Date;
  onPress?:    () => void;
  onFinish?:   () => void;
}

function formatElapsed(startTime: Date): string {
  const totalSec = Math.max(0, Math.floor((Date.now() - startTime.getTime()) / 1000));
  const h   = Math.floor(totalSec / 3600);
  const min = Math.floor((totalSec % 3600) / 60);
  const sec = totalSec % 60;
  const secStr = sec.toString().padStart(2, '0');
  if (h > 0) {
    const minStr = min.toString().padStart(2, '0');
    return `${h}:${minStr}:${secStr}`;
  } else {
    return `${min}:${secStr}`;
  }
}

const ActiveWorkoutBar: React.FC<ActiveWorkoutBarProps> = ({
  workoutName,
  startTime,
  onPress,
  onFinish,
}) => {
  const [elapsed, setElapsed] = useState(() => formatElapsed(startTime));

  const startTimeMs = startTime.getTime();

  useEffect(() => {
    const id = setInterval(() => setElapsed(formatElapsed(startTime)), 1000);
    return () => clearInterval(id);
  }, [startTimeMs]);

  const label = i18n.t('extras.activeWorkoutA11y', { name: workoutName, time: elapsed });

  return (
    <View style={styles.bar}>
      {/* Accent left glow border */}
      <View style={styles.glowBar} />

      <Pressable
        style={({ pressed }) => [styles.inner, pressed && { transform: [{ scale: 0.98 }] }]}
        onPress={onPress}
        android_ripple={rippleTokens.surface}
        accessibilityLabel={label}
        testID="active-workout-bar"
      >
        {/* Left: live indicator + info */}
        <View style={styles.left}>
          <View style={styles.liveDot} />
          <View style={styles.textBlock}>
            <Text style={styles.name} numberOfLines={1}>{workoutName}</Text>
          </View>
        </View>

        {/* Right: up chevron + timer */}
        <View style={styles.right}>
          <Text style={styles.rightTimer}>{elapsed}</Text>
          <Ionicons name="chevron-up-outline" size={20} color={colors.textSecondary} style={{ marginLeft: spacing.sm }} />
        </View>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderTopWidth:  1,
    borderTopColor:  colors.border,
    flexDirection:   'row',
  },
  glowBar: {
    width:           4,
    backgroundColor: colors.accent,
    boxShadow:       '0px 0px 8px ' + colors.accent + 'CC',
  },
  inner: {
    flex:              1,
    paddingVertical:   22, // 1.8X taller
    paddingHorizontal: spacing.lg,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
  },
  left: {
    flexDirection: 'row',
    alignItems:    'center',
    flex:          1,
    columnGap:     spacing.sm,
  },
  liveDot: {
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: colors.accent,
  },
  textBlock: {
    flex: 1,
  },
  name: {
    color:      colors.textPrimary,
    fontSize:   font.sizes.md, // Larger text size
    fontFamily: font.semibold,
  },
  rightTimer: {
    color:        colors.accent,
    fontSize:     font.sizes.md, // Larger text size
    fontFamily:   font.semibold,
  },
  right: {
    flexDirection: 'row',
    alignItems:    'center',
  },
});

export default ActiveWorkoutBar;
