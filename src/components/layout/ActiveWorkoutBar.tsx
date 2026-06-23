// components/layout/ActiveWorkoutBar.tsx
// Premium live workout status bar — accent left glow, pulsing dot, finish button
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withRepeat, withSequence, Easing } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, spacing, ripple as rippleTokens, radius, globalAnimation, getScaledDuration } from '../../theme';
import i18n from '../../utils/i18n';

interface ActiveWorkoutBarProps {
  workoutName: string;
  startTime:   Date;
  onPress?:    () => void;
  onFinish?:   () => void;
}

function formatElapsed(startTime: Date): string {
  const totalSec = Math.floor((Date.now() - startTime.getTime()) / 1000);
  const h   = Math.floor(totalSec / 3600);
  const min = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0');
  const sec = (totalSec % 60).toString().padStart(2, '0');
  return h > 0 ? `${h}:${min}:${sec}` : `${min}:${sec}`;
}

const ActiveWorkoutBar: React.FC<ActiveWorkoutBarProps> = ({
  workoutName,
  startTime,
  onPress,
  onFinish,
}) => {
  const [elapsed, setElapsed] = useState(() => formatElapsed(startTime));

  const pulseAnim = useSharedValue(1);

  const startTimeMs = startTime.getTime();

  useEffect(() => {
    const id = setInterval(() => setElapsed(formatElapsed(startTime)), 1000);
    return () => clearInterval(id);
  }, [startTimeMs]);

  useEffect(() => {
    const speed = (typeof globalAnimation !== 'undefined' && globalAnimation && typeof globalAnimation.speed === 'number')
      ? globalAnimation.speed
      : 1;

    if (speed === 0) {
      pulseAnim.value = 1;
      return;
    }

    const dur = getScaledDuration(700);
    pulseAnim.value = withRepeat(
      withSequence(
        withTiming(0.2, { duration: dur, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: dur, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    return () => {
      pulseAnim.value = 1;
    };
  }, [pulseAnim, globalAnimation?.speed]);

  const dotStyle = useAnimatedStyle(() => ({
    opacity: pulseAnim.value,
  }));

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
          <Animated.View style={[styles.dot, dotStyle]} />
          <View style={styles.textBlock}>
            <Text style={styles.name} numberOfLines={1}>{workoutName}</Text>
            <Text style={styles.timer}>{elapsed}</Text>
          </View>
        </View>

        {/* Right: up chevron + finish */}
        <View style={styles.right}>
          <Pressable
            style={({ pressed }) => [styles.finishBtn, pressed && { transform: [{ scale: 0.96 }] }]}
            onPress={onFinish}
            android_ripple={rippleTokens.accent}
            accessibilityLabel={i18n.t('extras.finishWorkoutBarA11y')}
            testID="active-workout-bar.finish"
          >
            <Text style={styles.finishText}>{i18n.t('activeWorkoutBar.finish')}</Text>
          </Pressable>
          <Ionicons name="chevron-up-outline" size={18} color={colors.textSecondary} style={{ marginLeft: spacing.sm }} />
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
    width:           3,
    backgroundColor: colors.accent,
    boxShadow:       '0px 0px 8px ' + colors.accent + 'CC',
  },
  inner: {
    flex:              1,
    paddingVertical:   spacing.md,
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
  dot: {
    width:           10,
    height:          10,
    borderRadius:    5,
    backgroundColor: colors.accent,
    boxShadow:       '0px 0px 6px ' + colors.accent + 'CC',
  },
  textBlock: {
    flex: 1,
  },
  name: {
    color:      colors.textPrimary,
    fontSize:   font.sizes.sm,
    fontFamily: font.semibold,
  },
  timer: {
    color:        colors.accent,
    fontSize:     font.sizes.xs,
    fontFamily:   'monospace',
    fontVariant:  ['tabular-nums'],
    marginTop:    2,
    letterSpacing: 1.2,
  },
  right: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  finishBtn: {
    backgroundColor:   colors.accent + '22',
    borderColor:       colors.accent,
    borderWidth:       1,
    borderRadius:      radius.full,
    paddingVertical:   4,
    paddingHorizontal: spacing.md,
  },
  finishText: {
    color:         colors.accent,
    fontSize:      font.sizes.xs,
    fontFamily:    font.bold,
    letterSpacing: 0.8,
  },
});

export default ActiveWorkoutBar;
