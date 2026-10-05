import { DatasetFileSchema, SYNC_PROGRESS_SCHEMA_VERSION } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { LOCK_PATH, serialiseLock } from '../../lock.ts';
import { DATASET_PATH, PROGRESS_PATH, REPORT_PATH } from '../../run-chunk.ts';
import { A, B, key, NOW, progressOf, reportOf, run, scriptedStep } from '../test-support.ts';
import { gated, LEAGUES, ok, PREVIOUS_DATASET, PREVIOUS_PROGRESS, ZERO } from './test-support.ts';

describe('runChunk: the league gate (Story 1.11)', () => {
  it('gate 429: the chunk yields, no step, the dataset published, progress remembers the penalty, report finished with no run-failure', async () => {
    const { fs, ports, leaguesHttp, visited, step, logs } = gated(
      'Standard',
      { status: 429, headers: { 'retry-after': '60' }, body: '' },
      {
        [DATASET_PATH]: { contents: PREVIOUS_DATASET },
        [PROGRESS_PATH]: { contents: PREVIOUS_PROGRESS },
      },
    );

    const outcome = await run(ports, step);

    expect(outcome).toEqual({ kind: 'yielded', completed: [], entries: [], records: [] });
    expect(logs).toEqual(['sync: the league check got no answer; the chunk yields with no entry attempted']);
    expect(visited).toEqual([]);
    expect(leaguesHttp.requests).toHaveLength(1);
    // A gate yield publishes like a yielded chunk: the previous entries and the marks (none here).
    const published = DatasetFileSchema.parse(JSON.parse((await fs.readTextFile(DATASET_PATH)) ?? ''));
    // The gate never confirmed the configured league, so the previous label stands.
    expect(published.league).toBe('Old League');
    expect(published.entries.map((entry) => entry.entryKey)).toEqual([key(A), key(B)]);
    expect(await progressOf(fs)).toEqual({
      schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION,
      completed: [key(A)],
      notBefore: '2026-09-26T12:01:00.000Z',
    });
    expect(await fs.exists(LOCK_PATH)).toBe(false);
    const report = await reportOf(fs);
    expect(report?.runFinishedAt).toBe(NOW);
    expect(report?.figures.requestsBySource).toEqual({ ...ZERO, 'league-validation': 1 });
    // Every entry the order made eligible: B (A is complete in this pass).
    expect(report?.figures.notReachedCount).toBe(1);
    expect(report?.records).toEqual([]);
  });

  it('gate 429 with a two-hour Retry-After: notBefore is NOW + 2h, completed kept, the dataset published', async () => {
    const { fs, ports } = gated(
      'Standard',
      { status: 429, headers: { 'retry-after': '7200' }, body: '' },
      {
        [DATASET_PATH]: { contents: PREVIOUS_DATASET },
        [PROGRESS_PATH]: { contents: PREVIOUS_PROGRESS },
      },
    );

    const outcome = await run(ports, scriptedStep().step);
    expect(outcome.kind).toBe('yielded');

    expect(await progressOf(fs)).toEqual({
      schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION,
      completed: [key(A)],
      notBefore: '2026-09-26T14:00:00.000Z',
    });
    const published = DatasetFileSchema.parse(JSON.parse((await fs.readTextFile(DATASET_PATH)) ?? ''));
    expect(published.league).toBe('Old League');
    expect(published.entries.map((entry) => entry.entryKey)).toEqual([key(A), key(B)]);
  });

  it('gate 429 over an unknown-major progress file: rejects, progress untouched, a run-failure reported', async () => {
    const unknown = JSON.stringify({ schemaVersion: '9.0.0', completed: [] });
    const { fs, ports } = gated(
      'Standard',
      { status: 429, headers: { 'retry-after': '60' }, body: '' },
      { [PROGRESS_PATH]: { contents: unknown } },
    );

    await expect(run(ports, scriptedStep().step)).rejects.toThrow(/9\.0\.0/);

    expect(await fs.readTextFile(PROGRESS_PATH)).toBe(unknown);
    const report = await reportOf(fs);
    expect(report?.records).toEqual([expect.objectContaining({ kind: 'run-failure' })]);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });

  it('gate 5xx: the chunk yields, publishes the dataset, and writes progress with no notBefore', async () => {
    const { fs, ports } = gated(
      'Standard',
      { status: 503, headers: {}, body: '' },
      { [PROGRESS_PATH]: { contents: PREVIOUS_PROGRESS } },
    );

    const outcome = await run(ports, scriptedStep().step);
    expect(outcome.kind).toBe('yielded');

    expect(await progressOf(fs)).toEqual({ schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION, completed: [key(A)] });
    expect(await fs.exists(DATASET_PATH)).toBe(true);
    const report = await reportOf(fs);
    expect(report?.figures.notReachedCount).toBe(1);
  });

  it('gate yield after the lock was taken over writes nothing and is dispossessed', async () => {
    const { fs, ports, step } = gated('Standard', ok(LEAGUES));
    const outcome = await run(
      {
        ...ports,
        gate: async () => {
          await fs.writeTextFile(LOCK_PATH, serialiseLock({ pid: 99, startedAt: NOW }));
          return { kind: 'yield' };
        },
      },
      step,
    );

    expect(outcome.kind).toBe('dispossessed');
    expect(await fs.exists(REPORT_PATH)).toBe(false);
    expect(await fs.exists(DATASET_PATH)).toBe(false);
    expect(await fs.exists(PROGRESS_PATH)).toBe(false);
    // The foreign lock is not this run's to release.
    expect(await fs.readTextFile(LOCK_PATH)).toBe(serialiseLock({ pid: 99, startedAt: NOW }));
  });
});
