/**
 * One bounded, resumable, single-instance chunk (AD-7, FR-19). The run-start sequence under the lock is AD-12's cost order.
 * A throw writes the report, and the dataset and progress once the order exists (AD-12, IMPLEMENTATION-NOTES.md §5.3).
 */

import {
  canonicalKey,
  DatasetFileSchema,
  parseEnvelope,
  SyncProgressFileSchema,
  SyncReportFileSchema,
} from '@poe/contracts';
import type {
  ClockPort,
  CurrencyRate,
  DatasetEntry,
  FilesystemPort,
  GitPort,
  SyncProgressFile,
  SyncRunRecord,
  TrackedEntry,
} from '@poe/contracts';
import { chunkOrder, pinnedToKeep, poolCoverage } from '@poe/core';

import type { CatalogueIds } from '../catalogue/catalogue-ids.ts';
import { checkWeightsIds, readWeightsIds, weightsAbsentRecord } from '../catalogue/weights-ids.ts';
import { LeagueMismatchError, LeagueRequestRejectedError } from '../league/league-gate.ts';
import { explainTrackedVersion, parseTrackedFile } from '../load-data-file.ts';
import type { DataFileResult } from '../load-data-file.ts';
import { MalformedRequestError, UnexpectedTradeResponseError } from '../pricing/price-entry.ts';
import type { RequestsBySource } from '../request-counter.ts';
import { writeArtifact } from '../write-artifact.ts';
import { checkCatalogue } from './catalogue-check.ts';
import { crossFileGate } from './cross-file-gate.ts';
import { acquireLock, isLockHeld, isOwnLockReleased } from './lock.ts';
import { DATASET_PATH, PROGRESS_PATH, REPORT_PATH, TRACKED_PATH } from './run-chunk/data-paths.ts';
import { failureRecords } from './run-chunk/failure-records.ts';
import { loadEnvelope } from './run-chunk/load-envelope.ts';
import { failureNotBefore, notBeforeAfter429 } from './run-chunk/not-before.ts';
import { publish } from './run-chunk/publish-artifacts.ts';
import { carriedCoverage, createRunState, newRecords, passNow, starvationNow } from './run-chunk/run-state.ts';
import { writeReport } from './run-chunk/write-report.ts';
import { buildSyncReport } from './sync-report.ts';

export { DATASET_PATH, PROGRESS_PATH, REPORT_PATH, TRACKED_PATH } from './run-chunk/data-paths.ts';

/** What one step reports for one entry: an absent allowance bounds nothing, and `yielded` stops the chunk now. */
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
      /** Set only on a `429`: the delay the chunk writes into `notBefore` (IMPLEMENTATION-NOTES.md §5.3). */
      readonly retryAfterMs?: number;
      /** Set only on AD-30's `session-expired` downgrade: no `notBefore`, and the session waits `backoff(1)` (IMPLEMENTATION-NOTES.md §13.4). */
      readonly sessionExpired?: true;
    };

export type ChunkStep = (entry: TrackedEntry) => Promise<StepResult>;

/** The runner's two narrow ports onto the process auth holder, so it never reaches the cookie (AD-30, IMPLEMENTATION-NOTES.md §13.1). */
interface ChunkAuth {
  /** Called once after the lock and the `notBefore` check: a due hold-off settles `held-off` and no probe goes out. */
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

/** `yield` is a chunk yield with no entry attempted (AD-8): the gate got no answer to check against. */
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
  /** Turns starvation into a report record with the declared yardstick, which this directory never reads (FR-25). */
  readonly starvationRecord: (starvation: ChunkStarvation) => SyncRunRecord;
  /** The run-start league gate, after the order and before any step: a throw aborts, a `yield` ends the chunk `yielded`. */
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
  /** The shell's per-source request counter (`../request-counter.ts`); the report carries what it counted since the lock. */
  readonly requests: { snapshot(): RequestsBySource };
  /** The shell's loads under the lock (AD-12), after the dataset and before the catalogue; a throw aborts before any request. */
  readonly load: (context: ChunkLoadContext) => Promise<ChunkSetup>;
  /** The committed catalogue's id sets, loaded after `load`; a refusal aborts with a `run-failure` record before any request. */
  readonly catalogue: () => Promise<DataFileResult<CatalogueIds>>;
  /** The retry delay of a latched probe `429`, read after the step loop: it makes the chunk a `429` yield (IMPLEMENTATION-NOTES.md §13.3). */
  readonly latchedRetryAfterMs?: () => number | undefined;
  /** The live shells' auth holder ports; omitted, nothing settles `held-off` and progress carries the hold-off forward. */
  readonly auth?: ChunkAuth;
  /** One line of operator output. Defaults to stderr. */
  readonly log?: (line: string) => void;
  /** Set only by the `pnpm sync` session (`../sync.ts`), one chunk per entry (AD-7); absent, the chunk is the batch chunk. */
  readonly session?: ChunkSession;
}

/** What the session tells each of its chunks. Every field is optional. */
export interface ChunkSession {
  /** The chunk attempts at most this many entries; reaching it with an entry left ends the chunk `bounded` by `'entries'`. */
  readonly maxEntries?: number;
  /** The request counter's snapshot at the pass start, so `requestsBySource` covers the pass; a new pass counts from its own start. */
  readonly requestsSince?: RequestsBySource;
  /** The league an earlier chunk confirmed: the gate is skipped while it equals the configured league within the same pass. */
  readonly confirmedLeague?: string;
  /** Row 1's stale-pinned rule (`chunkOrder`'s `pinnedMaxAgeMs`). */
  readonly pinnedMaxAgeMs?: number;
}

/** `'entries'` is reached only under a session's `maxEntries`. */
export type ChunkBound = 'search' | 'fetch' | 'entries';

interface ChunkOutcomeBase {
  /** Canonical keys this chunk completed in visiting order, row 1 included; progress records only rows 2–3. */
  readonly completed: readonly string[];
  /** The dataset entries the steps returned in visiting order; `busy` and `dispossessed` publish nothing. */
  readonly entries: readonly DatasetEntry[];
  /** The lock records this chunk produced; the report adds the starvation record through `starvationRecord`. */
  readonly records: readonly SyncRunRecord[];
  /** Present when a pinned step reported an allowance below the pinned entries left plus one while rotation work waited (AD-7, IMPLEMENTATION-NOTES.md §6); the kind is unchanged. */
  readonly pinnedStarvation?: ChunkStarvation;
  /** A session's chunk only, once the order exists: `true` when this chunk's order started a new pass. */
  readonly newPass?: boolean;
  /** A session's chunk only: the configured league, present when this chunk confirmed it. */
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
      /** `true` only on AD-30's `session-expired` yield, which reset the pacing state in place, so the session waits `backoff(1)` (IMPLEMENTATION-NOTES.md §13.4). */
      readonly sessionExpired?: true;
    })
  | (ChunkOutcomeBase & { readonly kind: 'busy' })
  /** A previous 429 or malformed-request abort wrote a `notBefore` still ahead: nothing sent or written (AD-8, IMPLEMENTATION-NOTES.md §5.3). */
  | (ChunkOutcomeBase & { readonly kind: 'deferred'; readonly notBefore: string })
  | (ChunkOutcomeBase & { readonly kind: 'dispossessed' });

export type ChunkOutcomeKind = ChunkOutcome['kind'];

/** The operator log's default sink: one line on stderr. */
export const writeStderr = (line: string): void => {
  process.stderr.write(`${line}\n`);
};

function boundOf(step: Extract<StepResult, { kind: 'completed' }>): ChunkBound | undefined {
  if (step.searchRemaining !== undefined && step.searchRemaining < 1) {
    return 'search';
  }
  return step.fetchRemaining !== undefined && step.fetchRemaining < 1 ? 'fetch' : undefined;
}

export async function runChunk(ports: ChunkPorts): Promise<ChunkOutcome> {
  const { fs, clock, pid, requests, session } = ports;
  const log = ports.log ?? writeStderr;
  // The original error is always the one rethrown: a fault in a
  // failure-path write goes to the log, and the report is still attempted
  // after a failed publication.
  const secondary = (what: string, fault: unknown): void => {
    log(`sync: ${what} failed on the failure path: ${String(fault)}`);
  };

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
    // The penalty memory (AD-8, IMPLEMENTATION-NOTES.md §5.3) is read before every other load; an unreadable progress file is thrown later, so it still fails the run with a report.
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
      if (acquisition.broken !== undefined && (await isLockHeld(fs, mine))) {
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
              ...carriedCoverage(previous),
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

    const state = createRunState({ ports, log, mine, requestsAtStart, records, progress, previousReport });

    try {
      if (progressFault !== undefined) {
        throw progressFault.error;
      }
      const tracked = await loadEnvelope(fs, TRACKED_PATH, parseTrackedFile, explainTrackedVersion);
      state.entries = tracked?.entries ?? [];
      const { entries } = state;
      // Absent means every entry is never attempted.
      state.dataset = await loadEnvelope(fs, DATASET_PATH, (data) =>
        parseEnvelope(DatasetFileSchema, data),
      );
      // The shell's loads: config, rates, item types and the pinned cap. The
      // step and the gate need config values, so the shell builds them here,
      // on the dataset loaded under this lock.
      const ready = await ports.load({ entries, dataset: state.dataset?.entries ?? [] });
      state.setup = ready;
      const catalogue = await ports.catalogue();
      if (!catalogue.ok) {
        throw catalogue.error;
      }
      // An absent file is recorded and the run goes on (AD-12); a present one
      // has its ids checked, report-only (AD-9); an unknown major throws.
      const weights = await readWeightsIds(fs);
      state.coverageFigures = (weights.kind === 'present' ? poolCoverage(entries, weights.file) : undefined) ?? {};

      // The run-start catalogue check (AD-9, AD-25): offline, before any
      // request, and never a stamp. A miss is marked, reported and kept out of
      // this order; a recovered entry enters it as an ordinary entry (AD-7).
      const check = checkCatalogue(entries, state.dataset?.entries ?? [], catalogue.value);
      state.marked = check.marked;
      state.checkRecords.push(
        ...check.records,
        ...(weights.kind === 'absent'
          ? [weightsAbsentRecord(entries)]
          : checkWeightsIds(weights, catalogue.value)),
      );
      // The cross-file gate (AD-12, AD-17): `core`'s five checks, before the
      // order exists. A failure throws, so nothing is published and progress
      // is untouched; the report carries one record per failure.
      crossFileGate(entries, weights.kind === 'present' ? weights.file : undefined);

      const plan = chunkOrder({
        tracked: entries.filter((entry) => !check.excludedKeys.has(canonicalKey(entry))),
        dataset: check.orderDataset,
        completed: progress?.completed ?? [],
        now: clock.now(),
        ...(session?.pinnedMaxAgeMs !== undefined && { pinnedMaxAgeMs: session.pinnedMaxAgeMs }),
      });
      state.order = plan;

      // The league gate, the only run-start check that costs a request (AD-12).
      // A session skips it while an earlier chunk's confirmation still holds:
      // the same league, and the same pass.
      const isAlreadyConfirmed =
        session?.confirmedLeague !== undefined &&
        !plan.newPass &&
        session.confirmedLeague === ready.publication.league;
      const gated =
        isAlreadyConfirmed || ready.gate === undefined ? undefined : await ready.gate({ entries });
      if (gated?.kind === 'yield') {
        // A gate yield is a chunk yield with no entry attempted (AD-8, AD-12).
        if (!(await isLockHeld(fs, mine))) {
          log('sync: the lock was taken over during this chunk; writing nothing');
          return { kind: 'dispossessed', completed: state.completed, entries: state.stepEntries, records, ...passNow(state) };
        }
        log('sync: the league check got no answer; the chunk yields with no entry attempted');
        await publish(
          state,
          ready.publication,
          [],
          gated.retryAfterMs === undefined
            ? undefined
            : notBeforeAfter429(clock.now(), gated.retryAfterMs),
        );
        await writeReport(state, newRecords(state), clock.now());
        return { kind: 'yielded', completed: state.completed, entries: state.stepEntries, records, ...passNow(state) };
      }
      state.isGatePassed = true;

      let ending:
        | { readonly kind: 'completed' }
        | { readonly kind: 'yielded'; readonly sessionExpired?: true }
        | { readonly kind: 'bounded'; readonly bound: ChunkBound } = { kind: 'completed' };
      /** The `notBefore` this ending writes: set only by a step's 429 or a latched probe 429 (§5.3, §13.3). */
      let until: string | undefined;

      const isRotationWaiting = plan.rotation.length > 0;
      let pinnedLimit = plan.pinned.length;
      let rotationVisited = 0;

      for (;;) {
        const isInPinned = state.pinnedVisited < pinnedLimit;
        const entry = isInPinned ? plan.pinned[state.pinnedVisited] : plan.rotation[rotationVisited];
        if (entry === undefined) {
          break;
        }
        state.current = entry;
        state.attempted += 1;
        // eslint-disable-next-line no-await-in-loop -- sequential on purpose: one step per entry in plan order, each step's pacing and bounds depend on the last
        const result = await ready.step(entry);
        state.current = undefined;
        if (result.entry !== undefined) {
          state.stepEntries.push(result.entry);
        }
        if (result.kind === 'completed' && result.records !== undefined) {
          state.stepRecords.push(...result.records);
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
        state.completed.push(key);

        if (isInPinned) {
          state.pinnedVisited += 1;
          const remaining = result.searchRemaining;
          if (remaining !== undefined) {
            // Every step so far spent one search, the reporting one included.
            state.discoveredAllowance ??= remaining + state.completed.length;
            const left = pinnedLimit - state.pinnedVisited;
            // R < P + 1 with rows 2–3 waiting is starvation, even when nothing is left to cut.
            if (isRotationWaiting && remaining < left + 1) {
              state.isTruncated = true;
            }
            pinnedLimit = state.pinnedVisited + pinnedToKeep(left, remaining, isRotationWaiting);
          }
        } else {
          rotationVisited += 1;
          state.rotationCompleted.push(key);
        }

        const hasNext = state.pinnedVisited < pinnedLimit || rotationVisited < plan.rotation.length;
        const bound = boundOf(result);
        if (bound !== undefined && hasNext) {
          ending = { kind: 'bounded', bound };
          break;
        }
        if (hasNext && session?.maxEntries !== undefined && state.attempted >= session.maxEntries) {
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

      const starvation = starvationNow(state);

      // Re-read immediately before committing. A run dispossessed at the
      // staleness threshold writes nothing, and the `finally` below then
      // releases nothing, because the lock on disk is no longer its own.
      if (!(await isLockHeld(fs, mine))) {
        log('sync: the lock was taken over during this chunk; writing nothing');
        return {
          kind: 'dispossessed',
          completed: state.completed,
          entries: state.stepEntries,
          records,
          ...starvation,
          ...passNow(state),
        };
      }

      await publish(state, ready.publication, state.stepEntries, until);
      await writeReport(state, newRecords(state), clock.now());

      return { ...ending, completed: state.completed, entries: state.stepEntries, records, ...starvation, ...passNow(state) };
    } catch (error) {
      // A report that could not be written is not written again.
      if (state.isReportAttempted) {
        throw error;
      }
      if (!(await isLockHeld(fs, mine))) {
        log('sync: the lock was taken over during this chunk; writing nothing');
        throw error;
      }
      if (error instanceof LeagueMismatchError) {
        // The run's premise is wrong: the report alone, with this chunk's lock
        // record and the mismatch; the check's marks and records are discarded
        // with the dataset write (AD-12).
        try {
          await writeReport(state, [...records, ...failureRecords(error, state.current)]);
        } catch (error_) {
          secondary('writing the report', error_);
        }
        throw error;
      }
      if (state.order !== undefined && state.setup !== undefined && !state.isPublishAttempted) {
        // A throw once the order exists publishes the step entries and the marks, plus the failing entry for a rejected
        // request or an unexpected body, which keeps an answered search's fields (AD-9, IMPLEMENTATION-NOTES.md §5.3).
        const isMalformed = error instanceof MalformedRequestError;
        // The gate's non-429 4xx is a rejected request too, and would be
        // refused again on the next tick: it writes the same abort `notBefore`.
        const isRejected = isMalformed || error instanceof LeagueRequestRejectedError;
        const failing =
          (isMalformed || error instanceof UnexpectedTradeResponseError) ? error.entry : undefined;
        // A probe 429 latched before the throw still persists its penalty (§13.3).
        const latchedMs = isRejected ? undefined : ports.latchedRetryAfterMs?.();
        try {
          await publish(
            state,
            state.setup.publication,
            failing === undefined ? state.stepEntries : [...state.stepEntries, failing],
            failureNotBefore(clock.now(), isRejected, latchedMs),
          );
        } catch (error_) {
          secondary('publishing the dataset and progress', error_);
        }
      }
      try {
        await writeReport(state, newRecords(state, failureRecords(error, state.current)));
      } catch (error_) {
        secondary('writing the report', error_);
      }
      throw error;
    }
  } finally {
    await isOwnLockReleased(fs, mine);
  }
}
