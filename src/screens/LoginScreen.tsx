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
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';

import { colors, font, spacing, radius, ripple as rippleTokens, shadow } from '../theme';
import { AuthMode } from '../utils/authStore';
import { pickAndReadBackupFile } from '../utils/backupManager';

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
const ANDROID_REDIRECT_URI = AuthSession.makeRedirectUri({
  scheme: `com.googleusercontent.apps.${ANDROID_CLIENT_ID.replace('.apps.googleusercontent.com', '')}`,
  path: 'oauth2redirect',
});

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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
}

// ─────────────────────────────────────────────────────────────────
// Sub-component: Animated pulsing dumbbell logo
// ─────────────────────────────────────────────────────────────────
const AnimatedLogo: React.FC = () => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 1400,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1400,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: false,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1400,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 1400,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: false,
          }),
        ]),
      ])
    ).start();
  }, []);

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.15, 0.4],
  });

  return (
    <View style={styles.logoContainer}>
      {/* Outer glow ring — two nested views to separate JS (opacity) and native (scale) drivers */}
      <Animated.View
        style={[
          styles.logoGlowWrapper,
          { opacity: glowOpacity },   // JS driver: opacity only
        ]}
      >
        <Animated.View
          style={[
            styles.logoGlow,
            { transform: [{ scale: pulseAnim }] }, // native driver: scale only
          ]}
        />
      </Animated.View>
      {/* Inner icon circle */}
      <Animated.View
        style={[
          styles.logoCircle,
          { transform: [{ scale: pulseAnim }] },
        ]}
      >
        <Ionicons name="barbell" size={44} color={colors.accent} />
      </Animated.View>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────
// Sub-component: Data location info card (collapsible)
// ─────────────────────────────────────────────────────────────────
const DataInfoCard: React.FC = () => {
  const [expanded, setExpanded] = useState(false);
  const heightAnim = useRef(new Animated.Value(0)).current;

  const toggle = () => {
    const toValue = expanded ? 0 : 1;
    Animated.timing(heightAnim, {
      toValue,
      duration: 250,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
    setExpanded(!expanded);
  };

  const expandedHeight = heightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 160],
  });

  return (
    <View style={styles.infoCard}>
      <Pressable
        onPress={toggle}
        style={styles.infoCardHeader}
        android_ripple={rippleTokens.surface}
      >
        <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
        <Text style={styles.infoCardTitle}>Where is my data stored?</Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.textMuted}
        />
      </Pressable>

      <Animated.View style={{ height: expandedHeight, overflow: 'hidden' }}>
        <View style={styles.infoCardBody}>
          <DataInfoRow
            icon="phone-portrait-outline"
            text="Data is stored locally on this device (SQLite). It is available instantly without internet."
          />
          <DataInfoRow
            icon="cloud-outline"
            text="Connect Google to back up across reinstalls. Your Drive file will be restored on next sign-in."
          />
          <DataInfoRow
            icon="document-outline"
            text="You can also manually export a JSON backup from Settings → Data at any time."
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
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────
const LoginScreen: React.FC<LoginScreenProps> = ({ onComplete, onGoogleLogin, onRestoreBackup }) => {
  const insets = useSafeAreaInsets();

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(32)).current;

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

  // React to the auth response from Google
  useEffect(() => {
    if (response?.type === 'success') {
      const token = response.authentication?.accessToken;
      if (token) {
        handleGoogleConnectWithToken(token);
      } else {
        setIsGoogleLoading(false);
      }
    } else if (response?.type === 'error' || response?.type === 'cancel') {
      setIsGoogleLoading(false);
    }
  }, [response]);

  // Mount animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // ── Handlers ──────────────────────────────────────────────────

  const handleContinueAsGuest = () => {
    onComplete('guest', 'Guest');
  };

  const handleLocalSubmit = () => {
    const trimmed = localUsername.trim();
    if (!trimmed) {
      setUsernameError('Please enter a name to continue.');
      return;
    }
    if (trimmed.length < 2) {
      setUsernameError('Name must be at least 2 characters.');
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
            'Name Mismatch',
            `Backup belongs to "${backupUsername}". Use "${backupUsername}" as your profile name?`,
            [
              {
                text: `Use "${backupUsername}"`,
                onPress: () => { resolvedUsername = backupUsername; resolve(); },
              },
              {
                text: `Keep "${typedName}"`,
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
          Alert.alert('Restore Failed', 'Could not apply the backup. Please try again.');
        }
      } else {
        // Fallback: just log in with the username from the backup
        onComplete('local', resolvedUsername);
        return;
      }
    } catch (e: any) {
      console.error('[LoginScreen] Restore error:', e);
      Alert.alert('Error', `Restore failed: ${e.message || String(e)}`);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleGoogleConnectWithToken = async (token: string) => {
    setIsGoogleLoading(true);
    try {
      const { fetchUserProfile, findBackupFile } = await import('../utils/googleDrive');
      const profile = await fetchUserProfile(token);
      const fileId = await findBackupFile(token);

      const restored = await onGoogleLogin(
        profile.email,
        profile.name,
        token,
        fileId || undefined,
        profile.avatarUri,
      );

      // Auth is complete — notify parent. Restore message shown in App.tsx.
      onComplete('google', profile.name);
    } catch (err: any) {
      console.error('[LoginScreen] Google connect error', err);
      // If token fails, fall back to guest
      onComplete('guest', 'Guest');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleGoogleOAuth = async () => {
    if (!request) {
      // Request not ready yet — should not happen in practice
      setShowTokenInput(true);
      return;
    }
    setIsGoogleLoading(true);
    try {
      // promptAsync opens the Google sign-in page in a secure in-app browser.
      // The PKCE code exchange happens automatically — no redirect URI 404.
      await promptAsync();
      // Response is handled by the useEffect above (watches `response`)
    } catch (err) {
      console.error('[LoginScreen] promptAsync error', err);
      setIsGoogleLoading(false);
      setShowTokenInput(true);
    }
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      {/* Background gradient top glow */}
      <LinearGradient
        colors={[colors.accent + '28', 'transparent']}
        style={styles.topGradient}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        pointerEvents="none"
      />

      <View style={{ flex: 1, paddingTop: insets.top }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
            <Animated.View
              style={[
                styles.content,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              {/* ── Logo ─────────────────────────────────────── */}
              <AnimatedLogo />

              {/* ── App Name ─────────────────────────────────── */}
              <Text style={styles.appName}>strongerN</Text>
              <Text style={styles.tagline}>Your personal strength tracker</Text>

              {/* ── Auth Card ────────────────────────────────── */}
              <View style={styles.card}>
                {/* Google Sign-In */}
                {!showLocalForm && (
                  <>
                    <Text style={styles.cardTitle}>Get Started</Text>
                    <Text style={styles.cardSubtitle}>
                      Sign in to keep your data safe across reinstalls, or jump straight in.
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
                      accessibilityLabel="Continue with Google"
                    >
                      {isGoogleLoading ? (
                        <ActivityIndicator size="small" color={colors.textPrimary} />
                      ) : (
                        <>
                          {/* Google "G" icon via SVG-like Ionicons + manual letter */}
                          <View style={styles.googleIconBox}>
                            <Text style={styles.googleG}>G</Text>
                          </View>
                          <Text style={styles.googleBtnText}>Continue with Google</Text>
                        </>
                      )}
                    </Pressable>

                    {/* Token fallback (developer / web popup blocked) */}
                    {showTokenInput && (
                      <View style={styles.tokenFallback}>
                        <Text style={styles.tokenLabel}>Paste Google Access Token:</Text>
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
                          <Text style={styles.tokenSubmitText}>CONNECT</Text>
                        </Pressable>
                      </View>
                    )}

                    {/* Divider */}
                    <View style={styles.dividerRow}>
                      <View style={styles.dividerLine} />
                      <Text style={styles.dividerText}>or</Text>
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
                      accessibilityLabel="Create a local account"
                    >
                      <Ionicons name="person-outline" size={18} color={colors.textInverse} style={{ marginRight: spacing.sm }} />
                      <Text style={styles.localBtnText}>Create Local Account</Text>
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
                      accessibilityLabel="Continue as guest"
                    >
                      <Ionicons name="eye-off-outline" size={15} color={colors.textMuted} style={{ marginRight: spacing.xs }} />
                      <Text style={styles.guestBtnText}>Continue as Guest</Text>
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
                      <Text style={styles.backText}>Back</Text>
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
                        <Text style={[styles.localTabText, !restoreMode && styles.localTabTextActive]}>New Account</Text>
                      </Pressable>
                      <Pressable
                        id="login-tab-restore"
                        style={[styles.localTab, restoreMode && styles.localTabActive]}
                        onPress={() => { setRestoreMode(true); setUsernameError(''); }}
                        android_ripple={rippleTokens.borderless}
                      >
                        <Ionicons name="cloud-download-outline" size={15} color={restoreMode ? colors.accent : colors.textMuted} />
                        <Text style={[styles.localTabText, restoreMode && styles.localTabTextActive]}>Restore</Text>
                      </Pressable>
                    </View>

                    {!restoreMode ? (
                      /* ── Create New Account ── */
                      <>
                        <Text style={styles.cardTitle}>Create Account</Text>
                        <Text style={styles.cardSubtitle}>
                          Choose a name to display on your profile. Data stays on-device.
                        </Text>

                        <View style={[styles.inputWrapper, usernameError ? styles.inputWrapperError : null]}>
                          <Ionicons name="person-outline" size={18} color={colors.textSecondary} style={{ marginRight: spacing.sm }} />
                          <TextInput
                            id="login-username-input"
                            style={styles.textInput}
                            value={localUsername}
                            onChangeText={(t) => { setLocalUsername(t); setUsernameError(''); }}
                            placeholder="Your name…"
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
                          <Text style={styles.localBtnText}>Continue</Text>
                          <Ionicons name="arrow-forward" size={18} color={colors.textInverse} style={{ marginLeft: spacing.sm }} />
                        </Pressable>
                      </>
                    ) : (
                      /* ── Restore from Backup File ── */
                      <>
                        <Text style={styles.cardTitle}>Restore Account</Text>
                        <Text style={styles.cardSubtitle}>
                          Pick your exported{' '}
                          <Text style={{ fontFamily: font.bold, color: colors.accent }}>strongerN backup (.json)</Text>{' '}
                          file to recover all your workouts, exercises, and settings instantly.
                        </Text>

                        {/* Optional name hint */}
                        <View style={styles.inputWrapper}>
                          <Ionicons name="person-outline" size={18} color={colors.textSecondary} style={{ marginRight: spacing.sm }} />
                          <TextInput
                            id="login-restore-name-input"
                            style={styles.textInput}
                            value={localUsername}
                            onChangeText={(t) => setLocalUsername(t)}
                            placeholder="Your name (optional hint)…"
                            placeholderTextColor={colors.textMuted}
                            maxLength={32}
                            returnKeyType="done"
                            autoCapitalize="words"
                          />
                        </View>

                        <Text style={styles.restoreHint}>
                          The name in your backup file will be used. Enter your name above only if you want to confirm it matches.
                        </Text>

                        {isRestoring ? (
                          <View style={styles.restoreLoadingRow}>
                            <ActivityIndicator size="small" color={colors.accent} />
                            <Text style={styles.restoreLoadingText}>Restoring your data…</Text>
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
                            <Text style={styles.restoreFileBtnText}>Pick Backup File (.json)</Text>
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
                      <Text style={styles.guestBtnText}>Skip — Continue as Guest</Text>
                    </Pressable>
                  </>
                )}
              </View>

              {/* ── Data Info Collapsible ─────────────────────── */}
              <DataInfoCard />

              {/* ── Privacy note ─────────────────────────────── */}
              <Text style={styles.privacyNote}>
                No personal data is sent to any server.{'\n'}Your workouts belong to you.
              </Text>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </View>
  );
};

export default LoginScreen;

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
    height: SCREEN_HEIGHT * 0.45,
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
});
