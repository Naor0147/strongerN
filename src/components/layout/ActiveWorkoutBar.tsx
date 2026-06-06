// components/layout/ActiveWorkoutBar.tsx
// Premium live workout status bar — accent left glow, pulsing dot, finish button
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, spacing, ripple as rippleTokens, radius, globalAnimation, getScaledDuration } from '../../theme';

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

  // Pulsing dot animation
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const id = setInterval(() => setElapsed(formatElapsed(startTime)), 1000);
    return () => clearInterval(id);
  }, [startTime]);

  useEffect(() => {
    if (globalAnimation.speed === 0) {
      pulseAnim.setValue(1);
      return;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue:         0.2,
          duration:        getScaledDuration(700),
          useNativeDriver: true,
          easing:          Easing.inOut(Easing.ease),
        }),
        Animated.timing(pulseAnim, {
          toValue:         1,
          duration:        getScaledDuration(700),
          useNativeDriver: true,
          easing:          Easing.inOut(Easing.ease),
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulseAnim, globalAnimation.speed]);

  const label = `Active workout: ${workoutName}. Elapsed ${elapsed}`;

  return (
    <View style={styles.bar}>
      {/* Accent left glow border */}
      <View style={styles.glowBar} />

      <Pressable
        style={styles.inner}
        onPress={onPress}
        android_ripple={rippleTokens.surface}
        accessibilityLabel={label}
        testID="active-workout-bar"
      >
        {/* Left: live indicator + info */}
        <View style={styles.left}>
          <Animated.View style={[styles.dot, { opacity: pulseAnim }]} />
          <View style={styles.textBlock}>
            <Text style={styles.name} numberOfLines={1}>{workoutName}</Text>
            <Text style={styles.timer}>{elapsed}</Text>
          </View>
        </View>

        {/* Right: up chevron + finish */}
        <View style={styles.right}>
          <Pressable
            style={styles.finishBtn}
            onPress={onFinish}
            android_ripple={rippleTokens.accent}
            accessibilityLabel="Finish workout"
            testID="active-workout-bar.finish"
          >
            <Text style={styles.finishText}>FINISH</Text>
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
    shadowColor:     colors.accent,
    shadowOpacity:   0.8,
    shadowRadius:    8,
    shadowOffset:    { width: 0, height: 0 },
    elevation:       8,
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
    shadowColor:     colors.accent,
    shadowOpacity:   0.8,
    shadowRadius:    6,
    shadowOffset:    { width: 0, height: 0 },
    elevation:       4,
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
