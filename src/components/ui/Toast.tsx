// components/ui/Toast.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, Text, View, Pressable, Platform, Modal } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, font, radius, spacing, shadow, getSpringConfig } from '../../theme';
import { toastManager, ToastConfig } from '../../utils/toast';

export const Toast: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastConfig | null>(null);

  const translateY = useSharedValue(-100);
  const opacity = useSharedValue(0);

  const hideToast = useCallback(() => {
    'worklet';
    translateY.value = withTiming(-100, { duration: 200 });
    opacity.value = withTiming(0, { duration: 200 }, (finished) => {
      if (finished) {
        runOnJS(setToast)(null);
      }
    });
  }, [opacity, translateY]);

  useEffect(() => {
    toastManager.setListener((config) => {
      setToast(config);
      translateY.value = -100;
      opacity.value = 0;

      translateY.value = withSpring(0, getSpringConfig(160, 18));
      opacity.value = withTiming(1, { duration: 200 });

      const timer = setTimeout(() => {
        hideToast();
      }, config.duration || 2500);

      return () => clearTimeout(timer);
    });

    return () => {
      toastManager.setListener(null);
    };
  }, [hideToast, opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!toast) return null;

  const getIcon = () => {
    switch (toast.type) {
      case 'success': return 'checkmark-circle';
      case 'error':   return 'alert-circle';
      case 'warning': return 'warning';
      default:        return 'information-circle';
    }
  };

  const getAccentColor = () => {
    switch (toast.type) {
      case 'success': return colors.success;
      case 'error':   return colors.error;
      case 'warning': return colors.gold;
      default:        return colors.accent;
    }
  };

  const accentColor = getAccentColor();

  return (
    <Modal transparent visible={!!toast} animationType="none" statusBarTranslucent onRequestClose={() => {}}>
      <View style={[styles.wrapper, { paddingTop: Math.max(insets.top, 12) + spacing.xs }]} pointerEvents="box-none">
        <Animated.View style={[styles.container, animatedStyle]}>
          <Pressable onPress={hideToast} style={styles.content}>
            <Ionicons name={getIcon()} size={20} color={accentColor} style={styles.icon} />
            <Text style={styles.message} numberOfLines={2}>
              {toast.message}
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  container: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.4)',
    maxWidth: 500,
    width: '100%',
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  icon: {
    marginRight: spacing.sm,
  },
  message: {
    color: colors.textPrimary,
    fontSize: font.sizes.sm,
    fontFamily: font.medium,
    flex: 1,
  },
});

export default Toast;
