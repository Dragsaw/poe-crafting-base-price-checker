import {
  DatasetFileSchema,
  SYNC_PROGRESS_SCHEMA_VERSION,
  SYNC_REPORT_SCHEMA_VERSION,
} from '@poe/contracts';
import type { DatasetEntry } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import {
  MalformedRequestError,
  UnexpectedTradeResponseError,
} from '../../../pricing/price-entry.ts';
import { LOCK_PATH } from '../../lock.ts';
import { DATASET_PATH, PROGRESS_PATH, REPORT_PATH } from '../../run-chunk.ts';
import {
  A,
  B,
  C,
  harness,
  key,
  noListingsEntry,
  NOW,
  progressOf,
  reportOf,
  run,
  scriptedStep,
} from '../test-support.ts';
import { BROKEN, D, E, reportText, ZERO } from './test-support.ts';

describe('runChunk: the Sync Report', () => {
  it('4xx abort: entries 1–2 published, entry 3 stamped, a trade-request-rejected record, no finish, lock released, rethrown', async () => {
    const { fs, ports } = harness([A, B, C, D, E]);
    const stamped: DatasetEntry = {
      entryKey: key(C),
      price: { state: 'not-yet-synced', reason: 'never-synced' },
      lastAttemptedAt: NOW,
    };
    const failure = new MalformedRequestError(key(C), 'search', 400, stamped);

    await expect(
      run(ports, (entry) =>
        key(entry) === key(C)
          ? Promise.reject(failure)
          : Promise.resolve({ kind: 'completed', entry: noListingsEntry(entry) }),
      ),
    ).rejects.toBe(failure);

    const dataset = DatasetFileSchema.parse(JSON.parse((await fs.readTextFile(DATASET_PATH)) ?? ''));
    const byKey = new Map(dataset.entries.map((entry) => [entry.entryKey, entry]));
    expect(byKey.get(key(A))).toEqual(noListingsEntry(A));
    expect(byKey.get(key(B))).toEqual(noListingsEntry(B));
    expect(byKey.get(key(C))).toEqual(stamped);
    expect(byKey.get(key(D))).toEqual({
      entryKey: key(D),
      price: { state: 'not-yet-synced', reason: 'never-synced' },
    });
    // A malformed-request abort remembers the full staleLockAfter.
    expect(await progressOf(fs)).toEqual({
      schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION,
      completed: [key(A), key(B)],
      notBefore: '2026-09-26T18:00:00.000Z',
    });

    const report = await reportOf(fs);
    expect(report).toEqual({
      runStartedAt: NOW,
      figures: { requestsBySource: ZERO, notReachedCount: 2 },
      records: [
        {
          kind: 'run-failure',
          reason: 'trade-request-rejected',
          entryKey: key(C),
          status: 400,
          message: failure.message,
        },
      ],
      schemaVersion: SYNC_REPORT_SCHEMA_VERSION,
    });
    expect(report !== undefined && 'runFinishedAt' in report).toBe(false);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });

  it('unparseable fetch body: entries 1–2 published, entry 3 keeps the answered search fields, an unrecoverable-error record, no notBefore, lock released, rethrown', async () => {
    const { fs, ports } = harness([A, B, C, D, E]);
    const searched: DatasetEntry = {
      entryKey: key(C),
      price: { state: 'no-listings' },
      lastAttemptedAt: NOW,
      lastSearchId: 'Ab3dE',
      lastSearchLeague: 'Standard',
    };
    const failure = new UnexpectedTradeResponseError(key(C), 'fetch', 'no top-level `result` array', searched);

    await expect(
      run(ports, (entry) =>
        key(entry) === key(C)
          ? Promise.reject(failure)
          : Promise.resolve({ kind: 'completed', entry: noListingsEntry(entry) }),
      ),
    ).rejects.toBe(failure);

    const dataset = DatasetFileSchema.parse(JSON.parse((await fs.readTextFile(DATASET_PATH)) ?? ''));
    const byKey = new Map(dataset.entries.map((entry) => [entry.entryKey, entry]));
    expect(byKey.get(key(A))).toEqual(noListingsEntry(A));
    expect(byKey.get(key(B))).toEqual(noListingsEntry(B));
    expect(byKey.get(key(C))).toEqual(searched);
    expect(byKey.get(key(D))).toEqual({
      entryKey: key(D),
      price: { state: 'not-yet-synced', reason: 'never-synced' },
    });
    // Only a MalformedRequestError writes the abort notBefore.
    expect(await progressOf(fs)).toEqual({ schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION, completed: [key(A), key(B)] });

    const report = await reportOf(fs);
    expect(report?.records).toEqual([
      { kind: 'run-failure', reason: 'unrecoverable-error', entryKey: key(C), message: failure.message },
    ]);
    expect(report !== undefined && 'runFinishedAt' in report).toBe(false);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });

  it('unparseable search body: entries 1–2 published, entry 3 stamped with lastAttemptedAt, an unrecoverable-error record, no notBefore, lock released, rethrown', async () => {
    const { fs, ports } = harness([A, B, C, D, E]);
    const stamped: DatasetEntry = {
      entryKey: key(C),
      price: { state: 'no-listings' },
      lastAttemptedAt: NOW,
      lastSearchId: 'Zz9yX',
      lastSearchLeague: 'Standard',
    };
    const failure = new UnexpectedTradeResponseError(key(C), 'search', 'no top-level `id` and `result`', stamped);

    await expect(
      run(ports, (entry) =>
        key(entry) === key(C)
          ? Promise.reject(failure)
          : Promise.resolve({ kind: 'completed', entry: noListingsEntry(entry) }),
      ),
    ).rejects.toBe(failure);

    const dataset = DatasetFileSchema.parse(JSON.parse((await fs.readTextFile(DATASET_PATH)) ?? ''));
    const byKey = new Map(dataset.entries.map((entry) => [entry.entryKey, entry]));
    expect(byKey.get(key(A))).toEqual(noListingsEntry(A));
    expect(byKey.get(key(B))).toEqual(noListingsEntry(B));
    expect(byKey.get(key(C))).toEqual(stamped);
    // Only a rejected request writes the abort notBefore.
    expect(await progressOf(fs)).toEqual({ schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION, completed: [key(A), key(B)] });

    const report = await reportOf(fs);
    expect(report?.records).toEqual([
      { kind: 'run-failure', reason: 'unrecoverable-error', entryKey: key(C), message: failure.message },
    ]);
    expect(report !== undefined && 'runFinishedAt' in report).toBe(false);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });

  it.each([
    ['progress', PROGRESS_PATH],
    ['report', REPORT_PATH],
  ] as const)('4xx abort whose %s write fails: still rejects with the original error, the fault logged', async (_name, failing) => {
    const { fs, ports, logs } = harness([A, B]);
    const stamped: DatasetEntry = {
      entryKey: key(B),
      price: { state: 'not-yet-synced', reason: 'never-synced' },
      lastAttemptedAt: NOW,
    };
    const failure = new MalformedRequestError(key(B), 'search', 400, stamped);
    const faulty = {
      ...fs,
      writeTextFile: (path: string, contents: string) =>
        path === failing ? Promise.reject(new Error(`disk full: ${path}`)) : fs.writeTextFile(path, contents),
    };

    await expect(
      run({ ...ports, fs: faulty }, (entry) =>
        key(entry) === key(B) ? Promise.reject(failure) : Promise.resolve({ kind: 'completed' }),
      ),
    ).rejects.toBe(failure);

    expect(logs.some((line) => line.includes(`disk full: ${failing}`))).toBe(true);
    // A failed publication does not stop the report.
    const finalReport = await reportOf(fs);
    expect(finalReport?.records).toEqual(
      failing === PROGRESS_PATH
        ? [{ kind: 'run-failure', reason: 'trade-request-rejected', entryKey: key(B), status: 400, message: failure.message }]
        : undefined,
    );
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });

  it('a fault resolving the edit date after publish still writes the failure report', async () => {
    const { fs, ports } = harness([A]);
    let calls = 0;
    const flaky = {
      ...ports.git,
      lastCommitAuthorDate: () => {
        calls += 1;
        return calls === 1 ? Promise.reject(new Error('git broke')) : Promise.resolve(undefined);
      },
    };

    await expect(run({ ...ports, git: flaky }, scriptedStep().step)).rejects.toThrow('git broke');

    const finalReport = await reportOf(fs);
    expect(finalReport?.records).toEqual([
      { kind: 'run-failure', reason: 'unrecoverable-error', message: 'git broke' },
    ]);
  });

  it('other throw: an unrecoverable-error record naming the entry, after the dataset and progress so far', async () => {
    const { fs, ports } = harness([A, B, C]);
    const failure = new Error('step exploded');

    await expect(
      run(ports, (entry) =>
        key(entry) === key(B) ? Promise.reject(failure) : Promise.resolve({ kind: 'completed' }),
      ),
    ).rejects.toBe(failure);

    expect(await fs.exists(DATASET_PATH)).toBe(true);
    expect(await progressOf(fs)).toEqual({ schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION, completed: [key(A)] });
    const report = await reportOf(fs);
    expect(report?.records).toEqual([
      { kind: 'run-failure', reason: 'unrecoverable-error', entryKey: key(B), message: 'step exploded' },
    ]);
    expect(report !== undefined && 'runFinishedAt' in report).toBe(false);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });

  it('a gate throw writes the report with an unrecoverable-error record and no entry key', async () => {
    const failure = new Error('gate refused');
    const { fs, ports } = harness([A], {}, { gate: () => Promise.reject(failure) });

    await expect(run(ports, scriptedStep().step)).rejects.toBe(failure);

    const finalReport = await reportOf(fs);
    expect(finalReport?.records).toEqual([
      { kind: 'run-failure', reason: 'unrecoverable-error', message: 'gate refused' },
    ]);
    // The gate runs after the order, so the throw publishes the marks (none here).
    expect(await fs.exists(DATASET_PATH)).toBe(true);
    expect(await progressOf(fs)).toEqual({ schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION, completed: [] });
  });

  it('a failure record follows the records carried from the previous report', async () => {
    const { fs, ports } = harness([A], { [REPORT_PATH]: { contents: reportText([BROKEN]) } });

    await expect(run(ports, () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');

    const finalReport = await reportOf(fs);
    expect(finalReport?.records).toEqual([
      BROKEN,
      { kind: 'run-failure', reason: 'unrecoverable-error', entryKey: key(A), message: 'boom' },
    ]);
  });
});
