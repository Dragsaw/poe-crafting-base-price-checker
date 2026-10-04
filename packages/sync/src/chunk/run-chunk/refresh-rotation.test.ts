import { SYNC_PROGRESS_SCHEMA_VERSION } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { DataFileError } from '../../load-data-file.ts';
import { LOCK_PATH } from '../lock.ts';
import { DATASET_PATH, PROGRESS_PATH } from '../run-chunk.ts';
import {
  A,
  B,
  C,
  datasetText,
  FIVE_HOURS_AGO,
  harness,
  key,
  progressOf,
  progressText,
  PRUNED,
  raw,
  run,
  scriptedStep,
  SEVEN_HOURS_AGO,
} from './test-support.ts';

describe('runChunk: the Refresh Rotation', () => {
  const P1 = raw('P1', 'pinned');
  const P2 = raw('P2', 'pinned');
  const P3 = raw('P3', 'pinned');

  it('orders by the dataset’s lastAttemptedAt, against the clock', async () => {
    const U = raw('U');
    const { fs, ports } = harness([A, B, C, U], {
      [DATASET_PATH]: {
        contents: datasetText([
          { key: key(A), at: FIVE_HOURS_AGO },
          { key: key(B), at: SEVEN_HOURS_AGO },
          { key: key(U), at: '2026-09-25T12:00:00.000Z', unresolvable: true },
        ]),
      },
    });
    const { visited, step } = scriptedStep();

    await run(ports, step);

    // C never attempted, then U, B, A oldest first. U's id resolves again, so
    // it is recovered into row 2 rather than waiting in row 3 (AD-7).
    expect(visited).toEqual([key(C), key(U), key(B), key(A)]);
    expect(await progressOf(fs)).toEqual({
      schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION,
      completed: [key(A), key(B), key(C), key(U)],
    });
  });

  it('an invalid dataset throws and still releases the lock', async () => {
    const { fs, ports } = harness(undefined, { [DATASET_PATH]: { contents: '{"schemaVersion":"2.0.0"}' } });
    const failure = run(ports, scriptedStep().step);
    await expect(failure).rejects.toThrow(/dataset\.json/);
    await expect(failure).rejects.toBeInstanceOf(DataFileError);
    await expect(failure).rejects.toMatchObject({ path: DATASET_PATH, reason: 'unknown-major' });
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });

  it('a dataset that repeats an entryKey throws rather than healing, and still releases the lock', async () => {
    const { fs, ports } = harness(undefined, {
      [DATASET_PATH]: { contents: datasetText([{ key: key(A) }, { key: key(A) }]) },
    });
    await expect(run(ports, scriptedStep().step)).rejects.toThrow(/dataset\.json.*repeats entries\.0/);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });

  it('starvation: 3 pinned, 2 active, R=2 after the first step keeps 1 more pinned, then active', async () => {
    const { fs, ports } = harness([P1, P2, P3, A, B]);
    let remaining = 3;
    const { visited, step } = scriptedStep((entry) => {
      remaining -= 1;
      return entry.status === 'pinned'
        ? { kind: 'completed', searchRemaining: remaining }
        : { kind: 'completed' };
    });

    const outcome = await run(ports, step);

    expect(visited).toEqual([key(P1), key(P2), key(A), key(B)]);
    expect(outcome).toEqual({
      kind: 'completed',
      completed: [key(P1), key(P2), key(A), key(B)],
      entries: [],
      records: [],
      pinnedStarvation: { discoveredAllowance: 3, pinnedCount: 3, pinnedRefreshed: 2, activeRefreshed: 2 },
    });
    // Row 1 is exempt from the pass.
    expect(await progressOf(fs)).toEqual({ schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION, completed: [key(A), key(B)] });
  });

  it('starvation leaves the outcome kind unchanged: the reserved search still bounds the chunk', async () => {
    const { ports } = harness([P1, P2, P3, A, B]);
    let remaining = 3;
    const { visited, step } = scriptedStep(() => {
      remaining -= 1;
      return { kind: 'completed', searchRemaining: remaining };
    });

    const outcome = await run(ports, step);

    expect(visited).toEqual([key(P1), key(P2), key(A)]);
    expect(outcome).toMatchObject({
      kind: 'bounded',
      bound: 'search',
      pinnedStarvation: { discoveredAllowance: 3, pinnedCount: 3, pinnedRefreshed: 2, activeRefreshed: 1 },
    });
  });

  it('starvation with nothing left to cut: 1 pinned reports R=0 while active waits', async () => {
    const { ports } = harness([P1, A]);
    const { visited, step } = scriptedStep((entry) =>
      entry.status === 'pinned' ? { kind: 'completed', searchRemaining: 0 } : { kind: 'completed' },
    );

    const outcome = await run(ports, step);

    // The kind is what the search bound makes it, record or not.
    expect(visited).toEqual([key(P1)]);
    expect(outcome).toEqual({
      kind: 'bounded',
      bound: 'search',
      completed: [key(P1)],
      entries: [],
      records: [],
      pinnedStarvation: { discoveredAllowance: 1, pinnedCount: 1, pinnedRefreshed: 1, activeRefreshed: 0 },
    });
  });

  it('a later pinned step’s first report: discoveredAllowance is R plus the steps taken', async () => {
    const { ports } = harness([P1, P2, P3, A, B]);
    const { visited, step } = scriptedStep((entry) =>
      key(entry) === key(P2) ? { kind: 'completed', searchRemaining: 1 } : { kind: 'completed' },
    );

    const outcome = await run(ports, step);

    expect(visited).toEqual([key(P1), key(P2), key(A), key(B)]);
    expect(outcome).toEqual({
      kind: 'completed',
      completed: [key(P1), key(P2), key(A), key(B)],
      entries: [],
      records: [],
      pinnedStarvation: { discoveredAllowance: 3, pinnedCount: 3, pinnedRefreshed: 2, activeRefreshed: 2 },
    });
  });

  it('a rotation step reporting a low allowance never truncates or records', async () => {
    const { ports } = harness([P1, A, B]);
    const { visited, step } = scriptedStep((entry) =>
      ({ kind: 'completed', searchRemaining: entry.status === 'pinned' ? 5 : 0 }),
    );

    const outcome = await run(ports, step);

    expect(visited).toEqual([key(P1), key(A)]);
    expect(outcome).toEqual({ kind: 'bounded', bound: 'search', completed: [key(P1), key(A)], entries: [], records: [] });
  });

  it('a yield in row 1 after a cut: kind yielded, the record still carried', async () => {
    const { fs, ports } = harness([P1, P2, P3, A, B]);
    const { visited, step } = scriptedStep((entry) =>
      key(entry) === key(P1) ? { kind: 'completed', searchRemaining: 2 } : { kind: 'yielded' },
    );

    const outcome = await run(ports, step);

    expect(visited).toEqual([key(P1), key(P2)]);
    expect(outcome).toEqual({
      kind: 'yielded',
      completed: [key(P1)],
      entries: [],
      records: [],
      pinnedStarvation: { discoveredAllowance: 3, pinnedCount: 3, pinnedRefreshed: 1, activeRefreshed: 0 },
    });
    expect(await progressOf(fs)).toEqual({ schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION, completed: [] });
  });

  it('a recovered pinned + unresolvable entry rejoins row 1, exempt from the pass', async () => {
    const PU = raw('PU', 'pinned');
    const { fs, ports } = harness([PU, A], {
      [DATASET_PATH]: {
        contents: datasetText([{ key: key(PU), at: '2026-09-25T11:00:00.000Z', unresolvable: true }]),
      },
    });
    const { visited, step } = scriptedStep();

    await run(ports, step);

    expect(visited).toEqual([key(PU), key(A)]);
    expect(await progressOf(fs)).toEqual({ schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION, completed: [key(A)] });
  });

  it('no rotation waiting: 3 pinned alone with R=1 are all visited, with no record', async () => {
    const { ports } = harness([P1, P2, P3, PRUNED]);
    const { visited, step } = scriptedStep(() => ({ kind: 'completed', searchRemaining: 1 }));

    const outcome = await run(ports, step);

    expect(visited).toEqual([key(P1), key(P2), key(P3)]);
    expect(outcome).toEqual({ kind: 'completed', completed: visited, entries: [], records: [] });
    expect(outcome.pinnedStarvation).toBeUndefined();
  });

  it('no truncation when the allowance covers the pinned set plus one', async () => {
    const { ports } = harness([P1, P2, A]);
    const { visited, step } = scriptedStep(() => ({ kind: 'completed', searchRemaining: 5 }));
    const outcome = await run(ports, step);
    expect(visited).toEqual([key(P1), key(P2), key(A)]);
    expect(outcome.pinnedStarvation).toBeUndefined();
  });

  it('pinned every chunk: a pinned key in progress is still visited first, and never written', async () => {
    const { fs, ports } = harness([P1, A, B], {
      [PROGRESS_PATH]: { contents: progressText([key(P1), key(A)]) },
    });
    const { visited, step } = scriptedStep();

    await run(ports, step);

    expect(visited).toEqual([key(P1), key(B)]);
    expect(await progressOf(fs)).toEqual({ schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION, completed: [key(A), key(B)] });
  });
});
