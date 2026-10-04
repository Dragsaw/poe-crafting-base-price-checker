import { DatasetFileSchema, SYNC_PROGRESS_SCHEMA_VERSION } from '@poe/contracts';
import type { DatasetEntry } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { LOCK_PATH, serialiseLock } from '../lock.ts';
import { DATASET_PATH, PROGRESS_PATH } from '../run-chunk.ts';
import type { ChunkPorts } from '../run-chunk.ts';
import {
  A,
  B,
  FIVE_HOURS_AGO,
  harness,
  key,
  NOW,
  progressOf,
  run,
  scriptedStep,
} from './test-support.ts';

const progressWith = (fields: Record<string, unknown>) => ({
  [PROGRESS_PATH]: { contents: JSON.stringify({ schemaVersion: '1.1.0', completed: [], ...fields }) },
});

describe('runChunk: the session-cookie hold-off (AD-30, IMPLEMENTATION-NOTES.md §13.1, §13.3, §13.4)', () => {
  const HOLD_OFF = '2026-09-27T06:00:00.000Z';
  const NOW_PLUS_24H = '2026-09-27T12:00:00.000Z';

  /** A recording stand-in for the holder's two narrow ports. */
  function fakeAuth(pending?: 'write' | 'clear') {
    const calls: string[] = [];
    let action = pending;
    const auth: NonNullable<ChunkPorts['auth']> = {
      settleHeldOffIfDue: (until, now) => {
        calls.push(`settle ${String(until)} ${now}`);
      },
      pendingHoldOff: () => action,
      holdOffApplied: (applied) => {
        calls.push(`applied ${applied}`);
        if (action === applied) {
          action = undefined;
        }
      },
    };
    return { auth, calls, pending: () => action };
  }

  it('reads a 1.1.0 progress file and writes the current version', async () => {
    const { fs, ports } = harness([A], progressWith({}));
    await run(ports, scriptedStep().step);
    expect(await progressOf(fs)).toEqual({ schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION, completed: [key(A)] });
  });

  it('after the lock and the notBefore check, hands the loaded hold-off and now to the settle port', async () => {
    const { auth, calls } = fakeAuth();
    const { ports } = harness([A], progressWith({ authHoldOffUntil: HOLD_OFF }), { auth });
    await run(ports, scriptedStep().step);
    expect(calls[0]).toBe(`settle ${HOLD_OFF} ${NOW}`);
  });

  it('a deferred run settles nothing and applies no pending action', async () => {
    const { auth, calls, pending } = fakeAuth('write');
    const seeded = progressWith({ notBefore: '2026-09-26T13:00:00.000Z', authHoldOffUntil: HOLD_OFF });
    const { fs, ports } = harness([A], seeded, { auth });
    const outcome = await run(ports, scriptedStep().step);
    expect(outcome.kind).toBe('deferred');
    expect(calls).toEqual([]);
    expect(pending()).toBe('write');
    // Untouched: the seeded 1.1.0 bytes, not a rewrite.
    expect(await fs.readTextFile(PROGRESS_PATH)).toBe(seeded[PROGRESS_PATH].contents);
  });

  it('a failed progress write applies nothing: the pending write survives for the next write', async () => {
    const { auth, calls, pending } = fakeAuth('write');
    const { fs, ports } = harness([A], progressWith({}), { auth });
    const faulty = {
      ...fs,
      writeTextFile: (path: string, contents: string) =>
        path === PROGRESS_PATH ? Promise.reject(new Error(`disk full: ${path}`)) : fs.writeTextFile(path, contents),
    };

    await expect(run({ ...ports, fs: faulty }, scriptedStep().step)).rejects.toThrow(`disk full: ${PROGRESS_PATH}`);

    expect(calls.some((call) => call.startsWith('applied'))).toBe(false);
    expect(pending()).toBe('write');
  });

  it('a busy run applies no pending action', async () => {
    const { auth, calls, pending } = fakeAuth('write');
    const { ports } = harness([A], { [LOCK_PATH]: { contents: serialiseLock({ pid: 7, startedAt: FIVE_HOURS_AGO }) } }, { auth });
    const outcome = await run(ports, scriptedStep().step);
    expect(outcome.kind).toBe('busy');
    expect(calls).toEqual([]);
    expect(pending()).toBe('write');
  });

  it('a pending write sets authHoldOffUntil = now + 24h in the chunk’s progress write, and is applied', async () => {
    const { auth, calls, pending } = fakeAuth('write');
    const { fs, ports } = harness([A], progressWith({}), { auth });
    await run(ports, scriptedStep().step);
    expect(await progressOf(fs)).toEqual({
      schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION,
      completed: [key(A)],
      authHoldOffUntil: NOW_PLUS_24H,
    });
    expect(calls).toContain('applied write');
    expect(pending()).toBeUndefined();
  });

  it('a pending clear removes the field', async () => {
    const { auth, pending } = fakeAuth('clear');
    const { fs, ports } = harness([A], progressWith({ authHoldOffUntil: HOLD_OFF }), { auth });
    await run(ports, scriptedStep().step);
    expect(await progressOf(fs)).toEqual({ schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION, completed: [key(A)] });
    expect(pending()).toBeUndefined();
  });

  it.each([
    ['no auth port', undefined],
    ['no pending action', fakeAuth().auth],
  ])('%s: the loaded value is carried forward', async (_label, auth) => {
    const { fs, ports } = harness([A], progressWith({ authHoldOffUntil: HOLD_OFF }), auth === undefined ? {} : { auth });
    await run(ports, scriptedStep().step);
    expect(await progressOf(fs)).toEqual({ schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION, completed: [key(A)], authHoldOffUntil: HOLD_OFF });
  });

  it('a session-expired step yield: yielded with the signal, the entry stamped, no notBefore, the hold-off written', async () => {
    const { auth } = fakeAuth('write');
    const { fs, ports } = harness([A, B], progressWith({}), { auth });
    const stamped: DatasetEntry = {
      entryKey: key(A),
      price: { state: 'not-yet-synced', reason: 'never-synced' },
      lastAttemptedAt: NOW,
    };
    const { visited, step } = scriptedStep(() => ({ kind: 'yielded', entry: stamped, sessionExpired: true }));

    const outcome = await run(ports, step);

    expect(outcome).toMatchObject({ kind: 'yielded', sessionExpired: true, completed: [] });
    expect(visited).toEqual([key(A)]);
    expect(await progressOf(fs)).toEqual({ schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION, completed: [], authHoldOffUntil: NOW_PLUS_24H });
    const dataset = DatasetFileSchema.parse(JSON.parse((await fs.readTextFile(DATASET_PATH)) ?? ''));
    expect(dataset.entries.find((entry) => entry.entryKey === key(A))?.lastAttemptedAt).toBe(NOW);
  });

  it('an ordinary yield carries no session-expired signal', async () => {
    const { ports } = harness([A], progressWith({}));
    const outcome = await run(ports, scriptedStep(() => ({ kind: 'yielded' })).step);
    expect(outcome.kind === 'yielded' && outcome.sessionExpired).toBeUndefined();
  });

  it('the failure path applies the pending action in its progress write', async () => {
    const { auth, pending } = fakeAuth('write');
    const { fs, ports } = harness([A], progressWith({}), { auth });
    await expect(
      run(ports, () => Promise.reject(new Error('boom'))),
    ).rejects.toThrow('boom');
    expect(await progressOf(fs)).toMatchObject({ authHoldOffUntil: NOW_PLUS_24H });
    expect(pending()).toBeUndefined();
  });
});
