// components/ui/WatchCompanionSimulator.tsx
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, spacing, radius, shadow, globalAnimation, getScaledDuration } from '../../theme';

interface WatchCompanionSimulatorProps {
  workoutName: string;
  startTime: Date;
  activeExercises: any[];
  onCheckSet?: () => void;
  onClose: () => void;
}

export const WatchCompanionSimulator: React.FC<WatchCompanionSimulatorProps> = ({
  workoutName,
  startTime,
  activeExercises = [],
  onCheckSet,
  onClose,
}) => {
  const [elapsed, setElapsed] = useState('00:00');
  const [heartRate, setHeartRate] = useState(132);

  // Heart rate pulse animation
  const pulseScale = useRef(new Animated.Value(1)).current;

  // Elapsed workout timer ticking
  useEffect(() => {
    const formatElapsed = () => {
      const totalSec = Math.floor((Date.now() - startTime.getTime()) / 1000);
      const min = Math.floor(totalSec / 60).toString().padStart(2, '0');
      const sec = (totalSec % 60).toString().padStart(2, '0');
      return `${min}:${sec}`;
    };

    const id = setInterval(() => setElapsed(formatElapsed()), 1000);
    return () => clearInterval(id);
  }, [startTime]);

  // Heart rate changes simulation
  useEffect(() => {
    const id = setInterval(() => {
      setHeartRate(prev => {
        const delta = Math.floor(Math.random() * 7) - 3; // -3 to +3
        const next = prev + delta;
        return Math.max(90, Math.min(165, next));
      });

      // trigger heartbeat scale animation
      if (globalAnimation.speed === 0) {
        pulseScale.setValue(1);
      } else {
        Animated.sequence([
          Animated.timing(pulseScale, { toValue: 1.25, duration: getScaledDuration(150), useNativeDriver: true }),
          Animated.timing(pulseScale, { toValue: 1, duration: getScaledDuration(150), useNativeDriver: true }),
        ]).start();
      }
    }, 1200);

    return () => clearInterval(id);
  }, []);

  const currentExercise = activeExercises.find(ex => {
    if (ex.setsDetails) {
      return ex.setsDetails.some((s: any) => !s.completed);
    }
    return true;
  }) ?? activeExercises[0] ?? { name: 'Bench Press', sets: 3 };

  return (
    <View style={styles.backdrop}>
      <View style={styles.watchBezel}>
        {/* Watch screen */}
        <View style={styles.watchScreen}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.watchTimer}>{elapsed}</Text>
            <Animated.View style={{ transform: [{ scale: pulseScale }], flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Ionicons name="heart" size={12} color={colors.error} />
              <Text style={styles.heartText}>{heartRate}</Text>
            </Animated.View>
          </View>

          {/* Workout name */}
          <Text style={styles.workoutName} numberOfLines={1}>
            {workoutName || 'Active Workout'}
          </Text>

          {/* Middle info */}
          <View style={styles.middleCard}>
            <Text style={styles.label}>CURRENT EXERCISE</Text>
            <Text style={styles.exerciseName} numberOfLines={2}>
              {currentExercise.name}
            </Text>
            <Text style={styles.setsLabel}>3 Sets Remaining</Text>
          </View>

          {/* Watch Action Button */}
          <Pressable 
            style={styles.actionBtn} 
            onPress={onCheckSet}
            android_ripple={{ color: colors.success + '44' }}
          >
            <Ionicons name="checkmark" size={14} color="#0D0F14" />
            <Text style={styles.actionText}>CHECK SET</Text>
          </Pressable>

          {/* Close watch overlay */}
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>Close Watch View</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(5, 7, 10, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999,
  },
  watchBezel: {
    width: 220,
    height: 260,
    borderRadius: 40,
    backgroundColor: '#1E242B', // Watch case body (Apple Watch Ultra Titanium style)
    borderColor: '#3A4452',
    borderWidth: 6,
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.8,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 10 },
    elevation: 15,
  },
  watchScreen: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
    backgroundColor: '#000000', // Pure AMOLED Watch Screen
    padding: 12,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: '#161B24',
    paddingBottom: 4,
  },
  watchTimer: {
    color: colors.accent,
    fontSize: 12,
    fontFamily: font.bold,
  },
  heartText: {
    color: colors.error,
    fontSize: 11,
    fontFamily: font.bold,
  },
  workoutName: {
    color: colors.textSecondary,
    fontSize: 10,
    fontFamily: font.bold,
    textAlign: 'center',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  middleCard: {
    backgroundColor: '#0D0F14',
    borderColor: '#1E2633',
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: 6,
    alignItems: 'center',
    width: '100%',
    marginVertical: 4,
  },
  label: {
    color: colors.textMuted,
    fontSize: 7,
    fontFamily: font.bold,
    letterSpacing: 0.5,
  },
  exerciseName: {
    color: colors.textPrimary,
    fontSize: font.sizes.xs,
    fontFamily: font.bold,
    textAlign: 'center',
    marginTop: 2,
  },
  setsLabel: {
    color: colors.accent,
    fontSize: 8,
    fontFamily: font.medium,
    marginTop: 2,
  },
  actionBtn: {
    backgroundColor: colors.success,
    borderRadius: radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
    paddingHorizontal: 12,
    width: '100%',
    gap: 4,
  },
  actionText: {
    color: '#0D0F14',
    fontSize: 10,
    fontFamily: font.bold,
  },
  closeBtn: {
    marginTop: 4,
  },
  closeText: {
    color: colors.textMuted,
    fontSize: 8,
    fontFamily: font.medium,
    textDecorationLine: 'underline',
  },
});
