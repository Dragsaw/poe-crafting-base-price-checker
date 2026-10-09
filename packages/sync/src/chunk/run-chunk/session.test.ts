import { SUPPORTED_SCHEMA_VERSION, SYNC_PROGRESS_SCHEMA_VERSION } from '@poe/contracts';
import type { DatasetEntry, DatasetFile } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { UnexpectedTradeResponseError } from '../../pricing/price-entry.ts';
import { zeroRequests } from '../../request-counter.ts';
import { DATASET_PATH, PROGRESS_PATH } from '../run-chunk.ts';
import type { ChunkSetup, ChunkStep, StepResult } from '../run-chunk.ts';
import {
  A,
  B,
  harness,
  key,
  NOW,
  progressOf,
  progressText,
  raw,
  reportOf,
  run,
  scriptedStep,
} from './test-support.ts';

/** A gate that passes and counts its calls. */
function countingGate(): { readonly calls: number[]; readonly gate: NonNullable<ChunkSetup['gate']> } {
  const calls: number[] = [];
  return {
    calls,
    gate: () => {
      calls.push(1);
      return Promise.resolve({ kind: 'pass' });
    },
  };
}

/** A step that latches the governor's penalty while it completes, as a probe 429 does. */
function latching(result: StepResult): { readonly step: ChunkStep; readonly latched: () => number | undefined } {
  let latchedMs: number | undefined;
  const { step } = scriptedStep(() => {
    latchedMs ??= 120_000;
    return result;
  });
  return { step, latched: () => latchedMs };
}

describe('runChunk: under a session (ChunkPorts.session)', () => {
  it('maxEntries 1 with an entry left ends bounded by entries, and names the pass and the league', async () => {
    const { fs, ports } = harness([A, B]);
    const { visited, step } = scriptedStep();
    const { calls, gate } = countingGate();

    const outcome = await run({ ...ports, gate, session: { maxEntries: 1 } }, step);

    expect(outcome).toEqual({
      kind: 'bounded',
      bound: 'entries',
      completed: [key(A)],
      entries: [],
      records: [],
      newPass: false,
      confirmedLeague: 'Standard',
    });
    expect(visited).toEqual([key(A)]);
    expect(calls).toHaveLength(1);
    expect(await progressOf(fs)).toEqual({ schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION, completed: [key(A)] });
  });

  it('maxEntries 1 on the last entry of the pass is completed', async () => {
    const { ports } = harness([A, B], { [PROGRESS_PATH]: { contents: progressText([key(A)]) } });
    const { visited, step } = scriptedStep();

    const outcome = await run({ ...ports, session: { maxEntries: 1 } }, step);

    expect(outcome).toMatchObject({ kind: 'completed', completed: [key(B)], newPass: false });
    expect(visited).toEqual([key(B)]);
  });

  it('skips the gate while the confirmed league holds in the same pass', async () => {
    const { ports } = harness([A, B], { [PROGRESS_PATH]: { contents: progressText([key(A)]) } });
    const { step } = scriptedStep();
    const { calls, gate } = countingGate();

    const outcome = await run(
      { ...ports, gate, session: { maxEntries: 1, confirmedLeague: 'Standard' } },
      step,
    );

    expect(calls).toEqual([]);
    expect(outcome).toMatchObject({ confirmedLeague: 'Standard', newPass: false });
  });

  it('runs the gate on a new pass, even with a confirmed league', async () => {
    const { ports } = harness([A, B], { [PROGRESS_PATH]: { contents: progressText([key(A), key(B)]) } });
    const { step } = scriptedStep();
    const { calls, gate } = countingGate();

    const outcome = await run(
      { ...ports, gate, session: { maxEntries: 1, confirmedLeague: 'Standard' } },
      step,
    );

    expect(calls).toHaveLength(1);
    expect(outcome).toMatchObject({ kind: 'bounded', bound: 'entries', newPass: true });
  });

  it('runs the gate when the configured league differs from the confirmed one', async () => {
    const { ports } = harness([A, B]);
    const { step } = scriptedStep();
    const { calls, gate } = countingGate();

    const outcome = await run(
      { ...ports, gate, session: { maxEntries: 1, confirmedLeague: 'Old League' } },
      step,
    );

    expect(calls).toHaveLength(1);
    expect(outcome).toMatchObject({ confirmedLeague: 'Standard' });
  });

  it('a gate yield names no confirmed league', async () => {
    const { ports } = harness([A, B]);
    const { step } = scriptedStep();

    const outcome = await run(
      { ...ports, gate: () => Promise.resolve({ kind: 'yield' }), session: { maxEntries: 1 } },
      step,
    );

    expect(outcome).toEqual({ kind: 'yielded', completed: [], entries: [], records: [], newPass: false });
  });

  it('counts the report figure from the pass start, and from its own start on a new pass', async () => {
    const passStart = { ...zeroRequests(), 'league-validation': 1, 'tracked-list': 1 };
    const counts = [
      { ...zeroRequests(), 'league-validation': 1, 'tracked-list': 3 },
      { ...zeroRequests(), 'league-validation': 1, 'tracked-list': 4 },
    ];
    let reads = 0;
    const requests = {
      snapshot: () => counts[Math.min(reads++, counts.length - 1)] ?? zeroRequests(),
    };

    const within = harness([A, B], {}, { requests });
    await run({ ...within.ports, session: { maxEntries: 1, requestsSince: passStart } }, scriptedStep().step);
    // 4 − 1 searches since the pass started, not 4 − 3 since this chunk did.
    const latestReport = await reportOf(within.fs);
    expect(latestReport?.figures.requestsBySource).toEqual({
      'league-validation': 0,
      'session-probe': 0,
      'tracked-list': 3,
    });

    reads = 0;
    const fresh = harness([A, B], { [PROGRESS_PATH]: { contents: progressText([key(A), key(B)]) } }, { requests });
    await run({ ...fresh.ports, session: { maxEntries: 1, requestsSince: passStart } }, scriptedStep().step);
    const finalReport = await reportOf(fresh.fs);
    expect(finalReport?.figures.requestsBySource).toEqual({
      'league-validation': 0,
      'session-probe': 0,
      'tracked-list': 1,
    });
  });

  it('keeps only stale pinned entries under pinnedMaxAgeMs', async () => {
    const pinned = raw('Pinned', 'pinned');
    const dataset: DatasetFile = {
      schemaVersion: SUPPORTED_SCHEMA_VERSION,
      league: 'Standard',
      generatedAt: NOW,
      entries: [
        { entryKey: key(pinned), price: { state: 'no-listings' }, lastAttemptedAt: '2026-09-26T11:00:00.000Z' },
      ],
      currencyRates: [],
    };
    const { ports } = harness([pinned, A], { [DATASET_PATH]: { contents: JSON.stringify(dataset) } });
    const { visited, step } = scriptedStep();

    await run({ ...ports, session: { maxEntries: 1, pinnedMaxAgeMs: 4 * 60 * 60 * 1000 } }, step);

    expect(visited).toEqual([key(A)]);
  });

  it('a batch chunk carries neither session field', async () => {
    const { ports } = harness([A]);

    const outcome = await run(ports, scriptedStep().step);

    expect(outcome).not.toHaveProperty('newPass');
    expect(outcome).not.toHaveProperty('confirmedLeague');
  });
});

describe('runChunk: a latched probe 429', () => {
  it('the entry completes with no further request: the chunk yields and persists notBefore', async () => {
    const { fs, ports } = harness([A]);
    const { step, latched } = latching({ kind: 'completed' });

    const outcome = await run({ ...ports, latchedRetryAfterMs: latched }, step);

    expect(outcome.kind).toBe('yielded');
    // The entry the baseline answered keeps its result.
    expect(outcome.completed).toEqual([key(A)]);
    expect(await progressOf(fs)).toEqual({
      schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION,
      completed: [key(A)],
      notBefore: '2026-09-26T12:02:00.000Z',
    });
  });

  it('a bound ended the chunk: the latch still makes it a 429 yield', async () => {
    const { fs, ports } = harness([A, B]);
    const { step, latched } = latching({ kind: 'completed', searchRemaining: 0 });

    const outcome = await run({ ...ports, latchedRetryAfterMs: latched }, step);

    expect(outcome.kind).toBe('yielded');
    expect(await progressOf(fs)).toMatchObject({ completed: [key(A)], notBefore: '2026-09-26T12:02:00.000Z' });
  });

  it('a session entries bound: the latch still makes it a 429 yield', async () => {
    const { fs, ports } = harness([A, B]);
    const { step, latched } = latching({ kind: 'completed' });

    const outcome = await run({ ...ports, latchedRetryAfterMs: latched, session: { maxEntries: 1 } }, step);

    expect(outcome.kind).toBe('yielded');
    expect(await progressOf(fs)).toMatchObject({ notBefore: '2026-09-26T12:02:00.000Z' });
  });

  it('no latch: the ending and the progress are unchanged', async () => {
    const { fs, ports } = harness([A]);
    const { step } = scriptedStep();

    const outcome = await run({ ...ports, latchedRetryAfterMs: () => {} }, step);

    expect(outcome.kind).toBe('completed');
    expect(await progressOf(fs)).toEqual({ schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION, completed: [key(A)] });
  });
  it('the step throws after the latch (an unexpected baseline body): the failure path still persists notBefore', async () => {
    const { fs, ports } = harness([A]);
    let latchedMs: number | undefined;
    const stamped: DatasetEntry = {
      entryKey: key(A),
      price: { state: 'not-yet-synced', reason: 'never-synced' },
      lastAttemptedAt: NOW,
    };
    const failure = new UnexpectedTradeResponseError(key(A), 'search', 'no top-level `id` and `result`', stamped);
    const step: ChunkStep = () => {
      latchedMs = 120_000;
      return Promise.reject(failure);
    };

    await expect(run({ ...ports, latchedRetryAfterMs: () => latchedMs }, step)).rejects.toBe(failure);

    expect(await progressOf(fs)).toEqual({
      schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION,
      completed: [],
      notBefore: '2026-09-26T12:02:00.000Z',
    });
  });
});
