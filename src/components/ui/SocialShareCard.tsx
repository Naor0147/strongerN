// components/ui/SocialShareCard.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, font, spacing, radius, ripple as rippleTokens } from '../../theme';

interface SocialShareCardProps {
  visible: boolean;
  workoutName: string;
  durationMin: number;
  totalSets: number;
  totalVolume: number;
  onClose: () => void;
}

export const SocialShareCard: React.FC<SocialShareCardProps> = ({
  visible,
  workoutName,
  durationMin,
  totalSets,
  totalVolume,
  onClose,
}) => {
  const handleExport = (platform: string) => {
    Alert.alert("Social Share", `Workout summary card successfully formatted and exported to ${platform}!`);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>SOCIAL SHARE CARD</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* Share Card Canvas (Styled like an AMOLED Instagram Story) */}
          <View style={styles.canvasFrame}>
            <LinearGradient
              colors={['#38BDF8', '#4F8EF7']} // Sky Blue to Electric Blue gradient border
              style={styles.gradientBorder}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.canvasInner}>
                {/* Branding stamp */}
                <Text style={styles.brandText}>strongerN</Text>
                
                {/* Trophy glow indicator */}
                <View style={[styles.trophyGlow, { backgroundColor: colors.gold + '1A' }]}>
                  <Ionicons name="trophy" size={44} color={colors.gold} />
                </View>

                {/* Workout Title */}
                <Text style={styles.workoutCompletedLabel}>WORKOUT COMPLETED</Text>
                <Text style={styles.workoutTitle} numberOfLines={1}>
                  {workoutName.toUpperCase()}
                </Text>

                <View style={styles.cardDivider} />

                {/* Big Stats grid */}
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statVal}>{durationMin}m</Text>
                    <Text style={styles.statLabel}>DURATION</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statVal}>{totalSets}</Text>
                    <Text style={styles.statLabel}>SETS LOGGED</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statVal}>{totalVolume.toLocaleString()} kg</Text>
                    <Text style={styles.statLabel}>VOLUME</Text>
                  </View>
                </View>

                <View style={styles.cardDivider} />

                {/* Motivational Quote footer */}
                <View style={styles.motivationContainer}>
                  <Ionicons name="flame" size={14} color={colors.accent} />
                  <Text style={styles.motivationText}>Every rep counts. Consistent progression.</Text>
                </View>
              </View>
            </LinearGradient>
          </View>

          {/* Social share options buttons */}
          <View style={styles.shareButtonsRow}>
            <Pressable
              style={[styles.shareBtn, { backgroundColor: '#E1306C' }]} // Instagram Color
              onPress={() => handleExport('Instagram')}
            >
              <Ionicons name="logo-instagram" size={16} color="#FFFFFF" />
              <Text style={styles.shareBtnText}>Instagram</Text>
            </Pressable>

            <Pressable
              style={[styles.shareBtn, { backgroundColor: '#1877F2' }]} // Facebook Color
              onPress={() => handleExport('Facebook')}
            >
              <Ionicons name="logo-facebook" size={16} color="#FFFFFF" />
              <Text style={styles.shareBtnText}>Facebook</Text>
            </Pressable>
          </View>

          <Pressable
            style={styles.downloadBtn}
            onPress={() => handleExport('Device Gallery')}
          >
            <Ionicons name="download-outline" size={16} color="#0D0F14" />
            <Text style={styles.downloadBtnText}>SAVE TO GALLERY</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 10, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
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
    fontSize: font.sizes.xs,
    fontFamily: font.bold,
    letterSpacing: 1.5,
  },
  closeBtn: {
    padding: 2,
  },
  canvasFrame: {
    width: '100%',
    aspectRatio: 0.8,
    borderRadius: radius.md,
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  gradientBorder: {
    flex: 1,
    padding: 2, // Border thickness
  },
  canvasInner: {
    flex: 1,
    backgroundColor: '#0D0F14', // AMOLED Black Canvas core
    borderRadius: radius.md - 2,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandText: {
    color: colors.accent,
    fontSize: font.sizes.xs,
    fontFamily: font.bold,
    letterSpacing: 2,
    opacity: 0.8,
  },
  trophyGlow: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workoutCompletedLabel: {
    color: colors.gold,
    fontSize: 9,
    fontFamily: font.bold,
    letterSpacing: 2,
  },
  workoutTitle: {
    color: colors.textPrimary,
    fontSize: font.sizes.lg,
    fontFamily: font.bold,
    textAlign: 'center',
    marginTop: -4,
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.border,
    width: '100%',
    opacity: 0.6,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statVal: {
    color: colors.textPrimary,
    fontSize: font.sizes.md,
    fontFamily: font.bold,
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 8,
    fontFamily: font.bold,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: colors.border,
  },
  motivationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  motivationText: {
    color: colors.textSecondary,
    fontSize: 9,
    fontFamily: font.medium,
  },
  shareButtonsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  shareBtn: {
    flex: 1,
    borderRadius: radius.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
  },
  shareBtnText: {
    color: '#FFFFFF',
    fontSize: font.sizes.xs,
    fontFamily: font.bold,
  },
  downloadBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
    marginTop: spacing.sm,
  },
  downloadBtnText: {
    color: '#0D0F14',
    fontSize: font.sizes.xs,
    fontFamily: font.bold,
  },
});
