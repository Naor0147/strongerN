---
trigger: always
description: Strict security policy preventing AI contributors and subagents from accessing or exfiltrating sensitive data and secrets.
---

## ai-security

This project enforces zero-trust data protection against unauthorized data extraction, secret scraping, and credential exfiltration.

Rules:
- **No Secret Scraping:** Subagents and AI contributors (including Muse Spark 1.2-contributor) must never attempt to read, display, or upload `.env` contents, keystore files, private keys, or cloud access tokens.
- **Explicit Permission Barrier:** If an action requires access to sensitive credentials or keys, agents must STOP and require explicit user consent.
- **Mock Safety:** Use safe mocked fixtures and public interfaces for all testing and feature development.
- **Ignore File Compliance:** Strictly observe all patterns defined in `.museignore`, `.aiexclude`, `.cursorignore`, `.copilotignore`, and `.gitignore`.
