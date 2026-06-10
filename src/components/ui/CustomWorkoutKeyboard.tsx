// components/ui/CustomWorkoutKeyboard.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Vibration,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, spacing, radius, ripple as rippleTokens } from '../../theme';

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
  const [lastInputKey, setLastInputKey] = useState<string | undefined>(undefined);
  const [lastVisible, setLastVisible] = useState<boolean>(false);
  const [isFirstKey, setIsFirstKey] = useState(true);

  if (inputKey !== lastInputKey || visible !== lastVisible) {
    setLastInputKey(inputKey);
    setLastVisible(visible);
    if (visible) {
      setIsFirstKey(true);
    }
  }

  if (!visible) return null;

  const playFeedback = (type: 'tap' | 'heavy' = 'tap') => {
    if (Platform.OS !== 'web') {
      Vibration.vibrate(type === 'heavy' ? 15 : 8);
    }
  };

  const handleKeyPress = (key: string) => {
    playFeedback('tap');

    if (isFirstKey) {
      setIsFirstKey(false);
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

  const keys = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['.', '0', '⌫'],
  ];

  return (
    <View style={styles.container}>
      {/* ── Top Bar / Header ── */}
      <View style={styles.topBar}>
        <Text style={styles.titleText}>
          {title ? `${title.toUpperCase()}` : ''}
          {fieldName && (
            <Text style={styles.fieldTypeText}>
              {` • ENTERING ${fieldName.toUpperCase()}`}
            </Text>
          )}
        </Text>
        <Pressable
          style={styles.closeBtn}
          onPress={() => {
            playFeedback('tap');
            onClose();
          }}
          android_ripple={rippleTokens.borderless}
          accessibilityLabel="Hide keyboard"
        >
          <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* ── RPE/RIR Selector Bar (Expands above key pad) ── */}
      {showRpeBar && (
        <View style={styles.rpeBar}>
          <Text style={styles.rpeBarLabel}>{isRpeMode ? 'SELECT RPE' : 'SELECT RIR'}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rpeScroll}
          >
            <Pressable
              style={[styles.rpeChip, rpeValue === '' && styles.rpeChipActive]}
              onPress={handleRpeClear}
              android_ripple={rippleTokens.surface}
            >
              <Text style={[styles.rpeChipText, rpeValue === '' && styles.rpeChipTextActive]}>
                NONE
              </Text>
            </Pressable>
            {(isRpeMode ? RPE_OPTIONS : RIR_OPTIONS).map((val) => {
              const isActive = rpeValue === val;
              return (
                <Pressable
                  key={val}
                  style={[styles.rpeChip, isActive && styles.rpeChipActive]}
                  onPress={() => handleRpeSelect(val)}
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
          {keys.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.row}>
              {row.map((key) => {
                const isBackspace = key === '⌫';
                return (
                  <Pressable
                    key={key}
                    style={styles.key}
                    onPress={() => handleKeyPress(key)}
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
              style={[styles.actionKey, showRpeBar && styles.rpeKeyActive]}
              onPress={() => {
                playFeedback('tap');
                setShowRpeBar(!showRpeBar);
              }}
              android_ripple={rippleTokens.surface}
            >
              <Ionicons
                name={showRpeBar ? 'star' : 'star-outline'}
                size={20}
                color={showRpeBar ? colors.violet : colors.textSecondary}
              />
              <Text style={[styles.actionKeyText, showRpeBar && { color: colors.violet }]}>
                {isRpeMode ? 'RPE' : 'RIR'}
              </Text>
            </Pressable>
          ) : (
            <View style={[styles.actionKey, { backgroundColor: 'transparent', borderColor: 'transparent' }]} />
          )}

          {/* Next Button */}
          {onNext ? (
            <Pressable
              style={[styles.actionKey, styles.nextKey]}
              onPress={() => {
                playFeedback('heavy');
                onNext();
              }}
              android_ripple={rippleTokens.accent}
            >
              <Ionicons name="arrow-forward" size={20} color="#0D0F14" />
              <Text style={styles.nextKeyText}>NEXT</Text>
            </Pressable>
          ) : (
            <Pressable
              style={[styles.actionKey, styles.doneKey]}
              onPress={() => {
                playFeedback('heavy');
                onClose();
              }}
              android_ripple={rippleTokens.accent}
            >
              <Ionicons name="checkmark" size={20} color="#0D0F14" />
              <Text style={styles.doneKeyText}>DONE</Text>
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
