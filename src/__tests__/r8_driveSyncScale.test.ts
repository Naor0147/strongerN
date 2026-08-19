import { computeBackupFingerprint } from '../utils/backupHash';

describe('R8 Drive Sync Scale Fix & Content Fingerprinting', () => {
  it('generates consistent deterministic fingerprint for identical state', () => {
    const payloadA = {
      user: { name: 'Alex', totalWorkouts: 10, isPro: true },
      templatesList: [{ id: 't1', name: 'Upper Body', lastUsed: '2026-06-01T00:00:00Z' }],
      exercisesList: [{ id: 'e1', name: 'Bench Press', isCustom: false }],
      sessionsList: [{ id: 's1', datetime: '2026-06-01T10:00:00Z' }],
    };

    const payloadB = {
      user: { name: 'Alex', totalWorkouts: 10, isPro: true },
      templatesList: [{ id: 't1', name: 'Upper Body', lastUsed: '2026-06-01T00:00:00Z' }],
      exercisesList: [{ id: 'e1', name: 'Bench Press', isCustom: false }],
      sessionsList: [{ id: 's1', datetime: '2026-06-01T10:00:00Z' }],
    };

    const hashA = computeBackupFingerprint(payloadA);
    const hashB = computeBackupFingerprint(payloadB);

    expect(hashA).toBe(hashB);
    expect(typeof hashA).toBe('string');
    expect(hashA.length).toBeGreaterThan(0);
  });

  it('updates fingerprint when a new workout session is added', () => {
    const payloadBefore = {
      user: { name: 'Alex', totalWorkouts: 1, isPro: false },
      sessionsList: [{ id: 's1', datetime: '2026-06-01T10:00:00Z' }],
    };

    const payloadAfter = {
      user: { name: 'Alex', totalWorkouts: 2, isPro: false },
      sessionsList: [
        { id: 's2', datetime: '2026-06-02T10:00:00Z' },
        { id: 's1', datetime: '2026-06-01T10:00:00Z' },
      ],
    };

    const hashBefore = computeBackupFingerprint(payloadBefore);
    const hashAfter = computeBackupFingerprint(payloadAfter);

    expect(hashBefore).not.toBe(hashAfter);
  });

  it('updates fingerprint when templates or custom exercises change', () => {
    const base = {
      user: { name: 'Alex', totalWorkouts: 1 },
      templatesList: [{ id: 't1', name: 'Push' }],
      exercisesList: [],
    };

    const withCustomEx = {
      ...base,
      exercisesList: [{ id: 'custom-1', name: 'Special Cable Fly', isCustom: true }],
    };

    expect(computeBackupFingerprint(base)).not.toBe(computeBackupFingerprint(withCustomEx));
  });
});
