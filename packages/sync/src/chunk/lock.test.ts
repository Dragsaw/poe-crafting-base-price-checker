import { createFakeClockPort, createFakeFilesystemPort } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import {
  acquireLock,
  BREAK_MARKER_PATH,
  isLockHeld,
  isStaleInstant,
  LOCK_PATH,
  isOwnLockReleased,
  serialiseLock,
  STALE_LOCK_AFTER_MS,
} from './lock.ts';

const NOW = '2026-09-26T12:00:00.000Z';
const SEVEN_HOURS_AGO = '2026-09-26T05:00:00.000Z';
const ONE_HOUR_AGO = '2026-09-26T11:00:00.000Z';
const clock = createFakeClockPort(NOW);

describe('the staleness rule', () => {
  it('is six hours, strictly greater', () => {
    expect(STALE_LOCK_AFTER_MS).toBe(6 * 60 * 60 * 1000);
    expect(isStaleInstant('2026-09-26T06:00:00.000Z', NOW)).toBe(false);
    expect(isStaleInstant('2026-09-26T05:59:59.999Z', NOW)).toBe(true);
  });

  it('never judges an unparseable instant stale', () => {
    expect(isStaleInstant('not a time', NOW)).toBe(false);
  });
});

describe('acquireLock', () => {
  it('takes a free lock with one exclusive create', async () => {
    const fs = createFakeFilesystemPort();
    const taken = await acquireLock(fs, clock, 5);
    expect(taken).toEqual({ kind: 'acquired', lock: { pid: 5, startedAt: NOW } });
    expect(await fs.readTextFile(LOCK_PATH)).toBe(serialiseLock({ pid: 5, startedAt: NOW }));
  });

  it('reports a live holder as busy and leaves its lock alone', async () => {
    const held = serialiseLock({ pid: 7, startedAt: ONE_HOUR_AGO });
    const fs = createFakeFilesystemPort({ [LOCK_PATH]: { contents: held } });
    expect(await acquireLock(fs, clock, 5)).toEqual({
      kind: 'busy',
      holder: { pid: 7, startedAt: ONE_HOUR_AGO },
    });
    expect(await fs.readTextFile(LOCK_PATH)).toBe(held);
  });

  it('breaks a stale lock and says whose it was', async () => {
    const fs = createFakeFilesystemPort({
      [LOCK_PATH]: { contents: serialiseLock({ pid: 7, startedAt: SEVEN_HOURS_AGO }) },
    });
    expect(await acquireLock(fs, clock, 5)).toEqual({
      kind: 'acquired',
      lock: { pid: 5, startedAt: NOW },
      broken: { kind: 'stale-lock-broken', pid: 7, startedAt: SEVEN_HOURS_AGO },
    });
    expect(await fs.exists(BREAK_MARKER_PATH)).toBe(false);
  });

  it('treats an unreadable young lock as held, never as free', async () => {
    const fs = createFakeFilesystemPort({ [LOCK_PATH]: { contents: '', modifiedAt: ONE_HOUR_AGO } });
    expect(await acquireLock(fs, clock, 5)).toEqual({ kind: 'busy' });
    expect(await fs.readTextFile(LOCK_PATH)).toBe('');
  });

  it('breaks an unreadable lock whose file time is past the threshold, so a crash cannot wedge', async () => {
    const fs = createFakeFilesystemPort({
      [LOCK_PATH]: { contents: '{"pid":', modifiedAt: SEVEN_HOURS_AGO },
    });
    // No pid or start time to report, so no record: the lock is simply retaken.
    expect(await acquireLock(fs, clock, 5)).toEqual({
      kind: 'acquired',
      lock: { pid: 5, startedAt: NOW },
    });
  });

  it('is busy while another run holds the break marker', async () => {
    const stale = serialiseLock({ pid: 7, startedAt: SEVEN_HOURS_AGO });
    const marker = serialiseLock({ pid: 8, startedAt: NOW });
    const fs = createFakeFilesystemPort({
      [LOCK_PATH]: { contents: stale },
      [BREAK_MARKER_PATH]: { contents: marker },
    });
    expect(await acquireLock(fs, clock, 5)).toEqual({
      kind: 'busy',
      holder: { pid: 8, startedAt: NOW },
    });
    expect(await fs.readTextFile(LOCK_PATH)).toBe(stale);
    expect(await fs.readTextFile(BREAK_MARKER_PATH)).toBe(marker);
  });

  it('clears a break marker a crashed breaker left past the threshold, for the next run', async () => {
    const stale = serialiseLock({ pid: 7, startedAt: SEVEN_HOURS_AGO });
    const fs = createFakeFilesystemPort({
      [LOCK_PATH]: { contents: stale },
      [BREAK_MARKER_PATH]: { contents: serialiseLock({ pid: 8, startedAt: SEVEN_HOURS_AGO }) },
    });
    const first = await acquireLock(fs, clock, 5);
    expect(first.kind).toBe('busy');
    expect(await fs.exists(BREAK_MARKER_PATH)).toBe(false);
    const second = await acquireLock(fs, clock, 5);
    expect(second.kind).toBe('acquired');
  });

  it('does not break a lock that changed between the judgement and the break', async () => {
    const stale = serialiseLock({ pid: 7, startedAt: SEVEN_HOURS_AGO });
    const winner = serialiseLock({ pid: 9, startedAt: NOW });
    const fs = createFakeFilesystemPort({ [LOCK_PATH]: { contents: stale } });
    // Swap the lock the moment the break marker is taken: the re-read under
    // the marker must see the winner and back off.
    const createExclusive = fs.createExclusive.bind(fs);
    fs.createExclusive = async (path, contents) => {
      const isCreated = await createExclusive(path, contents);
      if (isCreated && path === BREAK_MARKER_PATH) {
        fs.setFile(LOCK_PATH, { contents: winner });
      }
      return isCreated;
    };

    expect(await acquireLock(fs, clock, 5)).toEqual({
      kind: 'busy',
      holder: { pid: 9, startedAt: NOW },
    });
    expect(await fs.readTextFile(LOCK_PATH)).toBe(winner);
    expect(await fs.exists(BREAK_MARKER_PATH)).toBe(false);
  });

  it('race: of several runs breaking one stale lock, exactly one takes it', async () => {
    const fs = createFakeFilesystemPort({
      [LOCK_PATH]: { contents: serialiseLock({ pid: 7, startedAt: SEVEN_HOURS_AGO }) },
    });
    const results = await Promise.all([1, 2, 3].map((pid) => acquireLock(fs, clock, pid)));

    const acquired = results.filter((result) => result.kind === 'acquired');
    expect(acquired).toHaveLength(1);
    expect(results.filter((result) => result.kind === 'busy')).toHaveLength(2);
    const [only] = acquired;
    expect(only?.kind === 'acquired' ? await isLockHeld(fs, only.lock) : false).toBe(true);
  });
});

describe('isOwnLockReleased', () => {
  it('releases its own lock', async () => {
    const fs = createFakeFilesystemPort();
    const mine = { pid: 5, startedAt: NOW };
    await acquireLock(fs, clock, 5);
    expect(await isOwnLockReleased(fs, mine)).toBe(true);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });

  it("never deletes a successor's lock, even one with the same pid", async () => {
    const successor = serialiseLock({ pid: 5, startedAt: ONE_HOUR_AGO });
    const fs = createFakeFilesystemPort({ [LOCK_PATH]: { contents: successor } });
    expect(await isOwnLockReleased(fs, { pid: 5, startedAt: NOW })).toBe(false);
    expect(await fs.readTextFile(LOCK_PATH)).toBe(successor);
  });

  it('is a no-op when no lock exists', async () => {
    const fs = createFakeFilesystemPort();
    expect(await isOwnLockReleased(fs, { pid: 5, startedAt: NOW })).toBe(false);
  });
});
