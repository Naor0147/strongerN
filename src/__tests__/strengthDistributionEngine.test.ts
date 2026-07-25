import {
  findExerciseEntry,
  getExercisePercentile,
  getDistributionHistogramBins,
} from '../utils/strengthDistributionEngine';

describe('strengthDistributionEngine', () => {
  it('should find exercise entries by ID or clean name', () => {
    const squat = findExerciseEntry('barbell-squat');
    expect(squat).toBeDefined();
    expect(squat?.name).toBe('Barbell Back Squat');

    const bench = findExerciseEntry('bench press');
    expect(bench).toBeDefined();
    expect(bench?.id).toBe('barbell-bench-press');
  });

  it('should calculate percentile for Barbell Bench Press accurately', () => {
    // Male 18-29, 80kg bodyweight:
    // P50 in 75-82.5kg bracket is ~78.7kg
    const percentile78 = getExercisePercentile('Barbell Bench Press', 78.7, 80, 'male');
    expect(percentile78).toBeGreaterThanOrEqual(0.48);
    expect(percentile78).toBeLessThanOrEqual(0.55);

    // Very high weight (168kg) -> P99
    const percentileElite = getExercisePercentile('Barbell Bench Press', 168, 80, 'male');
    expect(percentileElite).toBeGreaterThanOrEqual(0.95);

    // Low weight (45kg) -> ~P5
    const percentileBeginner = getExercisePercentile('Barbell Bench Press', 45, 80, 'male');
    expect(percentileBeginner).toBeLessThan(0.20);
  });

  it('should return valid histogram bins for exercises', () => {
    const bins = getDistributionHistogramBins('Barbell Back Squat', 80, 'male');
    expect(bins.p5).toBeGreaterThan(0);
    expect(bins.p20).toBeGreaterThan(bins.p5);
    expect(bins.p50).toBeGreaterThan(bins.p20);
    expect(bins.p80).toBeGreaterThan(bins.p50);
    expect(bins.p95).toBeGreaterThan(bins.p80);
  });

  it('should fall back gracefully for unknown exercise names', () => {
    const percentile = getExercisePercentile('Unknown Magic Lift', 70, 75, 'male');
    expect(percentile).toBeGreaterThan(0);
    expect(percentile).toBeLessThan(1);
  });
});
