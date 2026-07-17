// scripts/run-microbench.js
// High-precision Hermes/V8 micro-benchmarks using benchmark.js

const Benchmark = require('benchmark');

function runMicroBenchmarks() {
  console.log('\n⚡ Running React Native & Hermes Engine State Mutation Micro-Benchmarks...');
  console.log('Testing state tree mutation strategies over heavy workout payload (20 exercises / 80 sets)...\n');

  // Sample heavy payload array
  const createMockExercises = () => Array.from({ length: 20 }).map((_, exIdx) => ({
    id: `ex-${exIdx}`,
    name: `Exercise ${exIdx}`,
    sets: Array.from({ length: 4 }).map((__, setIdx) => ({
      id: `set-${exIdx}-${setIdx}`,
      weight: '60',
      reps: '10',
      completed: false,
      category: 'S',
    }))
  }));

  const suite = new Benchmark.Suite();

  // Test Case 1: Legacy O(N) map iteration
  suite.add('Legacy O(N) Array.map Mutation', function() {
    let exercises = createMockExercises();
    const exIdx = 10;
    const setIdx = 2;
    const willBeCompleted = true;

    exercises = exercises.map((ex, eIdx) => {
      if (eIdx !== exIdx) return ex;
      return {
        ...ex,
        sets: ex.sets.map((set, sIdx) => {
          if (sIdx !== setIdx) return set;
          return { ...set, completed: willBeCompleted };
        })
      };
    });
  });

  // Test Case 2: High-Performance O(1) Direct Index Slicing
  suite.add('High-Performance O(1) Index Slice Mutation', function() {
    let exercises = createMockExercises();
    const exIdx = 10;
    const setIdx = 2;
    const willBeCompleted = true;

    if (exercises[exIdx] && exercises[exIdx].sets[setIdx]) {
      const targetEx = exercises[exIdx];
      const nextSets = [...targetEx.sets];
      nextSets[setIdx] = { ...nextSets[setIdx], completed: willBeCompleted };
      const nextArr = [...exercises];
      nextArr[exIdx] = { ...targetEx, sets: nextSets };
      exercises = nextArr;
    }
  });

  // Test Case 3: Mutative Ultra-Fast Structural Sharing
  try {
    const { create } = require('mutative');
    suite.add('Mutative Engine Structural Sharing', function() {
      let exercises = createMockExercises();
      const exIdx = 10;
      const setIdx = 2;
      const willBeCompleted = true;

      exercises = create(exercises, draft => {
        if (draft[exIdx] && draft[exIdx].sets[setIdx]) {
          draft[exIdx].sets[setIdx].completed = willBeCompleted;
        }
      });
    });
  } catch (e) {
    console.warn('Mutative package not loaded yet:', e.message);
  }

  // Add listeners
  suite.on('cycle', function(event) {
    console.log(`📊 ${String(event.target)}`);
  });

  suite.on('complete', function() {
    console.log(`\n========================================================================`);
    console.log(`🥇 Fastest Strategy: ${this.filter('fastest').map('name')}`);
    const legacyStats = this[0].hz;
    const optimizedStats = this[1].hz;
    const speedup = (optimizedStats / legacyStats).toFixed(2);
    console.log(`🚀 Speedup Factor: ${speedup}x throughput improvement!`);
    console.log(`========================================================================\n`);
  });

  suite.run({ async: false });
}

if (require.main === module) {
  runMicroBenchmarks();
}

module.exports = { runMicroBenchmarks };
