import { z } from 'zod';

import { IsoTimestampSchema } from './primitives.ts';

/**
 * The chunk runner's two on-disk shapes (AD-7, IMPLEMENTATION-NOTES.md §7).
 */

/**
 * `data/sync.lock` — **two fields and no others**. Anything else invites a
 * reader to reason about a run it cannot see. The lock is machine-local runtime
 * state and is not a versioned artifact, so it carries no `schemaVersion`.
 */
export const SyncLockSchema = z.strictObject({
  pid: z.int().describe('The holder process id. Never a liveness proof on its own.'),
  startedAt: IsoTimestampSchema.describe(
    'When the holder took the lock, from `ClockPort`. Staleness is judged by this alone.',
  ),
});

export type SyncLock = z.infer<typeof SyncLockSchema>;

/**
 * The body of `data/sync-progress.json`. It records the canonical keys of the
 * entries the current pass has **completed**, never the ones a chunk intended
 * to visit — a resumed chunk recomputes its order rather than replaying a
 * frozen plan. The envelope in `envelopes.ts` adds `schemaVersion`.
 */
export const SyncProgressSchema = z.strictObject({
  completed: z
    .array(z.string().min(1))
    .refine((keys) => new Set(keys).size === keys.length, {
      message: 'completed keys must be unique',
    })
    .describe('Canonical keys (§4.1) of the entries this pass has completed.'),
});

export type SyncProgress = z.infer<typeof SyncProgressSchema>;
