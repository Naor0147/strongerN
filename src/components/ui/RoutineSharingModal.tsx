// components/ui/RoutineSharingModal.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Rect, Path } from 'react-native-svg';
import { colors, font, spacing, radius, ripple as rippleTokens } from '../../theme';
import { Template } from '../../data/mockData';

interface RoutineSharingModalProps {
  visible: boolean;
  template: Template | null;
  onClose: () => void;
}

export const RoutineSharingModal: React.FC<RoutineSharingModalProps> = ({
  visible,
  template,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'link' | 'qr' | 'json'>('link');

  if (!template) return null;

  // Reconstruct sharing string payload
  const sharePayload = {
    name: template.name,
    exercises: template.exercises,
    folder: template.folder,
  };
  const serialized = JSON.stringify(sharePayload);
  const deepLink = `strongern://share?routine=${encodeURIComponent(serialized)}`;

  const handleCopy = (text: string, type: string) => {
    Alert.alert("Copied!", `${type} copied to clipboard! You can share it anywhere.`);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>SHARE ROUTINE</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <Text style={styles.subtitle}>{template.name.toUpperCase()}</Text>

          {/* Selector Tabs */}
          <View style={styles.tabs}>
            <Pressable
              style={[styles.tab, activeTab === 'link' && styles.tabActive]}
              onPress={() => setActiveTab('link')}
            >
              <Text style={[styles.tabText, activeTab === 'link' && styles.tabTextActive]}>DEEP LINK</Text>
            </Pressable>
            <Pressable
              style={[styles.tab, activeTab === 'qr' && styles.tabActive]}
              onPress={() => setActiveTab('qr')}
            >
              <Text style={[styles.tabText, activeTab === 'qr' && styles.tabTextActive]}>QR CODE</Text>
            </Pressable>
            <Pressable
              style={[styles.tab, activeTab === 'json' && styles.tabActive]}
              onPress={() => setActiveTab('json')}
            >
              <Text style={[styles.tabText, activeTab === 'json' && styles.tabTextActive]}>JSON PAYLOAD</Text>
            </Pressable>
          </View>

          <View style={styles.content}>
            {activeTab === 'link' && (
              <View style={styles.tabContent}>
                <Text style={styles.instructions}>
                  Share this deep link. Tapping it on another device will automatically import this routine!
                </Text>
                <TextInput
                  style={styles.textInput}
                  value={deepLink}
                  editable={false}
                  selectTextOnFocus
                />
                <Pressable
                  style={styles.actionBtn}
                  onPress={() => handleCopy(deepLink, 'Deep Link')}
                >
                  <Ionicons name="copy-outline" size={16} color="#0D0F14" />
                  <Text style={styles.actionBtnText}>COPY DEEP LINK</Text>
                </Pressable>
              </View>
            )}

            {activeTab === 'qr' && (
              <View style={[styles.tabContent, { alignItems: 'center' }]}>
                <Text style={[styles.instructions, { textAlign: 'center' }]}>
                  Ask a gym buddy to scan this QR code to instantly import your routine split.
                </Text>
                
                {/* Simulated QR Code using React Native SVG */}
                <View style={styles.qrContainer}>
                  <Svg width={140} height={140} viewBox="0 0 100 100">
                    <Rect width={100} height={100} fill="#0D0F14" />
                    {/* Corners finders */}
                    <Rect x={4} y={4} width={24} height={24} fill={colors.accent} rx={3} />
                    <Rect x={7} y={7} width={18} height={18} fill="#0D0F14" rx={2} />
                    <Rect x={10} y={10} width={12} height={12} fill={colors.accent} rx={1} />

                    <Rect x={72} y={4} width={24} height={24} fill={colors.accent} rx={3} />
                    <Rect x={75} y={7} width={18} height={18} fill="#0D0F14" rx={2} />
                    <Rect x={78} y={10} width={12} height={12} fill={colors.accent} rx={1} />

                    <Rect x={4} y={72} width={24} height={24} fill={colors.accent} rx={3} />
                    <Rect x={7} y={75} width={18} height={18} fill="#0D0F14" rx={2} />
                    <Rect x={10} y={78} width={12} height={12} fill={colors.accent} rx={1} />

                    {/* Randomized digital matrix pattern blocks */}
                    <Path
                      d="M36,12 H48 V16 H36 Z M56,8 H64 V12 H56 Z M36,24 H40 V36 H36 Z M48,28 H56 V32 H48 Z M40,44 H48 V48 H40 Z M64,36 H76 V40 H64 Z M52,52 H64 V56 H52 Z M24,52 H32 V60 H24 Z M12,48 H16 V60 H12 Z M60,68 H72 V76 H60 Z M76,56 H84 V68 H76 Z M88,76 H96 V84 H88 Z M76,80 H80 V92 H76 Z M36,80 H44 V88 H36 Z M48,76 H52 V84 H48 Z"
                      fill={colors.accent}
                    />
                    <Path
                      d="M20,38 H28 V42 H20 Z M44,64 H52 V68 H44 Z M68,84 H72 V92 H68 Z M84,36 H92 V44 H84 Z M8,64 H12 V68 H8 Z"
                      fill={colors.highlight}
                    />
                  </Svg>
                </View>

                <Pressable
                  style={[styles.actionBtn, { backgroundColor: colors.highlight }]}
                  onPress={() => Alert.alert("QR Code", "QR Code successfully generated! Your gym buddy can scan this.")}
                >
                  <Ionicons name="camera-outline" size={16} color="#0D0F14" />
                  <Text style={[styles.actionBtnText, { color: '#0D0F14' }]}>SHOW SCAN SCANNER</Text>
                </Pressable>
              </View>
            )}

            {activeTab === 'json' && (
              <View style={styles.tabContent}>
                <Text style={styles.instructions}>
                  Copy this JSON payload string. Paste it in the import box on another device to restore this routine.
                </Text>
                <TextInput
                  style={[styles.textInput, styles.codeBox]}
                  value={serialized}
                  editable={false}
                  multiline
                  selectTextOnFocus
                />
                <Pressable
                  style={styles.actionBtn}
                  onPress={() => handleCopy(serialized, 'JSON Data')}
                >
                  <Ionicons name="copy-outline" size={16} color="#0D0F14" />
                  <Text style={styles.actionBtnText}>COPY JSON STRING</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 10, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm,
  },
  title: {
    color: colors.accent,
    fontSize: font.sizes.sm,
    fontFamily: font.bold,
    letterSpacing: 1.5,
  },
  closeBtn: {
    padding: 2,
  },
  subtitle: {
    color: colors.textPrimary,
    fontSize: font.sizes.base,
    fontFamily: font.bold,
    marginTop: spacing.md,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  tabs: {
    flexDirection: 'row',
    marginTop: spacing.md,
    backgroundColor: colors.surface2,
    borderRadius: radius.xs,
    padding: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: radius.xs,
  },
  tabActive: {
    backgroundColor: colors.surface,
  },
  tabText: {
    color: colors.textMuted,
    fontSize: 9,
    fontFamily: font.bold,
  },
  tabTextActive: {
    color: colors.accent,
  },
  content: {
    marginTop: spacing.md,
  },
  tabContent: {
    rowGap: spacing.sm,
  },
  instructions: {
    color: colors.textSecondary,
    fontSize: 11,
    fontFamily: font.medium,
    lineHeight: 16,
  },
  textInput: {
    backgroundColor: colors.surface2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.xs,
    color: colors.textPrimary,
    padding: spacing.sm,
    fontSize: 11,
    fontFamily: 'monospace',
  },
  codeBox: {
    height: 80,
    textAlignVertical: 'top',
  },
  actionBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
    marginTop: 4,
  },
  actionBtnText: {
    color: '#0D0F14',
    fontSize: font.sizes.xs,
    fontFamily: font.bold,
  },
  qrContainer: {
    padding: spacing.md,
    backgroundColor: '#0D0F14',
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    marginVertical: spacing.xs,
  },
});
