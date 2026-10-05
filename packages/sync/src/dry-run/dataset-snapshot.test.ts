import {
  canonicalKey,
  compareCanonicalKeys,
  createFakeClockPort,
  createFakeFilesystemPort,
  createFakeGitPort,
  SUPPORTED_SCHEMA_VERSION,
  TRACKED_SCHEMA_VERSION,
} from '@poe/contracts';
import type { TrackedEntry } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { DATASET_PATH, runChunk, TRACKED_PATH } from '../chunk/run-chunk.ts';
import { dryRun } from '../dry-run.ts';
import { pinnedStarvationRecord } from '../pinned-cap.ts';
import { createRequestCounter } from '../request-counter.ts';
import { LEAGUE, snapshotOf } from './test-support.ts';

describe('dryRun: the dataset snapshot', () => {
  const rotation: TrackedEntry[] = [
    { kind: 'raw', baseTypeId: 'A', itemLevelMin: 82, status: 'active' },
    { kind: 'raw', baseTypeId: 'B', itemLevelMin: 82, status: 'active' },
    { kind: 'raw', baseTypeId: 'C', itemLevelMin: 82, status: 'active' },
    { kind: 'raw', baseTypeId: 'P', itemLevelMin: 82, status: 'pinned' },
  ];
  const [A, B, C, P] = rotation as [TrackedEntry, TrackedEntry, TrackedEntry, TrackedEntry];
  const rotationTracked = JSON.stringify({ schemaVersion: TRACKED_SCHEMA_VERSION, entries: rotation });
  /** The snapshot's own latest `lastAttemptedAt`, so this is the run's default clock. */
  const A_ATTEMPTED_AT = '2025-12-31T00:00:00.000Z';
  const B_ATTEMPTED_AT = '2025-12-30T00:00:00.000Z';
  const datasetText = JSON.stringify({
    schemaVersion: SUPPORTED_SCHEMA_VERSION,
    league: 'Standard',
    generatedAt: A_ATTEMPTED_AT,
    entries: [
      { entryKey: canonicalKey(A), price: { state: 'no-listings' }, lastAttemptedAt: A_ATTEMPTED_AT },
      { entryKey: canonicalKey(B), price: { state: 'no-listings' }, lastAttemptedAt: B_ATTEMPTED_AT },
    ],
    currencyRates: [],
  });
  const withDataset = snapshotOf(rotation, { dataset: datasetText });

  it('orders the rotation by the snapshot’s lastAttemptedAt', async () => {
    const report = await dryRun(withDataset);
    expect(report.completed).toEqual([P, C, B, A].map((entry) => canonicalKey(entry)));
  });

  it('visits the same keys in the same order as runChunk on the same fake and clock', async () => {
    const fs = createFakeFilesystemPort({
      [TRACKED_PATH]: { contents: rotationTracked },
      [DATASET_PATH]: { contents: datasetText },
    });
    const visited: string[] = [];
    await runChunk({
      fs,
      clock: createFakeClockPort(A_ATTEMPTED_AT),
      pid: 1,
      git: createFakeGitPort(),
      requests: createRequestCounter(),
      load: () =>
        Promise.resolve({
          publication: { league: LEAGUE, currencyRates: [] },
          starvationRecord: (starvation) => pinnedStarvationRecord(starvation, { minChunkSearches: 2 }),
          step: (entry) => {
            visited.push(canonicalKey(entry));
            return Promise.resolve({ kind: 'completed' });
          },
        }),
      log: () => {},
      catalogue: () =>
        Promise.resolve({
          ok: true,
          value: { statIds: new Set(), baseTypeIds: new Set(['A', 'B', 'C', 'P']), categoryIds: new Set() },
        }),
    });

    const report = await dryRun(withDataset);
    expect(report.completed).toEqual(visited);
    expect(visited).toHaveLength(4);
  });

  it('is deterministic with a dataset', async () => {
    expect(await dryRun(withDataset)).toEqual(await dryRun(withDataset));
  });

  it('publishes the snapshot’s entries merged with the step entries, under the active league', async () => {
    const report = await dryRun(withDataset);
    expect(report.dataset?.league).toBe(LEAGUE);
    expect(report.dataset?.entries.map((entry) => entry.entryKey)).toEqual(
      rotation.map((entry) => canonicalKey(entry)).toSorted(compareCanonicalKeys),
    );
    // Every tracked entry was visited, so every entry is this run's, stamped
    // with the default clock: the snapshot's own latest `lastAttemptedAt`.
    const reported = report.dataset?.entries ?? [];
    for (const entry of reported) {
      expect(entry.lastAttemptedAt, entry.entryKey).toBe(A_ATTEMPTED_AT);
    }
  });

  it('refuses an invalid dataset loudly', async () => {
    await expect(dryRun(snapshotOf(rotation, { dataset: '{"schemaVersion":"9.0.0"}' }))).rejects.toThrow(
      /dataset\.json/,
    );
  });

  it('an --at option overrides the snapshot’s own latest lastAttemptedAt', async () => {
    const at = '2026-06-01T00:00:00.000Z';
    const report = await dryRun(withDataset, { at });
    const reported = report.dataset?.entries ?? [];
    for (const entry of reported) {
      expect(entry.lastAttemptedAt, entry.entryKey).toBe(at);
    }
  });
});
