# Auto-Load Agent Rules

At the start of every session, read the `.agents` folder and load all rule files from `.agents/rules/` (including `auto-git-commit.md`) to understand project-specific behaviors and constraints.

# Primary Production Repository & Branch Rules

- **Always on Master**: This repository (`C:\Antigravity\strongerN`) is the official production project (`StrongerN`). All completed work, features, bug fixes, and builds MUST be committed and pushed directly to the `master` branch.
- **No Sandbox Branches**: Never leave work on temporary branches (such as `feat/sandbox-merge` or sandbox testing folders). Always merge changes to `master` and ensure `git status` shows you are on `master`.
- **Standalone Release APK**: Always build and install the release APK from `master` via `cmd /c build-apk.bat --auto`.

# ui-ux-design-pro-max

This project strictly implements a premium, AMOLED-first, high-fidelity dark design system using design intelligence from `ui-ux-design-pro-max`. Ensure any edits to `RestTimerRuler.tsx` align perfectly with colors, typography, and interactive state rules specified in [UI_UX_README.md](file:///C:/Antigravity/strongerN/UI_UX_README.md).

# E2E Testing Guide for AI Agents

- **CRITICAL**: Do NOT run `npm run e2e` tests unless the user explicitly asks for them. Running E2E tests burns excessive tokens. Use unit tests (`npm test`), typechecks (`npm run typecheck`), and standalone APK builds instead.
- If explicitly asked by the user, to run the end-to-end tests, run the command `npm run e2e`.
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

# AI & Contributor Security Protection (Muse Spark, Copilot, Cursor)

- **Zero-Trust Data Protection**: Never index, read, or commit `.env`, keystores, credentials, or private configuration files.
- **Strict Permission Boundary**: AI contributors (including Muse Spark 1.2-contributor) must never access or exfiltrate private credentials, user data, or keystores without explicit permission.
- **Automated Security Scan**: Run `npm run check:security` to ensure zero secret leakage.

# Git Auto-Commit & Push

After making any changes or completing a task, stage, commit, and push the changes to the Git repository on `master` (e.g., using `git add .`, `git commit -m "<message>"`, and `git push`). This ensures each task or feature has its own clean, separated commit and push history on the main production branch.

