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
 * abort writes `now + staleLockAfter`; every other ending that writes
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
 *   the `league-mismatch` record; the catalogue check's marks and records are
 *   discarded, since the next run that passes the gate recomputes them
 *   (AD-12);
 * - any other throw once the order exists: first the dataset and progress
 *   for the step entries so far and the marks, then the report. A
 *   `MalformedRequestError` (a non-429 4xx, AD-9) also publishes the failing
 *   entry as the step left it and writes the abort `notBefore`; every other
 *   throw clears `notBefore`.
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
  TrackedFileSchema,
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
import { chunkOrder, pinnedToKeep } from '@poe/core';
import type { ChunkOrder } from '@poe/core';

import type { CatalogueIds } from '../catalogue/catalogue-ids.ts';
import { checkWeightsIds, readWeightsIds, weightsAbsentRecord } from '../catalogue/weights-ids.ts';
import { LeagueMismatchError, LeagueRequestRejectedError } from '../league/league-gate.ts';
import type { DataFileResult } from '../load-data-file.ts';
import { MalformedRequestError } from '../pricing/price-entry.ts';
import { requestsBetween } from '../request-counter.ts';
import type { RequestsBySource } from '../request-counter.ts';
import { writeArtifact } from '../write-artifact.ts';
import { checkCatalogue } from './catalogue-check.ts';
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
    };

export type ChunkStep = (entry: TrackedEntry) => Promise<StepResult>;

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
  /** One line of operator output. Defaults to stderr. */
  readonly log?: (line: string) => void;
}

export type ChunkBound = 'search' | 'fetch';

interface ChunkOutcomeBase {
  /**
   * Canonical keys this chunk completed, in visiting order, row 1 (pinned)
   * included. Progress records only the rows 2–3 subset of these.
   */
  readonly completed: readonly string[];
  /**
   * The dataset entries the steps returned, in visiting order — completed and
   * yielded alike. `completed`, `bounded` and `yielded` publish them into the
   * dataset; `busy` and `dispossessed` write nothing. A throw after the order
   * exists still publishes them, a league mismatch excepted.
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
  | (ChunkOutcomeBase & { readonly kind: 'yielded' })
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

const writeStderr = (line: string): void => {
  process.stderr.write(`${line}\n`);
};

function describeRefusal(path: string, result: Exclude<EnvelopeResult<unknown>, { ok: true }>): string {
  switch (result.reason) {
    case 'unknown-major':
    case 'malformed-version':
      return `${path}: schemaVersion ${result.found} refused (${result.reason}; this build reads ${result.expected})`;
    case 'invalid':
      return `${path}: invalid: ${result.issues
        .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('; ')}`;
  }
}

async function loadEnvelope<T>(
  fs: FilesystemPort,
  path: string,
  parse: (data: unknown) => EnvelopeResult<T>,
): Promise<T | undefined> {
  const text = await fs.readTextFile(path);
  if (text === undefined) {
    return undefined;
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error(`${path}: not valid JSON: ${String(error)}`, { cause: error });
  }
  const result = parse(data);
  if (!result.ok) {
    throw new Error(describeRefusal(path, result));
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
  if (step.fetchRemaining !== undefined && step.fetchRemaining < 1) {
    return 'fetch';
  }
  return undefined;
}

/**
 * The record a throw leaves in the report. A league mismatch is its own
 * record, with the list the player corrects the configured league from
 * (AD-19). A non-429 4xx names its status, and its entry where it was on one:
 * the league gate's request names none. Any other throw names the entry the
 * step was on, where it was on one.
 */
function failureRecord(
  error: unknown,
  current: TrackedEntry | undefined,
): LeagueMismatchRecord | RunFailureRecord {
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
    ...(current === undefined ? {} : { entryKey: canonicalKey(current) }),
    message,
  };
}

export async function runChunk(ports: ChunkPorts): Promise<ChunkOutcome> {
  const { fs, clock, pid, git, requests } = ports;
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
            figures: { requestsBySource: {}, notReachedCount: 0 },
            runStartedAt,
            runFinishedAt: clock.now(),
          }),
        );
      }
      return { kind: 'deferred', completed: [], entries: [], records, notBefore };
    }

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
    const newRecords = (failure?: LeagueMismatchRecord | RunFailureRecord): SyncRunRecord[] => {
      const { pinnedStarvation } = starvationNow();
      return [
        ...records,
        ...checkRecords,
        ...stepRecords,
        // Truncation happens only in the rotation, which runs only after `load`.
        ...(pinnedStarvation === undefined || setup === undefined
          ? []
          : [setup.starvationRecord(pinnedStarvation)]),
        ...(failure === undefined ? [] : [failure]),
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
      const progressFile: SyncProgressFile = {
        schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION,
        completed: [...new Set([...(order?.completed ?? []), ...rotationCompleted])].toSorted(
          compareCanonicalKeys,
        ),
        ...(until === undefined ? {} : { notBefore: until }),
      };
      await writeArtifact(fs, PROGRESS_PATH, SyncProgressFileSchema, progressFile);
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
          requestsBySource: requestsBetween(requestsAtStart, requests.snapshot()),
          notReachedCount: Math.max(0, eligible - attempted),
          ...(trackedListEditedAt === undefined ? {} : { trackedListEditedAt }),
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
      const tracked = await loadEnvelope(fs, TRACKED_PATH, (data) =>
        parseEnvelope(TrackedFileSchema, data),
      );
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

      const plan = chunkOrder({
        tracked: entries.filter((entry) => !check.excludedKeys.has(canonicalKey(entry))),
        dataset: check.orderDataset,
        completed: progress?.completed ?? [],
        now: clock.now(),
      });
      order = plan;

      // The league gate, the only run-start check that costs a request (AD-12).
      const gated = ready.gate === undefined ? undefined : await ready.gate({ entries });
      if (gated?.kind === 'yield') {
        // A gate yield is a chunk yield with no entry attempted (AD-8, AD-12).
        if (!(await holdsLock(fs, mine))) {
          log('sync: the lock was taken over during this chunk; writing nothing');
          return { kind: 'dispossessed', completed, entries: stepEntries, records };
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
        return { kind: 'yielded', completed, entries: stepEntries, records };
      }
      gatePassed = true;

      let ending: { readonly kind: 'completed' } | { readonly kind: 'yielded' } | {
        readonly kind: 'bounded';
        readonly bound: ChunkBound;
      } = { kind: 'completed' };
      /** The `notBefore` this ending writes: set only by a step's 429 (§5.3). */
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
          ending = { kind: 'yielded' };
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
      }

      const starvation = starvationNow();

      // Re-read immediately before committing. A run dispossessed at the
      // staleness threshold writes nothing, and the `finally` below then
      // releases nothing, because the lock on disk is no longer its own.
      if (!(await holdsLock(fs, mine))) {
        log('sync: the lock was taken over during this chunk; writing nothing');
        return { kind: 'dispossessed', completed, entries: stepEntries, records, ...starvation };
      }

      await publish(ready.publication, stepEntries, until);
      await writeReport(newRecords(), clock.now());

      return { ...ending, completed, entries: stepEntries, records, ...starvation };
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
          await writeReport([...records, failureRecord(error, current)]);
        } catch (fault) {
          secondary('writing the report', fault);
        }
        throw error;
      }
      if (order !== undefined && setup !== undefined && !publishAttempted) {
        // Once the order exists a throw publishes what the chunk has: the
        // step entries so far and the marks. A rejected request also
        // publishes the failing entry as the step left it and remembers the
        // abort as `notBefore` (AD-9, §5.3); every other throw clears it.
        const malformed = error instanceof MalformedRequestError;
        try {
          await publish(
            setup.publication,
            malformed ? [...stepEntries, error.entry] : stepEntries,
            malformed ? notBeforeAfterAbort(clock.now()) : undefined,
          );
        } catch (fault) {
          secondary('publishing the dataset and progress', fault);
        }
      }
      try {
        await writeReport(newRecords(failureRecord(error, current)));
      } catch (fault) {
        secondary('writing the report', fault);
      }
      throw error;
    }
  } finally {
    await releaseLockIfOwn(fs, mine);
  }
}
