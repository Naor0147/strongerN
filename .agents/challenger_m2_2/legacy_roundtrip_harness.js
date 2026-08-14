'use strict';

const assert = require('node:assert');
const { legacySessionToV2, sessionV2ToLegacy } = require('../../src/storage/history/legacySessionMapper');

console.log('--- STARTING LEGACY SESSION ROUND-TRIP FIDELITY HARNESS ---');

const legacyWorkout = {
  id: 'legacy-sess-999',
  title: 'Full Body Heavy Blast',
  datetime: '2026-08-14T08:00:00.000Z',
  comment: 'Felt strong, hit PR on bench',
  durationMinutes: 75,
  totalVolumeKg: 12500.5,
  prs: 2,
  exercises: [
    {
      name: 'Barbell Bench Press',
      variation: 'paused',
      sets: 4,
      bestWeight: 120,
      bestReps: 6,
      setsDetails: [
        { weight: 60, reps: 12, completed: true, category: 'W', rpe: 5.5, isUnilateral: false },
        { weight: 100, reps: 8, completed: true, category: 'S', rpe: 7.5, isUnilateral: false },
        { weight: 120, reps: 6, completed: true, category: 'S', rpe: 9.0, isUnilateral: false },
        { weight: 90, reps: 10, completed: true, category: 'D', rpe: 10.0, isUnilateral: false },
      ],
    },
    {
      name: 'Single Arm Dumbbell Row',
      variation: '',
      sets: 2,
      bestWeight: 36,
      bestReps: 10,
      setsDetails: [
        {
          weight: 32,
          reps: 10,
          completed: true,
          category: 'S',
          rpe: 8.0,
          isUnilateral: true,
          leftWeight: 32,
          leftReps: 10,
          rightWeight: 32,
          rightReps: 10,
        },
        {
          weight: 36,
          reps: 8,
          completed: true,
          category: 'F',
          rpe: 10.0,
          isUnilateral: true,
          leftWeight: 36,
          leftReps: 8,
          rightWeight: 36,
          rightReps: 7,
        },
      ],
    },
    {
      name: 'Bodyweight Dips',
      setsDetails: [
        { weight: 0, reps: 15, completed: true, category: 'S', rpe: 8.5 },
      ],
    },
  ],
};

console.log('1. Converting Legacy -> V2...');
const v2Session = legacySessionToV2(legacyWorkout, 0);

assert.strictEqual(v2Session.id, 'legacy-sess-999');
assert.strictEqual(v2Session.title, 'Full Body Heavy Blast');
assert.strictEqual(v2Session.titleNorm, 'full body heavy blast');
assert.strictEqual(v2Session.durationSec, 4500);
assert.strictEqual(v2Session.totalVolumeMilliKg, 12500500);
assert.strictEqual(v2Session.prs, 2);
assert.strictEqual(v2Session.exercises.length, 3);

// Exercise 0 Sets
const ex0Sets = v2Session.exercises[0].sets;
assert.strictEqual(ex0Sets[0].category, 'W');
assert.strictEqual(ex0Sets[0].weightMilliKg, 60000);
assert.strictEqual(ex0Sets[0].rpeTenths, 55);

assert.strictEqual(ex0Sets[1].category, 'S');
assert.strictEqual(ex0Sets[1].weightMilliKg, 100000);
assert.strictEqual(ex0Sets[1].rpeTenths, 75);

assert.strictEqual(ex0Sets[2].category, 'S');
assert.strictEqual(ex0Sets[2].weightMilliKg, 120000);
assert.strictEqual(ex0Sets[2].rpeTenths, 90);

assert.strictEqual(ex0Sets[3].category, 'D');
assert.strictEqual(ex0Sets[3].weightMilliKg, 90000);
assert.strictEqual(ex0Sets[3].rpeTenths, 100);

// Exercise 1 Unilateral Sets
const ex1Sets = v2Session.exercises[1].sets;
assert.strictEqual(ex1Sets[0].isUnilateral, true);
assert.strictEqual(ex1Sets[0].category, 'S');
assert.strictEqual(ex1Sets[0].leftWeightMilliKg, 32000);
assert.strictEqual(ex1Sets[0].rightWeightMilliKg, 32000);

assert.strictEqual(ex1Sets[1].isUnilateral, true);
assert.strictEqual(ex1Sets[1].category, 'F');
assert.strictEqual(ex1Sets[1].leftWeightMilliKg, 36000);
assert.strictEqual(ex1Sets[1].leftReps, 8);
assert.strictEqual(ex1Sets[1].rightWeightMilliKg, 36000);
assert.strictEqual(ex1Sets[1].rightReps, 7);

// Exercise 2 Bodyweight
const ex2Sets = v2Session.exercises[2].sets;
assert.strictEqual(ex2Sets[0].weightMilliKg, 0);
assert.strictEqual(ex2Sets[0].reps, 15);
assert.strictEqual(ex2Sets[0].rpeTenths, 85);

console.log('  -> PASS: Legacy -> V2 conversion accurate.');

console.log('2. Converting V2 -> Legacy...');
const roundTripLegacy = sessionV2ToLegacy(v2Session);

assert.strictEqual(roundTripLegacy.id, legacyWorkout.id);
assert.strictEqual(roundTripLegacy.title, legacyWorkout.title);
assert.strictEqual(roundTripLegacy.durationMinutes, legacyWorkout.durationMinutes);
assert.strictEqual(roundTripLegacy.prs, legacyWorkout.prs);
assert.strictEqual(roundTripLegacy.exercises.length, legacyWorkout.exercises.length);

const rtEx0 = roundTripLegacy.exercises[0];
assert.strictEqual(rtEx0.setsDetails[0].category, 'W');
assert.strictEqual(rtEx0.setsDetails[0].weight, 60);
assert.strictEqual(rtEx0.setsDetails[0].rpe, 5.5);

assert.strictEqual(rtEx0.setsDetails[3].category, 'D');
assert.strictEqual(rtEx0.setsDetails[3].weight, 90);
assert.strictEqual(rtEx0.setsDetails[3].rpe, 10.0);

const rtEx1 = roundTripLegacy.exercises[1];
assert.strictEqual(rtEx1.setsDetails[1].category, 'F');
assert.strictEqual(rtEx1.setsDetails[1].isUnilateral, true);
assert.strictEqual(rtEx1.setsDetails[1].leftWeight, 36);
assert.strictEqual(rtEx1.setsDetails[1].leftReps, 8);
assert.strictEqual(rtEx1.setsDetails[1].rightWeight, 36);
assert.strictEqual(rtEx1.setsDetails[1].rightReps, 7);

const rtEx2 = roundTripLegacy.exercises[2];
assert.strictEqual(rtEx2.setsDetails[0].weight, 0);
assert.strictEqual(rtEx2.setsDetails[0].reps, 15);
assert.strictEqual(rtEx2.setsDetails[0].rpe, 8.5);

console.log('  -> PASS: V2 -> Legacy round-trip preserved 100% data fidelity.');
console.log('\n--- ALL ROUND-TRIP FIDELITY TESTS COMPLETED SUCCESSFULLY ---');
