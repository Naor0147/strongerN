import React, { useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radius, font, ripple as rippleTokens } from '../../theme';
import i18n from '../../utils/i18n';

const triggerHaptic = (type: string) => {
  try {
    if (type === 'selection') Haptics.selectionAsync();
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch (e) {}
};

export interface VariationDropdownProps {
  variations: string[];
  activeVariation?: string;
  onSelectVariation: (variation: string | undefined) => void;
  onManageVariations?: () => void;
}

export const VariationDropdown: React.FC<VariationDropdownProps> = ({
  variations,
  activeVariation,
  onSelectVariation,
  onManageVariations,
}) => {
  const [modalVisible, setModalVisible] = useState(false);

  // Base display text
  const displayText = activeVariation || i18n.t('variations.base', { defaultValue: 'Base' });

  const handleSelect = (v: string | undefined) => {
    triggerHaptic('selection');
    onSelectVariation(v);
    setModalVisible(false);
  };

  return (
    <View>
      <Pressable
        onPress={() => {
          triggerHaptic('impactLight');
          setModalVisible(true);
        }}
        style={({ pressed }) => [
          styles.chipBtn,
          activeVariation ? styles.chipBtnActive : null,
          pressed && { opacity: 0.8 },
        ]}
        android_ripple={rippleTokens.surface}
        accessibilityLabel={`Variation dropdown, current: ${displayText}`}
      >
        <Ionicons name="pricetag-outline" size={12} color={activeVariation ? colors.accent : colors.textMuted} style={{ marginRight: 4 }} />
        <Text style={[styles.chipText, activeVariation ? styles.chipTextActive : null]} numberOfLines={1}>
          {displayText}
        </Text>
        <Ionicons
          name="chevron-down"
          size={12}
          color={activeVariation ? colors.accent : colors.textMuted}
          style={{ marginLeft: 3 }}
        />
      </Pressable>

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <View style={styles.dropdownMenu}>
            <View style={styles.menuHeader}>
              <Ionicons name="pricetags" size={16} color={colors.accent} />
              <Text style={styles.menuTitle}>
                {i18n.t('variations.selectTitle', { defaultValue: 'Select Variation' })}
              </Text>
            </View>

            <ScrollView style={{ maxHeight: 240 }} keyboardShouldPersistTaps="handled">
              {/* Option 1: Base (No Variation) */}
              <Pressable
                style={({ pressed }) => [
                  styles.optionRow,
                  !activeVariation && styles.optionRowSelected,
                  pressed && { backgroundColor: colors.surface2 },
                ]}
                onPress={() => handleSelect(undefined)}
                android_ripple={rippleTokens.surface}
              >
                <Text style={[styles.optionText, !activeVariation && styles.optionTextSelected]}>
                  {i18n.t('variations.base', { defaultValue: 'Base (No Tag)' })}
                </Text>
                {!activeVariation && (
                  <Ionicons name="checkmark" size={16} color={colors.accent} />
                )}
              </Pressable>

              {/* Tag Options */}
              {variations.map((v) => {
                const isSelected = activeVariation?.toLowerCase() === v.toLowerCase();
                return (
                  <Pressable
                    key={v}
                    style={({ pressed }) => [
                      styles.optionRow,
                      isSelected && styles.optionRowSelected,
                      pressed && { backgroundColor: colors.surface2 },
                    ]}
                    onPress={() => handleSelect(v)}
                    android_ripple={rippleTokens.surface}
                  >
                    <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                      {v}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark" size={16} color={colors.accent} />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>

            {onManageVariations && (
              <Pressable
                style={styles.manageBtn}
                onPress={() => {
                  setModalVisible(false);
                  onManageVariations();
                }}
                android_ripple={rippleTokens.surface}
              >
                <Ionicons name="add-circle-outline" size={16} color={colors.accent} style={{ marginRight: 6 }} />
                <Text style={styles.manageBtnText}>
                  {i18n.t('variations.manage', { defaultValue: 'Manage Tags' })}
                </Text>
              </Pressable>
            )}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  chipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    backgroundColor: colors.surface2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
    maxWidth: 130,
  },
  chipBtnActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(79, 142, 247, 0.12)',
  },
  chipText: {
    fontSize: font.sizes.xs,
    fontFamily: font.medium,
    color: colors.textMuted,
  },
  chipTextActive: {
    color: colors.accent,
    fontFamily: font.semibold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  dropdownMenu: {
    width: '85%',
    maxWidth: 320,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.surfaceHigh,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.xs,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface2,
    marginBottom: spacing.xs,
  },
  menuTitle: {
    fontSize: font.sizes.sm,
    fontFamily: font.semibold,
    color: colors.textPrimary,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.xs,
    marginVertical: 1,
  },
  optionRowSelected: {
    backgroundColor: 'rgba(79, 142, 247, 0.15)',
  },
  optionText: {
    fontSize: font.sizes.sm,
    fontFamily: font.regular,
    color: colors.textSecondary,
  },
  optionTextSelected: {
    fontFamily: font.semibold,
    color: colors.accent,
  },
  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.sm + 2,
    marginTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.surface2,
  },
  manageBtnText: {
    fontSize: font.sizes.xs,
    fontFamily: font.medium,
    color: colors.accent,
  },
});
