/**
 * The chunk runner's exclusive, recoverable on-disk lock (AD-7,
 * IMPLEMENTATION-NOTES.md §7).
 *
 * Four operations: take, break-if-stale, verify-own and release-if-own. The
 * file holds `{pid, startedAt}` and nothing else, and it is taken by one
 * atomic exclusive create. Staleness is judged by time alone, never by pid: a
 * pid is reused by the operating system, and the time comparison is what bounds
 * the failure.
 *
 * **Breaking a stale lock is serialised by a second exclusive file**, the break
 * marker. Deleting a stale lock and creating a new one are two steps, and
 * without the marker two breakers can interleave so that the slower one
 * deletes the lock the faster one has just taken. Under the marker, the
 * breaker re-reads the lock and breaks it only if the text is still the stale
 * text it judged, so exactly one run takes the lock and every other reports
 * busy.
 */

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

/**
 * `staleLockAfter` (IMPLEMENTATION-NOTES.md §7): a ceiling on a chunk, not an
 * estimate of one. A `sync` constant, and deliberately not a player setting.
 */
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

/**
 * A lock that cannot be parsed is **held**, never free: the real adapter
 * writes the contents just after the exclusive create, so a reader can catch
 * the file empty for an instant. It has no `startedAt`, so its file time is
 * the only clock available, and the same threshold applies to it. Without
 * that, a run that crashed between the create and the write would leave a
 * lock nobody ever clears.
 *
 * Exported for the `pnpm sync` session (`../sync.ts`), which waits for a held
 * lock to be free or stale by this same rule rather than a copy of it.
 */
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
async function deleteIfText(fs: FilesystemPort, path: string, text: string): Promise<boolean> {
  if ((await fs.readTextFile(path)) !== text) {
    return false;
  }
  await fs.deleteFile(path);
  return true;
}

/**
 * Clears a break marker left by a run that crashed mid-break, so the next run
 * can proceed. The same threshold applies, so this is as bounded as the lock.
 */
async function clearStaleBreakMarker(fs: FilesystemPort, now: string): Promise<void> {
  const marker = await readLock(fs, BREAK_MARKER_PATH);
  if (marker.state === 'absent') {
    return;
  }
  if (await isStaleState(fs, marker, now, BREAK_MARKER_PATH)) {
    await deleteIfText(fs, BREAK_MARKER_PATH, marker.text);
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
    if (again.state !== 'absent' && !(await deleteIfText(fs, LOCK_PATH, stale.text))) {
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
    await deleteIfText(fs, BREAK_MARKER_PATH, mineText);
  }
}

/**
 * Takes the lock, breaking it first where it is stale. A live lock is a normal
 * `busy` outcome, never an error.
 */
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

  if (!(await isStaleState(fs, found, now, LOCK_PATH))) {
    return busy(found);
  }
  return breakAndTake(fs, found, mine, now);
}

/** `true` while the lock on disk is exactly the one this run took. */
export async function holdsLock(fs: FilesystemPort, mine: SyncLock): Promise<boolean> {
  const found = await readLock(fs);
  return (
    found.state === 'held' &&
    found.lock.pid === mine.pid &&
    found.lock.startedAt === mine.startedAt
  );
}

/**
 * Releases the lock **only while it is still this run's own**. A dispossessed
 * run that released unconditionally would delete its successor's lock.
 */
export async function releaseLockIfOwn(fs: FilesystemPort, mine: SyncLock): Promise<boolean> {
  if (!(await holdsLock(fs, mine))) {
    return false;
  }
  await fs.deleteFile(LOCK_PATH);
  return true;
}
