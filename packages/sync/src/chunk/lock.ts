// Chunk lock (AD-7): one atomic exclusive create, stale by time alone.
// A stale break is serialised by a second exclusive file, the break marker, so two breakers cannot
// interleave; under it the lock is re-read and broken only if it is still the text judged stale.

import { SyncLockSchema } from '@poe/contracts';
import type {
  ClockPort,
  FilesystemPort,
  StaleLockBrokenRecord,
  SyncLock,
} from '@poe/contracts';

import { serialiseJsonArtifact } from '../shell.ts';

/** `*.lock` is git-ignored: the lock is machine-local runtime state. */
export const LOCK_PATH = 'data/sync.lock';

/** Held only for the instant a stale lock is broken. Also matches `*.lock`. */
export const BREAK_MARKER_PATH = 'data/sync.break.lock';

/** `staleLockAfter`: a ceiling on a chunk, not a player setting. */
export const STALE_LOCK_AFTER_MS = 6 * 60 * 60 * 1000;

export type LockState =
  | { readonly state: 'absent' }
  | { readonly state: 'held'; readonly text: string; readonly lock: SyncLock }
  | { readonly state: 'unreadable'; readonly text: string };

export type LockAcquisition =
  | {
      readonly kind: 'acquired';
      readonly lock: SyncLock;
      /** Present when a stale lock was broken to take this one. */
      readonly broken?: StaleLockBrokenRecord;
    }
  | {
      readonly kind: 'busy';
      /** The holder, where its lock could be read. */
      readonly holder?: SyncLock;
    };

export function serialiseLock(lock: SyncLock): string {
  return serialiseJsonArtifact({ pid: lock.pid, startedAt: lock.startedAt });
}

function parseLock(text: string): SyncLock | undefined {
  try {
    const parsed = SyncLockSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

export async function readLock(fs: FilesystemPort, path = LOCK_PATH): Promise<LockState> {
  const text = await fs.readTextFile(path);
  if (text === undefined) {
    return { state: 'absent' };
  }
  const lock = parseLock(text);
  return lock === undefined ? { state: 'unreadable', text } : { state: 'held', text, lock };
}

/** `now − startedAt > staleLockAfter`. Both are ISO-8601 UTC from `ClockPort`. */
export function isStaleInstant(startedAt: string, now: string): boolean {
  const age = Date.parse(now) - Date.parse(startedAt);
  return Number.isFinite(age) && age > STALE_LOCK_AFTER_MS;
}

// An unparseable lock is held, not free: the adapter writes the contents just after the create.
// Its file time stands in for the missing `startedAt`, so a crash between the two still clears.
// Exported so the `pnpm sync` session waits by this same rule (`../sync.ts`).
export async function isStaleState(
  fs: FilesystemPort,
  found: Exclude<LockState, { state: 'absent' }>,
  now: string,
  path: string,
): Promise<boolean> {
  if (found.state === 'held') {
    return isStaleInstant(found.lock.startedAt, now);
  }
  const modifiedAt = await fs.lastModifiedAt(path);
  return modifiedAt !== undefined && isStaleInstant(modifiedAt, now);
}

function busy(found: LockState): LockAcquisition {
  return found.state === 'held' ? { kind: 'busy', holder: found.lock } : { kind: 'busy' };
}

/** Deletes `path` only while its text is still `text`. */
async function isDeletedIfText(fs: FilesystemPort, path: string, text: string): Promise<boolean> {
  if ((await fs.readTextFile(path)) !== text) {
    return false;
  }
  await fs.deleteFile(path);
  return true;
}

/** Clears a break marker left by a run that crashed mid-break; the same threshold bounds it. */
async function clearStaleBreakMarker(fs: FilesystemPort, now: string): Promise<void> {
  const marker = await readLock(fs, BREAK_MARKER_PATH);
  if (marker.state === 'absent') {
    return;
  }
  if (await isStaleState(fs, marker, now, BREAK_MARKER_PATH)) {
    await isDeletedIfText(fs, BREAK_MARKER_PATH, marker.text);
  }
}

async function breakAndTake(
  fs: FilesystemPort,
  stale: Exclude<LockState, { state: 'absent' }>,
  mine: SyncLock,
  now: string,
): Promise<LockAcquisition> {
  const mineText = serialiseLock(mine);
  if (!(await fs.createExclusive(BREAK_MARKER_PATH, mineText))) {
    // Another run is breaking this lock right now. It wins; this run is busy.
    // Report the breaker, not the dead holder it is replacing.
    await clearStaleBreakMarker(fs, now);
    return busy(await readLock(fs, BREAK_MARKER_PATH));
  }

  try {
    // Re-read under the marker: break only the exact lock that was judged
    // stale. A lock taken meanwhile by a winning breaker is a live lock.
    const again = await readLock(fs);
    if (again.state !== 'absent' && again.text !== stale.text) {
      return busy(again);
    }
    if (again.state !== 'absent' && !(await isDeletedIfText(fs, LOCK_PATH, stale.text))) {
      return busy(await readLock(fs));
    }
    if (!(await fs.createExclusive(LOCK_PATH, mineText))) {
      return busy(await readLock(fs));
    }
    return stale.state === 'held'
      ? {
          kind: 'acquired',
          lock: mine,
          broken: { kind: 'stale-lock-broken', pid: stale.lock.pid, startedAt: stale.lock.startedAt },
        }
      : { kind: 'acquired', lock: mine };
  } finally {
    await isDeletedIfText(fs, BREAK_MARKER_PATH, mineText);
  }
}

/** Takes the lock, breaking a stale one first; a live lock is a normal `busy` outcome. */
export async function acquireLock(
  fs: FilesystemPort,
  clock: ClockPort,
  pid: number,
): Promise<LockAcquisition> {
  const now = clock.now();
  const mine: SyncLock = { pid, startedAt: now };

  if (await fs.createExclusive(LOCK_PATH, serialiseLock(mine))) {
    return { kind: 'acquired', lock: mine };
  }

  const found = await readLock(fs);
  if (found.state === 'absent') {
    // Released between the create and the read. One more atomic attempt; a
    // loss here means another run took it in the same gap.
    return (await fs.createExclusive(LOCK_PATH, serialiseLock(mine)))
      ? { kind: 'acquired', lock: mine }
      : busy(await readLock(fs));
  }

  return (await isStaleState(fs, found, now, LOCK_PATH)) ? breakAndTake(fs, found, mine, now) : busy(found);
}

/** `true` while the lock on disk is exactly the one this run took. */
export async function isLockHeld(fs: FilesystemPort, mine: SyncLock): Promise<boolean> {
  const found = await readLock(fs);
  return (
    found.state === 'held' &&
    found.lock.pid === mine.pid &&
    found.lock.startedAt === mine.startedAt
  );
}

/** Releases only a lock still this run's own; otherwise it would delete its successor's (AD-7). */
export async function isOwnLockReleased(fs: FilesystemPort, mine: SyncLock): Promise<boolean> {
  if (!(await isLockHeld(fs, mine))) {
    return false;
  }
  await fs.deleteFile(LOCK_PATH);
  return true;
}
