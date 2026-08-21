# Contributing Guidelines & AI Contributor Protocol

Thank you for contributing to **StrongerN**! This document establishes operational and security guidelines for all contributors, including automated AI contributors like **Muse Spark 1.2-contributor**.

---

## 🤖 AI Contributor Protocol (Muse Spark 1.2-contributor, Copilot, Cursor, etc.)

1. **Strict Data Confidentiality & Permission Boundaries**:
   - AI tools and external contributors must operate strictly within the public UI and application logic (`src/`, `assets/`, `docs/`).
   - Do **NOT** attempt to inspect, index, log, or exfiltrate private credentials, keystores, `.env` files, or user database dumps.
   - All AI actions requiring sensitive permissions or credential alteration must request explicit human owner authorization.

2. **Offline & Mock Readiness**:
   - All UI components, state machines, and calculations must function in offline and mock modes without requiring real external API keys or cloud connections.
   - Tests must run offline without internet access or secret credentials.

3. **Design System Adherence**:
   - Follow the OLED Dark Theme (`#0D0F14`) rules defined in [UI_UX_README.md](file:///c:/Antigravity/strongerN/UI_UX_README.md) and [design-system/strongern/MASTER.md](file:///c:/Antigravity/strongerN/design-system/strongern/MASTER.md).

4. **Pre-Submission Quality Checklist**:
   - Run typecheck: `npm run typecheck`
   - Run unit tests: `npm test`
   - Run security secret scan: `npm run check:security`

---

## 🔒 Security & Secrets Hygiene

- Never commit real API keys, tokens, or keystores.
- Use `.env.example` as a template for environment variables with safe placeholder values.
- Verify that `.museignore`, `.aiexclude`, and `.gitignore` rules are respected at all times.
