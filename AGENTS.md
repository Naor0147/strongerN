# Auto-Load Agent Rules

At the start of every session, read the `.agents` folder and load all rule files from `.agents/rules/` (including `auto-git-commit.md`) to understand project-specific behaviors and constraints.

# ui-ux-design-pro-max

This sandbox project strictly implements a premium, AMOLED-first, high-fidelity dark design system using design intelligence from `ui-ux-design-pro-max`. Ensure any edits to `RestTimerRuler.tsx` align perfectly with colors, typography, and interactive state rules specified in [UI_UX_README.md](file:///C:/Antigravity/strongerNTesting/UI_UX_README.md).

# E2E Testing Guide for AI Agents

To run the end-to-end tests, run the command `npm run e2e`.
- **Exit Code**: The script returns `0` on success and `1` on failure.
- **Output Format**: The test runner uses a failures-only custom reporter. If all tests pass, it prints a single summary line. If tests fail, it outputs structured diagnostic logs (error description, file source, anchor code, and regression fix recommendation).
- **Debugging Protocol**: Do not read test spec files to analyze test failures. Trust the diagnostic output containing the exact `source` file, `anchor` code string, and recommended `fix`.

# Graphify Auto-Update

After modifying any code files in a session, always run `graphify update .` to keep the knowledge graph current.

# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

# DO NOT CHANGE SIGNING KEYSTORE / SIGNATURE

When building, compiling, or deploying the app, always use the developer's personal keystore from `C:\Users\NAORA\.android\debug.keystore`. Do not replace it, commit a default repository keystore, or perform any uninstallation/signature changes that would break in-place updates on the connected device.

# Standalone APK Auto-Build

After completing any task or making modifications, always rebuild the standalone release APK by running:
`build-apk.bat --auto`
This compiles the release app and exits cleanly. If a USB device is connected, it also installs automatically.

# App Versioning

Every time you make any change or complete a task, increment the app version in `app.json` and in the translation keys `profile.version` in `src/utils/i18n.ts` (both English and Hebrew), and report the new version at the end of the task.

# Git Auto-Commit & Push

After making any changes or completing a task, stage, commit, and push the changes to the Git repository (e.g., using `git add .`, `git commit -m "<message>"`, and `git push`). This ensures each task or feature has its own clean, separated commit and push history.
