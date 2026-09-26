/**
 * The chunk runner's two on-disk shapes (AD-7, IMPLEMENTATION-NOTES.md §7).
 */

import { z } from 'zod';

import { IsoTimestampSchema } from './primitives.ts';

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
  notBefore: IsoTimestampSchema.optional().describe(
    'Penalty memory across processes (AD-8, IMPLEMENTATION-NOTES.md §5.3). A run that starts before this instant defers: it sends nothing and exits 0. Written only by a chunk that ends on a 429 or a malformed-request abort; every other ending that writes progress clears it. Absent never defers.',
  ),
});

/**
 * The `sync-progress.json` contract version. 1.1.0 added the optional
 * `notBefore`. The schema is strict, so a build older than the change refuses a
 * file carrying the field, which is acceptable because only `sync` reads it.
 */
export const SYNC_PROGRESS_SCHEMA_VERSION = '1.1.0';

export type SyncProgress = z.infer<typeof SyncProgressSchema>;
