// screens/LoginScreen.tsx
// First-launch onboarding & login screen (local-first, no backend required)
// Auth paths: Google (Drive backup), Local Username (with Restore), Guest

import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  useWindowDimensions,
  AppState,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay, withRepeat, withSequence, cancelAnimation, interpolate, Easing } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as Haptics from 'expo-haptics';

import { colors, font, spacing, radius, ripple as rippleTokens, shadow, globalAnimation, getScaledDuration } from '../theme';
import { AuthMode } from '../utils/authStore';
import { pickAndReadBackupFile } from '../utils/backupManager';
import i18n from '../utils/i18n';
import {
  logOauthEvent,
  getOauthLogs,
  clearOauthLogs,
  subscribeOauthLogs,
  copyOauthLogsToClipboard,
  OAuthLogEvent,
} from '../utils/oauthDiagnostics';

// Required: warm up the browser so Google sign-in opens instantly on Android
WebBrowser.maybeCompleteAuthSession();

// ─── Google OAuth Client IDs ──────────────────────────────────────────────────
// These are loaded from .env (git-ignored). Never hardcode real client IDs here.
// Set EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID in your local .env file.
// See .env.example for the template.
const ANDROID_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '';

if (!ANDROID_CLIENT_ID) {
  console.warn(
    '[Auth] EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID is not set. ' +
    'Copy .env.example to .env and fill in your OAuth client ID.',
  );
}

// For expo-auth-session on Android, we MUST use the reverse client ID scheme as the
// redirect URI. Google's Android OAuth client does NOT accept custom URI schemes like
// `strongern://` — it only supports `com.googleusercontent.apps.<client-id>://`.
// We also pass webClientId so the library can negotiate the correct auth endpoint.
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? ANDROID_CLIENT_ID;

// Reverse client ID redirect URI — registered in AndroidManifest.xml as an intent filter
const ANDROID_REDIRECT_URI = `com.googleusercontent.apps.${ANDROID_CLIENT_ID.replace('.apps.googleusercontent.com', '')}:/oauth2redirect`;

// Google OAuth discovery endpoints (static — avoids network discovery round-trip)
const GOOGLE_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

interface LoginScreenProps {
  onComplete: (authMode: AuthMode, username: string) => void;
  onGoogleLogin: (
    email: string,
    name: string,
    accessToken?: string,
    fileId?: string,
    avatarUri?: string,
  ) => Promise<boolean> | boolean;
  /** Called when user restores a backup file on login. Returns true if restore succeeded. */
  onRestoreBackup?: (backupData: any, username: string) => Promise<boolean>;
  isDeveloperModeEnabled?: boolean;
}

// ─────────────────────────────────────────────────────────────────
// Sub-component: Animated pulsing dumbbell logo
// ─────────────────────────────────────────────────────────────────
const AnimatedLogo: React.FC<{ onPress?: () => void }> = ({ onPress }) => {
  const pulseAnim = useSharedValue(1);
  const glowAnim = useSharedValue(0);

  useEffect(() => {
    if (globalAnimation.speed === 0) {
      pulseAnim.value = 1;
      glowAnim.value = 0;
      return;
    }
    const dur = getScaledDuration(1400);
    const easing = Easing.inOut(Easing.sin);
    pulseAnim.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: dur, easing }),
        withTiming(1, { duration: dur, easing })
      ),
      -1,
      true
    );
    glowAnim.value = withRepeat(
      withSequence(
        withTiming(1, { duration: dur, easing }),
        withTiming(0, { duration: dur, easing })
      ),
      -1,
      true
    );
    return () => {
      if (typeof cancelAnimation === 'function') {
        cancelAnimation(pulseAnim);
        cancelAnimation(glowAnim);
      }
    };
  }, [globalAnimation.speed]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glowAnim.value, [0, 1], [0.15, 0.4]),
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      style={styles.logoContainer}
      accessibilityRole="button"
      accessibilityLabel="StrongerN Logo"
    >
      {/* Outer glow ring */}
      <Animated.View style={[styles.logoGlowWrapper, glowStyle]}>
        <Animated.View style={[styles.logoGlow, pulseStyle]} />
      </Animated.View>
      {/* Inner icon circle */}
      <Animated.View style={[styles.logoCircle, pulseStyle]}>
        <Image
          source={require('../../assets/StorngNLogo.png')}
          style={styles.logoImage}
        />
      </Animated.View>
    </Pressable>
  );
};

// ─────────────────────────────────────────────────────────────────
// Sub-component: Data location info card (collapsible)
// ─────────────────────────────────────────────────────────────────
const DataInfoCard: React.FC = () => {
  const [expanded, setExpanded] = useState(false);
  const heightAnim = useSharedValue(0);

  const toggle = () => {
    const toValue = expanded ? 0 : 1;
    if (globalAnimation.speed === 0) {
      heightAnim.value = toValue;
    } else {
      heightAnim.value = withTiming(toValue, {
        duration: getScaledDuration(250),
        easing: Easing.out(Easing.quad),
      });
    }
    setExpanded(!expanded);
  };

  const expandedStyle = useAnimatedStyle(() => ({
    height: interpolate(heightAnim.value, [0, 1], [0, 160]),
    overflow: 'hidden',
  }));

  return (
    <View style={styles.infoCard}>
      <Pressable
        onPress={toggle}
        style={styles.infoCardHeader}
        android_ripple={rippleTokens.surface}
      >
        <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
        <Text style={styles.infoCardTitle}>{i18n.t('login.whereDataStored')}</Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.textMuted}
        />
      </Pressable>

      <Animated.View style={expandedStyle}>
        <View style={styles.infoCardBody}>
          <DataInfoRow
            icon="phone-portrait-outline"
            text={i18n.t('login.dataLocal')}
          />
          <DataInfoRow
            icon="cloud-outline"
            text={i18n.t('login.dataGoogle')}
          />
          <DataInfoRow
            icon="document-outline"
            text={i18n.t('login.dataExport')}
          />
        </View>
      </Animated.View>
    </View>
  );
};

const DataInfoRow: React.FC<{ icon: string; text: string }> = ({ icon, text }) => (
  <View style={styles.dataInfoRow}>
    <Ionicons name={icon as any} size={16} color={colors.accent} style={{ marginTop: 2, marginRight: spacing.sm }} />
    <Text style={styles.dataInfoText}>{text}</Text>
  </View>
);

// ─────────────────────────────────────────────────────────────────
// Sub-component: OAuth Diagnostics & Telemetry Panel (monospace console)
// ─────────────────────────────────────────────────────────────────
const OAuthDiagnosticsPanel: React.FC = () => {
  const [logs, setLogs] = useState<OAuthLogEvent[]>(() => getOauthLogs());

  useEffect(() => {
    const unsub = subscribeOauthLogs((updatedLogs) => {
      setLogs(updatedLogs);
    });
    return unsub;
  }, []);

  const handleCopy = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const ok = copyOauthLogsToClipboard();
    if (ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert(i18n.t('common.info'), i18n.t('login.copiedLogs'));
    }
  };

  const handleClear = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    clearOauthLogs();
  };

  return (
    <View style={styles.diagContainer}>
      <View style={styles.diagHeader}>
        <View style={styles.diagHeaderLeft}>
          <Ionicons name="terminal-outline" size={14} color={colors.accent} />
          <Text style={styles.diagTitle}>{i18n.t('login.diagnosticsTitle')}</Text>
        </View>
        <View style={styles.diagActions}>
          <Pressable
            style={styles.diagBtn}
            onPress={handleCopy}
            android_ripple={rippleTokens.surface}
          >
            <Ionicons name="copy-outline" size={12} color={colors.textSecondary} />
            <Text style={styles.diagBtnText}>{i18n.t('login.copyLogs')}</Text>
          </Pressable>
          <Pressable
            style={[styles.diagBtn, { marginLeft: spacing.xs }]}
            onPress={handleClear}
            android_ripple={rippleTokens.surface}
          >
            <Ionicons name="trash-outline" size={12} color={colors.textMuted} />
            <Text style={styles.diagBtnText}>{i18n.t('login.clearLogs')}</Text>
          </Pressable>
        </View>
      </View>

      <Pressable
        onLongPress={handleCopy}
        delayLongPress={400}
        style={styles.diagConsole}
      >
        <ScrollView
          style={styles.diagScroll}
          nestedScrollEnabled
          showsVerticalScrollIndicator
        >
          {logs.length === 0 ? (
            <Text style={styles.diagEmptyText}>{i18n.t('login.noLogs')}</Text>
          ) : (
            logs.map((log) => {
              const color =
                log.level === 'ok'
                  ? colors.success
                  : log.level === 'error'
                  ? colors.error
                  : colors.accent;
              return (
                <View key={log.id} style={styles.diagRow}>
                  <View style={styles.diagRowHeader}>
                    <Text style={styles.diagTime}>{log.formattedTime}</Text>
                    <Text style={[styles.diagStep, { color }]}>{log.step}</Text>
                  </View>
                  {log.detail ? (
                    <Text style={styles.diagDetail}>{log.detail}</Text>
                  ) : null}
                </View>
              );
            })
          )}
        </ScrollView>
      </Pressable>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────
const LoginScreen: React.FC<LoginScreenProps> = ({
  onComplete,
  onGoogleLogin,
  onRestoreBackup,
  isDeveloperModeEnabled = false,
}) => {
  const insets = useSafeAreaInsets();
  const { height: layoutHeight } = useWindowDimensions();

  // Diagnostics unlock via triple-tap StrongerN logo (works in release builds)
  const logoTapCount = useRef(0);
  const lastLogoTapTime = useRef(0);
  const [diagnosticsUnlocked, setDiagnosticsUnlocked] = useState(false);
  const isDiagnosticsVisible = isDeveloperModeEnabled || diagnosticsUnlocked;

  const handleLogoPress = () => {
    const now = Date.now();
    if (now - lastLogoTapTime.current > 2000) {
      logoTapCount.current = 1;
    } else {
      logoTapCount.current += 1;
    }
    lastLogoTapTime.current = now;

    if (logoTapCount.current >= 3) {
      setDiagnosticsUnlocked(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert(
        i18n.t('login.diagnosticsUnlocked'),
        i18n.t('login.diagnosticsUnlockedDesc')
      );
      logoTapCount.current = 0;
    }
  };

  // 4-tier entrance animation shared values (Logo -> Title -> Card -> Footer)
  const isInstant = typeof globalAnimation !== 'undefined' && globalAnimation && globalAnimation.speed === 0;
  const logoAnim = useSharedValue(isInstant ? 1 : 0);
  const titleAnim = useSharedValue(isInstant ? 1 : 0);
  const cardAnim = useSharedValue(isInstant ? 1 : 0);
  const footerAnim = useSharedValue(isInstant ? 1 : 0);

  // Gate animation trigger to execute smoothly after layout/mount commit (Frame 0 gating)
  const [isReadyToAnimate, setIsReadyToAnimate] = useState(false);

  // Local username flow
  const [showLocalForm, setShowLocalForm] = useState(false);
  const [localUsername, setLocalUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');

  // Restore from backup file flow
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreMode, setRestoreMode] = useState(false); // Show restore tab instead of create tab

  // Google flow
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [googleToken, setGoogleToken] = useState('');
  const isConnectingRef = useRef(false);
  const isOAuthPendingRef = useRef(false);
  const watchdogTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const codeExchangeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loggedInitialRequest = useRef(false);

  // expo-auth-session hook — handles PKCE, redirect URI, and token exchange automatically
  // redirectUri must use the reverse client ID scheme for Android OAuth clients
  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: ANDROID_CLIENT_ID,
    webClientId: WEB_CLIENT_ID,
    redirectUri: ANDROID_REDIRECT_URI,
    scopes: [
      'openid',
      'profile',
      'email',
      'https://www.googleapis.com/auth/drive.file',
    ],
  });

  // Log OAuth request initialization
  useEffect(() => {
    if (request && !loggedInitialRequest.current) {
      loggedInitialRequest.current = true;
      logOauthEvent(
        'request loaded',
        `redirectUri: ${request.redirectUri}, client: ${ANDROID_CLIENT_ID ? 'configured' : 'missing'}`,
        'ok'
      );
    }
  }, [request]);

  // Foreground watchdog (always active, everyone benefits):
  // If app regains focus while OAuth is pending and no redirect arrives within ~2.5s,
  // cancel the spinner and display clear guidance to the user.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && isOAuthPendingRef.current) {
        logOauthEvent(
          'app foregrounded',
          'App resumed to foreground while OAuth is pending. Starting 2.5s watchdog.',
          'info'
        );
        if (watchdogTimerRef.current) clearTimeout(watchdogTimerRef.current);
        watchdogTimerRef.current = setTimeout(() => {
          if (isOAuthPendingRef.current) {
            isOAuthPendingRef.current = false;
            isConnectingRef.current = false;
            setIsGoogleLoading(false);
            if (codeExchangeTimerRef.current) {
              clearTimeout(codeExchangeTimerRef.current);
              codeExchangeTimerRef.current = null;
            }
            logOauthEvent(
              'watchdog timeout',
              'App resumed without OAuth redirect received within 2.5s',
              'error'
            );
            Alert.alert(
              i18n.t('login.signInInterrupted'),
              i18n.t('login.signInInterruptedDesc')
            );
          }
        }, 2500);
      }
    });

    return () => {
      subscription.remove();
      if (watchdogTimerRef.current) clearTimeout(watchdogTimerRef.current);
    };
  }, []);

  // Manual PKCE code exchange — fallback for when expo-auth-session's
  // background auto-exchange fails SILENTLY (the library has no .catch
  // around its exchange, leaving `response` null forever and the login
  // screen stuck on the spinner after a successful Google sign-in).
  const exchangeCodeForToken = async (code: string): Promise<string | null> => {
    if (!request?.codeVerifier) {
      logOauthEvent('manual exchange failed', 'No codeVerifier available on request', 'error');
      console.warn('[LoginScreen] No codeVerifier available for manual exchange');
      return null;
    }
    logOauthEvent('manual exchange', 'Executing manual PKCE token exchange fallback', 'info');
    try {
      const tokenResult = await AuthSession.exchangeCodeAsync(
        {
          clientId: ANDROID_CLIENT_ID,
          redirectUri: ANDROID_REDIRECT_URI,
          code,
          extraParams: { code_verifier: request.codeVerifier },
        },
        GOOGLE_DISCOVERY,
      );
      const token = tokenResult?.accessToken ?? null;
      if (token) {
        logOauthEvent('token exchanged', 'Manual PKCE token exchange succeeded', 'ok');
      } else {
        logOauthEvent('exchange failed', 'exchangeCodeAsync returned null accessToken', 'error');
      }
      return token;
    } catch (e: any) {
      logOauthEvent('exchange failed', `Manual exchange error: ${e?.message || String(e)}`, 'error');
      console.error('[LoginScreen] Manual code exchange failed:', e);
      return null;
    }
  };

  // Give the hook's built-in exchange time to finish before intervening,
  // so we never race/double-spend the single-use authorization code.
  const scheduleCodeExchangeFallback = (code: string, delayMs = 3500) => {
    logOauthEvent('library exchange pending', `Waiting ${delayMs}ms for expo-auth-session auto-exchange...`, 'info');
    if (codeExchangeTimerRef.current) clearTimeout(codeExchangeTimerRef.current);
    codeExchangeTimerRef.current = setTimeout(async () => {
      codeExchangeTimerRef.current = null;
      if (isConnectingRef.current) return; // hook's exchange already connected us
      console.log('[LoginScreen] Auto token exchange did not complete — running manual PKCE exchange');
      const token = await exchangeCodeForToken(code);
      if (token) {
        handleGoogleConnectWithToken(token);
      } else if (!isConnectingRef.current) {
        setIsGoogleLoading(false);
        isOAuthPendingRef.current = false;
        Alert.alert(i18n.t('login.googleSignInError'), i18n.t('login.noAccessToken'));
      }
    }, delayMs);
  };

  // Clear any pending exchange fallback on unmount
  useEffect(() => () => {
    if (codeExchangeTimerRef.current) clearTimeout(codeExchangeTimerRef.current);
    if (watchdogTimerRef.current) clearTimeout(watchdogTimerRef.current);
  }, []);

  // React to the auth response from Google
  useEffect(() => {
    if (!response) return;
    logOauthEvent(
      'response received',
      `AuthSession response type: ${response.type}`,
      response.type === 'success' ? 'ok' : response.type === 'error' ? 'error' : 'info'
    );
    console.log('[LoginScreen] Auth response received:', response.type);

    if (response.type === 'success') {
      const token =
        response.authentication?.accessToken ||
        (response.params as any)?.access_token ||
        (response.params as any)?.token;

      if (token) {
        logOauthEvent('token ready', 'Direct access token found in AuthSession response', 'ok');
        handleGoogleConnectWithToken(token);
      } else {
        const code = (response.params as any)?.code;
        if (code) {
          logOauthEvent('code received', 'Authorization code found in AuthSession response', 'ok');
          scheduleCodeExchangeFallback(code);
        } else {
          setIsGoogleLoading(false);
          isOAuthPendingRef.current = false;
          logOauthEvent('token missing', 'Success response without token or code', 'error');
          Alert.alert(i18n.t('login.googleSignInError'), i18n.t('login.noAccessToken'));
        }
      }
    } else if (response.type === 'error') {
      setIsGoogleLoading(false);
      isOAuthPendingRef.current = false;
      logOauthEvent('exchange failed', response.error?.message || 'OAuth error in response', 'error');
      Alert.alert(i18n.t('login.googleSignInError'), `OAuth error: ${response.error?.message || 'Unknown error'}`);
    } else if (response.type === 'cancel' || response.type === 'dismiss') {
      setIsGoogleLoading(false);
      isOAuthPendingRef.current = false;
      logOauthEvent('browser dismissed', `User dismissed or closed auth browser (${response.type})`, 'info');
    } else {
      setIsGoogleLoading(false);
      isOAuthPendingRef.current = false;
    }
  }, [response]);

  // Frame 0 gating: Wait for layout/mount commit before triggering entrance animations
  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      setIsReadyToAnimate(true);
    });
    return () => cancelAnimationFrame(frameId);
  }, []);

  // 4-tier staggered entrance animation (Logo: 0ms, Title: 50ms, Card: 100ms, Footer: 150ms)
  useEffect(() => {
    if (!isReadyToAnimate) return;

    const speed = (typeof globalAnimation !== 'undefined' && globalAnimation && typeof globalAnimation.speed === 'number')
      ? globalAnimation.speed
      : 1;

    if (speed === 0) {
      logoAnim.value = 1;
      titleAnim.value = 1;
      cardAnim.value = 1;
      footerAnim.value = 1;
      return;
    }

    const STAGGER = 50 * speed;
    const dur = getScaledDuration(600);
    const easing = Easing.out(Easing.cubic);

    logoAnim.value = withTiming(1, { duration: dur, easing });
    titleAnim.value = withDelay(STAGGER, withTiming(1, { duration: dur, easing }));
    cardAnim.value = withDelay(STAGGER * 2, withTiming(1, { duration: dur, easing }));
    footerAnim.value = withDelay(STAGGER * 3, withTiming(1, { duration: dur, easing }));
  }, [isReadyToAnimate]);

  // Animated styles for each tier executed directly on the UI thread
  const logoEntranceStyle = useAnimatedStyle(() => ({
    opacity: logoAnim.value,
    transform: [
      { translateY: interpolate(logoAnim.value, [0, 1], [32, 0]) },
    ],
  }));

  const titleEntranceStyle = useAnimatedStyle(() => ({
    opacity: titleAnim.value,
    transform: [
      { translateY: interpolate(titleAnim.value, [0, 1], [32, 0]) },
    ],
  }));

  const cardEntranceStyle = useAnimatedStyle(() => ({
    opacity: cardAnim.value,
    transform: [
      { translateY: interpolate(cardAnim.value, [0, 1], [32, 0]) },
    ],
  }));

  const footerEntranceStyle = useAnimatedStyle(() => ({
    opacity: footerAnim.value,
    transform: [
      { translateY: interpolate(footerAnim.value, [0, 1], [32, 0]) },
    ],
  }));

  // ── Handlers ──────────────────────────────────────────────────

  const handleContinueAsGuest = () => {
    onComplete('guest', 'Guest');
  };

  const handleLocalSubmit = () => {
    const trimmed = localUsername.trim();
    if (!trimmed) {
      setUsernameError(i18n.t('login.enterNameToContinue'));
      return;
    }
    if (trimmed.length < 2) {
      setUsernameError(i18n.t('login.nameMinChars'));
      return;
    }
    setUsernameError('');
    onComplete('local', trimmed);
  };

  const handleRestoreFromFile = async () => {
    setIsRestoring(true);
    try {
      const backupData = await pickAndReadBackupFile();
      if (!backupData) {
        setIsRestoring(false);
        return; // User cancelled or file was invalid (alert already shown)
      }

      const backupUsername = backupData.user?.name || backupData.username || '';

      // If there's a name in the input, confirm if it differs from backup
      const typedName = localUsername.trim();
      let resolvedUsername = backupUsername;

      if (typedName && typedName.toLowerCase() !== backupUsername.toLowerCase()) {
        await new Promise<void>((resolve) => {
          Alert.alert(
            i18n.t('login.nameMismatch'),
            i18n.t('login.nameMismatchMsg', { backupName: backupUsername }),
            [
              {
                text: i18n.t('login.useName', { name: backupUsername }),
                onPress: () => { resolvedUsername = backupUsername; resolve(); },
              },
              {
                text: i18n.t('login.keepName', { name: typedName }),
                onPress: () => { resolvedUsername = typedName; resolve(); },
              },
            ],
            { cancelable: false }
          );
        });
      }

      if (onRestoreBackup) {
        const success = await onRestoreBackup(backupData, resolvedUsername);
        if (success) {
          onComplete('local', resolvedUsername);
          return;
        } else {
          Alert.alert(i18n.t('login.restoreFailed'), i18n.t('login.restoreFailedMsg'));
        }
      } else {
        // Fallback: just log in with the username from the backup
        onComplete('local', resolvedUsername);
        return;
      }
    } catch (e: any) {
      console.error('[LoginScreen] Restore error:', e);
      Alert.alert(i18n.t('common.error'), i18n.t('extras.restoreFailedError', { error: e.message || String(e) }));
    } finally {
      setIsRestoring(false);
    }
  };

  const handleGoogleConnectWithToken = async (token: string) => {
    if (!token || isConnectingRef.current) return;
    isConnectingRef.current = true;
    isOAuthPendingRef.current = false;
    if (watchdogTimerRef.current) {
      clearTimeout(watchdogTimerRef.current);
      watchdogTimerRef.current = null;
    }
    if (codeExchangeTimerRef.current) {
      clearTimeout(codeExchangeTimerRef.current);
      codeExchangeTimerRef.current = null;
    }
    setIsGoogleLoading(true);
    logOauthEvent('profile fetch', 'Fetching Google user profile and Drive backup...', 'info');
    console.log('[LoginScreen] Connecting with Google token…');
    try {
      const { fetchUserProfile, findBackupFile } = await import('../utils/googleDrive');
      const profile = await fetchUserProfile(token);
      logOauthEvent('profile fetched', `Name: ${profile.name}, Email: ${profile.email}`, 'ok');
      let fileId: string | null = null;
      try {
        fileId = await findBackupFile(token);
        if (fileId) {
          logOauthEvent('backup file found', `Google Drive fileId: ${fileId}`, 'ok');
        } else {
          logOauthEvent('backup file check', 'No existing backup file found', 'info');
        }
      } catch (driveErr: any) {
        logOauthEvent('backup file check skipped', driveErr?.message || String(driveErr), 'info');
        console.warn('[LoginScreen] Backup file check skipped:', driveErr);
      }

      await onGoogleLogin(
        profile.email,
        profile.name,
        token,
        fileId || undefined,
        profile.avatarUri,
      );

      logOauthEvent('connected', `Google sign-in completed for ${profile.name}`, 'ok');
      // Auth is complete — notify parent.
      onComplete('google', profile.name);
    } catch (err: any) {
      logOauthEvent('profile fetch failed', err?.message || String(err), 'error');
      console.error('[LoginScreen] Google connect error', err);
      Alert.alert(
        i18n.t('login.googleSignInError'),
        err?.message || 'Failed to authenticate Google profile'
      );
    } finally {
      setIsGoogleLoading(false);
      isConnectingRef.current = false;
    }
  };

  const handleGoogleOAuth = async () => {
    if (!request) {
      logOauthEvent('request missing', 'Google auth request is not ready. Showing manual token input.', 'error');
      setShowTokenInput(true);
      return;
    }
    isOAuthPendingRef.current = true;
    setIsGoogleLoading(true);
    logOauthEvent('browser opened', 'Launching OAuth browser flow with Google', 'info');
    try {
      const res = await promptAsync();
      logOauthEvent(
        'browser returned',
        `promptAsync result type: ${res?.type || 'undefined'}`,
        res?.type === 'success' ? 'ok' : res?.type === 'error' ? 'error' : 'info'
      );
      console.log('[LoginScreen] promptAsync resolved:', res?.type);
      if (res?.type === 'success') {
        const token =
          res.authentication?.accessToken ||
          (res.params as any)?.access_token ||
          (res.params as any)?.token;
        if (token) {
          logOauthEvent('token ready', 'Direct access token returned from promptAsync', 'ok');
          handleGoogleConnectWithToken(token);
        } else {
          const code = (res.params as any)?.code;
          if (code) {
            logOauthEvent('code received', 'Authorization code returned from promptAsync', 'ok');
            // Token exchange is running in the background (hook or `response`
            // effect). Schedule a manual PKCE fallback in case it never lands.
            scheduleCodeExchangeFallback(code);
          } else {
            setIsGoogleLoading(false);
            isOAuthPendingRef.current = false;
            logOauthEvent('token missing', 'promptAsync success but no token or code', 'error');
            Alert.alert(i18n.t('login.googleSignInError'), i18n.t('login.noAccessToken'));
          }
        }
      } else if (res?.type === 'error') {
        setIsGoogleLoading(false);
        isOAuthPendingRef.current = false;
        logOauthEvent('exchange failed', res.error?.message || 'OAuth error in promptAsync', 'error');
        Alert.alert(i18n.t('login.googleSignInError'), `OAuth error: ${res.error?.message || 'Unknown error'}`);
      } else {
        // cancel / dismiss / locked / anything else — always release the spinner
        setIsGoogleLoading(false);
        isOAuthPendingRef.current = false;
        logOauthEvent('browser dismissed', `Browser closed (${res?.type})`, 'info');
      }
    } catch (err: any) {
      logOauthEvent('browser error', err?.message || String(err), 'error');
      console.error('[LoginScreen] promptAsync error', err);
      setIsGoogleLoading(false);
      isOAuthPendingRef.current = false;
      setShowTokenInput(true);
    }
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      {/* Background gradient top glow */}
      <LinearGradient
        colors={[colors.accent + '28', 'transparent']}
        style={[styles.topGradient, { height: layoutHeight * 0.45, pointerEvents: 'none' }]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <View style={{ flex: 1, paddingTop: insets.top }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={[
              styles.scroll,
              { paddingBottom: insets.bottom + spacing.xxl },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.content}>
              {/* ── Tier 1: Logo (0ms delay) ─────────────────── */}
              <Animated.View style={[styles.tierContainer, logoEntranceStyle]}>
                <AnimatedLogo onPress={handleLogoPress} />
              </Animated.View>

              {/* ── Tier 2: App Name & Tagline (50ms delay) ─── */}
              <Animated.View style={[styles.tierContainer, titleEntranceStyle]}>
                <Text style={styles.appName}>{i18n.t('login.appTitle')}</Text>
                <Text style={styles.tagline}>{i18n.t('login.appSubtitle')}</Text>
              </Animated.View>

              {/* ── Tier 3: Auth Card & Buttons (100ms delay) ─ */}
              <Animated.View style={[styles.tierContainer, cardEntranceStyle]}>
                <View style={styles.card}>
                  {/* Google Sign-In */}
                  {!showLocalForm && (
                    <>
                      <Text style={styles.cardTitle}>{i18n.t('login.getStarted')}</Text>
                      <Text style={styles.cardSubtitle}>
                        {i18n.t('login.signInDesc')}
                      </Text>

                      {/* Google Button */}
                      <Pressable
                        id="login-google-btn"
                        style={({ pressed }) => [
                          styles.googleBtn,
                          pressed && styles.googleBtnPressed,
                        ]}
                        onPress={handleGoogleOAuth}
                        disabled={isGoogleLoading}
                        android_ripple={rippleTokens.surface}
                        accessibilityLabel={i18n.t('extras.continueWithGoogleA11y')}
                      >
                        {isGoogleLoading ? (
                          <ActivityIndicator size="small" color={colors.textPrimary} />
                        ) : (
                          <>
                            {/* Google "G" icon via SVG-like Ionicons + manual letter */}
                            <View style={styles.googleIconBox}>
                              <Text style={styles.googleG}>G</Text>
                            </View>
                            <Text style={styles.googleBtnText}>{i18n.t('login.continueWithGoogle')}</Text>
                          </>
                        )}
                      </Pressable>

                      {/* Token fallback (developer / web popup blocked) */}
                      {showTokenInput && (
                        <View style={styles.tokenFallback}>
                          <Text style={styles.tokenLabel}>{i18n.t('login.pasteAccessToken')}</Text>
                          <TextInput
                            id="login-google-token-input"
                            style={styles.tokenInput}
                            value={googleToken}
                            onChangeText={setGoogleToken}
                            placeholder="ya29.xxx…"
                            placeholderTextColor={colors.textMuted}
                            autoCorrect={false}
                            autoCapitalize="none"
                          />
                          <Pressable
                            id="login-google-token-submit"
                            style={styles.tokenSubmitBtn}
                            onPress={() => handleGoogleConnectWithToken(googleToken.trim())}
                            disabled={!googleToken.trim()}
                            android_ripple={rippleTokens.accent}
                          >
                            <Text style={styles.tokenSubmitText}>{i18n.t('login.connect')}</Text>
                          </Pressable>
                        </View>
                      )}

                      {/* OAuth Diagnostics & Telemetry Panel (When Unlocked) */}
                      {isDiagnosticsVisible && <OAuthDiagnosticsPanel />}

                      {/* Divider */}
                      <View style={styles.dividerRow}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>{i18n.t('common.or')}</Text>
                        <View style={styles.dividerLine} />
                      </View>

                      {/* Local Account */}
                      <Pressable
                        id="login-local-btn"
                        style={({ pressed }) => [
                          styles.localBtn,
                          pressed && { opacity: 0.8 },
                        ]}
                        onPress={() => setShowLocalForm(true)}
                        android_ripple={rippleTokens.accent}
                        accessibilityLabel={i18n.t('extras.createLocalAccountA11y')}
                      >
                        <Ionicons name="person-outline" size={18} color={colors.textInverse} style={{ marginRight: spacing.sm }} />
                        <Text style={styles.localBtnText}>{i18n.t('login.createLocalAccount')}</Text>
                      </Pressable>

                      {/* Guest */}
                      <Pressable
                        id="login-guest-btn"
                        style={({ pressed }) => [
                          styles.guestBtn,
                          pressed && { opacity: 0.7 },
                        ]}
                        onPress={handleContinueAsGuest}
                        android_ripple={rippleTokens.borderless}
                        accessibilityLabel={i18n.t('extras.continueAsGuestA11y')}
                      >
                        <Ionicons name="eye-off-outline" size={15} color={colors.textMuted} style={{ marginRight: spacing.xs }} />
                        <Text style={styles.guestBtnText}>{i18n.t('login.continueAsGuest')}</Text>
                      </Pressable>
                    </>
                  )}

                  {/* ── Local Username Form ───────────────────── */}
                  {showLocalForm && (
                    <>
                      <Pressable
                        onPress={() => { setShowLocalForm(false); setUsernameError(''); setRestoreMode(false); }}
                        style={styles.backRow}
                        android_ripple={rippleTokens.borderless}
                      >
                        <Ionicons name="arrow-back" size={18} color={colors.textSecondary} />
                        <Text style={styles.backText}>{i18n.t('login.back')}</Text>
                      </Pressable>

                      {/* ── Tab Switcher: Create | Restore ─── */}
                      <View style={styles.localTabRow}>
                        <Pressable
                          id="login-tab-create"
                          style={[styles.localTab, !restoreMode && styles.localTabActive]}
                          onPress={() => { setRestoreMode(false); setUsernameError(''); }}
                          android_ripple={rippleTokens.borderless}
                        >
                          <Ionicons name="person-add-outline" size={15} color={!restoreMode ? colors.accent : colors.textMuted} />
                          <Text style={[styles.localTabText, !restoreMode && styles.localTabTextActive]}>{i18n.t('login.newAccount')}</Text>
                        </Pressable>
                        <Pressable
                          id="login-tab-restore"
                          style={[styles.localTab, restoreMode && styles.localTabActive]}
                          onPress={() => { setRestoreMode(true); setUsernameError(''); }}
                          android_ripple={rippleTokens.borderless}
                        >
                          <Ionicons name="cloud-download-outline" size={15} color={restoreMode ? colors.accent : colors.textMuted} />
                          <Text style={[styles.localTabText, restoreMode && styles.localTabTextActive]}>{i18n.t('login.restore')}</Text>
                        </Pressable>
                      </View>

                      {!restoreMode ? (
                        /* ── Create New Account ── */
                        <>
                          <Text style={styles.cardTitle}>{i18n.t('login.createAccount')}</Text>
                          <Text style={styles.cardSubtitle}>
                            {i18n.t('login.chooseName')}
                          </Text>

                          <View style={[styles.inputWrapper, usernameError ? styles.inputWrapperError : null]}>
                            <Ionicons name="person-outline" size={18} color={colors.textSecondary} style={{ marginRight: spacing.sm }} />
                            <TextInput
                              id="login-username-input"
                              style={styles.textInput}
                              value={localUsername}
                              onChangeText={(t) => { setLocalUsername(t); setUsernameError(''); }}
                              placeholder={i18n.t('login.yourName')}
                              placeholderTextColor={colors.textMuted}
                              maxLength={32}
                              returnKeyType="done"
                              onSubmitEditing={handleLocalSubmit}
                              autoFocus
                              autoCapitalize="words"
                            />
                          </View>

                          {usernameError ? (
                            <Text style={styles.errorText}>{usernameError}</Text>
                          ) : null}

                          <Pressable
                            id="login-local-submit"
                            style={({ pressed }) => [
                              styles.localBtn,
                              pressed && { opacity: 0.8 },
                              { marginTop: spacing.lg },
                            ]}
                            onPress={handleLocalSubmit}
                            android_ripple={rippleTokens.accent}
                          >
                            <Text style={styles.localBtnText}>{i18n.t('login.continue')}</Text>
                            <Ionicons name="arrow-forward" size={18} color={colors.textInverse} style={{ marginLeft: spacing.sm }} />
                          </Pressable>
                        </>
                      ) : (
                        /* ── Restore from Backup File ── */
                        <>
                          <Text style={styles.cardTitle}>{i18n.t('login.restoreAccount')}</Text>
                          <Text style={styles.cardSubtitle}>
                            {i18n.t('login.restoreDesc')}
                          </Text>

                          {/* Optional name hint */}
                          <View style={styles.inputWrapper}>
                            <Ionicons name="person-outline" size={18} color={colors.textSecondary} style={{ marginRight: spacing.sm }} />
                            <TextInput
                              id="login-restore-name-input"
                              style={styles.textInput}
                              value={localUsername}
                              onChangeText={(t) => setLocalUsername(t)}
                              placeholder={i18n.t('login.yourNameHint')}
                              placeholderTextColor={colors.textMuted}
                              maxLength={32}
                              returnKeyType="done"
                              autoCapitalize="words"
                            />
                          </View>

                          <Text style={styles.restoreHint}>
                            {i18n.t('login.restoreNameNote')}
                          </Text>

                          {isRestoring ? (
                            <View style={styles.restoreLoadingRow}>
                              <ActivityIndicator size="small" color={colors.accent} />
                              <Text style={styles.restoreLoadingText}>{i18n.t('login.restoringData')}</Text>
                            </View>
                          ) : (
                            <Pressable
                              id="login-restore-file-btn"
                              style={({ pressed }) => [
                                styles.restoreFileBtn,
                                pressed && { opacity: 0.8 },
                              ]}
                              onPress={handleRestoreFromFile}
                              android_ripple={rippleTokens.accent}
                              accessibilityLabel="Pick backup file to restore"
                            >
                              <Ionicons name="folder-open-outline" size={20} color={colors.textInverse} style={{ marginRight: spacing.sm }} />
                              <Text style={styles.restoreFileBtnText}>{i18n.t('login.pickBackupFile')}</Text>
                            </Pressable>
                          )}
                        </>
                      )}

                      <Pressable
                        id="login-local-guest-fallback"
                        style={[styles.guestBtn, { marginTop: spacing.md }]}
                        onPress={handleContinueAsGuest}
                        android_ripple={rippleTokens.borderless}
                      >
                        <Text style={styles.guestBtnText}>{i18n.t('login.skipGuest')}</Text>
                      </Pressable>
                    </>
                  )}
                </View>
              </Animated.View>

              {/* ── Tier 4: Data Info & Privacy Footer (150ms delay) ─ */}
              <Animated.View style={[styles.tierContainer, footerEntranceStyle]}>
                <DataInfoCard />
                <Text style={styles.privacyNote}>
                  {i18n.t('login.privacyNote')}
                </Text>
              </Animated.View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </View>
  );
};

export default React.memo(LoginScreen);

// ─────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  tierContainer: {
    width: '100%',
    alignItems: 'center',
  },

  // Logo
  logoContainer: {
    width: 110,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  logoGlowWrapper: {
    position: 'absolute',
    width: 110,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoGlow: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: colors.accent,
  },

  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.accent + '55',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.accentGlow as object,
  },
  logoImage: {
    width: 48,
    height: 48,
    resizeMode: 'contain',
  },

  // App name
  appName: {
    color: colors.textPrimary,
    fontFamily: font.bold,
    fontSize: font.sizes.hero - 4,
    letterSpacing: -0.5,
    marginBottom: spacing.xs,
  },
  tagline: {
    color: colors.textSecondary,
    fontFamily: font.regular,
    fontSize: font.sizes.md,
    marginBottom: spacing.xxxl,
    textAlign: 'center',
  },

  // Auth card
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    marginBottom: spacing.xl,
    ...shadow.card as object,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontFamily: font.bold,
    fontSize: font.sizes.xl,
    marginBottom: spacing.xs,
  },
  cardSubtitle: {
    color: colors.textSecondary,
    fontFamily: font.regular,
    fontSize: font.sizes.sm,
    lineHeight: 20,
    marginBottom: spacing.xl,
  },

  // Google button
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.sm,
    minHeight: 52,
  },
  googleBtnPressed: {
    backgroundColor: colors.surfaceHigh,
    borderColor: colors.accent + '55',
  },
  googleIconBox: {
    width: 26,
    height: 26,
    borderRadius: 4,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  googleG: {
    color: '#4285F4',
    fontFamily: font.bold,
    fontSize: 16,
    lineHeight: 20,
  },
  googleBtnText: {
    color: colors.textPrimary,
    fontFamily: font.semibold,
    fontSize: font.sizes.md,
  },

  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: font.sizes.sm,
    paddingHorizontal: spacing.md,
  },

  // Local Account button (primary accent)
  localBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    minHeight: 52,
  },
  localBtnText: {
    color: colors.textInverse,
    fontFamily: font.bold,
    fontSize: font.sizes.md,
    letterSpacing: 0.3,
  },

  // Guest button (muted)
  guestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  guestBtnText: {
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: font.sizes.sm,
  },

  // Local username form
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  backText: {
    color: colors.textSecondary,
    fontFamily: font.medium,
    fontSize: font.sizes.sm,
    marginLeft: spacing.xs,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.xs,
  },
  inputWrapperError: {
    borderColor: colors.error,
  },
  textInput: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: font.medium,
    fontSize: font.sizes.base,
    paddingVertical: 0,
    minHeight: 28,
  },
  errorText: {
    color: colors.error,
    fontFamily: font.regular,
    fontSize: font.sizes.xs,
    marginBottom: spacing.xs,
  },

  // Token fallback
  tokenFallback: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tokenLabel: {
    color: colors.textSecondary,
    fontFamily: font.medium,
    fontSize: font.sizes.xs,
    marginBottom: spacing.xs,
  },
  tokenInput: {
    color: colors.textPrimary,
    fontFamily: font.regular,
    fontSize: font.sizes.sm,
    backgroundColor: colors.surface2,
    borderRadius: radius.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tokenSubmitBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.xs,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  tokenSubmitText: {
    color: colors.textInverse,
    fontFamily: font.bold,
    fontSize: font.sizes.xs,
    letterSpacing: 1,
  },

  // Data info card
  infoCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.xl,
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  infoCardTitle: {
    flex: 1,
    color: colors.textSecondary,
    fontFamily: font.medium,
    fontSize: font.sizes.sm,
  },
  infoCardBody: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  dataInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  dataInfoText: {
    flex: 1,
    color: colors.textSecondary,
    fontFamily: font.regular,
    fontSize: font.sizes.sm,
    lineHeight: 19,
  },

  // Privacy note
  privacyNote: {
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: font.sizes.xs,
    textAlign: 'center',
    lineHeight: 18,
  },

  // ── Local account tab switcher (New Account | Restore) ─────────
  localTabRow: {
    flexDirection: 'row',
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
    overflow: 'hidden',
  },
  localTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  localTabActive: {
    backgroundColor: colors.surface2,
    borderBottomWidth: 2,
    borderBottomColor: colors.accent,
  },
  localTabText: {
    color: colors.textMuted,
    fontFamily: font.medium,
    fontSize: font.sizes.sm,
  },
  localTabTextActive: {
    color: colors.accent,
    fontFamily: font.semibold,
  },

  // ── Restore from file ───────────────────────────────────────────
  restoreHint: {
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: font.sizes.xs,
    lineHeight: 17,
    marginTop: -spacing.xs,
    marginBottom: spacing.md,
  },
  restoreFileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.violet,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    minHeight: 52,
    marginTop: spacing.sm,
  },
  restoreFileBtnText: {
    color: colors.textInverse,
    fontFamily: font.bold,
    fontSize: font.sizes.md,
    letterSpacing: 0.3,
  },
  restoreLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.md,
  },
  restoreLoadingText: {
    color: colors.textSecondary,
    fontFamily: font.medium,
    fontSize: font.sizes.sm,
  },

  // ── OAuth Diagnostics Panel ─────────────────────────────────────
  diagContainer: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    backgroundColor: '#07080A',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    overflow: 'hidden',
  },
  diagHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.xs,
  },
  diagHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  diagTitle: {
    color: colors.textSecondary,
    fontFamily: font.semibold,
    fontSize: font.sizes.xs,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  diagActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  diagBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 3,
  },
  diagBtnText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontFamily: font.medium,
  },
  diagConsole: {
    maxHeight: 180,
  },
  diagScroll: {
    maxHeight: 180,
  },
  diagEmptyText: {
    color: colors.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
    paddingVertical: spacing.sm,
    textAlign: 'center',
  },
  diagRow: {
    paddingVertical: 2,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border + '40',
  },
  diagRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  diagTime: {
    color: colors.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 10,
  },
  diagStep: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
    fontWeight: '600',
  },
  diagDetail: {
    color: colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 10,
    marginTop: 1,
    paddingLeft: 4,
  },
});
