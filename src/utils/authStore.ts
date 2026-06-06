// utils/authStore.ts
// Local-first auth state persistence (no server required)
// Stores onboarding state, auth mode, local username, and Google profile info.

import { saveToDb, loadFromDb } from './db';

const AUTH_KEY = 'strongern_auth_v1';

export type AuthMode = 'guest' | 'local' | 'google';

export interface GoogleProfile {
  email: string;
  name: string;
  avatarUri?: string;
  fileId?: string;
  /** Unix timestamp (ms) when the access token expires. Used to detect stale tokens on re-launch. */
  tokenExpiresAt?: number;
}

export interface AuthState {
  hasCompletedOnboarding: boolean;
  authMode: AuthMode;
  localUsername: string;
  /** Persisted Google profile (no access token — stored separately in SecureStore) */
  googleProfile?: GoogleProfile | null;
}

const DEFAULT_AUTH: AuthState = {
  hasCompletedOnboarding: false,
  authMode: 'guest',
  localUsername: '',
  googleProfile: null,
};

/**
 * Load saved auth state from local DB/storage.
 * Returns null if no state has been saved yet (first launch).
 */
export async function loadAuthState(): Promise<AuthState | null> {
  try {
    const saved = await loadFromDb(AUTH_KEY);
    if (saved && typeof saved === 'object') {
      return {
        hasCompletedOnboarding: saved.hasCompletedOnboarding ?? false,
        authMode: (saved.authMode as AuthMode) ?? 'guest',
        localUsername: saved.localUsername ?? '',
        googleProfile: saved.googleProfile ?? null,
      };
    }
    return null;
  } catch (e) {
    console.warn('[authStore] Failed to load auth state:', e);
    return null;
  }
}

/**
 * Persist auth state changes.
 */
export async function saveAuthState(state: AuthState): Promise<void> {
  try {
    await saveToDb(AUTH_KEY, state);
  } catch (e) {
    console.warn('[authStore] Failed to save auth state:', e);
  }
}

/**
 * Mark onboarding as completed (quick helper).
 */
export async function completeOnboarding(
  authMode: AuthMode,
  localUsername: string,
  googleProfile?: GoogleProfile | null,
): Promise<void> {
  await saveAuthState({
    hasCompletedOnboarding: true,
    authMode,
    localUsername,
    googleProfile: googleProfile ?? null,
  });
}

/**
 * Save/update Google profile info (called after sign-in or token refresh).
 */
export async function saveGoogleProfile(profile: GoogleProfile): Promise<void> {
  const current = await loadAuthState();
  await saveAuthState({
    ...(current ?? DEFAULT_AUTH),
    hasCompletedOnboarding: true,
    authMode: 'google',
    localUsername: profile.name,
    googleProfile: profile,
  });
}

/**
 * Reset auth state (for logout / wipe all data).
 */
export async function resetAuthState(): Promise<void> {
  await saveAuthState(DEFAULT_AUTH);
}
