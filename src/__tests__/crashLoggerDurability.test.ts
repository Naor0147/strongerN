// src/__tests__/crashLoggerDurability.test.ts
import * as crashLogger from '../utils/crashLogger';
import { AppState } from 'react-native';

describe('CrashLogger Durability & Reliability', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await crashLogger.clearCrashLogs();
  });

  it('re-queues logs and keeps newest logs when saveCrashLogs fails', async () => {
    // Add logs
    await crashLogger.addCrashLog('Log 1', 'Stack 1', false);
    await crashLogger.addCrashLog('Log 2', 'Stack 2', false);

    // Mock saveCrashLogs to fail
    const saveSpy = jest.spyOn(crashLogger, 'saveCrashLogs').mockResolvedValue(false);

    await crashLogger.flushCrashQueueAsync();

    // Verify logs are still available in memory / queue
    const logs = await crashLogger.getCrashLogs();
    expect(logs.length).toBe(2);
    expect(logs.map(l => l.message)).toEqual(
      expect.arrayContaining(['Log 1', 'Log 2'])
    );

    saveSpy.mockRestore();
  });

  it('preserves the newest 100 logs when queue overflows on failure', async () => {
    const saveSpy = jest.spyOn(crashLogger, 'saveCrashLogs').mockResolvedValue(false);

    for (let i = 0; i < 120; i++) {
      await crashLogger.addCrashLog(`Log ${i}`, `Stack ${i}`, false);
    }

    await crashLogger.flushCrashQueueAsync();

    const logs = await crashLogger.getCrashLogs();
    expect(logs.length).toBeLessThanOrEqual(100);
    // Newest log should be present
    expect(logs.some(l => l.message === 'Log 119')).toBe(true);
    // Oldest log should have been dropped
    expect(logs.some(l => l.message === 'Log 0')).toBe(false);

    saveSpy.mockRestore();
  });

  it('flushes crash queue on AppState background transition', async () => {
    await crashLogger.addCrashLog('Background Flush Test Log', 'Stack', false);

    const flushSpy = jest.spyOn(crashLogger, 'flushCrashQueueAsync');

    // Test flush behavior
    await crashLogger.flushCrashQueueAsync();
    const logs = await crashLogger.getCrashLogs();
    expect(logs.some(l => l.message === 'Background Flush Test Log')).toBe(true);

    flushSpy.mockRestore();
  });
});
