# Requirement R1 Investigation Report: Lossless Bundle & Asset Optimization (APK ≤ 20MB)

**Author:** Explorer 1 (`teamwork_preview_explorer`)  
**Target Milestone:** R1 (Lossless Bundle & Asset Optimization — APK ≤ 20MB, Stretch Target: 17MB)  
**Project:** StrongerN (`c:\Antigravity\strongerN`)  
**Date:** 2026-08-19  

---

## 1. Executive Summary & Baseline Census

A full empirical census of the existing release APK (`apk/strongerN.apk`) was executed.

### Baseline Metrics (Current Standalone Release APK)
- **Total APK Size:** **32.14 MB** (33,703,267 bytes)
- **Total Entries in APK:** 1,598 files

| Category | File Count | Current Compressed Size in APK | Current Uncompressed Size | Root Cause of Bloat |
| :--- | :--- | :--- | :--- | :--- |
| **Fonts (`.ttf`)** | **52 files** | **5.97 MB** | 12.59 MB | Barrel/index package imports (`@expo-google-fonts/inter`, `@expo-google-fonts/rubik`, `@expo/vector-icons`) causing Metro to resolve and bundle 52 TTFs instead of the 9 actually needed. |
| **DEX (Bytecode)** | **4 files** | **10.70 MB** | 28.57 MB | `enableMinifyInReleaseBuilds=false` and `shrinkResources=false`. R8 full mode is disabled; all unused classes/methods from RN, Expo, and native libs are packaged unminified. |
| **JS/Hermes Bundle** | **1 file** | **5.30 MB** | 5.42 MB | `enableBundleCompression=false`. The Hermes bytecode bundle is stored uncompressed in APK assets. |
| **Native SO Libraries** | **24 files** | **6.81 MB** | 20.64 MB | Pre-compiled native binaries (C++/JNI) for arm64-v8a (Hermes, Reanimated, Nitro/MMKV, etc.). |
| **Drawables & Images** | **431 files** | **0.97 MB** | 0.97 MB | `StorngNLogo.png` is an uncompressed 2000x2000 PNG (755 KB) displayed only at 48x48 pt (`res/Pa.png` = 699.4 KB in APK). |
| **Resources & Manifests**| **847 files** | **0.31 MB** | 0.70 MB | XML layouts, values, drawables. |
| **Other / Meta** | **239 files** | **1.89 MB** | 2.09 MB | Asset catalogs, licenses. |

---

## 2. Section 1: Font Census & Import Optimization

### 2.1 Current State Analysis
1. **Package Index Barrel Imports in App Core:**
   - `src/App.tsx` (Lines 11–12):
     ```typescript
     import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
     import { Rubik_400Regular, Rubik_500Medium, Rubik_600SemiBold, Rubik_700Bold } from '@expo-google-fonts/rubik';
     ```
   - `src/screens/E2EAppHarness.tsx` (Lines 13–14):
     ```typescript
     import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
     import { Rubik_400Regular, Rubik_500Medium, Rubik_600SemiBold, Rubik_700Bold } from '@expo-google-fonts/rubik';
     ```
   - `node_modules/@expo-google-fonts/inter/index.js` contains 18 top-level `require('./...ttf')` statements (weights 100 to 900 + 9 italics).
   - `node_modules/@expo-google-fonts/rubik/index.js` contains 14 top-level `require('./...ttf')` statements (weights 300 to 900 + 7 italics).
   - Metro follows every top-level require in `index.js`, bundling all 32 Google font TTFs into the APK assets.

2. **Vector Icons Barrel Imports Across 36 Files:**
   - 36 files across `src/components/` and `src/screens/` import Ionicons as:
     ```typescript
     import { Ionicons } from '@expo/vector-icons';
     ```
   - `node_modules/@expo/vector-icons/build/IconsLazy.js` (and `Icons.js`) top-level requires 19 icon packages: `AntDesign`, `Entypo`, `EvilIcons`, `Feather`, `FontAwesome`, `FontAwesome5`, `FontAwesome6`, `Fontisto`, `Foundation`, `Ionicons`, `MaterialCommunityIcons`, `MaterialIcons`, `Octicons`, `SimpleLineIcons`, `Zocial`, etc.
   - Each icon package has a top-level `import font from './vendor/.../*.ttf'`, forcing Metro to bundle all 19 icon fonts into the APK assets.
   - Total fonts bundled in current APK: **52 TTFs** (12.59 MB uncompressed / 5.97 MB in APK).

### 2.2 Active Font Requirements (Target: Exactly 9 TTFs)
The design system (`src/theme.ts` lines 125–145) strictly requires only:
1. `Inter_400Regular` (`Inter_400Regular.ttf` ~342 KB)
2. `Inter_500Medium` (`Inter_500Medium.ttf` ~339 KB)
3. `Inter_600SemiBold` (`Inter_600SemiBold.ttf` ~339 KB)
4. `Inter_700Bold` (`Inter_700Bold.ttf` ~337 KB)
5. `Rubik_400Regular` (`Rubik_400Regular.ttf` ~203 KB)
6. `Rubik_500Medium` (`Rubik_500Medium.ttf` ~203 KB)
7. `Rubik_600SemiBold` (`Rubik_600SemiBold.ttf` ~202 KB)
8. `Rubik_700Bold` (`Rubik_700Bold.ttf` ~202 KB)
9. `Ionicons` (`Ionicons.ttf` ~414 KB)

### 2.3 Actionable Implementation Specification for Fonts
1. **In `src/App.tsx` and `src/screens/E2EAppHarness.tsx`:**
   Replace the Google Font imports with direct subpath module imports and use `useFonts` from `expo-font`:
   ```typescript
   // Before:
   import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
   import { Rubik_400Regular, Rubik_500Medium, Rubik_600SemiBold, Rubik_700Bold } from '@expo-google-fonts/rubik';

   // After:
   import { useFonts } from 'expo-font';
   import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
   import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
   import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
   import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
   import { Rubik_400Regular } from '@expo-google-fonts/rubik/400Regular';
   import { Rubik_500Medium } from '@expo-google-fonts/rubik/500Medium';
   import { Rubik_600SemiBold } from '@expo-google-fonts/rubik/600SemiBold';
   import { Rubik_700Bold } from '@expo-google-fonts/rubik/700Bold';
   ```

2. **In all 36 files importing `@expo/vector-icons`:**
   Replace:
   ```typescript
   // Before:
   import { Ionicons } from '@expo/vector-icons';

   // After:
   import Ionicons from '@expo/vector-icons/Ionicons';
   ```

3. **In `src/__tests__/mocks/nativeModulesMock.js`:**
   Add mock for `@expo/vector-icons/Ionicons`:
   ```javascript
   jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
   ```

4. **In `jest.config.js`:**
   Ensure `moduleNameMapper` handles `.ttf` mock if needed:
   ```javascript
   '\\.(wav|mp3|png|jpg|jpeg|gif|ttf|otf)$': '<rootDir>/src/__tests__/mocks/fileMock.js',
   ```

**Expected Font Savings:** 52 TTFs (5.97 MB in APK) → 9 TTFs (~0.90 MB in APK). **Net reduction: ~5.07 MB**.

---

## 3. Section 2: Android Gradle & ProGuard / R8 Configuration

### 3.1 Current State Analysis
- `android/gradle.properties`:
  - `android.enableMinifyInReleaseBuilds` is missing (defaults to `false`).
  - `android.enableShrinkResourcesInReleaseBuilds` is missing (defaults to `false`).
  - `android.enableBundleCompression` is missing (defaults to `false`).
  - `android.enableR8.fullMode` is missing.
- `android/app/build.gradle`:
  - Lines 18, 70, 118, 119: Code checks `findProperty(...)` which returns `false` due to missing properties in `gradle.properties`.
  - Line 121: `proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"` uses basic proguard without standard optimizations.
- `android/app/proguard-rules.pro`:
  - Currently contains only 2 lines (`com.swmansion.reanimated.**` and `com.facebook.react.turbomodule.**`), which would cause runtime class-stripping crashes if R8 full mode were enabled without keep rules.

### 3.2 Actionable Implementation Specification for Gradle & ProGuard

#### A. `android/gradle.properties` Updates
Add the following properties:
```properties
# Enable R8 minification, resource shrinking, and R8 full mode
android.enableMinifyInReleaseBuilds=true
android.enableShrinkResourcesInReleaseBuilds=true
android.enableR8.fullMode=true

# Enable Hermes bundle compression in release APK
android.enableBundleCompression=true

# PNG crunching
android.enablePngCrunchInReleaseBuilds=true
```

#### B. `android/app/build.gradle` Updates
Update `buildTypes.release` block:
```groovy
release {
    signingConfig signingConfigs.debug
    def enableShrinkResources = findProperty('android.enableShrinkResourcesInReleaseBuilds') ?: 'true'
    shrinkResources enableShrinkResources.toBoolean()
    minifyEnabled enableMinifyInReleaseBuilds
    proguardFiles getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro"
    def enablePngCrunchInRelease = findProperty('android.enablePngCrunchInReleaseBuilds') ?: 'true'
    crunchPngs enablePngCrunchInRelease.toBoolean()
}
```

#### C. `android/app/proguard-rules.pro` Bulletproof Keep Rules
Replace `android/app/proguard-rules.pro` with comprehensive rules:
```proguard
# ─────────────────────────────────────────────────────────────────────────────
# ProGuard / R8 Configuration for StrongerN (Release Optimization)
# ─────────────────────────────────────────────────────────────────────────────

# --- React Native Core & JNI ---
-keep class com.facebook.react.** { *; }
-keep interface com.facebook.react.** { *; }
-keep class com.facebook.react.bridge.JavaScriptModule { *; }
-keep class com.facebook.react.bridge.NativeModule { *; }
-keepclassmembers class * extends com.facebook.react.bridge.NativeModule {
    @com.facebook.react.bridge.ReactMethod *;
}
-keep class com.facebook.react.uimanager.ViewManager { *; }
-keep class com.facebook.react.uimanager.ReactShadowNode { *; }
-keep class com.facebook.react.PackageList { *; }
-keep class com.facebook.react.ReactNativeApplicationEntryPoint { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.soloader.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.yoga.** { *; }

# Preserve native method bindings
-keepclasseswithmembernames class * {
    native <methods>;
}

# --- Expo Modules Architecture & Autolinking ---
-keep class expo.modules.** { *; }
-keep interface expo.modules.** { *; }
-keep @expo.modules.core.interfaces.DoNotStrip class *
-keepclassmembers class * {
    @expo.modules.core.interfaces.DoNotStrip *;
}
-keep class * implements expo.modules.kotlin.records.Record { *; }
-keep class * extends expo.modules.kotlin.sharedobjects.SharedObject { *; }
-keep enum * implements expo.modules.kotlin.types.Enumerable { *; }
-keep class * extends expo.modules.kotlin.modules.Module {
    public <init>();
    public expo.modules.kotlin.modules.ModuleDefinitionData definition();
}
-keepclassmembers class * implements expo.modules.kotlin.views.ExpoView {
    public <init>(android.content.Context);
    public <init>(android.content.Context, expo.modules.kotlin.AppContext);
}

# --- MMKV & Nitro Modules ---
-keep class com.tencent.mmkv.** { *; }
-keep class com.margelo.nitro.** { *; }
-keep interface com.margelo.nitro.** { *; }
-keep class com.margelo.nitro.mmkv.** { *; }

# --- NotifyKit / Notifee ---
-keep class io.invertase.notifee.** { *; }
-keep class app.notifee.core.** { *; }
-keeppackagenames app.notifee.core.**
-keep @interface app.notifee.core.KeepForSdk { *; }
-keep @app.notifee.core.KeepForSdk class * { *; }
-keepclasseswithmembers class * {
    @app.notifee.core.KeepForSdk <fields>;
    @app.notifee.core.KeepForSdk <methods>;
}

# --- Reanimated, Worklets, GestureHandler, Screens, SVG, SafeArea ---
-keep class com.swmansion.reanimated.** { *; }
-keep class com.swmansion.worklets.** { *; }
-keep class com.swmansion.gesturehandler.** { *; }
-keep class com.swmansion.rnscreens.** { *; }
-keep class com.th3rdwave.safeareacontext.** { *; }
-keep class com.horcrux.svg.** { *; }

# --- StrongerN Application Root ---
-keep class com.naor.strongern.** { *; }

# --- General Annotations & Enums ---
-keepattributes *Annotation*,InnerClasses,EnclosingMethod,Signature,Exceptions
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}
```

**Expected DEX & Bundle Savings:**
- DEX: 4 DEX files (10.70 MB compressed) → 1–2 DEX files (~3.80 MB compressed). **Net reduction: ~6.90 MB**.
- Hermes Bundle: Uncompressed 5.30 MB → Compressed ~2.60 MB. **Net reduction: ~2.70 MB**.

---

## 4. Section 3: Static Asset Census & Dead Asset Removal

### 4.1 Asset Census & Usage Matrix

| Asset Path | Disk Size | Referenced In Code? | Action Required |
| :--- | :--- | :--- | :--- |
| `assets/StorngNLogo.png` | 754.9 KB (2000x2000) | `src/screens/LoginScreen.tsx` (line 128) | **Compress & Resize to 512x512** (drops to ~40 KB; saving ~710 KB). |
| `assets/logos/logo_1.png` .. `logo_17.png` (17 files) | 4.52 MB total | **None (0 references)** | **Delete entire `assets/logos/` directory.** |
| `assets/logos_v2/` | 0 B (empty) | **None** | **Delete empty directory.** |
| `assets/photos/Bodyfront.png` | 92.9 KB | **None (0 references)** | **Delete file** (SVG vector paths used in MuscleMap). |
| `assets/photos/BodyBack.png` | 87.1 KB | **None (0 references)** | **Delete file** (SVG vector paths used in MuscleMap). |
| `assets/sounds/bell1.mp3` | 23.5 KB | `soundPlayer.web.ts` only | **Remove web import & delete file.** |
| `assets/sounds/bell2.mp3` | 31.7 KB | `soundPlayer.web.ts` only | **Remove web import & delete file.** |
| `assets/sounds/boxing-bell.mp3` | 132.7 KB | `soundPlayer.web.ts` only | **Remove web import & delete file.** |
| `assets/sounds/set_completed.wav` | 1.6 KB | `src/utils/soundPlayer.ts` | **Keep** (active workout set sound). |
| `assets/sounds/timer_completed.wav` | 3.2 KB | `src/utils/soundPlayer.ts` | **Keep** (active workout timer sound). |
| `assets/sounds/workout_completed.wav` | 4.8 KB | `src/utils/soundPlayer.ts` | **Keep** (active workout finish sound). |
| `assets/icon.png` | 113.5 KB (1024x1024) | `app.json` | **Keep** (app icon). |
| `assets/splash-icon.png` | 96.6 KB (1024x1024) | `app.json` | **Keep** (splash icon). |
| `assets/android-icon-foreground.png` | 116.0 KB | `app.json` | **Keep** (adaptive icon foreground). |
| `assets/android-icon-background.png` | 40.5 KB | Android build | **Keep** (adaptive icon background). |
| `assets/android-icon-monochrome.png` | 116.0 KB | `app.json` | **Keep** (monochrome icon). |
| `assets/favicon.png` | 1.2 KB | `app.json` | **Keep** (web favicon). |

### 4.2 `StorngNLogo.png` Compression Opportunity
- In `src/screens/LoginScreen.tsx` (lines 756–760), `logoImage` is styled with `width: 48, height: 48`.
- The current source image is **2000x2000 pixels (754,962 bytes)** uncompressed RGBA.
- Resizing to **512x512 pixels** (giving 10.6x pixel density for 48pt) and applying standard PNG optimization (palette quantization + Deflate) reduces the file size to **~35–45 KB** with zero visual loss on AMOLED displays.
- In the APK, `res/Pa.png` drops from **699.4 KB** to **~40 KB** (**~660 KB direct APK savings**).

---

## 5. Total Projected APK Size Savings Summary

| Optimization Step | Baseline Size in APK | Projected Size in APK | Expected APK Reduction |
| :--- | :--- | :--- | :--- |
| **Font Census Reduction (52 TTFs → 9 TTFs)** | 5.97 MB | 0.90 MB | **-5.07 MB** |
| **R8 Full Mode & Resource Shrinking** | 10.70 MB | 3.80 MB | **-6.90 MB** |
| **Hermes Bundle Compression** | 5.30 MB | 2.60 MB | **-2.70 MB** |
| **StorngNLogo & Dead Asset Cleanup** | 0.97 MB | 0.35 MB | **-0.62 MB** |
| **Total APK Size (arm64-v8a Standalone)** | **32.14 MB** | **~16.85 MB** | **-15.29 MB (~47.6% drop)** |

**Target:** APK ≤ 20.0 MB  
**Projected Result:** **~16.85 MB** (exceeds primary target and satisfies stretch target ≤ 17 MB).

---

## 6. Implementation Checklist & Verification Method

### 6.1 Step-by-Step Implementation Order
1. **Fonts:** Update imports in `src/App.tsx`, `src/screens/E2EAppHarness.tsx`, and 36 component/screen files to use `@expo/vector-icons/Ionicons`, `@expo-google-fonts/inter/<variant>`, `@expo-google-fonts/rubik/<variant>`, and `expo-font`. Update `src/__tests__/mocks/nativeModulesMock.js`.
2. **Dead Assets:** Remove `assets/logos/`, `assets/logos_v2/`, `assets/photos/`, and `assets/sounds/*.mp3`. Update `src/utils/soundPlayer.web.ts`.
3. **Logo Compression:** Resize/compress `assets/StorngNLogo.png` to 512x512.
4. **Android Build Configuration:** Update `android/gradle.properties`, `android/app/build.gradle`, and `android/app/proguard-rules.pro`.
5. **Add Font Census Regression Guard Test:** Add unit test `src/__tests__/fontCensusGuard.test.ts` to assert that font imports across the repo never re-introduce barrel index imports.

### 6.2 Independent Verification Protocol
- **Typecheck:** `npm run typecheck` (must exit 0).
- **Unit Tests:** `npm test` (must pass).
- **Standalone Build:** `build-apk.bat --auto` (must build cleanly with R8 enabled).
- **APK Census Analyzer:** Run `.agents/explorer_r1_bundle/analyze_apk.ps1` on the newly generated `apk/strongerN.apk`:
  - Assert total `.ttf` count in APK is exactly 9.
  - Assert total APK file size is ≤ 20.0 MB.
- **Runtime Verification:** Ensure MMKV, SecureStore, NotifyKit, Reanimated animations, and WorkoutRestTimer work without any ProGuard reflection errors.
