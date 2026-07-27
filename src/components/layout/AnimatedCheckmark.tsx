import React, { useEffect } from 'react';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

export const AnimatedCheckmark: React.FC<{ completed: boolean }> = ({ completed }) => {
  const scale = useSharedValue(completed ? 1 : 0);
  const opacity = useSharedValue(completed ? 1 : 0);

  useEffect(() => {
    scale.value = withSpring(completed ? 1 : 0, { damping: 15, stiffness: 180 });
    opacity.value = withTiming(completed ? 1 : 0, { duration: 120 });
  }, [completed]);

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={checkStyle}>
      <Ionicons name="checkmark" size={14} color="#0D0F14" />
    </Animated.View>
  );
};
