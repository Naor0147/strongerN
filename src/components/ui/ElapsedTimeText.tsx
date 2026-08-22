// components/ui/ElapsedTimeText.tsx
import React, { useState, useEffect } from 'react';
import { Text, StyleSheet, StyleProp, TextStyle } from 'react-native';
import { font, colors } from '../../theme';

interface ElapsedTimeTextProps {
  startTime: Date;
  offsetSeconds: number;
  visible: boolean;
  style?: StyleProp<TextStyle>;
}

function formatElapsed(startTime: Date, offsetSeconds: number = 0): string {
  const startMs = startTime?.getTime?.();
  if (typeof startMs !== 'number' || !Number.isFinite(startMs)) {
    return '0:00';
  }
  const offset = typeof offsetSeconds === 'number' && Number.isFinite(offsetSeconds) ? offsetSeconds : 0;
  const sessionSec = Math.floor((Date.now() - startMs) / 1000);
  const totalSec = Math.max(0, sessionSec + offset);
  const h = Math.floor(totalSec / 3600);
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

export const ElapsedTimeText: React.FC<ElapsedTimeTextProps> = React.memo(({
  startTime,
  offsetSeconds,
  visible,
  style,
}) => {
  const [elapsed, setElapsed] = useState(() => formatElapsed(startTime, offsetSeconds));

  useEffect(() => {
    if (!visible) return;

    // Set initial value immediately when starting/resuming
    setElapsed(formatElapsed(startTime, offsetSeconds));

    const id = setInterval(() => {
      setElapsed(formatElapsed(startTime, offsetSeconds));
    }, 1000);

    return () => clearInterval(id);
  }, [startTime, offsetSeconds, visible]);

  return (
    <Text style={[styles.timerText, style]}>
      {elapsed}
    </Text>
  );
});

const styles = StyleSheet.create({
  timerText: {
    color: colors.textPrimary,
    fontSize: font.sizes.base,
    fontFamily: font.semibold,
    fontVariant: ['tabular-nums'],
  },
});
