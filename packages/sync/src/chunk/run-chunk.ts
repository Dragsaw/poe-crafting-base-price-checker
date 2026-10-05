/** One bounded, resumable, single-instance chunk (AD-7, FR-19); failures: AD-12, IN §5.3. */

import { parseEnvelope, SyncReportFileSchema } from '@poe/contracts';
import type { ClockPort, CurrencyRate, DatasetEntry, FilesystemPort, GitPort, SyncLock, SyncRunRecord, TrackedEntry } from '@poe/contracts';

import type { CatalogueIds } from '../catalogue/catalogue-ids.ts';
import type { DataFileResult } from '../load-data-file.ts';
import type { RequestsBySource } from '../request-counter.ts';
import { acquireLock, isOwnLockReleased } from './lock.ts';
import { REPORT_PATH } from './run-chunk/data-paths.ts';
import { finishChunk, gateYieldOutcome } from './run-chunk/chunk-ending.ts';
import { failRun } from './run-chunk/failure-path.ts';
import { loadEnvelope } from './run-chunk/load-envelope.ts';
import { deferIfPaused, loadProgress } from './run-chunk/pause-deferral.ts';
import type { ProgressLoad } from './run-chunk/pause-deferral.ts';
import { checkRunStart, loadRunInputs, planOrder, runLeagueGate } from './run-chunk/run-start.ts';
import { createRunState } from './run-chunk/run-state.ts';
import type { RunContext, RunState } from './run-chunk/run-state.ts';
import { runSteps } from './run-chunk/step-loop.ts';

export { DATASET_PATH, PROGRESS_PATH, REPORT_PATH, TRACKED_PATH } from './run-chunk/data-paths.ts';

/** What one step reports for one entry: an absent allowance bounds nothing; `yielded` stops now. */
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
      /** Set only on a `429`: the delay the chunk writes into `notBefore` (IN §5.3). */
      readonly retryAfterMs?: number;
      /** Set only on AD-30's `session-expired` downgrade: no `notBefore`, `backoff(1)` (§13.4). */
      readonly sessionExpired?: true;
    };

export type ChunkStep = (entry: TrackedEntry) => Promise<StepResult>;

/** The runner's two narrow ports onto the process auth holder, never the cookie (AD-30, §13.1). */
interface ChunkAuth {
  /** Called once after the lock and `notBefore` check: a due hold-off settles `held-off`. */
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

/** `yield` is a chunk yield with no entry attempted (AD-8): the gate got no answer to check. */
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
  /** Turns starvation into a report record with the declared yardstick (FR-25), unread here. */
  readonly starvationRecord: (starvation: ChunkStarvation) => SyncRunRecord;
  /** The run-start league gate, after the order, before any step: a throw aborts. */
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
  /** The shell's per-source request counter (`../request-counter.ts`); counted since the lock. */
  readonly requests: { snapshot(): RequestsBySource };
  /** The shell's loads under the lock (AD-12), after the dataset, before the catalogue. */
  readonly load: (context: ChunkLoadContext) => Promise<ChunkSetup>;
  /** The committed catalogue's id sets, after `load`; a refusal aborts with a `run-failure`. */
  readonly catalogue: () => Promise<DataFileResult<CatalogueIds>>;
  /** The retry delay of a latched probe `429`, read after the step loop: a `429` yield (§13.3). */
  readonly latchedRetryAfterMs?: () => number | undefined;
  /** The live shells' auth holder ports; omitted, nothing settles `held-off`. */
  readonly auth?: ChunkAuth;
  /** One line of operator output. Defaults to stderr. */
  readonly log?: (line: string) => void;
  /** Set only by the `pnpm sync` session (`../sync.ts`), one chunk per entry (AD-7). */
  readonly session?: ChunkSession;
}

/** What the session tells each of its chunks. Every field is optional. */
export interface ChunkSession {
  /** The chunk attempts at most this many entries; reaching it with one left ends it `bounded`. */
  readonly maxEntries?: number;
  /** The request counter's snapshot at the pass start, so `requestsBySource` covers the pass. */
  readonly requestsSince?: RequestsBySource;
  /** The league an earlier chunk confirmed: the gate is skipped while it equals the configured. */
  readonly confirmedLeague?: string;
  /** Row 1's stale-pinned rule (`chunkOrder`'s `pinnedMaxAgeMs`). */
  readonly pinnedMaxAgeMs?: number;
}

/** `'entries'` is reached only under a session's `maxEntries`. */
export type ChunkBound = 'search' | 'fetch' | 'entries';

interface ChunkOutcomeBase {
  /** Canonical keys this chunk completed in visiting order, row 1 too; progress keeps rows 2–3. */
  readonly completed: readonly string[];
  /** The dataset entries the steps returned in visiting order; `busy` publishes none. */
  readonly entries: readonly DatasetEntry[];
  /** The lock records this chunk produced; the report adds the starvation record separately. */
  readonly records: readonly SyncRunRecord[];
  /** Set when a pinned step's allowance is below pinned entries left plus one while rotation
   * work waited (AD-7, §6). */
  readonly pinnedStarvation?: ChunkStarvation;
  /** A session's chunk only, once the order exists: `true` when its order started a new pass. */
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
      /** `true` only on AD-30's `session-expired` yield, which reset pacing (§13.4). */
      readonly sessionExpired?: true;
    })
  | (ChunkOutcomeBase & { readonly kind: 'busy' })
  /** A prior 429 or malformed-request abort left a `notBefore` ahead: nothing sent (AD-8, §5.3). */
  | (ChunkOutcomeBase & { readonly kind: 'deferred'; readonly notBefore: string })
  | (ChunkOutcomeBase & { readonly kind: 'dispossessed' });

export type ChunkOutcomeKind = ChunkOutcome['kind'];

/** The operator log's default sink: one line on stderr. */
export const writeStderr = (line: string): void => {
  process.stderr.write(`${line}\n`);
};

function busyOutcome(log: (line: string) => void, holder: SyncLock | undefined): ChunkOutcome {
  const described =
    holder === undefined ? 'an unreadable lock' : `pid ${String(holder.pid)} since ${holder.startedAt}`;
  log(`sync: another run holds the lock (${described}); nothing to do this invocation`);
  return { kind: 'busy', completed: [], entries: [], records: [] };
}

async function runNormalPath(state: RunState, progressFault: ProgressLoad['fault']): Promise<ChunkOutcome> {
  if (progressFault !== undefined) {
    throw progressFault.error;
  }
  const { ready, ids } = await loadRunInputs(state);
  const check = await checkRunStart(state, ids);
  const plan = planOrder(state, check);
  const gated = await runLeagueGate(state, ready, plan);
  if (gated !== undefined) {
    return gateYieldOutcome(state, ready, gated);
  }
  state.isGatePassed = true;
  return finishChunk(state, ready, await runSteps(state, ready, plan));
}

async function runUnderLock(context: RunContext): Promise<ChunkOutcome> {
  const { ports } = context;
  const { progress, fault } = await loadProgress(ports.fs);
  const paused = await deferIfPaused(context, progress);
  if (paused !== undefined) {
    return paused;
  }
  // After the lock and the `notBefore` check, a due hold-off settles `held-off`, so this run sends
  // no probe (§13.1).
  ports.auth?.settleHeldOffIfDue(progress?.authHoldOffUntil, ports.clock.now());
  // Read outside the failure path: an unreadable report is refused with nothing written (NFR-8).
  const previousReport = await loadEnvelope(ports.fs, REPORT_PATH, (data) =>
    parseEnvelope(SyncReportFileSchema, data),
  );
  const state = createRunState({ ...context, progress, previousReport });
  try {
    return await runNormalPath(state, fault);
  } catch (error) {
    return await failRun(state, error);
  }
}

export async function runChunk(ports: ChunkPorts): Promise<ChunkOutcome> {
  const log = ports.log ?? writeStderr;
  const acquisition = await acquireLock(ports.fs, ports.clock, ports.pid);
  if (acquisition.kind === 'busy') {
    return busyOutcome(log, acquisition.holder);
  }
  const mine = acquisition.lock;
  const context: RunContext = {
    ports,
    log,
    mine,
    requestsAtStart: ports.requests.snapshot(),
    records: acquisition.broken === undefined ? [] : [acquisition.broken],
  };
  try {
    return await runUnderLock(context);
  } finally {
    await isOwnLockReleased(ports.fs, mine);
  }
}
