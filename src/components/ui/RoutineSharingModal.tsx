// components/ui/RoutineSharingModal.tsx
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  Alert,
  Clipboard,
  ToastAndroid,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { colors, font, spacing, radius, ripple as rippleTokens } from '../../theme';
import { Template } from '../../data/mockData';
import i18n from '../../utils/i18n';

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
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback((text: string) => {
    try {
      Clipboard.setString(text);
      setCopied(true);
      if (Platform.OS === 'android') {
        ToastAndroid.show('Copied to clipboard!', ToastAndroid.SHORT);
      } else {
        Alert.alert(i18n.t('routineSharing.copied'), i18n.t('routineSharing.copiedMsg', { type: activeTab === 'link' ? 'Deep Link' : 'JSON Data' }));
      }
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      Alert.alert('Error', 'Failed to copy to clipboard');
    }
  }, [activeTab]);

  if (!template) return null;

  // Reconstruct sharing string payload
  const sharePayload = {
    name: template.name,
    exercises: template.exercises,
    folder: template.folder,
    ...(template.exercisesDetails ? { exercisesDetails: template.exercisesDetails } : {}),
  };
  const serialized = JSON.stringify(sharePayload);
  const deepLink = `strongern://share?routine=${encodeURIComponent(serialized)}`;

  // For QR, use a compact version to stay within QR size limits
  const qrPayload = JSON.stringify({
    n: template.name,
    e: template.exercises,
    ...(template.folder ? { f: template.folder } : {}),
    ...(template.exercisesDetails?.length ? { d: template.exercisesDetails } : {}),
  });

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
            <Text style={styles.title}>{i18n.t('routineSharing.shareRoutine')}</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <Text style={styles.subtitle}>{template.name.toUpperCase()}</Text>

          {/* Selector Tabs */}
          <View style={styles.tabs}>
            <Pressable
              style={[styles.tab, activeTab === 'link' && styles.tabActive]}
              onPress={() => { setActiveTab('link'); setCopied(false); }}
            >
              <Text style={[styles.tabText, activeTab === 'link' && styles.tabTextActive]}>{i18n.t('routineSharing.deepLink')}</Text>
            </Pressable>
            <Pressable
              style={[styles.tab, activeTab === 'qr' && styles.tabActive]}
              onPress={() => { setActiveTab('qr'); setCopied(false); }}
            >
              <Text style={[styles.tabText, activeTab === 'qr' && styles.tabTextActive]}>{i18n.t('routineSharing.qrCode')}</Text>
            </Pressable>
            <Pressable
              style={[styles.tab, activeTab === 'json' && styles.tabActive]}
              onPress={() => { setActiveTab('json'); setCopied(false); }}
            >
              <Text style={[styles.tabText, activeTab === 'json' && styles.tabTextActive]}>{i18n.t('routineSharing.jsonPayload')}</Text>
            </Pressable>
          </View>

          <View style={styles.content}>
            {activeTab === 'link' && (
              <View style={styles.tabContent}>
                <Text style={styles.instructions}>
                  {i18n.t('routineSharing.deepLinkDesc')}
                </Text>
                <TextInput
                  style={styles.textInput}
                  value={deepLink}
                  editable={false}
                  selectTextOnFocus
                />
                <Pressable
                  style={[styles.actionBtn, copied && styles.actionBtnCopied]}
                  onPress={() => handleCopy(deepLink)}
                  android_ripple={rippleTokens.accent}
                >
                  <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color="#0D0F14" />
                  <Text style={styles.actionBtnText}>
                    {copied ? 'Copied!' : i18n.t('routineSharing.copyDeepLink')}
                  </Text>
                </Pressable>
              </View>
            )}

            {activeTab === 'qr' && (
              <View style={[styles.tabContent, { alignItems: 'center' }]}>
                <Text style={[styles.instructions, { textAlign: 'center' }]}>
                  {i18n.t('routineSharing.qrCodeDesc')}
                </Text>
                
                {/* Real QR Code generated from routine data */}
                <View style={styles.qrContainer}>
                  <QRCode
                    value={qrPayload}
                    size={160}
                    color={colors.accent}
                    backgroundColor="#0D0F14"
                    ecl="L"
                  />
                </View>

                <Pressable
                  style={[styles.actionBtn, copied && styles.actionBtnCopied]}
                  onPress={() => handleCopy(qrPayload)}
                  android_ripple={rippleTokens.accent}
                >
                  <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color="#0D0F14" />
                  <Text style={styles.actionBtnText}>
                    {copied ? 'Copied!' : 'Copy QR Data'}
                  </Text>
                </Pressable>
              </View>
            )}

            {activeTab === 'json' && (
              <View style={styles.tabContent}>
                <Text style={styles.instructions}>
                  {i18n.t('routineSharing.jsonPayloadDesc')}
                </Text>
                <TextInput
                  style={[styles.textInput, styles.codeBox]}
                  value={serialized}
                  editable={false}
                  multiline
                  selectTextOnFocus
                />
                <Pressable
                  style={[styles.actionBtn, copied && styles.actionBtnCopied]}
                  onPress={() => handleCopy(serialized)}
                  android_ripple={rippleTokens.accent}
                >
                  <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color="#0D0F14" />
                  <Text style={styles.actionBtnText}>
                    {copied ? 'Copied!' : i18n.t('routineSharing.copyJsonString')}
                  </Text>
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
    boxShadow: '0px 6px 12px rgba(0, 0, 0, 0.5)',
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
  actionBtnCopied: {
    backgroundColor: colors.success,
  },
  actionBtnText: {
    color: '#0D0F14',
    fontSize: font.sizes.xs,
    fontFamily: font.bold,
  },
  qrContainer: {
    padding: spacing.lg,
    backgroundColor: '#0D0F14',
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    marginVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
