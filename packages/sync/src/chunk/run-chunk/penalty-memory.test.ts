import {
  createFakeClockPort,
  createFakeFilesystemPort,
  SYNC_PROGRESS_SCHEMA_VERSION,
  SYNC_REPORT_SCHEMA_VERSION,
} from '@poe/contracts';
import type {
  DatasetEntry,
  FakeFilesystemPort,
  PinnedStarvationRecord,
  SyncRunRecord,
} from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { WEIGHTS_PATH } from '../../catalogue/weights-ids.ts';
import { MalformedRequestError } from '../../pricing/price-entry.ts';
import { LOCK_PATH, serialiseLock } from '../lock.ts';
import { DATASET_PATH, PROGRESS_PATH, REPORT_PATH, TRACKED_PATH } from '../run-chunk.ts';
import {
  A,
  B,
  EMPTY_WEIGHTS,
  harness,
  key,
  NOW,
  PID,
  progressOf,
  PUBLICATION,
  raw,
  reportOf,
  RESOLVES_ALL,
  run,
  scriptedStep,
  SEVEN_HOURS_AGO,
  shellPorts,
  trackedText,
} from './test-support.ts';

/** A filesystem that records every path written through it. */
function recordingWrites(fs: FakeFilesystemPort): { readonly fs: FakeFilesystemPort; readonly writes: string[] } {
  const writes: string[] = [];
  return {
    writes,
    fs: {
      ...fs,
      writeTextFile: (path, contents) => {
        writes.push(path);
        return fs.writeTextFile(path, contents);
      },
    },
  };
}

/** The progress file of a previous chunk that ended on a penalty. */
function progressWithNotBefore(completed: readonly string[], notBefore: string): string {
  return JSON.stringify({ schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION, completed, notBefore });
}

describe('runChunk: penalty memory across processes (AD-8, IMPLEMENTATION-NOTES.md §5.3)', () => {
  it('step 429: progress gets notBefore = NOW + the yield’s retry-after', async () => {
    const { fs, ports } = harness([A, B]);
    const { step } = scriptedStep((entry) =>
      key(entry) === key(B) ? { kind: 'yielded', retryAfterMs: 60_000 } : { kind: 'completed' },
    );

    const outcome = await run(ports, step);
    expect(outcome.kind).toBe('yielded');

    expect(await progressOf(fs)).toEqual({
      schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION,
      completed: [key(A)],
      notBefore: '2026-09-26T12:01:00.000Z',
    });
  });

  it('huge Retry-After: notBefore is capped at NOW + staleLockAfter', async () => {
    const { fs, ports } = harness([A]);
    const { step } = scriptedStep(() => ({ kind: 'yielded', retryAfterMs: 86_400_000 }));

    await run(ports, step);

    expect(await progressOf(fs)).toMatchObject({ notBefore: '2026-09-26T18:00:00.000Z' });
  });

  it('a step yield with no retry-after (a 5xx, a timeout, the threshold) writes no notBefore', async () => {
    const { fs, ports } = harness([A], {
      [PROGRESS_PATH]: { contents: progressWithNotBefore([], '2026-09-26T11:00:00.000Z') },
    });
    const { step } = scriptedStep(() => ({ kind: 'yielded' }));

    const outcome = await run(ports, step);
    expect(outcome.kind).toBe('yielded');

    expect(await progressOf(fs)).toEqual({ schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION, completed: [] });
  });

  it.each([
    ['completed', () => ({ kind: 'completed' }) as const],
    ['bounded', () => ({ kind: 'completed', searchRemaining: 0 }) as const],
  ])('clearing: a %s chunk over a past notBefore writes progress without the field', async (kind, script) => {
    const { fs, ports } = harness([A, B], {
      [PROGRESS_PATH]: { contents: progressWithNotBefore([], '2026-09-26T11:59:59.000Z') },
    });

    const outcome = await run(ports, scriptedStep(script).step);
    expect(outcome.kind).toBe(kind);

    const progress = await progressOf(fs);
    expect(progress).toBeDefined();
    expect(progress !== null && typeof progress === 'object' && 'notBefore' in progress).toBe(false);
  });

  it('deferred: now < notBefore releases the lock, sends nothing and writes nothing', async () => {
    const until = '2026-09-26T12:00:01.000Z';
    const progress = progressWithNotBefore([key(A)], until);
    const built = harness([A, B], { [PROGRESS_PATH]: { contents: progress } });
    const { fs, writes } = recordingWrites(built.fs);
    let isGateCalled = false;
    let isCatalogueCalled = false;
    let loads = 0;
    const { visited, step } = scriptedStep();

    const outcome = await run(
      {
        ...built.ports,
        fs,
        load: () => {
          loads += 1;
          return Promise.reject(new Error('load must not run on a deferred chunk'));
        },
        gate: () => {
          isGateCalled = true;
          return Promise.resolve({ kind: 'pass' });
        },
        catalogue: () => {
          isCatalogueCalled = true;
          return Promise.resolve({ ok: true, value: RESOLVES_ALL });
        },
      },
      step,
    );

    expect(outcome).toEqual({ kind: 'deferred', completed: [], entries: [], records: [], notBefore: until });
    expect(visited).toEqual([]);
    expect(isGateCalled).toBe(false);
    expect(isCatalogueCalled).toBe(false);
    expect(loads).toBe(0);
    // The lock is the only file touched, and it is gone again.
    expect(writes.filter((path) => path !== LOCK_PATH)).toEqual([]);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
    expect(await fs.readTextFile(PROGRESS_PATH)).toBe(progress);
    expect(await fs.exists(REPORT_PATH)).toBe(false);
    expect(built.logs).toEqual([
      `sync: a previous chunk set a pause until ${until} (a 429 or a rejected request); nothing sent this invocation`,
    ]);
  });

  it('round trip: a step 429 chunk, then a second chunk at the same NOW is deferred with no step visited', async () => {
    const { fs, ports } = harness([A, B]);
    const first = scriptedStep((entry) =>
      key(entry) === key(B) ? { kind: 'yielded', retryAfterMs: 60_000 } : { kind: 'completed' },
    );
    const outcome = await run(ports, first.step);
    expect(outcome.kind).toBe('yielded');

    const second = scriptedStep();
    expect(await run(ports, second.step)).toMatchObject({
      kind: 'deferred',
      notBefore: '2026-09-26T12:01:00.000Z',
    });
    expect(second.visited).toEqual([]);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });

  it('round trip: a malformed-request abort, then a second chunk at the same NOW is deferred with no step visited', async () => {
    const { fs, ports } = harness([A, B]);
    const stamped: DatasetEntry = {
      entryKey: key(B),
      price: { state: 'not-yet-synced', reason: 'never-synced' },
      lastAttemptedAt: NOW,
    };
    const failure = new MalformedRequestError(key(B), 'search', 400, stamped);
    await expect(
      run(ports, (entry) =>
        key(entry) === key(B) ? Promise.reject(failure) : Promise.resolve({ kind: 'completed' }),
      ),
    ).rejects.toBe(failure);

    const second = scriptedStep();
    expect(await run(ports, second.step)).toMatchObject({
      kind: 'deferred',
      notBefore: '2026-09-26T18:00:00.000Z',
    });
    expect(second.visited).toEqual([]);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });

  it('now = notBefore does not defer: the pause has run out', async () => {
    const { ports } = harness([A], {
      [PROGRESS_PATH]: { contents: progressWithNotBefore([], NOW) },
    });

    const outcome = await run(ports, scriptedStep().step);
    expect(outcome.kind).toBe('completed');
  });

  it('deferred after breaking a stale lock: only sync-report.json is written, carrying stale-lock-broken', async () => {
    const stale = serialiseLock({ pid: 7, startedAt: SEVEN_HOURS_AGO });
    const progress = progressWithNotBefore([], '2026-09-26T13:00:00.000Z');
    const previousRecord: SyncRunRecord = { kind: 'weights-absent', uncheckableClassNames: [] };
    const previousReport = JSON.stringify({
      schemaVersion: '1.0.0',
      runStartedAt: SEVEN_HOURS_AGO,
      figures: {
        requestsBySource: { 'tracked-list': 3, 'league-validation': 1, 'catalogue-refresh': 0 },
        notReachedCount: 0,
      },
      records: [previousRecord],
    });
    const built = harness([A], {
      [LOCK_PATH]: { contents: stale },
      [PROGRESS_PATH]: { contents: progress },
      [REPORT_PATH]: { contents: previousReport },
    });
    const { fs, writes } = recordingWrites(built.fs);
    const { visited, step } = scriptedStep();

    const outcome = await run({ ...built.ports, fs }, step);

    expect(outcome.kind).toBe('deferred');
    expect(visited).toEqual([]);
    expect(writes.filter((path) => path !== LOCK_PATH && !path.endsWith('.break.lock'))).toEqual([REPORT_PATH]);
    expect(await fs.readTextFile(PROGRESS_PATH)).toBe(progress);
    expect(await fs.exists(DATASET_PATH)).toBe(false);
    const report = await reportOf(fs);
    expect(report).toEqual({
      runStartedAt: NOW,
      runFinishedAt: NOW,
      figures: { requestsBySource: { 'tracked-list': 0, 'league-validation': 0, 'session-probe': 0 }, notReachedCount: 0 },
      records: [previousRecord, { kind: 'stale-lock-broken', pid: 7, startedAt: SEVEN_HOURS_AGO }],
      schemaVersion: SYNC_REPORT_SCHEMA_VERSION,
    });
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });

  it('deferred after breaking a stale lock: the previous coverage pair is carried over unchanged', async () => {
    const previousReport = JSON.stringify({
      schemaVersion: '1.1.0',
      runStartedAt: SEVEN_HOURS_AGO,
      figures: {
        requestsBySource: { 'tracked-list': 3, 'league-validation': 1, 'session-probe': 0 },
        notReachedCount: 0,
        coverage: 0.75,
        rankableClassCount: 4,
      },
      records: [],
    });
    const built = harness([A], {
      [LOCK_PATH]: { contents: serialiseLock({ pid: 7, startedAt: SEVEN_HOURS_AGO }) },
      [PROGRESS_PATH]: { contents: progressWithNotBefore([], '2026-09-26T13:00:00.000Z') },
      [REPORT_PATH]: { contents: previousReport },
    });

    const outcome = await run(built.ports, scriptedStep().step);
    expect(outcome.kind).toBe('deferred');

    const report = await reportOf(built.fs);
    const figures = report?.figures;
    expect(figures?.coverage).toBe(0.75);
    expect(figures?.rankableClassCount).toBe(4);
  });

  it('growth: two starving chunks leave one pinned-starvation record, at its first position, carrying the latest allowance', async () => {
    const P1 = raw('P1', 'pinned');
    const P2 = raw('P2', 'pinned');
    const P3 = raw('P3', 'pinned');
    const entries = [P1, P2, P3, A];
    const earlier: SyncRunRecord = { kind: 'stale-lock-broken', pid: 7, startedAt: SEVEN_HOURS_AGO };
    const fsShared = createFakeFilesystemPort({
      [TRACKED_PATH]: { contents: trackedText(entries) },
      [WEIGHTS_PATH]: { contents: EMPTY_WEIGHTS },
      [REPORT_PATH]: {
        contents: JSON.stringify({
          schemaVersion: '1.1.0',
          runStartedAt: SEVEN_HOURS_AGO,
          figures: { requestsBySource: { 'tracked-list': 0, 'league-validation': 0, 'session-probe': 0 }, notReachedCount: 0 },
          records: [earlier],
        }),
      },
    });
    const chunk = (remaining: number) =>
      run(
        { fs: fsShared, clock: createFakeClockPort(NOW), pid: PID, ...shellPorts(), publication: PUBLICATION, log: () => {} },
        scriptedStep(() => ({ kind: 'completed', searchRemaining: remaining })).step,
      );

    // First chunk: allowance 3 (2 remaining after the first step). Second: 1 (0 remaining).
    const result = await chunk(2);
    expect(result.pinnedStarvation).toMatchObject({ discoveredAllowance: 3 });
    const second = await chunk(0);
    expect(second.pinnedStarvation).toMatchObject({ discoveredAllowance: 1 });

    const report = await reportOf(fsShared);
    const records = report?.records ?? [];
    expect(records.filter((record) => record.kind === 'pinned-starvation')).toHaveLength(1);
    expect(records[0]).toEqual(earlier);
    expect(records[1]).toMatchObject({ kind: 'pinned-starvation', discoveredAllowance: 1, pinnedCount: 3 });
  });

  it('new subject: a second chunk whose pinned set changed adds a second starvation record', async () => {
    const P1 = raw('P1', 'pinned');
    const P2 = raw('P2', 'pinned');
    const P3 = raw('P3', 'pinned');
    const fsShared = createFakeFilesystemPort({
      [TRACKED_PATH]: { contents: trackedText([P1, P2, P3, A]) },
      [WEIGHTS_PATH]: { contents: EMPTY_WEIGHTS },
    });
    const chunk = () =>
      run(
        { fs: fsShared, clock: createFakeClockPort(NOW), pid: PID, ...shellPorts(), publication: PUBLICATION, log: () => {} },
        scriptedStep(() => ({ kind: 'completed', searchRemaining: 0 })).step,
      );

    await chunk();
    // The player unpins one entry: the yardstick is unchanged, the pinned count is not.
    await fsShared.writeTextFile(TRACKED_PATH, trackedText([P1, P2, raw('P3'), A]));
    await chunk();

    const report = await reportOf(fsShared);
    const starvations = (report?.records ?? []).filter(
      (record): record is PinnedStarvationRecord => record.kind === 'pinned-starvation',
    );
    expect(starvations.map((record) => record.pinnedCount)).toEqual([3, 2]);
  });
});
