import React, { useState, useCallback } from 'react';
import { View, Pressable, StyleSheet, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radius, globalAnimation, getScaledDuration } from '../../theme';

export const SwipeableRow: React.FC<{
  children: React.ReactNode;
  onDelete: () => void;
  borderRadius?: number;
  style?: any;
}> = ({ children, onDelete, borderRadius = radius.xs, style }) => {
  const translateX = useSharedValue(0);
  const isOpen = useSharedValue(false);
  const [width, setWidth] = useState(0);
  const [isPastThreshold, setIsPastThreshold] = useState(false);
  const hasTriggeredHaptic = useSharedValue(false);

  const triggerHaptic = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
  }, []);

  const triggerDeleteHaptic = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }, []);

  const handleDeletePress = useCallback(() => {
    triggerDeleteHaptic();
    const toVal = width ? -(width + 50) : -500;
    translateX.value = withTiming(toVal, { duration: getScaledDuration(180) }, () => {
      runOnJS(onDelete)();
      translateX.value = 0;
      isOpen.value = false;
      runOnJS(setIsPastThreshold)(false);
      hasTriggeredHaptic.value = false;
    });
  }, [width, onDelete, triggerDeleteHaptic]);

  const animateTranslation = useCallback((toVal: number, callback?: () => void) => {
    'worklet';
    if (globalAnimation.speed === 0) {
      translateX.value = toVal;
      if (callback) runOnJS(callback)();
    } else {
      translateX.value = withSpring(
        toVal,
        {
          stiffness: 140 / (globalAnimation.speed * globalAnimation.speed),
          damping: 16 / globalAnimation.speed,
          mass: 0.9,
        },
        () => {
          if (callback) runOnJS(callback)();
        }
      );
    }
  }, []);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-8, 8])
    .onUpdate((e) => {
      let newX = e.translationX;
      if (isOpen.value) {
        newX = -70 + e.translationX;
      }
      if (newX > 0) newX = 0;
      translateX.value = newX;

      const currentThreshold = width ? -width * 0.45 : -150;
      const past = newX < currentThreshold;
      if (past) {
        if (!hasTriggeredHaptic.value) {
          runOnJS(triggerHaptic)();
          hasTriggeredHaptic.value = true;
        }
      } else {
        if (hasTriggeredHaptic.value && newX > currentThreshold + 15) {
          hasTriggeredHaptic.value = false;
        }
      }
      runOnJS(setIsPastThreshold)(past);
    })
    .onEnd((e) => {
      const currentThreshold = width ? -width * 0.45 : -150;
      const currentX = isOpen.value ? -70 + e.translationX : e.translationX;

      if (currentX < currentThreshold || e.velocityX < -500) {
        runOnJS(handleDeletePress)();
      } else {
        const threshold = isOpen.value ? -30 : -45;
        if (e.translationX < threshold) {
          animateTranslation(-70, () => { isOpen.value = true; });
        } else {
          animateTranslation(0, () => { isOpen.value = false; });
        }
        hasTriggeredHaptic.value = false;
        runOnJS(setIsPastThreshold)(false);
      }
    });

  const handleOverlayPress = useCallback(() => {
    if (isOpen.value) {
      animateTranslation(0, () => { isOpen.value = false; });
    }
  }, []);

  const currentThreshold = width ? -width * 0.45 : -150;

  const animatedUnderlayStyle = useAnimatedStyle(() => ({
    opacity: translateX.value < -10 ? 1 : 0,
  }));

  const animatedTrashStyle = useAnimatedStyle(() => {
    const scale = translateX.value < currentThreshold
      ? 1.3
      : translateX.value < -70
        ? 1.0
        : 0.8;
    return { transform: [{ scale }] };
  });

  const animatedContentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View 
      style={[swipeStyles.container, { borderRadius }, style]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      <Animated.View
        style={[StyleSheet.absoluteFill, animatedUnderlayStyle]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleDeletePress}
        >
          <View style={[
            swipeStyles.deleteAction, 
            { borderRadius },
            isPastThreshold && { backgroundColor: '#FF3B30' }
          ]}>
            <Animated.View style={animatedTrashStyle}>
              <Ionicons 
                name={isPastThreshold ? "trash" : "trash-outline"} 
                size={20} 
                color="#FFF" 
              />
            </Animated.View>
          </View>
        </Pressable>
      </Animated.View>
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={animatedContentStyle}
          onTouchStart={handleOverlayPress}
        >
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

const swipeStyles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  deleteAction: {
    flex: 1,
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: spacing.lg,
  },
});
