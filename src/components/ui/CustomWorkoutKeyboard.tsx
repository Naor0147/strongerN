// components/ui/CustomWorkoutKeyboard.tsx
import React, { useState, useRef } from 'react';
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
import { colors, font, spacing, radius, ripple as rippleTokens } from '../../theme';
import i18n from '../../utils/i18n';

interface CustomWorkoutKeyboardProps {
  visible: boolean;
  value: string;
  onChange: (newValue: string) => void;
  rpeValue?: string;
  onChangeRpe?: (newRpe: string) => void;
  onNext?: () => void;
  onClose: () => void;
  placeholder?: string;
  title?: string;
  fieldName?: 'weight' | 'reps' | 'leftWeight' | 'leftReps' | 'rightWeight' | 'rightReps';
  inputKey?: string;
  isRpeMode?: boolean;
}

const RPE_OPTIONS = ['6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10'];
const RIR_OPTIONS = ['0', '1', '2', '3', '4', '5'];
const KEYBOARD_KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', '⌫'],
];

const playFeedback = (type: 'tap' | 'heavy' = 'tap') => {
  if (Platform.OS !== 'web') {
    if (type === 'heavy') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  }
};

export const CustomWorkoutKeyboard: React.FC<CustomWorkoutKeyboardProps> = ({
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
}) => {
  const [showRpeBar, setShowRpeBar] = useState(false);
  const lastInputKeyRef = useRef<string | undefined>(undefined);
  const lastVisibleRef = useRef<boolean>(false);
  const isFirstKeyRef = useRef(true);

  if (inputKey !== lastInputKeyRef.current || visible !== lastVisibleRef.current) {
    lastInputKeyRef.current = inputKey;
    lastVisibleRef.current = visible;
    if (visible) {
      isFirstKeyRef.current = true;
    }
  }

  if (!visible) return null;

  const handleKeyPress = (key: string) => {
    playFeedback('tap');

    if (isFirstKeyRef.current) {
      isFirstKeyRef.current = false;
      if (key === '⌫') {
        onChange('');
      } else if (key === '.') {
        onChange('0.');
      } else {
        onChange(key);
      }
      return;
    }

    if (key === '⌫') {
      if (value.length > 0) {
        onChange(value.slice(0, -1));
      }
    } else if (key === '.') {
      if (!value.includes('.')) {
        onChange(value + '.');
      }
    } else {
      // Prevent leading multiple zeros
      if (value === '0') {
        onChange(key);
      } else {
        onChange(value + key);
      }
    }
  };

  const handleRpeSelect = (rpe: string) => {
    playFeedback('heavy');
    if (onChangeRpe) {
      onChangeRpe(rpe);
    }
  };

  const handleRpeClear = () => {
    playFeedback('heavy');
    if (onChangeRpe) {
      onChangeRpe('');
    }
  };

  return (
    <View style={styles.container}>
      {/* ── Top Bar / Header ── */}
      <View style={styles.topBar}>
        <Text style={styles.titleText}>
          {title ? `${title.toUpperCase()}` : ''}
          {fieldName && (
            <Text style={styles.fieldTypeText}>
              {` • ${i18n.t('extras.enteringField', { field: fieldName.toUpperCase() })}`}
            </Text>
          )}
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.closeBtn,
            pressed && { transform: [{ scale: 0.9 }] }
          ]}
          onPress={() => {
            playFeedback('tap');
            onClose();
          }}
          android_ripple={rippleTokens.borderless}
          accessibilityLabel={i18n.t('extras.hideKeyboardA11y')}
        >
          <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* ── RPE/RIR Selector Bar (Expands above key pad) ── */}
      {showRpeBar && (
        <View style={styles.rpeBar}>
          <Text style={styles.rpeBarLabel}>{isRpeMode ? i18n.t('customKeyboard.selectRpe') : i18n.t('customKeyboard.selectRir')}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rpeScroll}
          >
            <Pressable
              style={({ pressed }) => [
                styles.rpeChip,
                rpeValue === '' && styles.rpeChipActive,
                pressed && { transform: [{ scale: 0.95 }] }
              ]}
              onPress={handleRpeClear}
              unstable_pressDelay={0}
              android_ripple={rippleTokens.surface}
            >
              <Text style={[styles.rpeChipText, rpeValue === '' && styles.rpeChipTextActive]}>
                {i18n.t('extras.noneRpe')}
              </Text>
            </Pressable>
            {(isRpeMode ? RPE_OPTIONS : RIR_OPTIONS).map((val) => {
              const isActive = rpeValue === val;
              return (
                <Pressable
                  key={val}
                  style={({ pressed }) => [
                    styles.rpeChip,
                    isActive && styles.rpeChipActive,
                    pressed && { transform: [{ scale: 0.95 }] }
                  ]}
                  onPress={() => handleRpeSelect(val)}
                  unstable_pressDelay={0}
                  android_ripple={rippleTokens.surface}
                >
                  <Text style={[styles.rpeChipText, isActive && styles.rpeChipTextActive]}>
                    {val}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* ── Main Keyboard Layout ── */}
      <View style={styles.keyboardBody}>
        {/* Left Side: Number Pad */}
        <View style={styles.numPad}>
          {KEYBOARD_KEYS.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.row}>
              {row.map((key) => {
                const isBackspace = key === '⌫';
                return (
                  <Pressable
                    key={key}
                    style={({ pressed }) => [
                      styles.key,
                      pressed && { 
                        backgroundColor: colors.surface2, 
                        transform: [{ scale: 0.95 }] 
                      }
                    ]}
                    onPress={() => handleKeyPress(key)}
                    unstable_pressDelay={0}
                    android_ripple={rippleTokens.surface}
                  >
                    {isBackspace ? (
                      <Ionicons name="backspace-outline" size={22} color={colors.textPrimary} />
                    ) : (
                      <Text style={styles.keyText}>{key}</Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        {/* Right Side: Quick Action Columns */}
        <View style={styles.actionColumn}>
          {/* RPE/RIR Toggle Button */}
          {onChangeRpe ? (
            <Pressable
              style={({ pressed }) => [
                styles.actionKey,
                showRpeBar && styles.rpeKeyActive,
                pressed && { transform: [{ scale: 0.95 }] }
              ]}
              onPress={() => {
                playFeedback('tap');
                setShowRpeBar(!showRpeBar);
              }}
              unstable_pressDelay={0}
              android_ripple={rippleTokens.surface}
            >
              <Ionicons
                name={showRpeBar ? 'star' : 'star-outline'}
                size={20}
                color={showRpeBar ? colors.violet : colors.textSecondary}
              />
              <Text style={[styles.actionKeyText, showRpeBar && { color: colors.violet }]}>
                {isRpeMode ? i18n.t('customKeyboard.selectRpe').replace('SELECT ', '') : i18n.t('customKeyboard.selectRir').replace('SELECT ', '')}
              </Text>
            </Pressable>
          ) : (
            <View style={[styles.actionKey, { backgroundColor: 'transparent', borderColor: 'transparent' }]} />
          )}

          {/* Next Button */}
          {onNext ? (
            <Pressable
              style={({ pressed }) => [
                styles.actionKey,
                styles.nextKey,
                pressed && { opacity: 0.85, transform: [{ scale: 0.95 }] }
              ]}
              onPress={() => {
                playFeedback('heavy');
                onNext();
              }}
              unstable_pressDelay={0}
              android_ripple={rippleTokens.accent}
            >
              <Ionicons name="arrow-forward" size={20} color="#0D0F14" />
              <Text style={styles.nextKeyText}>{i18n.t('customKeyboard.next')}</Text>
            </Pressable>
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.actionKey,
                styles.doneKey,
                pressed && { opacity: 0.85, transform: [{ scale: 0.95 }] }
              ]}
              onPress={() => {
                playFeedback('heavy');
                onClose();
              }}
              unstable_pressDelay={0}
              android_ripple={rippleTokens.accent}
            >
              <Ionicons name="checkmark" size={20} color="#0D0F14" />
              <Text style={styles.doneKeyText}>{i18n.t('customKeyboard.done')}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0D0F14',
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
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  titleText: {
    color: colors.textMuted,
    fontSize: 9,
    fontFamily: font.bold,
    letterSpacing: 1,
  },
  fieldTypeText: {
    color: colors.accent,
  },
  closeBtn: {
    padding: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rpeBar: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(124, 92, 252, 0.03)',
  },
  rpeBarLabel: {
    color: colors.violet,
    fontSize: 8,
    fontFamily: font.bold,
    letterSpacing: 1,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  rpeScroll: {
    paddingHorizontal: spacing.md,
    columnGap: spacing.xs,
  },
  rpeChip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.xs,
    paddingVertical: 5,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rpeChipActive: {
    backgroundColor: colors.violet,
    borderColor: colors.violet,
  },
  rpeChipText: {
    color: colors.textSecondary,
    fontSize: font.sizes.xs,
    fontFamily: font.bold,
  },
  rpeChipTextActive: {
    color: '#0D0F14',
  },
  keyboardBody: {
    flexDirection: 'row',
    padding: spacing.sm,
    gap: spacing.sm,
  },
  numPad: {
    flex: 3,
    rowGap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  key: {
    flex: 1,
    height: 48,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    color: colors.textPrimary,
    fontSize: font.sizes.lg,
    fontFamily: font.semibold,
  },
  actionColumn: {
    flex: 1,
    rowGap: spacing.sm,
  },
  actionKey: {
    flex: 1,
    height: 104, // Height matching 2 rows
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
    fontSize: 10,
    fontFamily: font.bold,
  },
  nextKey: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  nextKeyText: {
    color: '#0D0F14',
    fontSize: 10,
    fontFamily: font.bold,
  },
  doneKey: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  doneKeyText: {
    color: '#0D0F14',
    fontSize: 10,
    fontFamily: font.bold,
  },
});
