import { z } from 'zod';

import { IsoTimestampSchema } from './primitives';
import { TrackedListAgeSchema } from './tracked-list-age';

/**
 * `SyncRunReport` **types a figure apart from a record** (Consistency
 * Conventions, *Logging*).
 *
 * - A **figure** describes the latest chunk and is overwritten by the next one.
 * - A **record** describes an event the player must see, and **survives the
 *   chunk that wrote it** — cleared by the player's edit, never by the next
 *   run. A report rewritten wholesale each chunk would erase a
 *   `stale-lock-broken` or a pinned-starvation record within minutes of its
 *   being written, which is the window in which nobody is looking.
 *
 * There is **no `failed push` record**: spine revision 18 removed every git
 * write, so it cannot arise.
 */

/** Exactly three sources generate a request, and nothing else does (AD-12). */
export const RequestSourceSchema = z.enum([
  'tracked-list',
  'league-validation',
  'catalogue-refresh',
]);

export type RequestSource = z.infer<typeof RequestSourceSchema>;

export const RequestsBySourceSchema = z
  .record(RequestSourceSchema, z.int().min(0))
  .describe('Requests consumed per declared source, so budget drift is attributable (AD-12, FR-14).');

export const SyncRunFiguresSchema = z
  .strictObject({
    requestsBySource: RequestsBySourceSchema,
    notReachedCount: z
      .int()
      .min(0)
      .describe(
        'How many entries this chunk made eligible but did not attempt — a single count, never a list. A normal rotation outcome, never a skip (AD-7, FR-25).',
      ),
    coverage: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe(
        'The share of rankable tracked item classes that are covered — a fraction in [0, 1], never a percentage. Omitted together with its denominator where weights.json is absent, and `web` must not read the omission as 0 (AD-27, IMPLEMENTATION-NOTES.md §3).',
      ),
    rankableClassCount: z
      .int()
      .min(0)
      .optional()
      .describe(
        'The coverage denominator, reported beside the fraction because the fraction alone is meaningless on a small list (AD-27).',
      ),
    trackedListEditedAt: TrackedListAgeSchema.optional().describe(
      'The last tracked-list edit, with the clock that produced it. Absent where neither clock answers — never a placeholder.',
    ),
  })
  .describe('Per-chunk figures. The next chunk overwrites every one of them.');

export type SyncRunFigures = z.infer<typeof SyncRunFiguresSchema>;

export const StaleLockBrokenRecordSchema = z.strictObject({
  kind: z.literal('stale-lock-broken'),
  pid: z.int().describe('The broken lock’s holder pid.'),
  startedAt: IsoTimestampSchema.describe('The broken lock’s start time.'),
});

/**
 * **Exactly five fields** (IMPLEMENTATION-NOTES.md §6). The shortfall is
 * otherwise at least four different numbers, and the declared yardstick beside
 * the observed allowance is what turns the record from a symptom into a
 * diagnosis.
 */
export const PinnedStarvationRecordSchema = z.strictObject({
  kind: z.literal('pinned-starvation'),
  discoveredAllowance: z
    .int()
    .min(0)
    .describe('The search allowance the chunk actually received from the live headers (AD-8).'),
  declaredMinChunkSearches: z
    .int()
    .min(0)
    .describe('`config.minChunkSearches` as loaded — the yardstick beside the allowance observed.'),
  pinnedCount: z.int().min(0).describe('The size of the pinned set at load.'),
  pinnedRefreshed: z.int().min(0).describe('How many pinned entries the truncation kept.'),
  activeRefreshed: z.int().min(0).describe('How many active entries the chunk reached.'),
});

export const UnresolvableRecordSchema = z.strictObject({
  kind: z.literal('unresolvable'),
  entryKey: z.string().min(1).describe('The tracked entry’s canonical key (§4.1).'),
  identifier: z.string().min(1).describe('The identifier the catalogue no longer exposes.'),
  identifierKind: z.enum(['statId', 'baseTypeId', 'categoryId']),
});

/** The five cross-file checks AD-17 defines once in `core`. */
export const CrossFileCheckSchema = z.enum([
  'edge-alignment',
  'empty-containment-set',
  'co-occur',
  'class-discriminability',
  'kind-agreement',
]);

export type CrossFileCheck = z.infer<typeof CrossFileCheckSchema>;

export const CrossFileGateFailureRecordSchema = z.strictObject({
  kind: z.literal('cross-file-gate-failure'),
  check: CrossFileCheckSchema,
  entryKey: z
    .string()
    .min(1)
    .describe('The failing entry’s canonical key. Every payload names the entry by it (AD-17).'),
  detail: z.string().min(1).describe('The failing check’s payload, as its § defines it.'),
});

export const SyncRunRecordSchema = z.discriminatedUnion('kind', [
  StaleLockBrokenRecordSchema,
  PinnedStarvationRecordSchema,
  UnresolvableRecordSchema,
  CrossFileGateFailureRecordSchema,
]);

export type StaleLockBrokenRecord = z.infer<typeof StaleLockBrokenRecordSchema>;
export type PinnedStarvationRecord = z.infer<typeof PinnedStarvationRecordSchema>;
export type UnresolvableRecord = z.infer<typeof UnresolvableRecordSchema>;
export type CrossFileGateFailureRecord = z.infer<typeof CrossFileGateFailureRecordSchema>;
export type SyncRunRecord = z.infer<typeof SyncRunRecordSchema>;

export const SyncRunReportSchema = z
  .strictObject({
    runStartedAt: IsoTimestampSchema,
    runFinishedAt: IsoTimestampSchema.optional().describe(
      'Absent on an aborted run. An aborting run still writes this file (AD-12).',
    ),
    figures: SyncRunFiguresSchema,
    records: z
      .array(SyncRunRecordSchema)
      .describe(
        'This chunk’s records plus every unacknowledged record from earlier chunks (Consistency Conventions, *Logging*).',
      ),
  })
  .describe('The structured outcome of one sync run. Data the view reads, never console output (FR-25).');

export type SyncRunReport = z.infer<typeof SyncRunReportSchema>;
