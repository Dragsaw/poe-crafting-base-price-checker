/**
 * The chunk runner's two on-disk shapes (AD-7).
 */

import { z } from 'zod';

import { IsoTimestampSchema } from './primitives.ts';

/** `data/sync.lock`: two fields and no others. Not a versioned artifact, so no `schemaVersion`. */
export const SyncLockSchema = z.strictObject({
  pid: z.int().describe('The holder process id. Never a liveness proof on its own.'),
  startedAt: IsoTimestampSchema.describe(
    'When the holder took the lock, from `ClockPort`. Staleness is judged by this alone.',
  ),
});

export type SyncLock = z.infer<typeof SyncLockSchema>;

/** Completed keys only: a resumed chunk recomputes its order. The envelope adds `schemaVersion`. */
export const SyncProgressSchema = z.strictObject({
  completed: z
    .array(z.string().min(1))
    .refine((keys) => new Set(keys).size === keys.length, {
      message: 'completed keys must be unique',
    })
    .describe('Canonical keys of the entries this pass has completed.'),
  notBefore: IsoTimestampSchema.optional().describe(
    'Penalty memory across processes (AD-8). A run that starts before this instant defers: it sends nothing and exits 0. Written only by a chunk that ends on a 429 or a malformed-request abort; every other ending that writes progress clears it. Absent never defers.',
  ),
  authHoldOffUntil: IsoTimestampSchema.optional().describe(
    'The session-cookie hold-off across processes (AD-30). While a run starts before this instant, a valid session cookie settles held-off and no probe is sent. Written as now + 24h by a not-elevated, probe-rejected or expired outcome, removed by a live probe, and carried forward by every other progress write. Holds the due time only, never the cookie value.',
  ),
});

/** 1.2.0 adds `authHoldOffUntil`. */
export const SYNC_PROGRESS_SCHEMA_VERSION = '1.2.0';

export type SyncProgress = z.infer<typeof SyncProgressSchema>;
