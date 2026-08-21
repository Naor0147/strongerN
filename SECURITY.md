# Security Policy & Contributor Data Protection

StrongerN enforces a strict privacy-first, zero-trust security policy for all contributors, developers, automated bots, and AI models (including Muse Spark 1.2-contributor, Copilot, Cursor, Codeium, and external sub-agents).

---

## 1. Zero-Trust Data Protection (No Exfiltration)

1. **No Hardcoded Secrets**: Under no circumstances should API keys, OAuth client secrets, private keys, database credentials, server connection strings, or personal access tokens (PATs) be committed to any branch or file in this repository.
2. **Explicit Permission Required**: AI assistants and contributor tooling (e.g. Muse Spark 1.2-contributor) are strictly restricted from scanning, scraping, logging, or transmitting local secrets, user data, biometric information, keystores, or private `.env` files.
3. **Environment Segregation**:
   - All runtime credentials must reside in local `.env` files (shielded by `.gitignore`, `.museignore`, `.aiexclude`, `.cursorignore`, `.copilotignore`, `.codeiumignore`, and `.geminiignore`).
   - Only dummy placeholders are permitted in `.env.example`.
4. **Android Signing & Keystores**:
   - Keystores (`*.keystore`, `*.jks`, `*.p12`) and signing certificates are strictly private.
   - Never commit or exfiltrate the developer's signing keystores.

---

## 2. Protected Files & Directories

The following file patterns are strictly excluded from AI indexing and external contribution ingestion:

| Resource Type | Protected Paths | Rule |
| :--- | :--- | :--- |
| **Secrets & Keys** | `.env*`, `*.keystore`, `*.jks`, `*.pem`, `*.key`, `*.p8`, `*.p12` | NEVER COMMIT / NEVER TRANSMIT |
| **Cloud Credentials** | `google-services.json`, `credentials.json`, `service-account*.json` | LOCAL ONLY |
| **Machine Configs** | `android/local.properties`, `local.properties`, `.idea/`, `.vscode/` | LOCAL ONLY |
| **Agent Memories** | `.agents/`, `.claude/`, `.junie/`, `.fallow/`, `graphify-out/` | INTERNAL AGENTS ONLY |
| **Build Artifacts** | `apk/`, `android/app/build/`, `android/build/`, `dist/`, `web-build/` | GENERATED BINARIES |
| **Test Logs & Dumps**| `test-results/`, `playwright-report/`, `*.log`, `*.cpuprofile` | LOCAL DIAGNOSTICS |

---

## 3. Reporting a Vulnerability

If you discover a security vulnerability or accidental secret exposure:
1. Do **NOT** create a public GitHub issue.
2. Contact the repository owner immediately.
3. If an API key or credential was accidentally exposed, revoke it immediately at the source provider.
