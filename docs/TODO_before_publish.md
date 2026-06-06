# ✅ StrongerN — Before Publishing Checklist

> Track every task before releasing to the Google Play Store.
> Mark items with `[x]` when done, `[/]` when in progress.

---

## 🔐 OAuth / Google Sign-In

- [ ] **Create Android OAuth client ID** (see section below for explanation)
  - Package name: `com.naor.strongern`
  - SHA-1 (debug): `76:DF:43:47:34:90:5B:C2:00:8B:29:FD:2E:B7:4E:C6:F4:D0:36:CF`
- [ ] **Create production OAuth client ID** with the Play Store's SHA-1 fingerprint
  - Get production SHA-1 from: Google Play Console → App signing → SHA-1 certificate fingerprint
- [ ] Add the `client_id` from the OAuth JSON into the app (see explanation below)
- [ ] Enable **Google Drive API** in Google Cloud Console for project `strongern`
- [ ] Enable **Google People API** (needed for user profile: name, photo, email)
- [ ] Set OAuth consent screen to **Production** (not Testing) before publishing
  - Go to: APIs & Services → OAuth consent screen → Publishing status → Publish App
  - While in "Testing" mode, only test users you manually add can log in with Google

---

## 📦 App Identity & Versioning

- [ ] Set correct `versionCode` in `app.json` for Play Store (must increment each release)
  ```json
  "android": {
    "versionCode": 1
  }
  ```
- [ ] Double-check `version` is `"1.0.0"` in app.json
- [ ] Confirm package name is final: `com.naor.strongern` (cannot change after first publish)

---

## 🎨 Store Assets

- [ ] **App icon**: 512×512 PNG, no transparency (for Play Store listing)
- [ ] **Feature graphic**: 1024×500 PNG (banner shown in Play Store)
- [ ] **Screenshots**: At least 2 phone screenshots (1080×1920 or 1080×2340)
  - Recommended: 4–8 screenshots of key screens (Workout, Profile, History, Muscle Map)
- [ ] **Short description**: Max 80 characters — catchy one-liner
- [ ] **Full description**: Up to 4000 characters — what the app does, key features
- [ ] Confirm splash screen looks correct on all screen sizes

---

## 🔒 Security & Secrets

- [ ] Remove any hardcoded API keys, tokens, or secrets from source code
- [ ] Verify `expo-secure-store` is used for all sensitive tokens (OAuth access tokens)
- [ ] Check `.gitignore` — ensure no keystores or secrets are committed
- [ ] The OAuth `client_secret` from Google Cloud is **NOT needed** in a mobile app (see explanation)

---

## 🧪 Testing

- [ ] Test Google Sign-In flow end-to-end on a real Android device
- [ ] Test Google Drive backup & restore with a real account
- [ ] Test CSV import with a real Strong export file
- [ ] Test guest mode (local account) full flow
- [ ] Test logout & account switching
- [ ] Test timer sounds on device (real hardware, not emulator)
- [ ] Test on at least one low-end device (< 4GB RAM)
- [ ] Run `npm test` — all Jest tests pass

---

## 📱 Android Build

- [ ] Generate a **production keystore** (do this once, keep it safe forever)
  ```powershell
  keytool -genkey -v -keystore strongern-release.keystore -alias strongern -keyalg RSA -keysize 2048 -validity 10000
  ```
- [ ] Build a signed release AAB (Android App Bundle) for Play Store
- [ ] Test the **release build** on a real device (not debug build)
- [ ] Enable Play App Signing in Play Console (Google manages your signing key)

---

## 🏪 Play Store Setup

- [ ] Create app in Google Play Console
- [ ] Fill in content rating questionnaire
- [ ] Set target audience (17+ for fitness?)
- [ ] Add **privacy policy URL** (required — even for free apps)
- [ ] Fill in **data safety form** (you collect: name, Google account, workout data)
- [ ] Set app category: **Health & Fitness**
- [ ] Upload signed AAB to Internal Testing track first
- [ ] Test Internal track install before promoting to Production

---

## ⚡ Performance & Polish

- [ ] Confirm no `console.log` debug spam leaks in release builds
- [ ] Verify all screens handle empty states (no workouts, no history, etc.)
- [ ] Check all back-navigation flows are correct
- [ ] Verify predictive back gesture is handled (`predictiveBackGestureEnabled: false` already set)

---
---

# 🔍 OAuth Client JSON — Explained

You received this JSON from Google Cloud Console after creating an OAuth 2.0 client:

```json
{
  "installed": {
    "client_id": "81738149264-q7gqeu0nvksebi02nrce68blhfqlhe1q.apps.googleusercontent.com",
    "project_id": "strongern",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs"
  }
}
```

## What Each Field Means

| Field | What it is | Do you need it? |
|---|---|---|
| `client_id` | **Your app's unique identity** with Google. Used when asking Google to log a user in. | ✅ YES — put this in your app |
| `project_id` | The name of your Google Cloud project (`strongern`). Just a label. | ℹ️ Info only |
| `auth_uri` | The Google URL where users are sent to log in (the Google sign-in page). | 🔧 Used automatically by OAuth library |
| `token_uri` | Google's URL that exchanges an auth code for an access token. | 🔧 Used automatically by OAuth library |
| `auth_provider_x509_cert_url` | URL to Google's public SSL certificates (used to verify tokens are really from Google). | 🔧 Used automatically by OAuth library |

## ⚠️ Why There Is No `client_secret`

The JSON type says `"installed"` — this is downloaded from the Google Console but for a **mobile Android app**, Google does NOT give a `client_secret` because:

- The app runs on users' devices — **secrets cannot be hidden in a mobile app**
- Android uses the **SHA-1 fingerprint** instead to prove identity (only YOUR signed app can use your client ID)
- This is the correct and secure design for mobile OAuth (called PKCE flow)

## ✅ What to Do With `client_id`

Use the `client_id` value in your Google OAuth flow. With Expo and `expo-auth-session`:

```typescript
// In your login screen or auth utility
const CLIENT_ID = '81738149264-q7gqeu0nvksebi02nrce68blhfqlhe1q.apps.googleusercontent.com';

// Used when building the auth request:
const request = new AuthRequest({
  clientId: CLIENT_ID,
  scopes: ['openid', 'profile', 'email', 'https://www.googleapis.com/auth/drive.file'],
  redirectUri: makeRedirectUri({ scheme: 'strongern' }),
});
```

## 🔑 Two Client IDs You Will Need

| Type | When to create | SHA-1 to use |
|---|---|---|
| **Debug client ID** ✅ Done | Now (already created) | `76:DF:43:47:34:90:5B:C2:00:8B:29:FD:2E:B7:4E:C6:F4:D0:36:CF` |
| **Production client ID** | Before publishing to Play Store | Get from Play Console → App signing → SHA-1 |

Both share the same `project_id` (`strongern`). You'll have two separate `client_id` values —
one for debug builds, one for production. The app typically detects build type automatically
or you can use an env variable to switch.

---

*Last updated: 2026-06-06*
