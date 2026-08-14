# Execution Plan

## Objective
Optimize StrongerN cold start loading time and data hydration performance for 300+ workouts (<150ms), eliminate monolithic state serialization bottlenecks, build comprehensive benchmarking suite, and verify zero regressions.

## Phases
1. **Phase 0: Architecture & Codebase Survey**
   - Explorer 1: Investigate storage layer, `bootstrapPersistence`, MMKV vs SQLite vs AsyncStorage, hydration flow, and bootstrap sequence.
   - Explorer 2: Investigate root state, Redux / Zustand / Context, workout history storage, active workout persistence, and dual-write mechanisms.
   - Explorer 3: Investigate SQLite relational schema, queries, indexing, N+1 patterns, deserialization, stats/analytics computations, and existing test setup.

2. **Phase 1: Project Scope & Feature Inventory (`PROJECT.md`)**
   - Synthesize survey findings.
   - Define milestones, interfaces, code layout, and non-negotiables.

3. **Milestone 1: Benchmarking Suite (R3)**
   - Create repeatable startup/hydration benchmark script simulating 0, 50, 300+ workouts.
   - Measure storage load/parse time, SQLite query/hydration duration, memory delta, mount time.
   - Establish baseline metrics.

4. **Milestone 2: Cold Start & SQLite/Storage Hydration Optimization (R1)**
   - Optimize query patterns, indexing, lazy/selective hydration, parallelization, eliminate N+1 bottlenecks.
   - Target <150ms startup for 300+ workouts.

5. **Milestone 3: Monolithic State Save & Dual-Write De-bottlenecking (R2)**
   - Decouple active workout drafts and settings persistence from heavy historical session logs.
   - Eliminate full history serialization on routine state updates.

6. **Milestone 4: Regression Testing, Typecheck, Build APK, Version Bump & Push (R4)**
   - Verify `npm run typecheck` and `npm test` pass 100%.
   - Run benchmark validation.
   - Increment app version in `app.json` and `src/utils/i18n.ts`.
   - Update knowledge graph with `graphify update .`.
   - Build release APK with `build-apk.bat --auto`.
   - Stage, commit, and push to `master`.

7. **Phase 5: Final Acceptance & Sentinel Handoff**
   - Prepare `handoff.md` and send completion message to parent Sentinel.
