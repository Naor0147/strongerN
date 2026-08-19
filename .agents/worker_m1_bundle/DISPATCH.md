## 2026-08-19T14:03:37Z

You are Worker 1 (teamwork_preview_worker) for Milestone 1: Lossless Bundle & Asset Optimization (R1).
Your working directory is: c:\Antigravity\strongerN\.agents\worker_m1_bundle
Project root: c:\Antigravity\strongerN
Original request record: c:\Antigravity\strongerN\.agents\ORIGINAL_REQUEST.md

Read:
- `c:\Antigravity\strongerN\.agents\ORIGINAL_REQUEST.md`
- `c:\Antigravity\strongerN\.agents\explorer_r1_bundle\report.md`
- `c:\Antigravity\strongerN\AGENTS.md` and `.agents/rules/`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Tasks for Milestone 1:
1. Font Imports Tree-Shaking (Target: Exactly 9 TTFs):
   - Replace barrel/index imports of `@expo-google-fonts/inter`, `@expo-google-fonts/rubik`, and `@expo/vector-icons` across all components/screens with direct variant imports (`@expo-google-fonts/inter/400Regular`, `@expo-google-fonts/inter/500Medium`, `@expo-google-fonts/inter/600SemiBold`, `@expo-google-fonts/inter/700Bold`, `@expo-google-fonts/rubik/400Regular`, `@expo-google-fonts/rubik/500Medium`, `@expo-google-fonts/rubik/600SemiBold`, `@expo-google-fonts/rubik/700Bold`, and `@expo/vector-icons/Ionicons` or direct Ionicons import).
   - Ensure `useFonts` in `App.tsx` (or root font loader) loads exactly these 8 font variants + Ionicons glyph map.
2. Android Gradle & ProGuard / R8 Configuration:
   - In `android/gradle.properties`:
     - Set `android.enableMinifyInReleaseBuilds=true`
     - Set `android.enableShrinkResourcesInReleaseBuilds=true`
     - Set `android.enableR8.fullMode=true`
     - Set `android.enableBundleCompression=true`
   - In `android/app/build.gradle`:
     - Ensure release buildType has `minifyEnabled true`, `shrinkResources true`, and `proguardFiles getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro"`.
   - In `android/app/proguard-rules.pro`:
     - Add bulletproof keep rules for React Native core, autolinking, MMKV, Nitro, NotifyKit, Expo SecureStore, Expo SQLite, Expo AV/Audio, Expo Notifications, and Reanimated (refer to `explorer_r1_bundle/report.md` section 2).
3. Dead Asset Pruning & Logo Optimization:
   - Remove unused assets: `assets/logos/` (all 17 files), `assets/logos_v2/`, `assets/photos/Bodyfront.png`, `assets/photos/BodyBack.png`, and unreferenced mp3 files in `assets/sounds/` (ensure any sound actively used by the workout timer/rest timer is preserved or safely handled).
   - Compress `assets/StorngNLogo.png` losslessly/optimally.
4. Verification:
   - Run `npm run typecheck` to verify zero TypeScript errors.
   - Run `npm test` to verify existing tests pass.

When complete, write your changes and verification report to `c:\Antigravity\strongerN\.agents\worker_m1_bundle\handoff.md` and send a message.
