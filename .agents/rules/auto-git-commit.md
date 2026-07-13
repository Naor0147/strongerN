---
trigger: after_implementation
description: Auto-commit completed implementation work with a descriptive conventional-commit message.
---

## auto-git-commit

After completing an implementation task (code edits, bug fixes, new features — NOT research, planning, or read-only exploration), automatically commit the work.

Rules:
- **Pre-commit verification:** Run the project's typecheck/lint command before staging. If it fails, fix the issue and retry — do not commit broken code.
- **Stage only task-related files:** Inspect `git status` and `git diff`; stage only the files changed for the current task. Never stage unrelated changes, secrets, or `.env` files.
- **Commit message format:** Use conventional commits matching the existing repo history:
  - `feat: <imperative description>` for new features or enhancements
  - `fix: <imperative description>` for bug fixes
  - `refactor: <imperative description>` for code restructuring with no behavior change
  - `chore: <imperative description>` for config, build, or dependency changes
- **Message content:** The description must explain WHAT changed and WHY. Keep the subject line ≤72 chars. If more context is needed, add a blank line then a short body paragraph.
  - Example: `fix: prevent timer picker sheet from closing on web drag release`
  - Example: `feat: move rest timer seconds to center and save button to right in picker`
- **Commit immediately:** Create exactly one commit per completed task. Do not amend or force-push. If the commit fails (hook rejection, etc.), fix the issue and create a new commit.
- **Do NOT commit during plan mode** or when the user has explicitly asked to review before committing.
- **Do NOT push** unless the user explicitly requests it.
