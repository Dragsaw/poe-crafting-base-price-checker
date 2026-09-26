import { canonicalKey, compareTrackedEntries } from '@poe/contracts';
import type { TrackedEntry } from '@poe/contracts';

/**
 * The chunk runner's selection order (AD-7). Pure: the tracked entries and the
 * completed keys go in, the order comes out, and nothing is read from anywhere
 * else.
 *
 * **A minimal body.** Story 1.6 replaces it with the Refresh Rotation — pinned
 * then active by oldest `lastAttemptedAt`, then bounded `unresolvable` retries.
 * This version sorts by canonical key only. The signature and the pass-reset
 * rule are what the runner depends on, and they stay.
 */

export interface ChunkOrder {
  /** The entries this chunk may visit, in visiting order. */
  readonly entries: readonly TrackedEntry[];
  /**
   * The completed keys that remain in force, in canonical-key order. It is
   * empty when a new pass started, and it drops any key that no longer names a
   * non-pruned tracked entry.
   */
  readonly completed: readonly string[];
  /** `true` when every non-pruned entry was complete, so the pass restarted. */
  readonly newPass: boolean;
}

export function chunkOrder(
  tracked: readonly TrackedEntry[],
  completedKeys: readonly string[],
): ChunkOrder {
  const eligible = tracked
    .filter((entry) => entry.status !== 'pruned')
    .toSorted(compareTrackedEntries);

  const done = new Set(completedKeys);
  const completed = eligible.map(canonicalKey).filter((key) => done.has(key));

  if (eligible.length > 0 && completed.length === eligible.length) {
    return { entries: eligible, completed: [], newPass: true };
  }

  return {
    entries: eligible.filter((entry) => !done.has(canonicalKey(entry))),
    completed,
    newPass: false,
  };
}
