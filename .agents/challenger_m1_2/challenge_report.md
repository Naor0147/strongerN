# Challenge Report — Milestone 1 (Benchmarking Suite - R3)

**Author**: Challenger 2 (Empirical Challenger)  
**Date**: 2026-08-14T05:54:40Z  
**Verdict**: **APPROVE**  
**Risk Assessment**: **LOW**

---

## 1. Executive Summary

Challenger 2 has conducted independent, empirical verification of the Milestone 1 benchmarking suite (`scripts/benchmark-startup.js`), the SQLite relational schema fidelity (`src/storage/history/schema.ts`), timing isolation, garbage collection decoupling, simulation realism, and domain validation.

All empirical tests passed with 100% fidelity:
1. **SQLite Schema Parity**: 100% structural and constraint match across all 4 tables (`persistence_meta`, `workout_sessions`, `session_exercises`, `set_logs`) and all 5 multi-column indices (`idx_sessions_started_desc`, `idx_sessions_title_started`, `idx_exercises_lookup`, `idx_exercises_session_position`, `idx_sets_exercise_position`).
2. **Simulation Realism & Domain Validation**: Synthetic workout generator accurately models the StrongerN domain model (`WorkoutSessionV2`, `SessionExerciseV2`, `SetLogV2`), producing valid variations, unilateral sets, RPE tenths, set categories, and accurate milli-kg volume computations across 0, 1, 10, 50, 350, and 1000 sessions.
3. **Timing Precision & Isolation**: High-resolution `performance.now()` measurements are strictly decoupled from Garbage Collection (`global.gc()` runs before `t0`), warm-up iterations stabilize JIT tiering, and benchmark read strategies maintain 100% database purity without state mutation leaks.
4. **CLI & Automation**: `"benchmark:startup"` runs cleanly from `package.json`, supporting `--iterations`, `--sessions`, `--json`, `--markdown`, and `--save` flags.
5. **Quality & Regressions**: `npm run typecheck` passes with 0 errors; `npm test` passes all 12 test suites, 94 unit tests, and 6 snapshots.

---

## 2. Empirical Verification Evidence

### Dimension 1: SQLite Schema & Index Equivalence
- **Methodology**: Extracted SQL DDL from `src/storage/history/schema.ts` and compared against the benchmark database initialization via `sqlite_master`, `PRAGMA table_info`, `PRAGMA index_list`, and `PRAGMA foreign_key_list`.
- **Findings**:
  - `persistence_meta` (3 columns, primary key `key`) — **MATCH**
  - `workout_sessions` (13 columns, primary key `id`, constraints) — **MATCH**
  - `session_exercises` (9 columns, primary key `id`, FK to `workout_sessions` ON DELETE CASCADE, UNIQUE `(session_id, position)`) — **MATCH**
  - `set_logs` (13 columns, primary key `id`, FK to `session_exercises` ON DELETE CASCADE, UNIQUE `(session_exercise_id, position)`) — **MATCH**
  - Index `idx_sessions_started_desc` on `workout_sessions(deleted_at_ms, started_at_ms DESC, id)` — **MATCH**
  - Index `idx_sessions_title_started` on `workout_sessions(title_norm, started_at_ms DESC)` — **MATCH**
  - Index `idx_exercises_lookup` on `session_exercises(name_norm, variation_key, session_id)` — **MATCH**
  - Index `idx_exercises_session_position` on `session_exercises(session_id, position)` — **MATCH**
  - Index `idx_sets_exercise_position` on `set_logs(session_exercise_id, category, position)` — **MATCH**

### Dimension 2: Simulation Realism & Domain Validation
- **Methodology**: Evaluated `generateRealisticSessions` and `createLegacyPayload` across 0, 1, 10, 50, 350, and 1000 sessions against StrongerN domain rules (`src/storage/contracts/types.ts` & `src/storage/contracts/validators.ts`).
- **Findings**:
  - 18 catalog exercises spanning Chest, Quads, Hamstrings, Shoulders, Lats, Arms, and Abs across Barbell, Dumbbells, Machine, and Cable.
  - Realistic workout titling and normalized lowercase lookups (`titleNorm`, `nameNorm`).
  - Strict volume accounting: `totalVolumeMilliKg` matches `sum(weightMilliKg * reps)` for completed, non-warmup (`category !== 'W'`) sets.
  - Proper unilateral set handling (`isUnilateral`, `leftWeightMilliKg`, `leftReps`, `rightWeightMilliKg`, `rightReps`).
  - Zero ID collisions across sessions, exercises, and set logs.

### Dimension 3: Timing Precision, Warmup Isolation, and Garbage Collection
- **Methodology**: Inspected timing capture sequence, tested consecutive executions, and evaluated database state mutation isolation.
- **Findings**:
  - `global.gc()` is executed prior to `t0 = performance.now()`, ensuring GC sweep time is not charged to strategy execution time.
  - `initialMem` is sampled before `t0` and `finalMem` after `tEnd`, providing accurate heap delta metrics.
  - Warmup loop (`warmup = 3`) runs before measurement loop, neutralizing V8 turbofan tier-up delays.
  - DB Mutation Isolation: Verified that `workout_sessions` count (350) and `set_logs` count (6,148) remained identical before and after 40 consecutive read benchmark iterations.

### Dimension 4: CLI Execution & Performance Confirmation
- **Methodology**: Executed `npm run benchmark:startup` and tested CLI flag combinations.
- **Observed Metrics (10 iterations)**:
  - **0 Sessions**:
    - Legacy KV: `0.05 ms` (p95: `0.06 ms`, heap: `0.01 MB`)
    - Relational v2: `0.04 ms` (p95: `0.05 ms`, heap: `0.00 MB`)
    - Fast-Path: `0.14 ms` (p95: `0.18 ms`, heap: `0.00 MB`)
  - **50 Sessions** (249 exercises, 868 sets, 115.5 KB KV payload):
    - Legacy KV: `1.89 ms` (p95: `2.53 ms`, heap: `0.47 MB`)
    - Relational v2: `3.90 ms` (p95: `5.80 ms`, heap: `0.79 MB`)
    - Fast-Path: `4.01 ms` (p95: `4.36 ms`, heap: `0.91 MB`)
  - **350 Sessions** (1,761 exercises, 6,177 sets, 803.1 KB KV payload):
    - Legacy KV: `13.61 ms` (p95: `20.88 ms`, heap: `4.23 MB`)
    - Relational v2: `30.10 ms` (p95: `33.08 ms`, heap: `2.78 MB`)
    - Fast-Path: `29.56 ms` (p95: `32.37 ms`, heap: `0.56 MB`)
    - Viewport Instant (Top 50): `2.54 ms` (p95: `3.01 ms`, heap: `0.56 MB`)
  - **Interactive State Save (350 sessions)**:
    - Legacy Monolithic Save: `9.68 ms` (p95: `13.68 ms`)
    - Incremental Delta Write: `0.01 ms` (p95: `0.03 ms`, **968x throughput increase**)

---

## 3. Adversarial Stress-Testing Matrix

| Hypothesis / Attack Scenario | Empirical Test | Result | Status |
|---|---|---|---|
| H1: DDL in benchmark script differs from `src/storage/history/schema.ts` | Extracted SQL DDL and ran schema equivalence check | 100% identical tables, column types, constraints, and indices | PASS |
| H2: Synthetic session generator emits invalid domain models | Validated 0, 1, 10, 50, 350, 1000 sessions with strict contract checkers | 100% valid entities, zero duplicate IDs, valid volume & unilateral fields | PASS |
| H3: Garbage collection or memory sampling distorts timing | Ran with and without `--expose-gc` and verified timer placement | GC runs before `t0`; timers reflect pure query/hydration execution | PASS |
| H4: Benchmark read queries cause database state mutation | Queried row counts before and after 40 strategy runs | Row counts exactly matched (350 sessions, 6,148 sets) | PASS |
| H5: CLI flags or edge-case session counts crash script | Tested `--iterations=2`, `--sessions=0,10,350`, `--json`, `--markdown` | All flags returned status code 0 with valid structured output | PASS |
| H6: Project typechecks or unit tests regress | Ran `npm run typecheck` and `npm test` | 0 type errors, 12 test suites passed, 94 tests passed, 6 snapshots passed | PASS |

---

## 4. Final Verdict

**VERDICT: APPROVE**

The benchmarking suite in `scripts/benchmark-startup.js` satisfies all criteria of Milestone 1 (R3), is mathematically and architecturally rigorous, strictly matches the production SQLite schema, and provides an authoritative baseline for Milestone 2 (Cold Start & Database Hydration Optimization) and Milestone 3 (State Save Decoupling & Delta Writes).
