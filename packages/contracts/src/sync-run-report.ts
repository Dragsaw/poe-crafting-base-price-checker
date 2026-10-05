import { z } from 'zod';

import { IsoTimestampSchema, LeagueIdSchema } from './primitives.ts';
import { TrackedListAgeSchema } from './tracked-list-age.ts';

/** A figure is overwritten by the next chunk; a record survives it (Consistency Conventions). */

/** Exactly four sources generate a request (AD-12); `session-probe`: AD-30, IN §13.2. */
export const RequestSourceSchema = z.enum([
  'tracked-list',
  'league-validation',
  'catalogue-refresh',
  'session-probe',
]);

export type RequestSource = z.infer<typeof RequestSourceSchema>;

/** Chunk sources (AD-12); `catalogue-refresh` is its own command; `web` hides `session-probe`. */
export const ChunkRequestSourceSchema = RequestSourceSchema.extract([
  'tracked-list',
  'league-validation',
  'session-probe',
]);

export type ChunkRequestSource = z.infer<typeof ChunkRequestSourceSchema>;

/** The key a report written before spine revision 21 still carries. */
const LEGACY_REQUEST_SOURCE_KEY = 'catalogue-refresh';

/** The key a report written before 1.2.0 lacks; it reads as `0`. */
const SESSION_PROBE_SOURCE_KEY = 'session-probe';

/** Lets a 1.0.0 or 1.1.0 report parse and nothing else; here so every reader inherits it. */
function readLegacyRequestSources(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return value;
  }
  const entries = Object.entries(value).filter(([key]) => key !== LEGACY_REQUEST_SOURCE_KEY);
  if (!Object.hasOwn(value, SESSION_PROBE_SOURCE_KEY)) {
    entries.push([SESSION_PROBE_SOURCE_KEY, 0]);
  }
  return Object.fromEntries(entries);
}

export const RequestsBySourceSchema = z
  .preprocess(readLegacyRequestSources, z.record(ChunkRequestSourceSchema, z.int().min(0)))
  .describe('Requests the chunk consumed per chunk source, so budget drift is attributable (AD-12, FR-14).');


/** 1.2.0 adds `session-probe` (IN §13.7); an older build refuses a newer report. */
export const SYNC_REPORT_SCHEMA_VERSION = '1.2.0';

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

/** Exactly five fields (IN §6): the declared yardstick beside the observed one. */
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

/** `weights.json` absent: the classes are reported as uncheckable, not clean (AD-12, AD-25). */
export const WeightsAbsentRecordSchema = z.strictObject({
  kind: z.literal('weights-absent'),
  uncheckableClassNames: z
    .array(z.string().min(1))
    .describe(
      'The distinct `className` values of the non-pruned `crafted` entries, sorted by UTF-8 code unit.',
    ),
});

/** Reported only: the file is never rewritten or refused for it (AD-9). */
export const UncataloguedWeightsIdRecordSchema = z.strictObject({
  kind: z.literal('uncatalogued-weights-id'),
  identifier: z.string().min(1).describe('The identifier the catalogue does not expose.'),
  identifierKind: z.enum(['statId', 'categoryId']),
});

/** The six cross-file checks AD-17 defines once in `core`. */
export const CrossFileCheckSchema = z.enum([
  'edge-alignment',
  'empty-containment-set',
  'co-occur',
  'class-discriminability',
  'kind-agreement',
  'line-set-completeness',
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

/** A record, not a figure: a failed unattended run otherwise leaves an exit code (FR-25, FR-19). */
export const RunFailureReasonSchema = z.enum(['trade-request-rejected', 'unrecoverable-error']);

export type RunFailureReason = z.infer<typeof RunFailureReasonSchema>;

export const RunFailureRecordSchema = z.strictObject({
  kind: z.literal('run-failure'),
  reason: RunFailureReasonSchema.describe(
    '`trade-request-rejected`: the trade API answered a non-429 4xx and the chunk aborted. `unrecoverable-error`: any other throw.',
  ),
  entryKey: z
    .string()
    .min(1)
    .optional()
    .describe('The canonical key of the entry the chunk was on, where the failure names one (§4.1).'),
  status: z.int().optional().describe('The HTTP status the trade API answered, where there was one.'),
  message: z.string().min(1).describe('The error message, as thrown.'),
});

/** A routine configuration fault, not a `run-failure`: the player needs the list (AD-19, FR-32). */
export const LeagueMismatchRecordSchema = z.strictObject({
  kind: z.literal('league-mismatch'),
  configuredLeague: LeagueIdSchema.describe('`config.league` as loaded.'),
  availableLeagues: z
    .array(LeagueIdSchema)
    .describe('Every id the leagues endpoint answered, in endpoint order. Ids compare byte for byte.'),
});

export const SyncRunRecordSchema = z.discriminatedUnion('kind', [
  StaleLockBrokenRecordSchema,
  PinnedStarvationRecordSchema,
  UnresolvableRecordSchema,
  WeightsAbsentRecordSchema,
  UncataloguedWeightsIdRecordSchema,
  CrossFileGateFailureRecordSchema,
  RunFailureRecordSchema,
  LeagueMismatchRecordSchema,
]);

export type StaleLockBrokenRecord = z.infer<typeof StaleLockBrokenRecordSchema>;
export type PinnedStarvationRecord = z.infer<typeof PinnedStarvationRecordSchema>;
export type UnresolvableRecord = z.infer<typeof UnresolvableRecordSchema>;
export type WeightsAbsentRecord = z.infer<typeof WeightsAbsentRecordSchema>;
export type UncataloguedWeightsIdRecord = z.infer<typeof UncataloguedWeightsIdRecordSchema>;
export type CrossFileGateFailureRecord = z.infer<typeof CrossFileGateFailureRecordSchema>;
export type RunFailureRecord = z.infer<typeof RunFailureRecordSchema>;
export type LeagueMismatchRecord = z.infer<typeof LeagueMismatchRecordSchema>;
export type SyncRunRecord = z.infer<typeof SyncRunRecordSchema>;

export type SyncRunRecordKind = SyncRunRecord['kind'];

type RecordOfKind<Kind extends SyncRunRecordKind> = Extract<SyncRunRecord, { kind: Kind }>;

/** Subject fields name what is wrong and make up record identity (IMPLEMENTATION-NOTES.md §12). */
export const RECORD_SUBJECTS: {
  readonly [Kind in SyncRunRecordKind]: readonly Exclude<keyof RecordOfKind<Kind>, 'kind'>[];
} = {
  'stale-lock-broken': ['pid', 'startedAt'],
  'pinned-starvation': ['declaredMinChunkSearches', 'pinnedCount'],
  unresolvable: ['entryKey', 'identifier', 'identifierKind'],
  'weights-absent': [],
  'uncatalogued-weights-id': ['identifier', 'identifierKind'],
  'cross-file-gate-failure': ['check', 'entryKey'],
  'run-failure': ['reason', 'entryKey', 'status'],
  'league-mismatch': ['configuredLeague'],
};

/** `same(a, b) ⇔ a.kind = b.kind ∧ subject(a) = subject(b)` (§12); an absent subject is a value. */
export function isSameRecord(a: SyncRunRecord, b: SyncRunRecord): boolean {
  if (a.kind !== b.kind) {
    return false;
  }
  const subjects: readonly string[] = RECORD_SUBJECTS[a.kind];
  const left = a as Readonly<Record<string, unknown>>;
  const right = b as Readonly<Record<string, unknown>>;
  return subjects.every((key) => left[key] === right[key]);
}

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
