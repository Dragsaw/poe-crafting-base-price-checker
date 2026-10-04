/**
 * One bounded, resumable, single-instance chunk (AD-7, FR-19).
 *
 * One call runs one chunk and returns. The chunk stops at whichever comes
 * first: the step reports a search allowance below `1`, the step reports a
 * fetch allowance below `1`, the step yields, or the order runs out. The
 * allowances are whatever the step read from live headers; this module holds
 * no rate and no floor of its own.
 *
 * **The run-start sequence is AD-12's cost order**, under the lock, free
 * before costly:
 *
 * 1. the lock (`./lock.ts`), then AD-8's `notBefore` check, before every
 *    other load (IMPLEMENTATION-NOTES.md §5.3). While the clock is before it
 *    the run is `deferred`: it sends nothing and writes nothing, except the
 *    report alone where it broke a stale lock;
 * 2. the loads and their load-time validation: the previous report, progress,
 *    `data/tracked.json`, `data/dataset.json`, then the shell's `load` hook
 *    (config, rates, item types and IMPLEMENTATION-NOTES.md §6's pinned-cap
 *    inequality; it returns the publication, the starvation record, the
 *    league gate and the pricing step, built on the dataset loaded here),
 *    then the committed catalogue and `data/weights.json`;
 * 3. the weights records (`../catalogue/weights-ids.ts`: absent is a
 *    `weights-absent` record, present has its ids checked report-only) and
 *    the run-start catalogue check (`./catalogue-check.ts`, AD-9, AD-25): a
 *    miss is marked `unresolvable`, reported, published with the step
 *    entries and kept out of the order; nothing is stamped. The report lists
 *    the `unresolvable` records before the weights records;
 * 3b. the cross-file gate (`./cross-file-gate.ts`, AD-17): `core`'s five
 *    checks over the tracked list and a present weights file. Any failure
 *    throws `CrossFileGateError` before the order exists, so the run
 *    publishes nothing, leaves `sync-progress.json` untouched and writes the
 *    report alone, with one `cross-file-gate-failure` record per failure
 *    after the run-start records, then exits non-zero. An absent file skips
 *    the gate;
 * 4. the order, from `core` (the Refresh Rotation, AD-7), recomputed on every
 *    run from the tracked list, the dataset, the completed keys and the
 *    clock, so a resumed chunk never replays a frozen plan;
 * 5. the league gate (`../league/league-gate.ts`, AD-19), the only check
 *    that costs a request;
 * 6. the rotation.
 *
 * `sync-progress.json` records only what was **completed**, and only in rows
 * 2–3: row 1 is exempt from the pass. A pinned entry that is `unresolvable`
 * sits in row 3, so its key is recorded like any other row 3 key.
 *
 * The runtime half of the pinned cap lives here: after each pinned step that
 * reports a search allowance, `pinnedToKeep` may cut the rest of row 1 so the
 * rotation keeps at least one search. A shortfall surfaces as
 * `pinnedStarvation` on the outcome; the kind is unchanged. The load-time
 * half, which reads the player's declared yardstick, runs inside the shell's
 * `load` (`../pinned-cap.ts`).
 *
 * Under the lock, a `completed`, `bounded` or `yielded` chunk writes
 * `data/dataset.json` (`./publish-dataset.ts`), then `sync-progress.json`,
 * then `data/sync-report.json` (`./sync-report.ts`), all through
 * `writeArtifact`. The dataset goes first, so progress never records a
 * completion the dataset does not publish. `busy` and `dispossessed` write
 * nothing. A chunk that ends on a `429` (a step's or the gate's) writes
 * `notBefore = now + min(retryAfter, staleLockAfter)`; a malformed-request
 * abort or a gate 4xx writes `now + staleLockAfter`; every other ending that writes
 * progress clears it.
 *
 * **A gate yield is an ordinary yielded chunk** with no entry attempted: it
 * publishes the dataset (the catalogue marks only), progress, and the report
 * with `runFinishedAt`, and its not-reached figure is every entry the order
 * made eligible (AD-7, AD-12). Until the gate passes, a publish keeps the
 * dataset's previously published league label (the configured league only
 * where no dataset exists), since the gate never confirmed it.
 *
 * The report carries this chunk's figures (requests per source, the
 * not-reached count, the tracked-list edit date) and its records after every
 * record the previous report still holds. A previous report this build cannot
 * read is refused before anything is written (NFR-8).
 *
 * **A throw** writes the report with a failure record, leaves
 * `runFinishedAt` absent, and is rethrown; the lock is released in a
 * `finally`. What else it writes depends on where it came from:
 *
 * - before the order exists (a load refusal, a pinned-cap excess, a
 *   catalogue or weights refusal): the report only;
 * - a league mismatch: the report only, carrying this chunk's lock record and
 *   the `league-mismatch` record; the catalogue check's marks and records and
 *   the weights records are discarded, since the next run that passes the
 *   gate recomputes them (AD-12);
 * - any other throw once the order exists: first the dataset and progress
 *   for the step entries so far and the marks, then the report. The failing
 *   entry, as the step left it, is published too for a `MalformedRequestError`
 *   (a non-429 4xx, AD-9) and for an `UnexpectedTradeResponseError` that
 *   carries one (a 2xx body of the wrong shape on the search or the fetch).
 *   Only a `MalformedRequestError` and the gate's `LeagueRequestRejectedError` (a
 *   non-429 4xx on the leagues request) write the abort `notBefore`; every
 *   other throw clears it.
 *
 * **Under a session** (`ChunkPorts.session`, `../sync.ts`) the chunk is the
 * same chunk with four differences: it attempts at most `maxEntries` entries
 * (`bounded` by `'entries'`), its order keeps only stale pinned entries, and
 * it skips the gate while the session's confirmed league still holds. Its
 * `requestsBySource` figure covers the session's current pass.
 *
 * A publish or report write that was already attempted on the normal path is
 * never attempted again on the failure path.
 */

import {
  canonicalKey,
  compareCanonicalKeys,
  DatasetFileSchema,
  parseEnvelope,
  resolveTrackedListAge,
  SYNC_PROGRESS_SCHEMA_VERSION,
  SyncProgressFileSchema,
  SyncReportFileSchema,
} from '@poe/contracts';
import type {
  ClockPort,
  CurrencyRate,
  DatasetEntry,
  DatasetFile,
  EnvelopeResult,
  FilesystemPort,
  GitPort,
  LeagueMismatchRecord,
  RunFailureRecord,
  SyncProgressFile,
  SyncRunRecord,
  TrackedEntry,
} from '@poe/contracts';
import { chunkOrder, pinnedToKeep, poolCoverage } from '@poe/core';
import type { ChunkOrder } from '@poe/core';

import type { CatalogueIds } from '../catalogue/catalogue-ids.ts';
import { checkWeightsIds, readWeightsIds, weightsAbsentRecord } from '../catalogue/weights-ids.ts';
import { LeagueMismatchError, LeagueRequestRejectedError } from '../league/league-gate.ts';
import { DataFileError, describeVersionRefusal, explainTrackedVersion, parseTrackedFile } from '../load-data-file.ts';
import type { DataFileResult, VersionRefusalExplainer } from '../load-data-file.ts';
import { MalformedRequestError, UnexpectedTradeResponseError } from '../pricing/price-entry.ts';
import { requestsBetween } from '../request-counter.ts';
import type { RequestsBySource } from '../request-counter.ts';
import { writeArtifact } from '../write-artifact.ts';
import { checkCatalogue } from './catalogue-check.ts';
import { CrossFileGateError, crossFileGate, crossFileGateRecords } from './cross-file-gate.ts';
import { acquireLock, holdsLock, releaseLockIfOwn, STALE_LOCK_AFTER_MS } from './lock.ts';
import { buildDatasetFile } from './publish-dataset.ts';
import { buildSyncReport } from './sync-report.ts';

export const TRACKED_PATH = 'data/tracked.json';
export const PROGRESS_PATH = 'data/sync-progress.json';
/**
 * The published Dataset (AD-19). Read at the start of a chunk for the
 * rotation's `lastAttemptedAt` and price state, and written under the lock at
 * its end, by explicit path, with this chunk's step entries merged in.
 */
export const DATASET_PATH = 'data/dataset.json';
/**
 * The Sync Report (FR-25, AD-12). Read under the lock before anything else,
 * for the records it still carries, and written after progress by explicit
 * path (`./sync-report.ts`).
 */
export const REPORT_PATH = 'data/sync-report.json';

/**
 * What one step reports for one entry. `completed` carries the allowances the
 * step observed in the live headers of its last search and fetch; an absent
 * allowance bounds nothing, because nothing was observed. `yielded` means the
 * entry was **not** completed and the chunk must stop now — a `429`, or the
 * client's invalid-request refusal, or a 5xx or timeout from the pricing step.
 *
 * Either kind may carry the step's updated `DatasetEntry`: a completed entry
 * with its new price state, or a yielded one stamped with `lastAttemptedAt`
 * (and, after an answered search, carrying its search fields).
 * The runner publishes them into `data/dataset.json` and reports them on the
 * outcome.
 */
export type StepResult =
  | {
      readonly kind: 'completed';
      readonly searchRemaining?: number;
      readonly fetchRemaining?: number;
      readonly entry?: DatasetEntry;
      /** Report records the step raised for this entry (a `jewel`-arm miss). */
      readonly records?: readonly SyncRunRecord[];
    }
  | {
      readonly kind: 'yielded';
      readonly entry?: DatasetEntry;
      /**
       * Set only when the yield was a `429`: the delay the client's yield
       * carried. The chunk writes it into `notBefore` (IMPLEMENTATION-NOTES.md
       * §5.3). Absent on a 5xx, a timeout or a threshold refusal.
       */
      readonly retryAfterMs?: number;
      /**
       * Set only when the yield was AD-30's downgrade, the `session-expired`
       * yield (IMPLEMENTATION-NOTES.md §13.4). It writes no `notBefore`; the
       * outcome carries it to the session, which waits `backoff(1)`.
       */
      readonly sessionExpired?: true;
    };

export type ChunkStep = (entry: TrackedEntry) => Promise<StepResult>;

/**
 * How long a failed session cookie is held off (AD-30, IMPLEMENTATION-NOTES.md
 * §13.3): a `write` sets `authHoldOffUntil` to the progress write's `now`
 * plus this.
 */
export const AUTH_HOLD_OFF_MS = 24 * 60 * 60 * 1000;

/**
 * The runner's two narrow ports onto the process auth holder (AD-30,
 * IMPLEMENTATION-NOTES.md §13.1, §13.3), wired in `../compose-chunk.ts`. The
 * runner never sees the holder itself, so it never reaches the cookie.
 */
export interface ChunkAuth {
  /**
   * Called once, after the lock and the `notBefore` check, with the loaded
   * `authHoldOffUntil` and `now`: while the holder may still probe and the
   * hold-off is due, it settles `held-off` and no probe goes out.
   */
  settleHeldOffIfDue(holdOffUntil: string | undefined, now: string): void;
  /** The hold-off action the next progress write applies, or `undefined` to carry the field. */
  pendingHoldOff(): 'write' | 'clear' | undefined;
  /** The progress write applied `action`; the holder stops keeping it. */
  holdOffApplied(action: 'write' | 'clear'): void;
}

/** What the run-start gate sees. Later stories add to it. */
export interface GateContext {
  readonly entries: readonly TrackedEntry[];
}

/**
 * What the run-start gate answers. `pass` lets the chunk go on. `yield` is a
 * chunk yield (AD-8): the gate got no answer to check against (a 429, the
 * invalid-request threshold, a 5xx, a timeout or a network failure), so the
 * chunk attempts no entry and publishes like any yielded chunk: the dataset
 * (the catalogue marks only), progress (`notBefore` set after a 429, cleared
 * otherwise) and the report.
 */
export type GateResult =
  | { readonly kind: 'pass' }
  | {
      readonly kind: 'yield';
      /** Set only when the gate's request answered `429`, as on `StepResult`. */
      readonly retryAfterMs?: number;
    };

/** What the caller supplies for the published Dataset's top level (AD-19, AD-20). */
export interface ChunkPublication {
  /** The active league, written as the dataset's `league`. */
  readonly league: string;
  /** The rate set as `sync` writes it out: `outputRates` of the loaded rates. */
  readonly currencyRates: readonly CurrencyRate[];
}

/** What the shell's `load` hook sees: the loads the runner made under the lock. */
export interface ChunkLoadContext {
  /** `data/tracked.json`'s entries; absent is an empty workload. */
  readonly entries: readonly TrackedEntry[];
  /** `data/dataset.json`'s entries as loaded under the lock; absent is empty. */
  readonly dataset: readonly DatasetEntry[];
}

/** What the shell's `load` hook answers: everything the chunk needs from config. */
export interface ChunkSetup {
  readonly publication: ChunkPublication;
  /**
   * Turns the chunk's starvation into a report record. The shell supplies it
   * with the declared yardstick (`pinnedStarvationRecord` in
   * `../pinned-cap.ts`), which this directory never reads. Required, so a
   * shell cannot silently drop the record (FR-25).
   */
  readonly starvationRecord: (starvation: ChunkStarvation) => SyncRunRecord;
  /**
   * The run-start league gate. It runs after the order and before any step.
   * A throw aborts the chunk; a `yield` ends it `yielded` with no entry
   * attempted.
   */
  readonly gate?: (context: GateContext) => Promise<GateResult>;
  /** The pricing step, built on the dataset the runner loaded. */
  readonly step: ChunkStep;
}

export interface ChunkPorts {
  readonly fs: FilesystemPort;
  readonly clock: ClockPort;
  /** The process id written into the lock. */
  readonly pid: number;
  /** Read-only: the tracked list's last commit author date (`resolveTrackedListAge`). */
  readonly git: GitPort;
  /**
   * The per-source request counter the shell wrapped its `HttpPort` with
   * (`../request-counter.ts`). The report carries what it counted between
   * taking the lock and writing the report.
   */
  readonly requests: { snapshot(): RequestsBySource };
  /**
   * The shell's loads (AD-12): config, rates, item types and the pinned-cap
   * inequality. Called under the lock, after the tracked list and the
   * dataset, and before the catalogue. A throw aborts the chunk with a
   * failure record and nothing else written, before any request.
   */
  readonly load: (context: ChunkLoadContext) => Promise<ChunkSetup>;
  /**
   * Loads the committed catalogue's id sets (`../catalogue/catalogue-ids.ts`).
   * Called under the lock, after `load` and before the order. A refusal
   * aborts the chunk with a `run-failure` record, before any request.
   */
  readonly catalogue: () => Promise<DataFileResult<CatalogueIds>>;
  /**
   * The retry delay of a probe `429` the chunk's governor latched, or
   * `undefined` (IMPLEMENTATION-NOTES.md §13.3). Read after the step loop,
   * just before `publish`: a latched penalty makes the chunk a `429` yield,
   * whatever bound ended it, and writes `notBefore` by §5.3's after-a-429
   * row. Omitted, nothing is latched.
   */
  readonly latchedRetryAfterMs?: () => number | undefined;
  /**
   * The live shells only: the auth holder's narrow ports (`ChunkAuth`).
   * Omitted, nothing settles `held-off` and every progress write carries
   * `authHoldOffUntil` forward unchanged.
   */
  readonly auth?: ChunkAuth;
  /** One line of operator output. Defaults to stderr. */
  readonly log?: (line: string) => void;
  /**
   * Set only by the long-running `pnpm sync` session (`../sync.ts`), which
   * runs one chunk per entry (AD-7). Absent, the chunk is the batch chunk of
   * `pnpm sync:batch` and `pnpm sync:dry`, unchanged.
   */
  readonly session?: ChunkSession;
}

/** What the session tells each of its chunks. Every field is optional. */
export interface ChunkSession {
  /**
   * The chunk attempts at most this many entries. Reaching it with an entry
   * left ends the chunk `bounded` by `'entries'`.
   */
  readonly maxEntries?: number;
  /**
   * The request counter's snapshot at the start of the current pass. The
   * report's `requestsBySource` then covers the pass, not only this chunk. A
   * chunk that starts a new pass (`newPass`) counts from its own start.
   */
  readonly requestsSince?: RequestsBySource;
  /**
   * The league an earlier chunk of this session confirmed. The gate is skipped
   * while it equals the configured league and the order is not a new pass.
   */
  readonly confirmedLeague?: string;
  /** Row 1's stale-pinned rule (`chunkOrder`'s `pinnedMaxAgeMs`). */
  readonly pinnedMaxAgeMs?: number;
}

/** `'entries'` is reached only under a session's `maxEntries`. */
export type ChunkBound = 'search' | 'fetch' | 'entries';

interface ChunkOutcomeBase {
  /**
   * Canonical keys this chunk completed, in visiting order, row 1 (pinned)
   * included. Progress records only the rows 2–3 subset of these.
   */
  readonly completed: readonly string[];
  /**
   * The dataset entries the steps returned, in visiting order — completed and
   * yielded alike. `completed`, `bounded` and `yielded` publish them into the
   * dataset; `busy` and `dispossessed` write nothing.
   */
  readonly entries: readonly DatasetEntry[];
  /**
   * The lock records this chunk produced (a broken stale lock). The report
   * adds the starvation record through `starvationRecord`.
   */
  readonly records: readonly SyncRunRecord[];
  /**
   * Present only when a pinned step reported an allowance below the pinned
   * entries left plus one while rows 2–3 had work waiting, whether or not any
   * pinned entry was left to cut (AD-7, IMPLEMENTATION-NOTES.md §6). It is not an error and does not
   * change the outcome kind. `pinnedStarvationRecord` in `../pinned-cap.ts`
   * adds the declared yardstick to make the report record.
   */
  readonly pinnedStarvation?: ChunkStarvation;
  /**
   * A session's chunk only (`ChunkPorts.session`), once the order exists:
   * `true` when this chunk's order started a new pass.
   */
  readonly newPass?: boolean;
  /**
   * A session's chunk only: the configured league, present when this chunk
   * confirmed it — the gate passed, or the session's earlier confirmation held.
   */
  readonly confirmedLeague?: string;
}

/** The four observed fields of a pinned-starvation record. */
export interface ChunkStarvation {
  /** The search allowance the chunk received: the first reported remaining search count plus the steps it had already taken. */
  readonly discoveredAllowance: number;
  /** The size of the pinned set at load: every tracked entry with status `pinned`, `unresolvable` ones included. */
  readonly pinnedCount: number;
  /** How many pinned entries the chunk completed. */
  readonly pinnedRefreshed: number;
  /** How many rotation (rows 2–3) entries the chunk completed. */
  readonly activeRefreshed: number;
}

export type ChunkOutcome =
  | (ChunkOutcomeBase & { readonly kind: 'completed' })
  | (ChunkOutcomeBase & { readonly kind: 'bounded'; readonly bound: ChunkBound })
  | (ChunkOutcomeBase & {
      readonly kind: 'yielded';
      /**
       * `true` only when the chunk ended on AD-30's downgrade, the
       * `session-expired` yield (IMPLEMENTATION-NOTES.md §13.4). The downgrade
       * reset the pacing state in place, so the session cannot read it from the
       * ledger: it waits `backoff(1)` on this signal.
       */
      readonly sessionExpired?: true;
    })
  | (ChunkOutcomeBase & { readonly kind: 'busy' })
  /**
   * A previous chunk ended on a `429` or a malformed-request abort and wrote a
   * `notBefore` still in the future (AD-8, IMPLEMENTATION-NOTES.md §5.3). The
   * run released the lock, sent nothing and wrote nothing — except the report
   * alone where it broke a stale lock to get here.
   */
  | (ChunkOutcomeBase & { readonly kind: 'deferred'; readonly notBefore: string })
  | (ChunkOutcomeBase & { readonly kind: 'dispossessed' });

export type ChunkOutcomeKind = ChunkOutcome['kind'];

/** The operator log's default sink: one line on stderr. */
export const writeStderr = (line: string): void => {
  process.stderr.write(`${line}\n`);
};

function describeRefusal(
  path: string,
  result: Exclude<EnvelopeResult<unknown>, { ok: true }>,
  explainVersion?: VersionRefusalExplainer,
): DataFileError {
  switch (result.reason) {
    case 'unknown-major':
    case 'malformed-version': {
      return new DataFileError(path, result.reason, describeVersionRefusal(result, explainVersion));
    }
    case 'invalid': {
      return new DataFileError(
        path,
        'invalid',
        `invalid: ${result.issues
          .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
          .join('; ')}`,
      );
    }
  }
}

async function loadEnvelope<T>(
  fs: FilesystemPort,
  path: string,
  parse: (data: unknown) => EnvelopeResult<T>,
  explainVersion?: VersionRefusalExplainer,
): Promise<T | undefined> {
  const text = await fs.readTextFile(path);
  if (text === undefined) {
    return undefined;
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new DataFileError(path, 'not-json', `not valid JSON: ${String(error)}`, { cause: error });
  }
  const result = parse(data);
  if (!result.ok) {
    throw describeRefusal(path, result, explainVersion);
  }
  return result.value;
}

/**
 * The two `notBefore` formulas (IMPLEMENTATION-NOTES.md §5.3). The cap is
 * `staleLockAfter`, so no `Retry-After` defers a run past the window that
 * clears a crashed run's lock.
 */
function notBeforeAfter429(now: string, retryAfterMs: number): string {
  return new Date(Date.parse(now) + Math.min(retryAfterMs, STALE_LOCK_AFTER_MS)).toISOString();
}

function notBeforeAfterAbort(now: string): string {
  return new Date(Date.parse(now) + STALE_LOCK_AFTER_MS).toISOString();
}

function boundOf(step: Extract<StepResult, { kind: 'completed' }>): ChunkBound | undefined {
  if (step.searchRemaining !== undefined && step.searchRemaining < 1) {
    return 'search';
  }
  return step.fetchRemaining !== undefined && step.fetchRemaining < 1 ? 'fetch' : undefined;
}

/**
 * The records a throw leaves in the report. A cross-file gate failure leaves
 * one `cross-file-gate-failure` record per failing (check, entry); every
 * other throw leaves one record. A league mismatch is its own
 * record, with the list the player corrects the configured league from
 * (AD-19). A non-429 4xx names its status, and its entry where it was on one:
 * the league gate's request names none. Any other throw names the entry the
 * step was on, where it was on one.
 */
function failureRecords(error: unknown, current: TrackedEntry | undefined): SyncRunRecord[] {
  return error instanceof CrossFileGateError ? crossFileGateRecords(error) : [failureRecord(error, current)];
}

function failureRecord(error: unknown, current: TrackedEntry | undefined): LeagueMismatchRecord | RunFailureRecord {
  if (error instanceof LeagueMismatchError) {
    return {
      kind: 'league-mismatch',
      configuredLeague: error.configuredLeague,
      availableLeagues: [...error.availableLeagues],
    };
  }
  const message = (error instanceof Error ? error.message : String(error)) || 'unknown error';
  if (error instanceof LeagueRequestRejectedError) {
    return { kind: 'run-failure', reason: 'trade-request-rejected', status: error.status, message };
  }
  if (error instanceof MalformedRequestError) {
    return {
      kind: 'run-failure',
      reason: 'trade-request-rejected',
      entryKey: error.entryKey,
      status: error.status,
      message,
    };
  }
  return {
    kind: 'run-failure',
    reason: 'unrecoverable-error',
    ...(!(current === undefined) && { entryKey: canonicalKey(current) }),
    message,
  };
}

export async function runChunk(ports: ChunkPorts): Promise<ChunkOutcome> {
  const { fs, clock, pid, git, requests, session } = ports;
  const log = ports.log ?? writeStderr;

  const acquisition = await acquireLock(fs, clock, pid);
  if (acquisition.kind === 'busy') {
    const holder =
      acquisition.holder === undefined
        ? 'an unreadable lock'
        : `pid ${String(acquisition.holder.pid)} since ${acquisition.holder.startedAt}`;
    log(`sync: another run holds the lock (${holder}); nothing to do this invocation`);
    return { kind: 'busy', completed: [], entries: [], records: [] };
  }

  const mine = acquisition.lock;
  const runStartedAt = mine.startedAt;
  const requestsAtStart = requests.snapshot();
  const records: SyncRunRecord[] = acquisition.broken === undefined ? [] : [acquisition.broken];

  try {
    // The penalty memory (AD-8, IMPLEMENTATION-NOTES.md §5.3) is read between
    // the lock and every other load. A progress file this build cannot read
    // is thrown at its usual place below, so it still fails the run with a
    // report; it can defer nothing.
    let progress: SyncProgressFile | undefined;
    let progressFault: { readonly error: unknown } | undefined;
    try {
      progress = await loadEnvelope(fs, PROGRESS_PATH, (data) =>
        parseEnvelope(SyncProgressFileSchema, data),
      );
    } catch (error) {
      progressFault = { error };
    }
    const notBefore = progress?.notBefore;
    if (notBefore !== undefined && Date.parse(clock.now()) < Date.parse(notBefore)) {
      log(
        `sync: a previous chunk set a pause until ${notBefore} (a 429 or a rejected request); nothing sent this invocation`,
      );
      // The one write: a broken stale lock's record is the only trace of the
      // crash, so the report carries it alone.
      if (acquisition.broken !== undefined && (await holdsLock(fs, mine))) {
        const previous = await loadEnvelope(fs, REPORT_PATH, (data) =>
          parseEnvelope(SyncReportFileSchema, data),
        );
        await writeArtifact(
          fs,
          REPORT_PATH,
          SyncReportFileSchema,
          buildSyncReport({
            previous,
            newRecords: records,
            figures: {
              requestsBySource: {},
              notReachedCount: 0,
              // The pause is no re-read of the weights file: the figure stays.
              ...(!(previous?.figures.coverage === undefined ||
              previous.figures.rankableClassCount === undefined) && {
                    coverage: previous.figures.coverage,
                    rankableClassCount: previous.figures.rankableClassCount,
                  }),
            },
            runStartedAt,
            runFinishedAt: clock.now(),
          }),
        );
      }
      return { kind: 'deferred', completed: [], entries: [], records, notBefore };
    }

    // The hold-off across processes (§13.1): after the lock and the
    // `notBefore` check, a due `authHoldOffUntil` settles a valid value
    // `held-off`, so this run sends no probe.
    ports.auth?.settleHeldOffIfDue(progress?.authHoldOffUntil, clock.now());

    // Read first and outside the failure path: a report this build cannot
    // read is refused with nothing written, so the player's records are never
    // overwritten by a file that lost them (NFR-8).
    const previousReport = await loadEnvelope(fs, REPORT_PATH, (data) =>
      parseEnvelope(SyncReportFileSchema, data),
    );

    // State the failure path reads as well as the normal one.
    let dataset: DatasetFile | undefined;
    let setup: ChunkSetup | undefined;
    let order: ChunkOrder | undefined;
    let entries: readonly TrackedEntry[] = [];
    /** Both fields or neither (AD-27); set once the weights file is read. */
    let coverageFigures: { coverage?: number; rankableClassCount?: number } =
      previousReport?.figures.coverage === undefined || previousReport.figures.rankableClassCount === undefined
        ? {}
        : {
            // A failure before the weights read is no re-read: the figure stays, as on the pause.
            coverage: previousReport.figures.coverage,
            rankableClassCount: previousReport.figures.rankableClassCount,
          };
    let current: TrackedEntry | undefined;
    let attempted = 0;
    let publishAttempted = false;
    /** Set once the league gate passed (or there is none): only then is the configured league confirmed. */
    let gatePassed = false;
    let reportAttempted = false;
    const completed: string[] = [];
    const stepEntries: DatasetEntry[] = [];
    /** The run-start check's offline marks (AD-9). They publish beneath the step entries. */
    let marked: readonly DatasetEntry[] = [];
    /** The run-start records: `unresolvable`, then `weights-absent` or `uncatalogued-weights-id`. */
    const checkRecords: SyncRunRecord[] = [];
    /** The records the steps raised, in visiting order. */
    const stepRecords: SyncRunRecord[] = [];
    // Only rotation completions enter the pass: row 1 is exempt (AD-7).
    const rotationCompleted: string[] = [];
    let pinnedVisited = 0;
    let discoveredAllowance: number | undefined;
    let truncated = false;

    /**
     * Where the report's request figure counts from: this chunk's start, or,
     * inside a session pass this chunk did not start, the pass's start.
     */
    const countFrom = (): RequestsBySource =>
      session?.requestsSince !== undefined && order !== undefined && !order.newPass
        ? session.requestsSince
        : requestsAtStart;

    /**
     * The session fields of an outcome reached once the order exists. Only a
     * session's chunk carries them, so a batch outcome is unchanged.
     */
    const passNow = (): { readonly newPass?: boolean; readonly confirmedLeague?: string } =>
      session === undefined
        ? {}
        : {
            ...(!(order === undefined) && { newPass: order.newPass }),
            ...(gatePassed && setup !== undefined && { confirmedLeague: setup.publication.league }),
          };

    const starvationNow = (): { readonly pinnedStarvation?: ChunkStarvation } =>
      truncated
        ? {
            pinnedStarvation: {
              discoveredAllowance: discoveredAllowance ?? 0,
              pinnedCount: entries.filter((entry) => entry.status === 'pinned').length,
              pinnedRefreshed: pinnedVisited,
              activeRefreshed: rotationCompleted.length,
            },
          }
        : {};

    /**
     * This chunk's records: the broken lock, the run-start check, the steps,
     * then the starvation, then any failure.
     */
    const newRecords = (failure: readonly SyncRunRecord[] = []): SyncRunRecord[] => {
      const { pinnedStarvation } = starvationNow();
      return [
        ...records,
        ...checkRecords,
        ...stepRecords,
        // Truncation happens only in the rotation, which runs only after `load`.
        ...(pinnedStarvation === undefined || setup === undefined
          ? []
          : [setup.starvationRecord(pinnedStarvation)]),
        ...failure,
      ];
    };

    /**
     * Dataset first, then progress, so progress never records a completion the
     * dataset does not publish. `until` is the `notBefore` this ending writes;
     * absent clears the field. Called once per run at most.
     */
    const publish = async (
      publication: ChunkPublication,
      published: readonly DatasetEntry[],
      until: string | undefined,
    ): Promise<void> => {
      publishAttempted = true;
      await writeArtifact(
        fs,
        DATASET_PATH,
        DatasetFileSchema,
        buildDatasetFile({
          tracked: entries,
          previous: dataset?.entries ?? [],
          // A step entry for the same key wins over an offline mark.
          stepEntries: [...marked, ...published],
          // An unconfirmed league never relabels the dataset: before the gate
          // passed, the previously published label stands (AD-19).
          league: gatePassed ? publication.league : (dataset?.league ?? publication.league),
          currencyRates: publication.currencyRates,
          now: clock.now(),
        }),
      );
      // The holder's pending hold-off action (§13.3): `write` sets the field
      // from this write's `now`, `clear` removes it, and none carries the
      // loaded value forward.
      const holdOff = ports.auth?.pendingHoldOff();
      const authHoldOffUntil =
        holdOff === 'write'
          ? new Date(Date.parse(clock.now()) + AUTH_HOLD_OFF_MS).toISOString()
          : (holdOff === 'clear'
            ? undefined
            : progress?.authHoldOffUntil);
      const progressFile: SyncProgressFile = {
        schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION,
        completed: [...new Set([...(order?.completed ?? []), ...rotationCompleted])].toSorted(
          compareCanonicalKeys,
        ),
        ...(!(until === undefined) && { notBefore: until }),
        ...(!(authHoldOffUntil === undefined) && { authHoldOffUntil }),
      };
      await writeArtifact(fs, PROGRESS_PATH, SyncProgressFileSchema, progressFile);
      if (holdOff !== undefined) {
        ports.auth?.holdOffApplied(holdOff);
      }
    };

    const writeReport = async (
      chunkRecords: readonly SyncRunRecord[],
      runFinishedAt?: string,
    ): Promise<void> => {
      // Every entry the order made eligible that the chunk did not attempt (AD-7).
      const eligible = order === undefined ? 0 : order.pinned.length + order.rotation.length;
      const trackedListEditedAt = await resolveTrackedListAge({
        git,
        filesystem: fs,
        path: TRACKED_PATH,
      });
      const report = buildSyncReport({
        previous: previousReport,
        newRecords: chunkRecords,
        figures: {
          requestsBySource: requestsBetween(countFrom(), requests.snapshot()),
          notReachedCount: Math.max(0, eligible - attempted),
          ...(!(trackedListEditedAt === undefined) && { trackedListEditedAt }),
          ...coverageFigures,
        },
        runStartedAt,
        runFinishedAt,
      });
      reportAttempted = true;
      await writeArtifact(fs, REPORT_PATH, SyncReportFileSchema, report);
    };

    try {
      if (progressFault !== undefined) {
        throw progressFault.error;
      }
      const tracked = await loadEnvelope(fs, TRACKED_PATH, parseTrackedFile, explainTrackedVersion);
      entries = tracked?.entries ?? [];
      // Absent means every entry is never attempted.
      dataset = await loadEnvelope(fs, DATASET_PATH, (data) =>
        parseEnvelope(DatasetFileSchema, data),
      );
      // The shell's loads: config, rates, item types and the pinned cap. The
      // step and the gate need config values, so the shell builds them here,
      // on the dataset loaded under this lock.
      const ready = await ports.load({ entries, dataset: dataset?.entries ?? [] });
      setup = ready;
      const catalogue = await ports.catalogue();
      if (!catalogue.ok) {
        throw catalogue.error;
      }
      // An absent file is recorded and the run goes on (AD-12); a present one
      // has its ids checked, report-only (AD-9); an unknown major throws.
      const weights = await readWeightsIds(fs);
      coverageFigures = (weights.kind === 'present' ? poolCoverage(entries, weights.file) : undefined) ?? {};

      // The run-start catalogue check (AD-9, AD-25): offline, before any
      // request, and never a stamp. A miss is marked, reported and kept out of
      // this order; a recovered entry enters it as an ordinary entry (AD-7).
      const check = checkCatalogue(entries, dataset?.entries ?? [], catalogue.value);
      marked = check.marked;
      checkRecords.push(...check.records);
      checkRecords.push(
        ...(weights.kind === 'absent'
          ? [weightsAbsentRecord(entries)]
          : checkWeightsIds(weights, catalogue.value)),
      );
      // The cross-file gate (AD-12, AD-17): `core`'s five checks, before the
      // order exists. A failure throws, so nothing is published and progress
      // is untouched; the report carries one record per failure.
      crossFileGate(entries, weights.kind === 'present' ? weights.file : null);

      const plan = chunkOrder({
        tracked: entries.filter((entry) => !check.excludedKeys.has(canonicalKey(entry))),
        dataset: check.orderDataset,
        completed: progress?.completed ?? [],
        now: clock.now(),
        ...(!(session?.pinnedMaxAgeMs === undefined) && { pinnedMaxAgeMs: session.pinnedMaxAgeMs }),
      });
      order = plan;

      // The league gate, the only run-start check that costs a request (AD-12).
      // A session skips it while an earlier chunk's confirmation still holds:
      // the same league, and the same pass.
      const alreadyConfirmed =
        session?.confirmedLeague !== undefined &&
        !plan.newPass &&
        session.confirmedLeague === ready.publication.league;
      const gated =
        ready.gate === undefined || alreadyConfirmed ? undefined : await ready.gate({ entries });
      if (gated?.kind === 'yield') {
        // A gate yield is a chunk yield with no entry attempted (AD-8, AD-12).
        if (!(await holdsLock(fs, mine))) {
          log('sync: the lock was taken over during this chunk; writing nothing');
          return { kind: 'dispossessed', completed, entries: stepEntries, records, ...passNow() };
        }
        log('sync: the league check got no answer; the chunk yields with no entry attempted');
        await publish(
          ready.publication,
          [],
          gated.retryAfterMs === undefined
            ? undefined
            : notBeforeAfter429(clock.now(), gated.retryAfterMs),
        );
        await writeReport(newRecords(), clock.now());
        return { kind: 'yielded', completed, entries: stepEntries, records, ...passNow() };
      }
      gatePassed = true;

      let ending:
        | { readonly kind: 'completed' }
        | { readonly kind: 'yielded'; readonly sessionExpired?: true }
        | { readonly kind: 'bounded'; readonly bound: ChunkBound } = { kind: 'completed' };
      /** The `notBefore` this ending writes: set only by a step's 429 or a latched probe 429 (§5.3, §13.3). */
      let until: string | undefined;

      const rotationWaiting = plan.rotation.length > 0;
      let pinnedLimit = plan.pinned.length;
      let rotationVisited = 0;

      for (;;) {
        const inPinned = pinnedVisited < pinnedLimit;
        const entry = inPinned ? plan.pinned[pinnedVisited] : plan.rotation[rotationVisited];
        if (entry === undefined) {
          break;
        }
        current = entry;
        attempted += 1;
        const result = await ready.step(entry);
        current = undefined;
        if (result.entry !== undefined) {
          stepEntries.push(result.entry);
        }
        if (result.kind === 'completed' && result.records !== undefined) {
          stepRecords.push(...result.records);
        }
        if (result.kind === 'yielded') {
          // A downgrade writes no `notBefore` and tells the session (§13.4).
          ending = result.sessionExpired === true ? { kind: 'yielded', sessionExpired: true } : { kind: 'yielded' };
          if (result.retryAfterMs !== undefined) {
            until = notBeforeAfter429(clock.now(), result.retryAfterMs);
          }
          break;
        }
        const key = canonicalKey(entry);
        completed.push(key);

        if (inPinned) {
          pinnedVisited += 1;
          const remaining = result.searchRemaining;
          if (remaining !== undefined) {
            // Every step so far spent one search, the reporting one included.
            discoveredAllowance ??= remaining + completed.length;
            const left = pinnedLimit - pinnedVisited;
            // R < P + 1 with rows 2–3 waiting is starvation, even when nothing is left to cut.
            if (rotationWaiting && remaining < left + 1) {
              truncated = true;
            }
            pinnedLimit = pinnedVisited + pinnedToKeep(left, remaining, rotationWaiting);
          }
        } else {
          rotationVisited += 1;
          rotationCompleted.push(key);
        }

        const hasNext = pinnedVisited < pinnedLimit || rotationVisited < plan.rotation.length;
        const bound = boundOf(result);
        if (bound !== undefined && hasNext) {
          ending = { kind: 'bounded', bound };
          break;
        }
        if (hasNext && session?.maxEntries !== undefined && attempted >= session.maxEntries) {
          ending = { kind: 'bounded', bound: 'entries' };
          break;
        }
      }

      // A probe 429 settles nothing and ends the chunk as a 429 yield, also
      // when no further request followed it in this chunk (§13.3).
      const latchedMs = ports.latchedRetryAfterMs?.();
      if (latchedMs !== undefined) {
        ending = { kind: 'yielded' };
        until = notBeforeAfter429(clock.now(), latchedMs);
      }

      const starvation = starvationNow();

      // Re-read immediately before committing. A run dispossessed at the
      // staleness threshold writes nothing, and the `finally` below then
      // releases nothing, because the lock on disk is no longer its own.
      if (!(await holdsLock(fs, mine))) {
        log('sync: the lock was taken over during this chunk; writing nothing');
        return {
          kind: 'dispossessed',
          completed,
          entries: stepEntries,
          records,
          ...starvation,
          ...passNow(),
        };
      }

      await publish(ready.publication, stepEntries, until);
      await writeReport(newRecords(), clock.now());

      return { ...ending, completed, entries: stepEntries, records, ...starvation, ...passNow() };
    } catch (error) {
      // A report that could not be written is not written again.
      if (reportAttempted) {
        throw error;
      }
      if (!(await holdsLock(fs, mine))) {
        log('sync: the lock was taken over during this chunk; writing nothing');
        throw error;
      }
      // The original error is always the one rethrown: a fault in a
      // failure-path write goes to the log, and the report is still attempted
      // after a failed publication.
      const secondary = (what: string, fault: unknown): void => {
        log(`sync: ${what} failed on the failure path: ${String(fault)}`);
      };
      if (error instanceof LeagueMismatchError) {
        // The run's premise is wrong: the report alone, with this chunk's lock
        // record and the mismatch; the check's marks and records are discarded
        // with the dataset write (AD-12).
        try {
          await writeReport([...records, ...failureRecords(error, current)]);
        } catch (error_) {
          secondary('writing the report', error_);
        }
        throw error;
      }
      if (order !== undefined && setup !== undefined && !publishAttempted) {
        // Once the order exists a throw publishes what the chunk has: the
        // step entries so far and the marks. A rejected request also
        // publishes the failing entry as the step left it and remembers the
        // abort as `notBefore` (AD-9, §5.3); every other throw clears it. An
        // unexpected search or fetch body also publishes the failing entry with
        // `lastAttemptedAt` stamped; after a fetch it keeps the answered
        // search's fields (AD-9).
        const malformed = error instanceof MalformedRequestError;
        // The gate's non-429 4xx is a rejected request too, and would be
        // refused again on the next tick: it writes the same abort `notBefore`.
        const rejected = malformed || error instanceof LeagueRequestRejectedError;
        const failing =
          (malformed || error instanceof UnexpectedTradeResponseError) ? error.entry : undefined;
        // A probe 429 latched before the throw still persists its penalty (§13.3).
        const latchedMs = rejected ? undefined : ports.latchedRetryAfterMs?.();
        try {
          await publish(
            setup.publication,
            failing === undefined ? stepEntries : [...stepEntries, failing],
            rejected
              ? notBeforeAfterAbort(clock.now())
              : (latchedMs === undefined
                ? undefined
                : notBeforeAfter429(clock.now(), latchedMs)),
          );
        } catch (error_) {
          secondary('publishing the dataset and progress', error_);
        }
      }
      try {
        await writeReport(newRecords(failureRecords(error, current)));
      } catch (error_) {
        secondary('writing the report', error_);
      }
      throw error;
    }
  } finally {
    await releaseLockIfOwn(fs, mine);
  }
}
