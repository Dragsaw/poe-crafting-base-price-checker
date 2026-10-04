import { z } from 'zod';

import { IsoTimestampSchema, LeagueIdSchema } from './primitives.ts';
import { TrackedListAgeSchema } from './tracked-list-age.ts';

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

/**
 * Exactly four sources generate a request, and nothing else does (AD-12).
 * `session-probe` is the one liveness probe of the optional session cookie
 * (AD-30, IMPLEMENTATION-NOTES.md §13.2).
 */
export const RequestSourceSchema = z.enum([
  'tracked-list',
  'league-validation',
  'catalogue-refresh',
  'session-probe',
]);

export type RequestSource = z.infer<typeof RequestSourceSchema>;

/**
 * The three sources a chunk spends requests on (AD-12). The report figure keys
 * on these alone: `catalogue-refresh` runs as its own command and never inside
 * a chunk, so a chunk report that carried it would always print 0. The
 * `session-probe` count is the report's one trace of the session cookie, and
 * `web` does not render it (AD-30).
 */
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

/**
 * Drops the legacy key and fills a missing `session-probe` key with `0`, and
 * nothing else, so a report written at 1.0.0 or 1.1.0 still parses while every
 * other unknown key is still refused. The tolerance lives here rather than in
 * `sync`, so that every reader inherits it.
 */
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


/**
 * The `sync-report.json` contract version. 1.1.0 narrowed `requestsBySource`
 * to the chunk sources; the reader drops the legacy key, so a 1.0.0 file still
 * parses (the major is unchanged). 1.2.0 adds the `session-probe` source
 * (IMPLEMENTATION-NOTES.md §13.7). The writer always writes the key; the
 * reader reads a 1.1.0 file without it as `0`. A build older than a version
 * refuses a report of that version, because its figure required a key set the
 * file no longer matches; that is acceptable because only `sync` writes and
 * reads the report's figure, the same trade IMPLEMENTATION-NOTES.md §5.3
 * accepts for progress.
 */
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

/**
 * `weights.json` is absent, so the cross-file gate is skipped and `className`
 * cannot be checked. The classes are reported as uncheckable rather than clean
 * (AD-12, AD-25).
 */
export const WeightsAbsentRecordSchema = z.strictObject({
  kind: z.literal('weights-absent'),
  uncheckableClassNames: z
    .array(z.string().min(1))
    .describe(
      'The distinct `className` values of the non-pruned `crafted` entries, sorted by UTF-8 code unit.',
    ),
});

/**
 * A `statId` or `categoryId` in a present `weights.json` that the committed
 * catalogue does not expose. Reported only: the file is never rewritten or
 * refused for it (AD-9).
 */
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

/**
 * Why a chunk stopped on a throw. A record, not a figure: a failed unattended
 * run otherwise leaves only an exit code (FR-25, FR-19).
 */
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

/**
 * The configured league is not among the ids the trade leagues endpoint
 * answered, so the run aborted before it spent any search (AD-19, FR-32).
 * A routine configuration fault, not a `run-failure`: the player needs the
 * list to correct `config.json`.
 */
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

/**
 * The **subject** fields of each record kind: the fields that name *what is
 * wrong* and so make up the record's identity. Every other field is an
 * observation of the chunk that wrote it (IMPLEMENTATION-NOTES.md §12).
 *
 * The map is exhaustive over the kinds, so a new record kind that declares no
 * subject list fails type-checking.
 */
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

/**
 * `same(a, b) ⇔ a.kind = b.kind ∧ subject(a) = subject(b)` (§12). Every
 * subject field is a scalar, so `===` compares it. An absent optional subject
 * is a value: two records that both lack it agree on it.
 */
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
