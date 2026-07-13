import React, { useCallback, useMemo } from 'react';
import { View, Pressable, StyleSheet, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radius, globalAnimation, getScaledDuration, getSpringConfig } from '../../theme';
import { ExerciseRowGesturesContext } from '../ui/gestureCoexistence';

/**
 * SwipeableRow — slide a row left to reveal a delete underlay, then swipe
 * further (or release with enough velocity) to commit the delete.
 *
 * Two `onDelete` shapes are supported (detected via `.length`):
 *   1-arg  → slide-off + collapse animation, then `onDelete()` is called.
 *            The parent simply removes the item from its array.
 *   2-arg  → `onDelete(confirm, cancel)` is called BEFORE any animation.
 *            The parent (e.g. an Alert) decides:
 *              • confirm(onDone) → triggers slide-off + collapse, then onDone
 *                (the parent's state-update that removes the item).
 *              • cancel()       → snaps the row back to rest (no delete).
 *
 * After the slide-off the row's height/opacity collapse to 0 (Reanimated),
 * so the parent's array removal causes no layout jump / snap-back on Android.
 */

export const SwipeableRow: React.FC<{
  children: React.ReactNode;
  onDelete?: () => void;
  onDeleteWithConfirm?: (confirm: (onDone: () => void) => void, cancel: () => void) => void;
  borderRadius?: number;
  style?: any;
  blocksExternalGesture?: any | any[];
  activeOffsetX?: [number, number] | number[];
  snapBackOnRelease?: boolean;
}> = React.memo(({
  children,
  onDelete,
  onDeleteWithConfirm,
  borderRadius = radius.xs,
  style,
  blocksExternalGesture,
  activeOffsetX = [-15, 15] as [number, number] | number[],
  snapBackOnRelease = false,
}) => {
  const translateX = useSharedValue(0);
  const isOpen = useSharedValue(false);
  const width = useSharedValue(0);
  const height = useSharedValue(-1);
  const collapse = useSharedValue(0); // 0 = visible, 1 = fully collapsed
  const hasTriggeredHaptic = useSharedValue(false);
  const isDeleting = useSharedValue(false);

  const cancelledRef = React.useRef(false);

  // ─── Ref pattern: always hold the latest handlers without changing any
  // useCallback/useMemo dependencies. This is what keeps panGesture from
  // being recreated every time the parent re-renders with new inline arrows.
  const onDeleteRef = React.useRef(onDelete);
  onDeleteRef.current = onDelete;

  const onDeleteWithConfirmRef = React.useRef(onDeleteWithConfirm);
  onDeleteWithConfirmRef.current = onDeleteWithConfirm;

  React.useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
      cancelAnimation(translateX);
      cancelAnimation(collapse);
    };
  }, []);

  const triggerHaptic = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
  }, []);

  const triggerSuccessHaptic = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }, []);

  // Snap open/closed (no delete). Runs on the UI thread.
  const animateTranslation = useCallback((toVal: number) => {
    'worklet';
    if (globalAnimation.speed === 0) {
      translateX.value = toVal;
    } else {
      translateX.value = withSpring(toVal, getSpringConfig(140, 16));
    }
  }, []);

  // Slide the row fully off-screen, then collapse height+opacity to 0, then
  const handleDone = useCallback((onDone: () => void) => {
    if (cancelledRef.current) return;
    onDone();
  }, []);

  // Slide the row fully off-screen, then collapse height+opacity to 0, then
  // invoke `onDone` on the JS thread. The row is already invisible/zero-height
  // by the time `onDone` runs, so the parent's array removal is jump-free.
  const slideOffThenCollapse = useCallback((onDone: () => void) => {
    'worklet';
    const w = width.value;
    const toVal = w ? -(w + 50) : -500;
    translateX.value = withTiming(toVal, {
      duration: getScaledDuration(150),
      easing: Easing.out(Easing.quad),
    }, () => {
      'worklet';
      collapse.value = withTiming(1, {
        duration: getScaledDuration(160),
        easing: Easing.in(Easing.quad),
      }, () => {
        'worklet';
        runOnJS(handleDone)(onDone);
      });
    });
  }, [handleDone]);

  // Restore the row to rest (used by the 2-arg `cancel` path).
  const cancelSlide = useCallback(() => {
    'worklet';
    isDeleting.value = false;
    isOpen.value = false;
    hasTriggeredHaptic.value = false;
    animateTranslation(0);
  }, [animateTranslation]);

  // handleDeletePress is invoked from runOnJS (pan onEnd) AND from the
  // underlay Pressable onPress. Reads the ref so it never goes stale.
  const handleDeletePress = useCallback(() => {
    if (isDeleting.value) return;
    isDeleting.value = true;
    triggerSuccessHaptic();

    const currentOnDelete = onDeleteRef.current;
    const currentOnDeleteWithConfirm = onDeleteWithConfirmRef.current;

    if (currentOnDeleteWithConfirm) {
      // Confirm/cancel flow. The parent decides; we animate only after confirm.
      const confirm = (onDone: () => void) => {
        slideOffThenCollapse(onDone);
      };
      const cancel = () => {
        cancelSlide();
      };
      currentOnDeleteWithConfirm(confirm, cancel);
    } else if (currentOnDelete) {
      slideOffThenCollapse(() => {
        currentOnDelete();
      });
    }
  }, [triggerSuccessHaptic, slideOffThenCollapse, cancelSlide]);

  // ─── panGesture is memoized with stable deps — created ONCE and never
  // replaced while a gesture is active. All referenced functions are stable.
  const panGesture = useMemo(() => {
    let g = Gesture.Pan()
      // Tighter vertical fail so the parent ScrollView wins quickly on Android;
      // slightly larger horizontal activation so taps/inputs don't misfire.
      .activeOffsetX(activeOffsetX as [number, number])
      .failOffsetY([-10, 10]);

    if (blocksExternalGesture) {
      if (Array.isArray(blocksExternalGesture)) {
        const valid = blocksExternalGesture.filter(Boolean);
        if (valid.length > 0) {
          g = g.blocksExternalGesture(...valid);
        }
      } else {
        g = g.blocksExternalGesture(blocksExternalGesture);
      }
    }

    return g
      .onUpdate((e) => {
        'worklet';
        let newX = e.translationX;
        if (isOpen.value) {
          newX = -70 + e.translationX;
        }
        if (newX > 0) newX = 0;
        translateX.value = newX;

        const currentThreshold = width.value ? -width.value * 0.45 : -150;
        const past = newX < currentThreshold;
        if (past) {
          if (!hasTriggeredHaptic.value) {
            runOnJS(triggerHaptic)();
            hasTriggeredHaptic.value = true;
          }
        } else if (hasTriggeredHaptic.value && newX > currentThreshold + 15) {
          hasTriggeredHaptic.value = false;
        }
      })
      .onEnd((e) => {
        'worklet';
        const currentThreshold = width.value ? -width.value * 0.45 : -150;
        const currentX = isOpen.value ? -70 + e.translationX : e.translationX;

        if (currentX < currentThreshold || e.velocityX < -500) {
          runOnJS(handleDeletePress)();
        } else {
          if (snapBackOnRelease) {
            isOpen.value = false;
            animateTranslation(0);
          } else {
            const threshold = isOpen.value ? -30 : -45;
            if (e.translationX < threshold) {
              isOpen.value = true;
              animateTranslation(-70);
            } else {
              isOpen.value = false;
              animateTranslation(0);
            }
          }
          hasTriggeredHaptic.value = false;
        }
      });
  }, [handleDeletePress, triggerHaptic, animateTranslation, blocksExternalGesture, activeOffsetX, snapBackOnRelease]);

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
    return { opacity: isPast ? 0 : 1, position: 'absolute' };
  });

  const animatedTrashFilledStyle = useAnimatedStyle(() => {
    const thresh = width.value ? -width.value * 0.45 : -150;
    const isPast = translateX.value < thresh;
    return { opacity: isPast ? 1 : 0, position: 'absolute' };
  });

  const animatedContentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  // Collapse animation: drive height/opacity to 0 after slide-off so the
  // parent's array removal is jump-free (esp. on Android, where RN's
  // LayoutAnimation can fight Reanimated transforms).
  const collapseStyle = useAnimatedStyle(() => {
    if (collapse.value <= 0 || height.value <= 0) {
      return { opacity: 1 };
    }
    const t = 1 - collapse.value; // 1 → 0
    return {
      height: height.value * t,
      opacity: t,
      marginTop: 0,
      marginBottom: 0,
      paddingTop: 0,
      paddingBottom: 0,
      overflow: 'hidden',
    };
  });

  return (
    <Animated.View
      style={[swipeStyles.container, { borderRadius }, style, collapseStyle]}
      onLayout={(e) => {
        if (!isDeleting.value && collapse.value === 0) {
          width.value = e.nativeEvent.layout.width;
          if (height.value <= 0) {
            height.value = e.nativeEvent.layout.height;
          }
        }
      }}
    >
      <Animated.View style={[StyleSheet.absoluteFill, animatedUnderlayStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleDeletePress}>
          <View style={[swipeStyles.deleteAction, { borderRadius }]}>
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
        <Animated.View style={animatedContentStyle}>
          <ExerciseRowGesturesContext.Provider value={{ swipeGesture: panGesture }}>
            {children}
          </ExerciseRowGesturesContext.Provider>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
});

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