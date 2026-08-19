import { mergeSessionChunks, mergeLegacySessionChunks } from '../storage/history/sessionMerge';
import { HistoryHydrator } from '../storage/history/historyHydrator';
import { WorkoutSessionV2 } from '../storage/contracts/types';

describe('R2 Scale-Invariant Chunked History Hydration', () => {
  const createMockSessionV2 = (id: string, startedAtMs: number, updatedAtMs: number): WorkoutSessionV2 => ({
    id,
    title: `Workout ${id}`,
    titleNorm: `workout ${id}`,
    startedAtMs,
    endedAtMs: startedAtMs + 3600000,
    durationSec: 3600,
    comment: null,
    totalVolumeMilliKg: 10000000,
    prs: 0,
    createdAtMs: startedAtMs,
    updatedAtMs,
    revision: 1,
    deletedAtMs: null,
    exercises: [],
  });

  describe('mergeSessionChunks', () => {
    it('merges non-overlapping session chunks and sorts descending by endedAtMs', () => {
      const chunk1 = [
        createMockSessionV2('s3', 3000, 3000),
        createMockSessionV2('s2', 2000, 2000),
      ];
      const chunk2 = [
        createMockSessionV2('s1', 1000, 1000),
        createMockSessionV2('s4', 4000, 4000),
      ];

      const merged = mergeSessionChunks(chunk1, chunk2);
      expect(merged.length).toBe(4);
      expect(merged.map((s) => s.id)).toEqual(['s4', 's3', 's2', 's1']);
    });

    it('deduplicates overlapping sessions and keeps newer updatedAtMs', () => {
      const existing = [
        createMockSessionV2('s1', 1000, 1000),
        createMockSessionV2('s2', 2000, 2000),
      ];
      const incoming = [
        createMockSessionV2('s2', 2000, 2500), // newer revision
        createMockSessionV2('s3', 3000, 3000),
      ];

      const merged = mergeSessionChunks(existing, incoming);
      expect(merged.length).toBe(3);
      expect(merged.map((s) => s.id)).toEqual(['s3', 's2', 's1']);
      expect(merged.find((s) => s.id === 's2')?.updatedAtMs).toBe(2500);
    });

    it('handles empty inputs cleanly', () => {
      expect(mergeSessionChunks([], [])).toEqual([]);
      const single = [createMockSessionV2('s1', 1000, 1000)];
      expect(mergeSessionChunks(single, [])).toEqual(single);
      expect(mergeSessionChunks([], single)).toEqual(single);
    });
  });

  describe('mergeLegacySessionChunks', () => {
    it('merges legacy session format and sorts descending by datetime', () => {
      const legacy1 = [
        { id: '1', datetime: new Date('2026-01-02').toISOString() },
      ];
      const legacy2 = [
        { id: '2', datetime: new Date('2026-01-03').toISOString() },
        { id: '1', datetime: new Date('2026-01-02').toISOString() },
      ];

      const merged = mergeLegacySessionChunks(legacy1, legacy2);
      expect(merged.length).toBe(2);
      expect(merged[0].id).toBe('2');
      expect(merged[1].id).toBe('1');
    });
  });

  describe('HistoryHydrator', () => {
    it('initializes and manages subscriber callbacks', async () => {
      const hydrator = new HistoryHydrator({ initialChunkSize: 10, chunkSize: 10 });
      const initial = [createMockSessionV2('s1', 1000, 1000)];
      await hydrator.start(initial);

      const listener = jest.fn();
      const unsubscribe = hydrator.subscribe(listener);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          sessions: initial,
          loadedCount: 1,
        })
      );

      unsubscribe();
    });

    it('cancel stops hydrator execution', () => {
      const hydrator = new HistoryHydrator();
      hydrator.cancel();
      expect(hydrator.getIsRunning()).toBe(false);
    });
  });
});
