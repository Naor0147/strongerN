# Fixture Corpus Matrix

## Synthetic Test Fixtures (Not Derived From User Data)

| Fixture ID | Purpose & Focus | Key Data Characteristics | Verification Rules |
| :--- | :--- | :--- | :--- |
| `FX_01_EMPTY_USER` | Fresh app install / onboarding | No legacy sessions, default preferences. | Migration completes cleanly with zero records; default stores do not write empty blobs over missing legacy keys. |
| `FX_02_LARGE_HISTORY` | Performance & pagination scale | 5,000+ completed sessions, 25,000+ sets across 3 years. | Page loading < 50ms, memory overhead < 10MB, query plan uses indexes for date range / exercise search. |
| `FX_03_CUSTOM_EXERCISES_TAGS` | Custom exercise library & variations | Custom exercise IDs (`ex-custom-1`), variation tags ("Incline", "Pause"). | Variation isolation verified; expected values for base vs custom variation do not leak across isolated variations. |
| `FX_04_UNILATERAL_ASYMMETRIC` | Unilateral exercises with distinct side values | Dumbbell Curl: Left (20kg x 10), Right (17.5kg x 8). | Normalization preserves distinct left/right weights/reps without averaging or collapsing. |
| `FX_05_BODYWEIGHT_ZERO` | Zero-weight bodyweight exercises | Pull-ups: Weight 0 kg, 12 reps. | `weightMilliKg` preserved as integer `0` (not `null` or missing). Expected values engine treats 0kg x 12 as valid history. |
| `FX_06_ACTIVE_TYPING_DRAFT` | In-progress active workout draft | Active workout with focused input string `"12."` and `reps: ""`. | Recovery restores exact string `"12."` without converting to `12.0` or stripping decimal point. |
| `FX_07_NUMERIC_SET_COUNT` | Routine templates / legacy active state with set count | Exercise `{ name: 'Squat', sets: 3 }` without explicit `setsDetails` array. | Normalizer creates exactly 3 active set records without dropping exercise or generating zero sets. |
| `FX_08_CORRUPT_SLOT_STALE_HEAD` | Active draft slot recovery | Slot A corrupted checksum, Slot B valid revision 5, Head points to Slot A. | Recovery detects Slot A corruption, falls back to Slot B (revision 5), and restores active workout. |
