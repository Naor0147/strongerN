import React, { useCallback, useMemo } from 'react';
import { View, Pressable, StyleSheet, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS, cancelAnimation } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radius, globalAnimation, getScaledDuration, getSpringConfig } from '../../theme';

export const SwipeableRow: React.FC<{
  children: React.ReactNode;
  onDelete: (() => void) | ((confirm: (cb: () => void) => void, cancel: () => void) => void);
  useConfirmation?: boolean;
  borderRadius?: number;
  style?: any;
}> = ({ children, onDelete, useConfirmation = false, borderRadius = radius.xs, style }) => {
  const translateX = useSharedValue(0);
  const isOpen = useSharedValue(false);
  const width = useSharedValue(0);
  const hasTriggeredHaptic = useSharedValue(false);

  // ─── Ref pattern: always hold the latest onDelete without changing
  // any useCallback/useMemo dependencies. This is what keeps panGesture
  // from being recreated every time the parent re-renders with a new
  // inline arrow function.
  const onDeleteRef = React.useRef(onDelete);
  onDeleteRef.current = onDelete;

  React.useEffect(() => {
    return () => {
      cancelAnimation(translateX);
    };
  }, []);

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

  const animateTranslation = useCallback((toVal: number) => {
    'worklet';
    if (globalAnimation.speed === 0) {
      translateX.value = toVal;
    } else {
      translateX.value = withSpring(toVal, getSpringConfig(140, 16));
    }
  }, []);

  const handlePostDeleteAnimation = useCallback(() => {
    const currentOnDelete = onDeleteRef.current;

    if (useConfirmation) {
      const confirm = (onConfirmedStateUpdate: () => void) => {
        // Animate off-screen first, then update state
        const w = width.value;
        const toVal = w ? -(w + 50) : -500;
        translateX.value = withTiming(toVal, { duration: getScaledDuration(180) }, () => {
          cancelAnimation(translateX);
          translateX.value = 0;
          isOpen.value = false;
          hasTriggeredHaptic.value = false;
          runOnJS(onConfirmedStateUpdate)();
        });
      };
      const cancel = () => {
        isOpen.value = false;
        hasTriggeredHaptic.value = false;
        animateTranslation(0);
      };
      (currentOnDelete as any)(confirm, cancel);
    } else {
      cancelAnimation(translateX);
      translateX.value = 0;
      isOpen.value = false;
      hasTriggeredHaptic.value = false;
      setTimeout(() => {
        (currentOnDelete as () => void)();
      }, 0);
    }
  }, [useConfirmation, animateTranslation]); // eslint-disable-line react-hooks/exhaustive-deps

  const triggerDeleteFlow = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }

    if (useConfirmation) {
      // Keep it open at -70, then show alert
      translateX.value = withSpring(-70, getSpringConfig(140, 16), () => {
        isOpen.value = true;
        runOnJS(handlePostDeleteAnimation)();
      });
    } else {
      // Animate all the way off-screen and delete immediately
      const w = width.value;
      const toVal = w ? -(w + 50) : -500;
      translateX.value = withTiming(toVal, { duration: getScaledDuration(180) }, () => {
        runOnJS(handlePostDeleteAnimation)();
      });
    }
  }, [useConfirmation, handlePostDeleteAnimation]);

  // ─── panGesture is memoized with [] deps — it is created ONCE and never
  // replaced while a gesture is active. All referenced functions are stable
  // (useCallback with [] or stable deps). All state is via shared values.
  const panGesture = useMemo(() => Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-8, 8])
    .onUpdate((e) => {
      'worklet';
      let newX = e.translationX;
      if (isOpen.value) {
        newX = -70 + e.translationX;
      }
      if (newX > 0) newX = 0;
      translateX.value = newX;

      const currentThreshold = width.value ? -width.value * 0.85 : -300;
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
    })
    .onEnd((e) => {
      'worklet';
      const currentThreshold = width.value ? -width.value * 0.85 : -300;
      const currentX = isOpen.value ? -70 + e.translationX : e.translationX;

      if (currentX < currentThreshold) {
        runOnJS(triggerDeleteFlow)();
      } else {
        const threshold = isOpen.value ? -30 : -45;
        if (e.translationX < threshold) {
          isOpen.value = true;
          animateTranslation(-70);
        } else {
          isOpen.value = false;
          animateTranslation(0);
        }
        hasTriggeredHaptic.value = false;
      }
    }),
  // All of these are stable (created once), so panGesture is created once.
  [triggerDeleteFlow, triggerHaptic, animateTranslation]); // eslint-disable-line react-hooks/exhaustive-deps

  const animatedUnderlayStyle = useAnimatedStyle(() => ({
    opacity: translateX.value < -10 ? 1 : 0,
  }));

  const animatedTrashStyle = useAnimatedStyle(() => {
    const thresh = width.value ? -width.value * 0.45 : -150;
    const scale = translateX.value < thresh
      ? 1.3
      : translateX.value < -70
        ? 1.0
        : 0.8;
    return { 
      transform: [{ scale }],
      justifyContent: 'center',
      alignItems: 'center',
      width: 24,
      height: 24,
    };
  });

  const animatedTrashOutlineStyle = useAnimatedStyle(() => {
    const thresh = width.value ? -width.value * 0.45 : -150;
    const isPast = translateX.value < thresh;
    return {
      opacity: isPast ? 0 : 1,
      position: 'absolute',
    };
  });

  const animatedTrashFilledStyle = useAnimatedStyle(() => {
    const thresh = width.value ? -width.value * 0.45 : -150;
    const isPast = translateX.value < thresh;
    return {
      opacity: isPast ? 1 : 0,
      position: 'absolute',
    };
  });

  const animatedContentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View 
      style={[swipeStyles.container, { borderRadius }, style]}
      onLayout={(e) => { width.value = e.nativeEvent.layout.width; }}
    >
      <Animated.View
        style={[StyleSheet.absoluteFill, animatedUnderlayStyle]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={triggerDeleteFlow}
        >
          <View style={[
            swipeStyles.deleteAction, 
            { borderRadius },
          ]}>
            <Animated.View style={animatedTrashStyle}>
              <Animated.View style={animatedTrashOutlineStyle}>
                <Ionicons name="trash-outline" size={20} color="#FFF" />
              </Animated.View>
              <Animated.View style={animatedTrashFilledStyle}>
                <Ionicons name="trash" size={20} color="#FFF" />
              </Animated.View>
            </Animated.View>
          </View>
        </Pressable>
      </Animated.View>
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={animatedContentStyle}
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
