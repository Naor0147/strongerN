## 2026-08-19T14:31:42Z
You are Worker 4 (teamwork_preview_worker) for Milestone 4: Production Release Verification, Standalone APK Build & Release Protocol (R4).
Your working directory is: c:\Antigravity\strongerN\.agents\worker_m4_release
Project root: c:\Antigravity\strongerN
Original request record: c:\Antigravity\strongerN\.agents\ORIGINAL_REQUEST.md

Read:
- `c:\Antigravity\strongerN\.agents\ORIGINAL_REQUEST.md`
- `c:\Antigravity\strongerN\AGENTS.md` and all rules in `.agents/rules/`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Tasks for Milestone 4:
1. Verification Checks:
   - Run `npm run typecheck` (must be 0 errors).
   - Run `npm test` (all suites must pass).
   - Verify app version in `app.json` and in `src/utils/i18n.ts` (both EN and HE `profile.version`) are updated and matching.
2. Standalone Release APK Build:
   - Run `cmd /c build-apk.bat --auto` from project root (`c:\Antigravity\strongerN`).
   - Monitor the Gradle release build to completion.
3. APK Size & Font Census Verification:
   - Inspect the compiled release APK at `apk/strongerN.apk` (and `android/app/build/outputs/apk/release/app-release.apk`).
   - Measure exact file size in bytes and MB. Confirm it is <= 20.0 MB (and check if it reaches the stretch goal <= 17.0 MB).
   - Unpack/inspect APK contents (using zip/tar/node/powershell) to verify:
     - Exact font census (verify exactly 9 TTF files in `assets/fonts/` or APK assets).
     - R8 minification effect (number and size of `classes*.dex` files).
     - Asset compression.
4. Knowledge Graph Update:
   - Run `graphify update .`
5. Git Auto-Commit & Push to Master:
   - Check `git status` and `git diff` to ensure you are on `master`.
   - Stage all modified files (`git add .` or stage task-related files).
   - Commit with a descriptive conventional commit message (e.g., `feat: 120 FPS entry-to-interactive and lightweight APK optimization`).
   - Push to `origin master` (`git push`).
6. Comprehensive Verification Report:
   - Record all baseline vs optimized metrics, APK size, font census, build output, test results, git commit hash in `c:\Antigravity\strongerN\.agents\worker_m4_release\handoff.md`.

When complete, send a message with your findings.
