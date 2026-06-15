import React, { useRef, useState } from 'react';
import { View, Pressable, PanResponder, StyleSheet, Platform, Animated } from 'react-native';
import * as RN from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radius, globalAnimation, getScaledDuration } from '../../theme';

export const SwipeableRow: React.FC<{
  children: React.ReactNode;
  onDelete: () => void;
  borderRadius?: number;
  style?: any;
}> = ({ children, onDelete, borderRadius = radius.xs, style }) => {
  const translateXRef = useRef<Animated.Value | null>(null);
  if (translateXRef.current === null) translateXRef.current = new Animated.Value(0);
  const translateX = translateXRef.current;
  const isOpen = useRef(false);
  const [width, setWidth] = useState(0);
  const [isPastThreshold, setIsPastThreshold] = useState(false);
  const hasTriggeredHaptic = useRef(false);

  const animateTranslation = (toVal: number, callback?: () => void) => {
    if (globalAnimation.speed === 0) {
      Animated.timing(translateX, {
        toValue: toVal,
        duration: 0,
        useNativeDriver: true,
      }).start(callback);
    } else {
      Animated.spring(translateX, {
        toValue: toVal,
        useNativeDriver: true,
        stiffness: 140 / (globalAnimation.speed * globalAnimation.speed),
        damping: 16 / globalAnimation.speed,
        mass: 0.9,
      }).start(callback);
    }
  };

  const panResponderRef = useRef<any>(null);
  if (panResponderRef.current === null) {
    panResponderRef.current = PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < 8;
      },
      onPanResponderMove: (_, gestureState) => {
        let newX = gestureState.dx;
        if (isOpen.current) {
          newX = -70 + gestureState.dx;
        }
        if (newX > 0) newX = 0;
        translateX.setValue(newX);

        // Check auto-delete threshold (45% of width or -150)
        const currentThreshold = width ? -width * 0.45 : -150;
        const past = newX < currentThreshold;
        if (past) {
          if (!hasTriggeredHaptic.current) {
            if (Platform.OS !== 'web') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            }
            hasTriggeredHaptic.current = true;
          }
        } else {
          if (hasTriggeredHaptic.current && newX > currentThreshold + 15) {
            hasTriggeredHaptic.current = false;
          }
        }
        setIsPastThreshold(past);
      },
      onPanResponderRelease: (_, gestureState) => {
        const currentThreshold = width ? -width * 0.45 : -150;
        const currentX = isOpen.current ? -70 + gestureState.dx : gestureState.dx;

        if (currentX < currentThreshold || gestureState.vx < -0.5) {
          handleDeletePress();
        } else {
          const threshold = isOpen.current ? -30 : -45;
          if (gestureState.dx < threshold) {
            animateTranslation(-70, () => {
              isOpen.current = true;
            });
          } else {
            animateTranslation(0, () => {
              isOpen.current = false;
            });
          }
          hasTriggeredHaptic.current = false;
          setIsPastThreshold(false);
        }
      },
    });
  }
  const panResponder = panResponderRef.current;

  const handleDeletePress = () => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    const toVal = width ? -(width + 50) : -500;
    Animated.timing(translateX, {
      toValue: toVal,
      duration: getScaledDuration(180),
      useNativeDriver: true,
    }).start(() => {
      onDelete();
      translateX.setValue(0);
      isOpen.current = false;
      setIsPastThreshold(false);
      hasTriggeredHaptic.current = false;
    });
  };

  const handleOverlayPress = () => {
    if (isOpen.current) {
      animateTranslation(0, () => {
        isOpen.current = false;
      });
    }
  };

  const currentThreshold = width ? -width * 0.45 : -150;

  const trashScale = translateX.interpolate({
    inputRange: [currentThreshold, -70, 0],
    outputRange: [1.3, 1.0, 0.8],
    extrapolate: 'clamp',
  });

  const underlayOpacity = translateX.interpolate({
    inputRange: [-10, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View 
      style={[swipeStyles.container, { borderRadius }, style]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      <Animated.View
        style={[StyleSheet.absoluteFill, { opacity: underlayOpacity }]}
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
            <Animated.View style={{ transform: [{ scale: trashScale }] }}>
              <Ionicons 
                name={isPastThreshold ? "trash" : "trash-outline"} 
                size={20} 
                color="#FFF" 
              />
            </Animated.View>
          </View>
        </Pressable>
      </Animated.View>
      <Animated.View
        style={{ transform: [{ translateX }] }}
        {...panResponder.panHandlers}
        onTouchStart={handleOverlayPress}
      >
        {children}
      </Animated.View>
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
