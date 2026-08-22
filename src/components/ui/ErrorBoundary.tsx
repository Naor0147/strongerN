import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Platform, Clipboard, StatusBar, SafeAreaView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { colors, font, spacing, radius, shadow, ripple as rippleTokens } from '../../theme';
import { saveCrashLogSync } from '../../utils/crashLogger';

interface Props {
  children: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const stack = errorInfo.componentStack || error.stack || '';
    console.error('[ErrorBoundary] Caught crash:', error.message, stack);

    // Synchronously save crash log to database (non-fatal recovery view)
    saveCrashLogSync(error.message, stack, false);
  }

  private handleCopyLog = () => {
    if (this.state.error) {
      const log = `[ErrorBoundary Crash Log]\nMessage: ${this.state.error.message}\n\nStack:\n${this.state.error.stack || ''}`;
      Clipboard.setString(log);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      alert('Crash log copied to clipboard!');
    }
  };

  private handleReset = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }

    // Trigger reset callback if provided (e.g. to clean up corrupt state)
    try {
      this.props.onReset?.();
    } catch (e) {
      console.warn('[ErrorBoundary] Error during onReset callback execution:', e);
    }

    // Attempt state reset
    this.setState({ hasError: false, error: null });

    // If on web, we can also refresh the page
    if (Platform.OS === 'web') {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.container}>
          <StatusBar barStyle="light-content" backgroundColor="#0D0F14" />
          <View style={styles.content}>
            {/* Warning Icon with Tinted Accent Glow */}
            <View style={styles.iconContainer}>
              <View style={styles.iconCircle}>
                <Ionicons name="warning-outline" size={40} color={colors.error} />
              </View>
            </View>

            {/* Error Headers */}
            <Text style={styles.title}>Application Error</Text>
            <Text style={styles.subtitle}>
              strongerN encountered an unexpected crash. The issue has been recorded and logged automatically.
            </Text>

            {/* Error Detail Panel */}
            <View style={styles.card}>
              <Text style={styles.errorLabel}>ERROR MESSAGE</Text>
              <Text style={styles.errorMessage}>
                {this.state.error?.message || 'Unknown Error'}
              </Text>

              <Text style={[styles.errorLabel, { marginTop: spacing.md }]}>STACK TRACE</Text>
              <View style={styles.stackContainer}>
                <ScrollView contentContainerStyle={styles.stackScroll} showsVerticalScrollIndicator={true}>
                  <Text style={styles.stackText}>
                    {this.state.error?.stack || 'No stack trace details available.'}
                  </Text>
                </ScrollView>
              </View>
            </View>

            {/* Actions Panel */}
            <View style={styles.actions}>
              <Pressable
                style={({ pressed }) => [
                  styles.btnSecondary,
                  pressed && { opacity: 0.8 }
                ]}
                onPress={this.handleCopyLog}
                android_ripple={rippleTokens.surface}
              >
                <Ionicons name="copy-outline" size={18} color={colors.textPrimary} style={{ marginRight: spacing.xs }} />
                <Text style={styles.btnSecondaryText}>Copy Log</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.btnPrimary,
                  pressed && { opacity: 0.8 }
                ]}
                onPress={this.handleReset}
                android_ripple={rippleTokens.accent}
              >
                <Ionicons name="refresh-outline" size={18} color={colors.textInverse} style={{ marginRight: spacing.xs }} />
                <Text style={styles.btnPrimaryText}>Reset & Retry</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0F14',
  },
  content: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.error + '12',
    borderColor: colors.error + '33',
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontFamily: font.bold,
    fontSize: font.sizes.xl,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontFamily: font.regular,
    fontSize: font.sizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    lineHeight: 18,
    marginBottom: spacing.xl,
  },
  card: {
    width: '100%',
    backgroundColor: '#161B24',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.xl,
    ...shadow.card,
  },
  errorLabel: {
    fontFamily: font.bold,
    fontSize: font.sizes.xs,
    color: colors.textMuted,
    letterSpacing: 1,
    marginBottom: 4,
  },
  errorMessage: {
    fontFamily: font.medium,
    fontSize: font.sizes.sm,
    color: colors.error,
    lineHeight: 18,
  },
  stackContainer: {
    height: 150,
    backgroundColor: '#0D0F14',
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginTop: 4,
  },
  stackScroll: {
    paddingBottom: spacing.sm,
  },
  stackText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 15,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%',
  },
  btnPrimary: {
    flex: 1.2,
    flexDirection: 'row',
    height: 48,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadow.accentGlow,
  },
  btnPrimaryText: {
    fontFamily: font.bold,
    fontSize: font.sizes.base,
    color: colors.textInverse,
  },
  btnSecondary: {
    flex: 0.8,
    flexDirection: 'row',
    height: 48,
    backgroundColor: colors.surfaceHigh,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnSecondaryText: {
    fontFamily: font.semibold,
    fontSize: font.sizes.base,
    color: colors.textPrimary,
  },
});
