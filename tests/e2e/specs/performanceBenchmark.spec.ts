import { test, expect } from '@playwright/test';
import { AppPage } from '../pages/AppPage';
import * as fs from 'fs';
import * as path from 'path';

interface BenchmarkResult {
  mean: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
  stdDev: number;
  samples: number;
}

function computeStats(timings: number[]): BenchmarkResult {
  if (timings.length === 0) {
    return { mean: 0, min: 0, max: 0, p50: 0, p95: 0, p99: 0, stdDev: 0, samples: 0 };
  }
  const sorted = [...timings].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = sum / sorted.length;
  const stdDev = Math.sqrt(
    sorted.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / sorted.length
  );
  const percentile = (p: number) => {
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
  };
  return {
    mean: parseFloat(mean.toFixed(2)),
    min: parseFloat(sorted[0].toFixed(2)),
    max: parseFloat(sorted[sorted.length - 1].toFixed(2)),
    p50: parseFloat(percentile(50).toFixed(2)),
    p95: parseFloat(percentile(95).toFixed(2)),
    p99: parseFloat(percentile(99).toFixed(2)),
    stdDev: parseFloat(stdDev.toFixed(2)),
    samples: sorted.length,
  };
}

function printStats(label: string, stats: BenchmarkResult) {
  console.log(`\n========================================`);
  console.log(`📊 ${label} (${stats.samples} samples)`);
  console.log(`========================================`);
  console.log(`Mean:   ${stats.mean} ms`);
  console.log(`P50:    ${stats.p50} ms`);
  console.log(`P95:    ${stats.p95} ms`);
  console.log(`P99:    ${stats.p99} ms`);
  console.log(`Min:    ${stats.min} ms`);
  console.log(`Max:    ${stats.max} ms`);
  console.log(`StdDev: ${stats.stdDev} ms`);
  console.log(`========================================\n`);
}

test.describe('Performance Benchmark Suite', () => {
  let appPage: AppPage;

  test('Comprehensive baseline & throttled interaction benchmarks', async ({ page }) => {
    test.setTimeout(240000);
    appPage = new AppPage(page);
    await appPage.goto();
    await appPage.clearStorage();
    await appPage.startLargeWorkout();

    const focusTimings: number[] = [];
    const keystrokeTimings: number[] = [];
    const kbOpenTimings: number[] = [];
    const kbCloseTimings: number[] = [];

    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[BENCHMARK]')) {
        const focusMatch = text.match(/Focus transition took: ([\d.]+)ms/);
        if (focusMatch) focusTimings.push(parseFloat(focusMatch[1]));

        const keyMatch = text.match(/Keystroke render took: ([\d.]+)ms/);
        if (keyMatch) keystrokeTimings.push(parseFloat(keyMatch[1]));

        const openMatch = text.match(/Keyboard open took: ([\d.]+)ms/);
        if (openMatch) kbOpenTimings.push(parseFloat(openMatch[1]));

        const closeMatch = text.match(/Keyboard close took: ([\d.]+)ms/);
        if (closeMatch) kbCloseTimings.push(parseFloat(closeMatch[1]));
      }
    });

    const weightCell = page.locator('[data-testid="set-weight-0-0"]');
    const repsCell = page.locator('[data-testid="set-reps-0-0"]');
    await weightCell.waitFor({ state: 'visible', timeout: 15000 });

    // Helper function to run the benchmark interaction sequence
    const runInteractions = async () => {
      // Warmup
      await weightCell.click();
      await page.waitForTimeout(30);
      await repsCell.click();
      await page.waitForTimeout(30);
      focusTimings.length = 0;
      keystrokeTimings.length = 0;
      kbOpenTimings.length = 0;
      kbCloseTimings.length = 0;

      // 1. Focus Transitions (10 cycles = 20 transitions, N=20 sample points)
      for (let i = 0; i < 10; i++) {
        await weightCell.click();
        await page.waitForTimeout(10);
        await repsCell.click();
        await page.waitForTimeout(10);
      }

      // 2. Rapid Keystrokes (2 rounds of 6 digits + 6 backspaces = 24 keystrokes)
      await weightCell.click();
      await page.waitForTimeout(50);
      const digits = ['1', '2', '3', '4', '5', '6'];
      for (let round = 0; round < 2; round++) {
        for (const digit of digits) {
          const keyBtn = page.locator(`[aria-label="Digit ${digit}"]`);
          if (await keyBtn.isVisible()) {
            await keyBtn.click({ delay: 0 });
            await page.waitForTimeout(5);
          }
        }
        const bsBtn = page.locator('[aria-label="Delete last digit"]');
        if (await bsBtn.isVisible()) {
          for (let b = 0; b < 6; b++) {
            await bsBtn.click({ delay: 0 });
            await page.waitForTimeout(5);
          }
        }
      }

      // 3. Keyboard Open / Close (4 cycles = 8 toggle interactions)
      const closeBtn = page.locator('[data-testid="close-keyboard-btn"]');
      for (let i = 0; i < 4; i++) {
        await weightCell.click();
        await page.waitForTimeout(20);
        if (await closeBtn.isVisible()) {
          await closeBtn.click();
          await page.waitForTimeout(20);
        }
      }

      // 4. Drag-and-Drop Exercise Card Reorder Physics Test
      try {
        const dragHandle0 = page.locator('[aria-label="Drag to reorder exercise"]').first();
        const dragHandle1 = page.locator('[aria-label="Drag to reorder exercise"]').nth(1);
        if (await dragHandle0.isVisible() && await dragHandle1.isVisible()) {
          const box0 = await dragHandle0.boundingBox();
          const box1 = await dragHandle1.boundingBox();
          if (box0 && box1) {
            const tDragStart = Date.now();
            await page.mouse.move(box0.x + box0.width / 2, box0.y + box0.height / 2);
            await page.mouse.down();
            await page.mouse.move(box1.x + box1.width / 2, box1.y + box1.height / 2 + 40, { steps: 5 });
            await page.mouse.up();
            const dragMs = Date.now() - tDragStart;
            console.log(`[BENCHMARK] Exercise card drag reorder took: ${dragMs}ms`);
          }
        }
      } catch (err) {
        console.warn('Drag reorder test non-fatal notice:', err);
      }
    };

    // CDP Setup
    const client = await page.context().newCDPSession(page);

    // ── 1. BASELINE BENCHMARK (1x Speed) ──
    console.log('\n🏃 Running 1x Baseline Heavy Payload Benchmark...');
    const t0 = Date.now();
    await runInteractions();
    const baselineModalOpenMs = Date.now() - t0;
    console.log(`⏱️  1x Baseline Modal Load & Interaction Cycle: ${baselineModalOpenMs}ms`);

    const baselineResults = {
      modalMountMs: baselineModalOpenMs,
      focusTransition: computeStats(focusTimings),
      keystrokeRender: computeStats(keystrokeTimings),
      keyboardOpen: computeStats(kbOpenTimings),
      keyboardClose: computeStats(kbCloseTimings),
    };
    printStats('1X BASELINE FOCUS TRANSITIONS', baselineResults.focusTransition);

    // ── 2. LOW-END HARDWARE BENCHMARK (4x CPU Throttling) ──
    console.log('\n🐢 Setting CPU Throttling to 4x (Budget Android Device Simulation)...');
    await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await client.send('Profiler.enable');
    await client.send('Profiler.start');

    const t4x = Date.now();
    await runInteractions();
    const throttled4xModalOpenMs = Date.now() - t4x;
    console.log(`⏱️  4x Throttled Modal Load & Interaction Cycle: ${throttled4xModalOpenMs}ms`);

    const profile4x = await client.send('Profiler.stop');
    fs.writeFileSync(
      path.resolve(__dirname, '../../../cpu_profile_4x.json'),
      JSON.stringify(profile4x.profile, null, 2)
    );

    const stats4xResults = {
      modalMountMs: throttled4xModalOpenMs,
      focusTransition: computeStats(focusTimings),
      keystrokeRender: computeStats(keystrokeTimings),
      keyboardOpen: computeStats(kbOpenTimings),
      keyboardClose: computeStats(kbCloseTimings),
    };
    printStats('4X THROTTLED FOCUS TRANSITIONS', stats4xResults.focusTransition);

    // ── 3. LOW-END HARDWARE BENCHMARK (6x CPU Throttling) ──
    console.log('\n🦥 Setting CPU Throttling to 6x (Low-End Entry Android Device Simulation)...');
    await client.send('Emulation.setCPUThrottlingRate', { rate: 6 });
    await client.send('Profiler.enable');
    await client.send('Profiler.start');

    const t6x = Date.now();
    await runInteractions();
    const throttled6xModalOpenMs = Date.now() - t6x;
    console.log(`⏱️  6x Throttled Modal Load & Interaction Cycle: ${throttled6xModalOpenMs}ms`);

    const profile6x = await client.send('Profiler.stop');
    fs.writeFileSync(
      path.resolve(__dirname, '../../../cpu_profile_6x.json'),
      JSON.stringify(profile6x.profile, null, 2)
    );

    const stats6xResults = {
      modalMountMs: throttled6xModalOpenMs,
      focusTransition: computeStats(focusTimings),
      keystrokeRender: computeStats(keystrokeTimings),
      keyboardOpen: computeStats(kbOpenTimings),
      keyboardClose: computeStats(kbCloseTimings),
    };
    printStats('6X THROTTLED FOCUS TRANSITIONS', stats6xResults.focusTransition);

    // Reset Throttling
    await client.send('Emulation.setCPUThrottlingRate', { rate: 1 });

    const allResults = {
      baseline: baselineResults,
      throttled4x: stats4xResults,
      throttled6x: stats6xResults,
      timestamp: new Date().toISOString(),
    };

    fs.writeFileSync(
      path.resolve(__dirname, '../../../benchmark_results.json'),
      JSON.stringify(allResults, null, 2)
    );

    // Run V8 Profile Analysis
    try {
      const { runAnalysis } = require('../../../scripts/analyze-cpu-profile');
      runAnalysis();
    } catch (err) {
      console.warn('Profile analysis auto-trigger error:', err);
    }

    // Assertions: even under 4x CPU throttling, average focus transition time should stay under 25ms
    expect(stats4xResults.focusTransition.mean).toBeLessThan(25);
  });
});
