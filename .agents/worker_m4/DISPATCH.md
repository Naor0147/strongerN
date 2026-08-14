## 2026-08-14T06:19:30Z
You are Worker 4 for Milestone 4 (Comprehensive Verification, Version Bump, Release APK & Master Git Push - R4) in StrongerN.
Your working directory is: C:\Antigravity\strongerN\.agents\worker_m4

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Read:
1. ORIGINAL_REQUEST.md: C:\Antigravity\strongerN\ORIGINAL_REQUEST.md
2. PROJECT.md: C:\Antigravity\strongerN\PROJECT.md
3. Worker 1 Handoff: C:\Antigravity\strongerN\.agents\worker_m1\handoff.md
4. Worker 2 Handoff: C:\Antigravity\strongerN\.agents\worker_m2\handoff.md
5. Worker 3 Handoff: C:\Antigravity\strongerN\.agents\worker_m3\handoff.md

Tasks to Execute:
1. Verification Checks:
   - Run typecheck: `fnm env --shell powershell | Out-String | Invoke-Expression; npm run typecheck` (must pass with 0 errors).
   - Run full unit tests: `fnm env --shell powershell | Out-String | Invoke-Expression; npm test` (all suites must pass 100%).
   - Run startup benchmark: `fnm env --shell powershell | Out-String | Invoke-Expression; npm run benchmark:startup` (verify sub-150ms 350-session hydration and delta save performance).
2. App Version Increment:
   - Check current version in `app.json` (e.g. `version`). Increment patch version (or appropriate semver).
   - Increment translation keys `profile.version` in `src/utils/i18n.ts` (both English and Hebrew sections) to match the new version.
3. Graphify Auto-Update:
   - Run `graphify update .` to keep the knowledge graph current.
4. Standalone Release APK Build:
   - Run `cmd /c build-apk.bat --auto` to compile the release APK.
5. Git Auto-Commit & Push:
   - Check `git status` to ensure you are on `master` branch.
   - Stage all modified and added files (`git add .`).
   - Commit with a descriptive message (e.g. `feat(perf): cold start hydration and state save decoupling (R1-R4)`).
   - Push to origin `master` (`git push origin master`).
   - Verify `git status` confirms working tree clean and up to date with origin/master.
6. Write full handoff report to `C:\Antigravity\strongerN\.agents\worker_m4\handoff.md` detailing all test outputs, new version number, APK build status, and git commit hash/push status, then send a completion message to your parent.
