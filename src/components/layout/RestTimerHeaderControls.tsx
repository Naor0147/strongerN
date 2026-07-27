import React, { useState, useEffect } from 'react';
import { Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, ripple as rippleTokens } from '../../theme';
import { styles } from './activeWorkoutStyles';
import { restTimerEmitter } from './restTimerEmitter';
import { scheduleRestTimerNotification } from '../../utils/notifications';
import RestTimerRuler from '../ui/RestTimerRuler';

export const RestTimerHeaderButton: React.FC<{
  isSubMenuVisible: boolean;
  onToggleSubMenu: () => void;
  defaultRestDuration: number;
}> = React.memo(({ isSubMenuVisible, onToggleSubMenu, defaultRestDuration }) => {
  const [timerState, setTimerState] = useState({ remaining: 0, active: false });

  useEffect(() => {
    return restTimerEmitter.subscribe(setTimerState);
  }, []);

  const handlePress = () => {
    if (timerState.active) {
      onToggleSubMenu();
    } else {
      restTimerEmitter.start(defaultRestDuration);
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.headerStopwatchBtn,
        timerState.active && styles.headerTimerBtnActive,
        pressed && { transform: [{ scale: 0.96 }] }
      ]}
      android_ripple={rippleTokens.surface}
      accessibilityLabel="Toggle rest timer"
    >
      <Ionicons 
        name={timerState.active ? "stopwatch" : "stopwatch-outline"} 
        size={18} 
        color={timerState.active ? colors.accent : colors.textPrimary} 
      />
      {timerState.active && (
        <Text style={styles.headerRestTimerText}>{timerState.remaining}s</Text>
      )}
    </Pressable>
  );
});

export const RestTimerRulerContainer: React.FC<{
  defaultRestDuration: number;
  onCloseSubMenu: () => void;
}> = React.memo(({ defaultRestDuration, onCloseSubMenu }) => {
  const [timerState, setTimerState] = useState<{ remaining: number; active: boolean; endTarget?: number | null }>({
    remaining: 0,
    active: false,
  });

  useEffect(() => {
    return restTimerEmitter.subscribe(setTimerState);
  }, []);

  return (
    <RestTimerRuler
      currentSecs={timerState.remaining}
      defaultSecs={defaultRestDuration}
      isRunning={timerState.active}
      endTarget={timerState.endTarget ?? null}
      onSecsChange={(secs) => {
        restTimerEmitter.setRemaining(secs);
      }}
      onSecsChangeComplete={(secs) => {
        scheduleRestTimerNotification(secs);
      }}
      onDragStart={() => {
        restTimerEmitter.setIsDragging(true);
      }}
      onDragEnd={() => {
        restTimerEmitter.setIsDragging(false);
      }}
      onStopStart={() => {
        restTimerEmitter.stop();
      }}
      onStopComplete={() => {
        onCloseSubMenu();
      }}
      onStart={() => {
        restTimerEmitter.start(timerState.remaining || defaultRestDuration);
      }}
    />
  );
});
