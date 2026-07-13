# strongerN E2E Tests (AI-First)

This test harness runs on Playwright + Expo Web.

## Commands
- Run E2E: `npm run e2e`
- Run headed: `npm run e2e:headed`
- Run specific spec: `npm run e2e -- specs/restTimerSheet.spec.ts`

## File Structure
- `config/` - Playwright browser and custom reporter configurations.
- `core/` - Diagnostics registry, failures-only AI reporter, assertions, and gesture helpers.
- `pages/` - Page Objects representing UI screens and sheets.
- `specs/` - Feature regression test specs.

## AI Debugging Protocol
1. Do NOT inspect test spec files.
2. Read the console output: it contains failures formatted by `core/reporter.ts`.
3. Locate the error's `SOURCE` file and target `ANCHOR` code string.
4. Apply the recommended `FIX` in the codebase.
