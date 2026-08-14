# Original User Request

## 2026-08-14T05:42:11Z

Optimize StrongerN cold start loading time and data hydration performance, specifically accelerating startup when 300+ workouts are logged, while preserving 100% data integrity, UI responsiveness, and existing functionality.

Working directory: C:\Antigravity\strongerN
Integrity mode: development

## Requirements

### R1. Cold Start & Database Hydration Optimization
Optimize `bootstrapPersistence`, SQLite queries, and root state initialization so that loading 300+ workout sessions happens instantaneously. Eliminate N+1 query bottlenecks, avoid redundant full-table deserialization on every app launch, and utilize indexed SQLite / MMKV storage efficiently.

### R2. Monolithic State Save & Dual-Write De-bottlenecking
Eliminate the lag caused by serializing the entire 300-session workout history as a massive monolithic JSON payload to SQLite/localStorage on every root state update. Decouple active workout and settings persistence from heavy historical session logs.

### R3. Comprehensive Benchmarking Suite
Provide an automated, repeatable benchmark script (`scripts/benchmark-startup.ts` or `.js`) that simulates cold start with 0, 50, and 300+ full workout sessions, measuring:
- Storage load / parse execution time (ms)
- SQLite query & hydration duration (ms)
- Memory allocation / heap delta (MB)
- Component mount-to-ready time

### R4. Zero Regressions & Type Safety
Ensure full backward compatibility with existing legacy JSON migrations, active workout draft restoration, SQLite relational tables, statistics/analytics computations, and offline-first persistence. All TypeScript checks (`npm run typecheck`) and unit tests (`npm test`) must pass cleanly.

## Acceptance Criteria

### Startup Performance
- [ ] Cold start data hydration for 300+ workouts executes in under 150ms on benchmark testing (massive speedup from current synchronous monolithic load).
- [ ] Eliminates blocking JSON.stringify / JSON.parse cycles of the full history on standard app interactions.

### Benchmarks & Telemetry
- [ ] Benchmark script executes cleanly via `node` / `npm run` and reports detailed before/after breakdown of load time and memory usage.

### Quality & Regression Verification
- [ ] `npm run typecheck` passes with 0 errors.
- [ ] `npm test` passes 100% of unit tests.
- [ ] Release APK compiles cleanly with `build-apk.bat --auto`.
- [ ] App version incremented in `app.json` and `src/utils/i18n.ts`.
