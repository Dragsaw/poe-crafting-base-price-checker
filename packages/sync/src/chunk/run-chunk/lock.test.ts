import {
  createFakeClockPort,
  createFakeFilesystemPort,
  SYNC_PROGRESS_SCHEMA_VERSION,
  SyncReportFileSchema,
  trackedEarlierMajorMessage,
} from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { DataFileError } from '../../load-data-file.ts';
import { MalformedRequestError } from '../../pricing/price-entry.ts';
import { LOCK_PATH, serialiseLock } from '../lock.ts';
import { DATASET_PATH, PROGRESS_PATH, REPORT_PATH, TRACKED_PATH } from '../run-chunk.ts';
import {
  A,
  B,
  C,
  FIVE_HOURS_AGO,
  harness,
  key,
  NOW,
  PID,
  progressOf,
  PUBLICATION,
  run,
  scriptedStep,
  SEVEN_HOURS_AGO,
  shellPorts,
  trackedText,
} from './test-support.ts';

describe('runChunk: the lock', () => {
  it('takes the lock as exactly {pid, startedAt} from the clock', async () => {
    const { fs, ports } = harness();
    let seen: string | undefined;
    await run(ports, async () => {
      seen = await fs.readTextFile(LOCK_PATH);
      return { kind: 'completed' };
    });
    expect(seen).toBe(serialiseLock({ pid: PID, startedAt: NOW }));
    expect(JSON.parse(seen ?? '')).toEqual({ pid: PID, startedAt: NOW });
  });

  it('busy lock: writes nothing, leaves the lock untouched, logs one line', async () => {
    const held = serialiseLock({ pid: 7, startedAt: FIVE_HOURS_AGO });
    let loads = 0;
    const { fs, ports, logs } = harness(undefined, { [LOCK_PATH]: { contents: held } }, {
      load: () => {
        loads += 1;
        return Promise.reject(new Error('load must not run on a busy chunk'));
      },
    });
    const { visited, step } = scriptedStep();

    const outcome = await run(ports, step);

    expect(outcome).toEqual({ kind: 'busy', completed: [], entries: [], records: [] });
    expect(loads).toBe(0);
    expect(visited).toEqual([]);
    expect(await fs.readTextFile(LOCK_PATH)).toBe(held);
    expect(await fs.exists(PROGRESS_PATH)).toBe(false);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toContain('pid 7');
  });

  it('treats a lock exactly at the threshold as live: staleness is strictly greater', async () => {
    const held = serialiseLock({ pid: 7, startedAt: '2026-09-26T06:00:00.000Z' });
    const { ports } = harness(undefined, { [LOCK_PATH]: { contents: held } });
    const outcome = await run(ports, scriptedStep().step);
    expect(outcome.kind).toBe('busy');
  });

  it('judges staleness by time, never by pid: its own pid in a live lock is still busy', async () => {
    const held = serialiseLock({ pid: PID, startedAt: FIVE_HOURS_AGO });
    const { ports } = harness(undefined, { [LOCK_PATH]: { contents: held } });
    const outcome = await run(ports, scriptedStep().step);
    expect(outcome.kind).toBe('busy');
  });

  it('stale lock: breaks and retakes it, runs the chunk, records the old pid and startedAt', async () => {
    const stale = serialiseLock({ pid: 7, startedAt: SEVEN_HOURS_AGO });
    const { fs, ports } = harness(undefined, { [LOCK_PATH]: { contents: stale } });
    let during: string | undefined;

    const outcome = await run(ports, async () => {
      during = await fs.readTextFile(LOCK_PATH);
      return { kind: 'completed' };
    });

    expect(during).toBe(serialiseLock({ pid: PID, startedAt: NOW }));
    expect(outcome.kind).toBe('completed');
    expect(outcome.completed).toHaveLength(3);
    expect(outcome.records).toEqual([
      { kind: 'stale-lock-broken', pid: 7, startedAt: SEVEN_HOURS_AGO },
    ]);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
    expect(fs.paths()).not.toContain('data/sync.break.lock');
  });

  it('race: two runners breaking the same stale lock, exactly one takes it', async () => {
    const stale = serialiseLock({ pid: 7, startedAt: SEVEN_HOURS_AGO });
    const fs = createFakeFilesystemPort({
      [TRACKED_PATH]: { contents: trackedText([A, B]) },
      [LOCK_PATH]: { contents: stale },
    });
    const clock = createFakeClockPort(NOW);
    const first = scriptedStep();
    const second = scriptedStep();

    const outcomes = await Promise.all([
      run({ fs, clock, pid: 1, ...shellPorts(), publication: PUBLICATION, log: () => {} }, first.step),
      run({ fs, clock, pid: 2, ...shellPorts(), publication: PUBLICATION, log: () => {} }, second.step),
    ]);

    const kinds = outcomes.map((outcome) => outcome.kind).toSorted((a, b) => Number(a > b) - Number(a < b));
    expect(kinds).toEqual(['busy', 'completed']);
    expect(first.visited.length + second.visited.length).toBe(2);
    expect(outcomes.flatMap((outcome) => outcome.records)).toHaveLength(1);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });

  it('race: many runners on a free lock, exactly one runs', async () => {
    const fs = createFakeFilesystemPort({ [TRACKED_PATH]: { contents: trackedText([A]) } });
    const clock = createFakeClockPort(NOW);
    const outcomes = await Promise.all(
      [1, 2, 3, 4].map((pid) =>
        run(
          { fs, clock, pid, ...shellPorts(), publication: PUBLICATION, log: () => {} },
          scriptedStep().step,
        ),
      ),
    );
    expect(outcomes.filter((outcome) => outcome.kind === 'completed')).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.kind === 'busy')).toHaveLength(3);
  });

  it('dispossessed: a lock replaced mid-chunk means no progress write and no release', async () => {
    const { fs, ports, logs } = harness();
    const successor = serialiseLock({ pid: 99, startedAt: NOW });

    const outcome = await run(ports, (entry) => {
      if (key(entry) === key(B)) {
        fs.setFile(LOCK_PATH, { contents: successor });
      }
      return Promise.resolve({ kind: 'completed' });
    });

    expect(outcome.kind).toBe('dispossessed');
    expect(outcome.completed).toEqual([key(A), key(B), key(C)]);
    expect(await fs.exists(PROGRESS_PATH)).toBe(false);
    expect(await fs.readTextFile(LOCK_PATH)).toBe(successor);
    expect(logs).toHaveLength(1);
  });

  it('a throw from the step releases the lock and is rethrown', async () => {
    const { fs, ports } = harness();
    const failure = new Error('step exploded');

    await expect(
      run(ports, (entry) =>
        key(entry) === key(B) ? Promise.reject(failure) : Promise.resolve({ kind: 'completed' }),
      ),
    ).rejects.toBe(failure);

    expect(await fs.exists(LOCK_PATH)).toBe(false);
    // What the chunk completed is kept, and no penalty is remembered.
    expect(await progressOf(fs)).toEqual({ schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION, completed: [key(A)] });
  });

  it('a MalformedRequestError from the step releases the lock and is rethrown', async () => {
    const { fs, ports } = harness();
    const failure = new MalformedRequestError(key(B), 'search', 400, {
      entryKey: key(B),
      price: { state: 'not-yet-synced', reason: 'never-synced' },
      lastAttemptedAt: NOW,
    });

    await expect(
      run(ports, (entry) =>
        key(entry) === key(B) ? Promise.reject(failure) : Promise.resolve({ kind: 'completed' }),
      ),
    ).rejects.toBe(failure);

    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });

  it('a throw from the gate releases the lock, is rethrown, and no step runs', async () => {
    const failure = new Error('gate refused');
    const { fs, ports } = harness(undefined, {}, { gate: () => Promise.reject(failure) });
    const { visited, step } = scriptedStep();

    await expect(run(ports, step)).rejects.toBe(failure);

    expect(visited).toEqual([]);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });

  it('runs the gate under the lock, with the tracked entries, before any step', async () => {
    const order: string[] = [];
    let lockDuringGate: boolean | undefined;
    const { fs, ports } = harness([A], {}, {
      gate: async ({ entries }) => {
        lockDuringGate = await fs.exists(LOCK_PATH);
        order.push(`gate:${String(entries.length)}`);
        return { kind: 'pass' };
      },
    });

    await run(ports, () => {
      order.push('step');
      return Promise.resolve({ kind: 'completed' });
    });

    expect(order).toEqual(['gate:1', 'step']);
    expect(lockDuringGate).toBe(true);
  });

  it('an invalid tracked list throws and still releases the lock', async () => {
    const fs = createFakeFilesystemPort({ [TRACKED_PATH]: { contents: '{not json' } });
    const failure = run(
      { fs, clock: createFakeClockPort(NOW), pid: PID, ...shellPorts(), publication: PUBLICATION },
      scriptedStep().step,
    );
    await expect(failure).rejects.toThrow(/tracked\.json/);
    await expect(failure).rejects.toBeInstanceOf(DataFileError);
    await expect(failure).rejects.toMatchObject({ path: TRACKED_PATH, reason: 'not-json' });
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });

  it('a tracked list holding one canonical key twice throws before any step and still releases the lock (L-A1)', async () => {
    const { fs, ports } = harness([A, B, A]);
    const { visited, step } = scriptedStep();

    const failure = run(ports, step);

    await expect(failure).rejects.toThrow(/tracked\.json/);
    await expect(failure).rejects.toThrow(key(A));
    expect(visited).toEqual([]);
    expect(await fs.exists(DATASET_PATH)).toBe(false);
    expect(await fs.exists(PROGRESS_PATH)).toBe(false);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
    const report = SyncReportFileSchema.parse(JSON.parse((await fs.readTextFile(REPORT_PATH)) ?? ''));
    const failures = report.records.filter((record) => record.kind === 'run-failure');
    expect(failures).toHaveLength(1);
    expect(failures[0]?.message).toContain('tracked.json');
    expect(failures[0]?.message).toContain(key(A));
  });

  // Story hybrid-mods 2, I/O matrix "Earlier major": IMPLEMENTATION-NOTES §4.1.
  it('refuses a tracked list at the earlier 1.x major with the re-author message, before any step', async () => {
    const fs = createFakeFilesystemPort({
      [TRACKED_PATH]: { contents: JSON.stringify({ schemaVersion: '1.0.0', entries: [A] }) },
    });
    const { visited, step } = scriptedStep();
    const failure = run({ fs, clock: createFakeClockPort(NOW), pid: PID, ...shellPorts(), publication: PUBLICATION }, step);

    await expect(failure).rejects.toBeInstanceOf(DataFileError);
    await expect(failure).rejects.toMatchObject({ path: TRACKED_PATH, reason: 'unknown-major' });
    await expect(failure).rejects.toThrow(String(trackedEarlierMajorMessage('1.0.0')));
    expect(visited).toEqual([]);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });

  it('refuses a later or malformed tracked major with the generic message', async () => {
    await Promise.all(
      ['3.0.0', 'abc'].map(async (version) => {
        const fs = createFakeFilesystemPort({
          [TRACKED_PATH]: { contents: JSON.stringify({ schemaVersion: version, entries: [] }) },
        });
        const failure = run({ fs, clock: createFakeClockPort(NOW), pid: PID, ...shellPorts(), publication: PUBLICATION }, scriptedStep().step);
        await expect(failure).rejects.toThrow(`schemaVersion ${version} refused`);
        await expect(failure).rejects.not.toThrow(/Re-author/);
      }),
    );
  });
});
