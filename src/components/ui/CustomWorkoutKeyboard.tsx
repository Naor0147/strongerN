// components/ui/CustomWorkoutKeyboard.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeOutDown, useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { colors, font, spacing, radius, ripple as rippleTokens, getScaledDuration } from '../../theme';
import i18n from '../../utils/i18n';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface KeyboardKeyProps {
  onPress?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  style: any;
  rippleColor?: string;
  activeScale?: number;
  children?: React.ReactNode;
  [key: string]: any;
}

const KeyboardKey = React.memo(({
  onPress,
  onPressIn,
  onPressOut,
  style,
  rippleColor = colors.surface2,
  activeScale = 0.94,
  children,
  ...rest
}: KeyboardKeyProps) => {
  const scale = useSharedValue(1);
  const rippleOpacity = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const rippleAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: rippleOpacity.value,
      backgroundColor: rippleColor,
    };
  });

  const handlePressIn = () => {
    scale.value = withTiming(activeScale, { duration: 50 });
    rippleOpacity.value = withTiming(1, { duration: 50 });
    if (onPressIn) onPressIn();
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 90 });
    rippleOpacity.value = withTiming(0, { duration: 120 });
    if (onPressOut) onPressOut();
  };

  const flatStyle = StyleSheet.flatten(style) || {};

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      style={{ flex: flatStyle.flex, height: flatStyle.height, width: flatStyle.width }}
      {...rest}
    >
      <Animated.View
        style={[
          flatStyle,
          { flex: 1, height: '100%' },
          animatedStyle
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { borderRadius: flatStyle.borderRadius || radius.sm },
            rippleAnimatedStyle
          ]}
        />
        {children}
      </Animated.View>
    </Pressable>
  );
});


interface CustomWorkoutKeyboardProps {
  visible: boolean;
  value: string;
  onChange: (newValue: string) => void;
  rpeValue?: string;
  onChangeRpe?: (newRpe: string) => void;
  onNext?: () => void;
  onClose: () => void;
  title?: string;
  fieldName?: 'weight' | 'reps' | 'leftWeight' | 'leftReps' | 'rightWeight' | 'rightReps';
  inputKey?: string;
  isRpeMode?: boolean;
  maxLength?: number;
  onHeightChange?: (height: number) => void;
}

const RPE_OPTIONS = ['6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10'];
const RIR_OPTIONS = ['0', '1', '2', '3', '4', '5'];
const REPEAT_START_MS = 350;
const REPEAT_INTERVAL_MS = 55;
const KEY_HIT_SLOP = { top: 6, bottom: 6, left: 6, right: 6 };
const PRESS_RETENTION = { top: 64, bottom: 64, left: 64, right: 64 };

const playFeedback = (type: 'tap' | 'heavy' = 'tap') => {
  if (Platform.OS === 'web') return;
  try {
    Haptics.impactAsync(
      type === 'heavy'
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light
    );
  } catch {}
};

export const CustomWorkoutKeyboard: React.FC<CustomWorkoutKeyboardProps> = React.memo(({
  visible,
  value,
  onChange,
  rpeValue = '',
  onChangeRpe,
  onNext,
  onClose,
  title = '',
  fieldName = 'weight',
  inputKey,
  isRpeMode = true,
  maxLength = 6,
  onHeightChange,
}) => {
  const [showRpeBar, setShowRpeBar] = useState(false);
  const isFirstKeyRef = useRef(true);
  const valueRef = useRef(value);
  const repeatTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeatInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep valueRef in sync with prop (external changes, e.g. field switch).
  useEffect(() => { valueRef.current = value; }, [value]);

  // Reset per-field/per-visibility state + clear any running hold timers.
  useEffect(() => {
    if (visible) {
      setShowRpeBar(false);
      isFirstKeyRef.current = true;
    }
    if (repeatTimer.current) { clearTimeout(repeatTimer.current); repeatTimer.current = null; }
    if (repeatInterval.current) { clearInterval(repeatInterval.current); repeatInterval.current = null; }
  }, [inputKey, visible]);

  // Unmount safety.
  useEffect(() => {
    return () => {
      if (repeatTimer.current) clearTimeout(repeatTimer.current);
      if (repeatInterval.current) clearInterval(repeatInterval.current);
    };
  }, []);

  if (!visible) return null;

  const isRepsField = fieldName?.toLowerCase().includes('reps');
  const keyboardKeys = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    [isRepsField ? '' : '.', '0', '⌫'],
  ];


  const computeNext = (key: string, current: string): string => {
    if (isFirstKeyRef.current) {
      isFirstKeyRef.current = false;
      if (key === '⌫') {
        const nextVal = current.length > 0 ? current.slice(0, -1) : '';
        return nextVal.slice(0, maxLength);
      }
      if (key === '.') return '0.'.slice(0, maxLength);
      return key.slice(0, maxLength);
    }
    if (key === '⌫') {
      const nextVal = current.length > 0 ? current.slice(0, -1) : '';
      return nextVal.slice(0, maxLength);
    }
    if (key === '.') {
      if (current === '') return '0.'.slice(0, maxLength);
      if (current.includes('.')) return current.slice(0, maxLength);
      return (current + '.').slice(0, maxLength);
    }
    // digit
    if (current === '0') return key.slice(0, maxLength);
    if (current.length >= maxLength) return current;
    return (current + key).slice(0, maxLength);
  };

  const handleKeyPress = (key: string) => {
    playFeedback('tap');
    const next = computeNext(key, valueRef.current);
    valueRef.current = next;
    onChange(next);
  };

  const handleBackspaceRepeat = () => {
    const cur = valueRef.current;
    if (cur.length > 0) {
      const next = cur.slice(0, -1);
      valueRef.current = next;
      onChange(next);
    }
  };

  const handleBackspacePressIn = () => {
    handleKeyPress('⌫');
    repeatTimer.current = setTimeout(() => {
      let tick = 0;
      repeatInterval.current = setInterval(() => {
        tick++;
        if (tick % 4 === 0) playFeedback('tap');
        handleBackspaceRepeat();
      }, REPEAT_INTERVAL_MS);
    }, REPEAT_START_MS);
  };

  const clearRepeatTimers = () => {
    if (repeatTimer.current) { clearTimeout(repeatTimer.current); repeatTimer.current = null; }
    if (repeatInterval.current) { clearInterval(repeatInterval.current); repeatInterval.current = null; }
  };

  const handleBackspacePressOut = () => clearRepeatTimers();


  const handleRpeSelect = (rpe: string) => { playFeedback('heavy'); onChangeRpe?.(rpe); };
  const handleRpeClear = () => { playFeedback('heavy'); onChangeRpe?.(''); };

  return (
    <Animated.View
      style={styles.container}
      entering={FadeInDown.duration(getScaledDuration(160))}
      exiting={FadeOutDown.duration(getScaledDuration(120))}
      onLayout={(event) => onHeightChange?.(event.nativeEvent.layout.height)}
    >
      <View style={styles.topBar}>
        <Text style={styles.titleText} numberOfLines={1}>
          {title ? `${title.toUpperCase()}` : ''}
          {fieldName && (
            <Text style={styles.fieldTypeText}>
              {` • ${i18n.t('extras.enteringField', { field: fieldName.toUpperCase() })}`}
            </Text>
          )}
        </Text>
        <Pressable
          style={({ pressed }) => [styles.closeBtn, pressed && { transform: [{ scale: 0.9 }] }]}
          onPress={() => { playFeedback('tap'); onClose(); }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          android_ripple={rippleTokens.borderless}
          {...({ delayPressIn: 0 } as any)}
          accessibilityRole="button"
          accessibilityLabel={i18n.t('extras.hideKeyboardA11y')}
        >
          <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
        </Pressable>
      </View>

      {showRpeBar && (
        <View style={styles.rpeBar}>
          <Text style={styles.rpeBarLabel}>
            {isRpeMode ? i18n.t('customKeyboard.selectRpe') : i18n.t('customKeyboard.selectRir')}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rpeScroll}>
            <Pressable
              style={({ pressed }) => [styles.rpeChip, rpeValue === '' && styles.rpeChipActive, pressed && { transform: [{ scale: 0.95 }] }]}
              onPress={handleRpeClear}
              android_ripple={rippleTokens.surface}
              {...({ delayPressIn: 0 } as any)}
            >
              <Text style={[styles.rpeChipText, rpeValue === '' && styles.rpeChipTextActive]}>{i18n.t('extras.noneRpe')}</Text>
            </Pressable>
            {(isRpeMode ? RPE_OPTIONS : RIR_OPTIONS).map((val) => {
              const isActive = rpeValue === val;
              return (
                <Pressable
                  key={val}
                  style={({ pressed }) => [styles.rpeChip, isActive && styles.rpeChipActive, pressed && { transform: [{ scale: 0.95 }] }]}
                  onPress={() => handleRpeSelect(val)}
                  android_ripple={rippleTokens.surface}
                  {...({ delayPressIn: 0 } as any)}
                >
                  <Text style={[styles.rpeChipText, isActive && styles.rpeChipTextActive]}>{val}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      <View style={styles.keyboardBody}>
        <View style={styles.numPad}>
          {keyboardKeys.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.row}>
              {row.map((key, keyIndex) => {
                if (key === '') {
                  return <View key={`empty-${rowIndex}-${keyIndex}`} style={[styles.key, { backgroundColor: 'transparent', borderColor: 'transparent' }]} />;
                }
                if (key === '⌫') {
                  return (
                    <KeyboardKey
                      key={key}
                      style={styles.key}
                      rippleColor={colors.surface2}
                      onPressIn={handleBackspacePressIn}
                      onPressOut={handleBackspacePressOut}
                      delayPressIn={0}
                      hitSlop={KEY_HIT_SLOP}
                      pressRetentionOffset={PRESS_RETENTION}
                      accessibilityRole="button"
                      accessibilityLabel="Delete last digit"
                    >
                      <Ionicons name="backspace-outline" size={26} color={colors.textPrimary} />
                    </KeyboardKey>
                  );
                }
                return (
                  <KeyboardKey
                    key={key}
                    style={styles.key}
                    rippleColor={colors.surface2}
                    onPress={() => handleKeyPress(key)}
                    delayPressIn={0}
                    hitSlop={KEY_HIT_SLOP}
                    pressRetentionOffset={PRESS_RETENTION}
                    accessibilityRole="button"
                    accessibilityLabel={key === '.' ? 'Decimal point' : `Digit ${key}`}
                  >
                    <Text style={styles.keyText}>{key}</Text>
                  </KeyboardKey>
                );
              })}
            </View>
          ))}
        </View>

        <View style={styles.actionColumn}>
          {onChangeRpe ? (
            <KeyboardKey
              key="rpe-bar-toggle"
              style={[styles.actionKey, showRpeBar && styles.rpeKeyActive]}
              rippleColor={colors.surface2}
              onPress={() => { playFeedback('tap'); setShowRpeBar(v => !v); }}
              delayPressIn={0}
              hitSlop={KEY_HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel={isRpeMode ? 'Select rating of perceived exertion' : 'Select repetitions in reserve'}
            >
              <Ionicons name={showRpeBar ? 'star' : 'star-outline'} size={20} color={showRpeBar ? colors.violet : colors.textSecondary} />
              <Text style={[styles.actionKeyText, showRpeBar && { color: colors.violet }]}>
                {isRpeMode ? i18n.t('customKeyboard.selectRpe').replace('SELECT ', '') : i18n.t('customKeyboard.selectRir').replace('SELECT ', '')}
              </Text>
            </KeyboardKey>
          ) : (
            <View style={[styles.actionKey, { backgroundColor: 'transparent', borderColor: 'transparent' }]} />
          )}

          {onNext ? (
            <KeyboardKey
              key="next-field"
              style={[styles.actionKey, styles.nextKey]}
              rippleColor="rgba(255, 255, 255, 0.2)"
              onPress={() => { playFeedback('heavy'); onNext(); }}
              delayPressIn={0}
              hitSlop={KEY_HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel="Next field"
            >
              <Ionicons name="arrow-forward" size={20} color={colors.bg} />
              <Text style={styles.nextKeyText}>{i18n.t('customKeyboard.next')}</Text>
            </KeyboardKey>
          ) : (
            <KeyboardKey
              key="done-btn"
              style={[styles.actionKey, styles.doneKey]}
              rippleColor="rgba(255, 255, 255, 0.2)"
              onPress={() => { playFeedback('heavy'); onClose(); }}
              delayPressIn={0}
              hitSlop={KEY_HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel="Done"
            >
              <Ionicons name="checkmark" size={20} color={colors.bg} />
              <Text style={styles.doneKeyText}>{i18n.t('customKeyboard.done')}</Text>
            </KeyboardKey>
          )}
        </View>
      </View>
    </Animated.View>
  );
});

const KEY_HEIGHT = 56;
const ACTION_KEY_HEIGHT = 120; // 120 with gap 6

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    height: 38,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  titleText: { color: colors.textMuted, fontSize: font.sizes.xs, fontFamily: font.bold, letterSpacing: 1, flexShrink: 1 },
  fieldTypeText: { color: colors.accent },
  closeBtn: { padding: spacing.xs, justifyContent: 'center', alignItems: 'center' },
  rpeBar: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(124, 92, 252, 0.03)',
  },
  rpeBarLabel: { color: colors.violet, fontSize: font.sizes.xs, fontFamily: font.bold, letterSpacing: 1, paddingHorizontal: spacing.md, marginBottom: spacing.xs },
  rpeScroll: { paddingHorizontal: spacing.md, columnGap: spacing.xs },
  rpeChip: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.xs, paddingVertical: 5, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center' },
  rpeChipActive: { backgroundColor: colors.violet, borderColor: colors.violet },
  rpeChipText: { color: colors.textSecondary, fontSize: font.sizes.xs, fontFamily: font.bold },
  rpeChipTextActive: { color: colors.bg },
  keyboardBody: { flexDirection: 'row', padding: spacing.sm, gap: 6 },
  numPad: { flex: 3, rowGap: 6 },
  row: { flexDirection: 'row', gap: 6 },
  key: {
    flex: 1,
    height: KEY_HEIGHT,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: { color: colors.textPrimary, fontSize: 24, fontFamily: font.semibold },
  actionColumn: { flex: 1, rowGap: 6 },
  actionKey: {
    flex: 1,
    height: ACTION_KEY_HEIGHT,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    rowGap: 4,
  },
  rpeKeyActive: {
    borderColor: colors.violet,
    backgroundColor: 'rgba(124, 92, 252, 0.05)',
  },
  actionKeyText: {
    color: colors.textSecondary,
    fontSize: font.sizes.xs,
    fontFamily: font.bold,
  },
  nextKey: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  nextKeyText: {
    color: colors.bg,
    fontSize: font.sizes.xs,
    fontFamily: font.bold,
  },
  doneKey: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  doneKeyText: {
    color: colors.bg,
    fontSize: font.sizes.xs,
    fontFamily: font.bold,
  },
});
