import { canonicalKey, compareCanonicalKeys, compareTrackedEntries } from '@poe/contracts';
import type { DatasetEntry, TrackedEntry } from '@poe/contracts';

/**
 * The chunk runner's selection order: the Refresh Rotation (AD-7, FR-17).
 *
 * Pure. The tracked list, the dataset entries, the pass's completed keys and
 * the instant go in; the order comes out. Nothing is read from anywhere else,
 * so a dry run and a live run given the same inputs visit the same keys.
 *
 * Rows, in order:
 *
 * 1. `pinned` entries whose dataset price state is not `unresolvable` — with
 *    `pinnedMaxAgeMs`, only the stale ones (no `lastAttemptedAt`, or one older
 *    than the maximum age).
 * 2. `active` entries whose dataset price state is not `unresolvable`, less
 *    the pass's completed keys.
 * 3. every non-pruned entry whose dataset price state is `unresolvable` and
 *    that is due — no `lastAttemptedAt`, or at least 24 h since it — less the
 *    pass's completed keys.
 *
 * `pruned` is never selected. Within a row: oldest `lastAttemptedAt` first,
 * compared as instants; an absent one sorts before any present one; ties by
 * `compareTrackedEntries`. The key is the field's absence, never the
 * `not-yet-synced` state.
 *
 * The pass covers rows 2–3 only. `pinned` is exempt from rotation, so row 1
 * never consults or produces completed keys.
 */

/** The bounded retry interval for row 3 (AD-7). */
export const UNRESOLVABLE_RETRY_MS = 24 * 60 * 60 * 1000;

export interface ChunkOrderInput {
  readonly tracked: readonly TrackedEntry[];
  /** The published dataset's entries. Empty means every entry is never-attempted. */
  readonly dataset: readonly DatasetEntry[];
  /** The canonical keys the current pass has completed. */
  readonly completed: readonly string[];
  /** The current instant, ISO-8601 UTC. */
  readonly now: string;
  /**
   * The `pnpm sync` session's stale-pinned rule (AD-7): row 1 keeps only the
   * pinned entries whose `lastAttemptedAt` is absent or more than this many
   * milliseconds before `now`. Absent, row 1 keeps every pinned entry.
   */
  readonly pinnedMaxAgeMs?: number;
}

export interface ChunkOrder {
  /** Row 1, in visiting order. Subject to the runner's runtime truncation. */
  readonly pinned: readonly TrackedEntry[];
  /** Rows 2 then 3, in visiting order. */
  readonly rotation: readonly TrackedEntry[];
  /**
   * The completed keys that remain in force, in canonical-key order. It is
   * empty when a new pass started, and it drops any key that no longer names a
   * rotation (rows 2–3) entry.
   */
  readonly completed: readonly string[];
  /** `true` when every due row 2–3 entry was complete, so the pass restarted. */
  readonly newPass: boolean;
}

interface Placed {
  readonly entry: TrackedEntry;
  readonly key: string;
  /** Milliseconds since the epoch, or `undefined` for never attempted. */
  readonly attemptedAt: number | undefined;
}

function compareOldestFirst(left: Placed, right: Placed): number {
  if (left.attemptedAt !== right.attemptedAt) {
    if (left.attemptedAt === undefined) {
      return -1;
    }
    return right.attemptedAt === undefined ? 1 : left.attemptedAt - right.attemptedAt;
  }
  return compareTrackedEntries(left.entry, right.entry);
}

const entriesOf = (placed: readonly Placed[]): TrackedEntry[] =>
  placed.toSorted(compareOldestFirst).map((item) => item.entry);

/** Row 1's filter: every pinned entry, or only the stale ones when a maximum age is given. */
function isStalePinned(attemptedAt: number | undefined, now: number, maxAgeMs: number | undefined): boolean {
  return maxAgeMs === undefined || attemptedAt === undefined || now - attemptedAt > maxAgeMs;
}

type Bucket = 'pinned' | 'active' | 'unresolvable';

interface Classified {
  /** Whether the key belongs to a pass: rows 2–3, due or not. */
  readonly inRotation: boolean;
  /** The row the entry is visited in now, or `undefined` when none. */
  readonly bucket: Bucket | undefined;
}

function classify(
  entry: TrackedEntry,
  published: DatasetEntry | undefined,
  attemptedAt: number | undefined,
  clock: { readonly now: number; readonly pinnedMaxAgeMs: number | undefined },
): Classified {
  const { now, pinnedMaxAgeMs } = clock;
  if (published?.price.state === 'unresolvable') {
    const isDue = attemptedAt === undefined || now - attemptedAt >= UNRESOLVABLE_RETRY_MS;
    return { inRotation: true, bucket: isDue ? 'unresolvable' : undefined };
  }
  if (entry.status === 'pinned') {
    return { inRotation: false, bucket: isStalePinned(attemptedAt, now, pinnedMaxAgeMs) ? 'pinned' : undefined };
  }
  return { inRotation: true, bucket: 'active' };
}

interface Buckets extends Record<Bucket, Placed[]> {
  readonly rotationKeys: Set<string>;
}

function bucketTracked(input: ChunkOrderInput, now: number): Buckets {
  const byKey = new Map(input.dataset.map((entry) => [entry.entryKey, entry]));
  const buckets: Buckets = { pinned: [], active: [], unresolvable: [], rotationKeys: new Set<string>() };

  for (const entry of input.tracked) {
    if (entry.status === 'pruned') {
      continue;
    }
    const key = canonicalKey(entry);
    const published = byKey.get(key);
    const attemptedAt =
      published?.lastAttemptedAt === undefined ? undefined : Date.parse(published.lastAttemptedAt);
    const { inRotation, bucket } = classify(entry, published, attemptedAt, { now, pinnedMaxAgeMs: input.pinnedMaxAgeMs });
    if (inRotation) {
      buckets.rotationKeys.add(key);
    }
    if (bucket !== undefined) {
      buckets[bucket].push({ entry, key, attemptedAt });
    }
  }
  return buckets;
}

export function chunkOrder(input: ChunkOrderInput): ChunkOrder {
  const { pinned, active, unresolvable, rotationKeys } = bucketTracked(input, Date.parse(input.now));

  const done = new Set(input.completed);
  const completed = [...rotationKeys].filter((key) => done.has(key)).toSorted(compareCanonicalKeys);
  const due = [...active, ...unresolvable];
  const isNewPass = due.length > 0 && due.every((item) => done.has(item.key));
  const isOpen = (item: Placed): boolean => isNewPass || !done.has(item.key);

  return {
    pinned: entriesOf(pinned),
    rotation: [...entriesOf(active.filter((item) => isOpen(item))), ...entriesOf(unresolvable.filter((item) => isOpen(item)))],
    completed: isNewPass ? [] : completed,
    newPass: isNewPass,
  };
}

/**
 * The runtime `pinned` truncation (AD-7, IMPLEMENTATION-NOTES.md §6). After a
 * pinned step reports `remaining` searches with `left` pinned entries still
 * unvisited: when the rotation has work waiting and `remaining < left + 1`,
 * visit only `max(remaining − 1, 0)` more, reserving a search for the rotation.
 * Otherwise visit all `left`.
 */
export function pinnedToKeep(left: number, remaining: number, rotationWaiting: boolean): number {
  return !rotationWaiting || remaining >= left + 1 ? left : Math.min(left, Math.max(remaining - 1, 0));
}
