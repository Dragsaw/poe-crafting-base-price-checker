/**
 * `pnpm sync` — the long-running sync session (FR-19, AD-7, AD-8).
 *
 * One process prices **one entry per iteration**. Each iteration is the same
 * chunk `pnpm sync:batch` runs (`./compose-chunk.ts`, `./chunk/run-chunk.ts`),
 * bounded to one entry: it takes the lock, loads, prices, publishes and
 * releases. The lock is taken per entry and never held across a wait, so
 * IMPLEMENTATION-NOTES.md §7 and its 6 h stale rule are unchanged.
 *
 * **One pacing state lives for the whole process** (`PacingState`: the bucket
 * ledger and the lane memo). Each chunk gets a fresh governor seeded with it,
 * paced with the even spread (`spreadBeforeNext`, §5.3), and its own
 * invalid-request counts. Before each chunk the session pre-waits the spread
 * delay of the lanes the next entry spends on — `DATA_LANE` when the league
 * gate is due, `SEARCH_LANE` and `FETCH_LANE` — **outside** the lock, so the
 * waits inside a chunk are only the fetch lane's small gaps. There is no
 * startup wait: the first request goes out cold and its response seeds the
 * ledger.
 *
 * After each chunk, `nextWait` (pure) decides the wait from the outcome or the
 * throw, the `notBefore` the chunk left in `sync-progress.json`, and whether
 * the chunk brought a fresh State reading (the ledger changed). `runWait`
 * spends it: a timed wait, a local poll of the input files' `modifiedAt`, or a
 * local poll of the lock file. Nothing idle sends a request.
 *
 * The first SIGINT or SIGTERM cancels a wait at once, or lets the running
 * entry finish, and the command exits 0. A throw never stops the session: it
 * is printed and waited out.
 *
 * **No test runs `main`.** `sync.test.ts` drives `syncSessionCommand` with
 * injected ports; the entry guard at the bottom means importing the module
 * runs nothing.
 */

import { realpathSync } from 'node:fs';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseEnvelope, SyncProgressFileSchema } from '@poe/contracts';
import type { FilesystemPort, ClockPort } from '@poe/contracts';
import { UNRESOLVABLE_RETRY_MS } from '@poe/core';

import { CATALOGUE_FILTERS_PATH, CATALOGUE_STATS_PATH } from './catalogue/catalogue-ids.ts';
import { WEIGHTS_PATH } from './catalogue/weights-ids.ts';
import { CrossFileGateError } from './chunk/cross-file-gate.ts';
import { isStaleState, LOCK_PATH, readLock, STALE_LOCK_AFTER_MS } from './chunk/lock.ts';
import { PROGRESS_PATH, TRACKED_PATH } from './chunk/run-chunk.ts';
import type { ChunkOutcome } from './chunk/run-chunk.ts';
import { composeChunk } from './compose-chunk.ts';
import type { ComposeChunkPorts } from './compose-chunk.ts';
import { createReadOnlyGitPort } from './git/read-only-git-port.ts';
import { LeagueMismatchError } from './league/league-gate.ts';
import { CONFIG_PATH } from './load-config.ts';
import { DataFileError } from './load-data-file.ts';
import { PinnedCapExceededError } from './pinned-cap.ts';
import { CURRENCIES_PATH } from './pricing/load-currencies.ts';
import { CATALOGUE_ITEMS_PATH } from './pricing/load-item-types.ts';
import { MalformedRequestError } from './pricing/price-entry.ts';
import { UnknownClassBaseTypeError } from './pricing/search-body.ts';
import { createRequestCounter } from './request-counter.ts';
import type { RequestCounter, RequestsBySource } from './request-counter.ts';
import {
  abortableSleep,
  createFetchHttpPort,
  createNodeFilesystemPort,
  sleep,
  systemClock,
} from './shell.ts';
import { createPacingState, laneDelayMs } from './trade/client.ts';
import type { PacingState } from './trade/client.ts';
import { DATA_LANE, FETCH_LANE, SEARCH_LANE } from './trade/endpoints.ts';
import { evenIntervalMs } from './trade/ledger.ts';
import { createSessionAuth } from './trade/session-auth.ts';
import type { SessionAuth } from './trade/session-auth.ts';
import { resolveUserAgent } from './trade/user-agent.ts';

const PREFIX = 'pnpm sync:';
const MS_PER_HOUR = 60 * 60 * 1000;

/** `--pinned-max-age <hours>`'s default (AD-7): a pinned entry is due once it is older. */
export const DEFAULT_PINNED_MAX_AGE_HOURS = 4;

/**
 * The first backoff on a lane whose policy the session has not read yet: the
 * even interval of the measured search bucket `600:21600` (21 600 s / 600
 * hits = 36 s, IMPLEMENTATION-NOTES.md §5.3, which owns the figure).
 */
export const COLD_EVEN_INTERVAL_MS = 36_000;

/**
 * How often a wait polls the local input files or the lock file. A local
 * read, never a request: an idle wait sends nothing.
 */
export const LOCAL_POLL_MS = 5000;

/**
 * The hand-owned inputs under `data/` a chunk reads and never writes. A change
 * to any of them — its presence or its `modifiedAt` — ends a wait for an input
 * change, and makes the league gate due again.
 */
export const INPUT_PATHS: readonly string[] = [
  TRACKED_PATH,
  CONFIG_PATH,
  CURRENCIES_PATH,
  WEIGHTS_PATH,
  CATALOGUE_ITEMS_PATH,
  CATALOGUE_STATS_PATH,
  CATALOGUE_FILTERS_PATH,
];

// ---------------------------------------------------------------------------
// Arguments

export interface SessionOptions {
  readonly pinnedMaxAgeMs: number;
}

export type ParsedArguments =
  | { readonly ok: true; readonly options: SessionOptions }
  | { readonly ok: false; readonly message: string };

/** `--pinned-max-age <hours>` (a positive number) and a literal `--`, which is skipped. */
export function parseArguments(argv: readonly string[]): ParsedArguments {
  let hours = DEFAULT_PINNED_MAX_AGE_HOURS;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--') {
      continue;
    }
    if (argument === '--pinned-max-age') {
      const value = argv[index + 1];
      const parsed = value === undefined ? NaN : Number(value);
      if (value === undefined || value.trim() === '' || !Number.isFinite(parsed) || parsed <= 0) {
        return { ok: false, message: '--pinned-max-age needs a positive number of hours' };
      }
      hours = parsed;
      index += 1;
      continue;
    }
    return { ok: false, message: `unknown argument ${JSON.stringify(argument)}` };
  }
  return { ok: true, options: { pinnedMaxAgeMs: hours * MS_PER_HOUR } };
}

// ---------------------------------------------------------------------------
// State and the pure decisions

/** What one iteration's chunk ended with. */
export type ChunkResult =
  | { readonly kind: 'outcome'; readonly outcome: ChunkOutcome }
  | { readonly kind: 'error'; readonly error: unknown };

export interface SessionState {
  /** The league the last chunk confirmed; absent until one does, and after a throw or a gate yield. */
  readonly confirmedLeague?: string;
  /** The input signature at the chunk that last confirmed the league. */
  readonly confirmedSignature?: string;
  /** The request counter's snapshot at the start of the current pass. */
  readonly passStart?: RequestsBySource;
  /** `true` after a `completed` chunk: the next chunk starts a new pass. */
  readonly passEnded: boolean;
  /** Consecutive backoff waits (decisions 5 and 6); `0` after a State reading. */
  readonly backoffCount: number;
}

export const INITIAL_SESSION_STATE: SessionState = { passEnded: false, backoffCount: 0 };

/** What the session knew around one chunk. */
export interface ChunkContext {
  /** The instant the chunk ended. */
  readonly now: string;
  /** The `notBefore` in `sync-progress.json` after the chunk, where it is still in the future. */
  readonly notBefore?: string;
  /** `true` when the chunk's responses brought a State reading (the ledger changed). */
  readonly freshReading: boolean;
  /** The tightest even interval of the lanes the entry spent on (`sessionEvenIntervalMs`). */
  readonly evenIntervalMs: number;
}

export type SessionWait =
  | { readonly kind: 'none' }
  /** Until an instant; with `orInputChange`, or until an input file changes if that is sooner. */
  | { readonly kind: 'until'; readonly until: string; readonly reason: string; readonly orInputChange: boolean }
  /** Until an input file changes; with `until`, at most until then. */
  | { readonly kind: 'input-change'; readonly reason: string; readonly until?: string }
  /** Until the lock file is absent or stale (§7). */
  | { readonly kind: 'lock'; readonly reason: string };

const NO_WAIT: SessionWait = { kind: 'none' };

/**
 * A throw only an edit to an input file clears. A `DataFileError` counts only
 * for a watched input: a refused sync-owned file (the dataset, progress or the
 * report) is not in `INPUT_PATHS`, so a wait for an input change would never
 * end, and it takes the backoff instead.
 */
function isRefusal(error: unknown): boolean {
  return (
    (error instanceof DataFileError && INPUT_PATHS.includes(error.path)) ||
    error instanceof PinnedCapExceededError ||
    error instanceof UnknownClassBaseTypeError ||
    error instanceof LeagueMismatchError ||
    error instanceof CrossFileGateError
  );
}

/**
 * Whether the result earns a backoff (decisions 5 and 6): a yield that wrote
 * no `notBefore` and brought no State reading (no answer), or a throw that is
 * not a refusal, a league mismatch or a malformed request and wrote no
 * `notBefore`.
 */
function isBackoff(result: ChunkResult, context: ChunkContext): boolean {
  if (context.notBefore !== undefined) {
    return false;
  }
  return result.kind === 'outcome' ? result.outcome.kind === 'yielded' && (!context.freshReading || isSessionExpired(result)) : !isRefusal(result.error);
}

/**
 * `true` when the chunk ended on AD-30's downgrade (IMPLEMENTATION-NOTES.md
 * §13.4). The downgrade reset the pacing state in place, so the ledger cannot
 * tell it apart from a fresh State reading: the outcome says so explicitly.
 */
export function isSessionExpired(result: ChunkResult): boolean {
  return result.kind === 'outcome' && result.outcome.kind === 'yielded' && result.outcome.sessionExpired === true;
}

/**
 * The count this result's backoff runs at: `1` after a State reading and
 * after a downgrade (the pacing is cold again), one more than the last
 * otherwise.
 */
function backoffCountFor(state: SessionState, context: ChunkContext, result: ChunkResult): number {
  return context.freshReading || isSessionExpired(result) ? 1 : state.backoffCount + 1;
}

/**
 * The `count`-th consecutive backoff: the even interval, doubled per
 * consecutive backoff, capped at the 6 h stale threshold (`STALE_LOCK_AFTER_MS`).
 */
export function backoffMs(evenInterval: number, count: number): number {
  const doubled = evenInterval * 2 ** Math.max(0, count - 1);
  return Math.min(doubled, STALE_LOCK_AFTER_MS);
}

function plus(now: string, ms: number): string {
  return new Date(Date.parse(now) + ms).toISOString();
}

/**
 * The wait after one chunk (the I/O matrix of the session). Pure: the result,
 * the state before it and what the session read around the chunk go in.
 */
export function nextWait(result: ChunkResult, state: SessionState, context: ChunkContext): SessionWait {
  const { now } = context;
  const backoffUntil = (): string =>
    plus(now, backoffMs(context.evenIntervalMs, backoffCountFor(state, context, result)));

  if (result.kind === 'error') {
    return waitAfterError(result.error, context, backoffUntil);
  }

  const { outcome } = result;
  switch (outcome.kind) {
    case 'busy': {
      return { kind: 'lock', reason: 'another run holds the lock' };
    }
    case 'dispossessed': {
      return { kind: 'lock', reason: 'the lock was taken over' };
    }
    case 'deferred': {
      return { kind: 'until', until: outcome.notBefore, reason: 'a trade penalty', orInputChange: false };
    }
    case 'yielded': {
      return waitAfterYield(outcome, context, backoffUntil);
    }
    case 'completed': {
      return waitAfterCompleted(outcome, now);
    }
    case 'bounded': {
      return NO_WAIT;
    }
  }
}

function waitAfterError(error: unknown, context: ChunkContext, backoffUntil: () => string): SessionWait {
  const { notBefore } = context;
  if (notBefore !== undefined) {
    // A malformed request, or the gate's 4xx: the abort `notBefore` (§5.3).
    // An edit may fix a request `sync` built wrong, so that wait also ends on one.
    return {
      kind: 'until',
      until: notBefore,
      reason: 'a rejected request',
      orInputChange: error instanceof MalformedRequestError,
    };
  }
  return isRefusal(error)
    ? { kind: 'input-change', reason: 'a refused input or a league mismatch' }
    : { kind: 'input-change', reason: 'an unexpected failure', until: backoffUntil() };
}

function waitAfterYield(
  outcome: Extract<ChunkOutcome, { kind: 'yielded' }>,
  context: ChunkContext,
  backoffUntil: () => string,
): SessionWait {
  if (context.notBefore !== undefined) {
    return { kind: 'until', until: context.notBefore, reason: 'a 429', orInputChange: false };
  }
  if (outcome.sessionExpired === true) {
    // The downgrade wrote no `notBefore` and reset the pacing: backoff(1) (§13.4).
    return { kind: 'until', until: backoffUntil(), reason: 'the session cookie expired', orInputChange: false };
  }
  if (context.freshReading) {
    // A 5xx or a timeout that still carried headers: the spread paces the retry.
    return NO_WAIT;
  }
  return { kind: 'until', until: backoffUntil(), reason: 'no answer', orInputChange: false };
}

function waitAfterCompleted(outcome: Extract<ChunkOutcome, { kind: 'completed' }>, now: string): SessionWait {
  if (outcome.completed.length === 0 && outcome.entries.length === 0) {
    return {
      kind: 'input-change',
      reason: 'nothing due',
      until: plus(now, UNRESOLVABLE_RETRY_MS),
    };
  }
  return NO_WAIT;
}

/** The state with no confirmed league: the next chunk runs the gate. */
function withoutLeague(state: SessionState): SessionState {
  return {
    passEnded: state.passEnded,
    backoffCount: state.backoffCount,
    ...(state.passStart !== undefined && { passStart: state.passStart }),
  };
}

/** The state after one chunk. `signature` and `before` are the iteration's, read before the chunk. */
export function nextState(
  state: SessionState,
  result: ChunkResult,
  context: ChunkContext,
  iteration: { readonly signature: string; readonly before: RequestsBySource },
): SessionState {
  const backoffCount = isBackoff(result, context)
    ? backoffCountFor(state, context, result)
    : 0;

  if (result.kind === 'error') {
    // Only a league mismatch unconfirms the league; a transient fault keeps it,
    // so the retry does not spend an extra gate request.
    return result.error instanceof LeagueMismatchError
      ? { ...withoutLeague(state), backoffCount }
      : { ...state, backoffCount };
  }

  const { outcome } = result;
  if (outcome.newPass === undefined) {
    // Busy, deferred, or a throw-free ending before the order: nothing about the pass changed.
    return { ...state, backoffCount };
  }
  const passStart =
    outcome.newPass || state.passStart === undefined ? iteration.before : state.passStart;
  const isPassEnded = outcome.kind === 'completed';
  if (outcome.confirmedLeague === undefined) {
    return { ...withoutLeague(state), passStart, passEnded: isPassEnded, backoffCount };
  }
  return {
    confirmedLeague: outcome.confirmedLeague,
    confirmedSignature: iteration.signature,
    passStart,
    passEnded: isPassEnded,
    backoffCount,
  };
}

/** The gate is due when no league is confirmed, a new pass starts, or an input changed since it was. */
export function isGateDue(state: SessionState, signature: string): boolean {
  return (
    state.confirmedLeague === undefined || state.passEnded || signature !== state.confirmedSignature
  );
}

function entryLanes(hasGate: boolean): readonly string[] {
  return hasGate ? [DATA_LANE, SEARCH_LANE, FETCH_LANE] : [SEARCH_LANE, FETCH_LANE];
}

/** The pre-wait before the next chunk: the largest spread delay over the lanes it will spend on. */
export function preWaitMs(pacing: PacingState, now: string, hasGate: boolean): number {
  return Math.max(0, ...entryLanes(hasGate).map((lane) => laneDelayMs(pacing, lane, now, true)));
}

/**
 * The tightest even interval over the lanes an entry spends on; a lane whose
 * policy is unread counts as `COLD_EVEN_INTERVAL_MS`.
 */
export function sessionEvenIntervalMs(pacing: PacingState, hasGate: boolean): number {
  return Math.max(
    ...entryLanes(hasGate).map(
      (lane) => evenIntervalMs(pacing.ledger, pacing.lanePolicies.get(lane)) ?? COLD_EVEN_INTERVAL_MS,
    ),
  );
}

// ---------------------------------------------------------------------------
// Local reads

/**
 * The presence and `modifiedAt` of every input file, as one comparable string.
 * It never throws: a transient fs fault (`EBUSY`, `EPERM`) on one path records
 * an error marker in that path's part, so it cannot end the session.
 */
export async function inputSignature(fs: FilesystemPort): Promise<string> {
  const parts = await Promise.all(
    INPUT_PATHS.map(async (path) => {
      try {
        return [path, await fs.exists(path), await fs.lastModifiedAt(path)];
      } catch {
        return [path, 'error'];
      }
    }),
  );
  return JSON.stringify(parts);
}

/**
 * `true` when the lock file is absent, or stale by §7's rule (`isStaleState`).
 * A read that throws answers `false`, so the poll continues.
 */
export async function isLockFree(fs: FilesystemPort, clock: ClockPort): Promise<boolean> {
  try {
    const found = await readLock(fs);
    return found.state === 'absent' ? true : (await isStaleState(fs, found, clock.now(), LOCK_PATH));
  } catch {
    return false;
  }
}

/** The `notBefore` in `sync-progress.json`, where it is readable and still after `now`. */
async function pendingNotBefore(fs: FilesystemPort, now: string): Promise<string | undefined> {
  try {
    const text = await fs.readTextFile(PROGRESS_PATH);
    if (text === undefined) {
      return undefined;
    }
    const parsed = parseEnvelope(SyncProgressFileSchema, JSON.parse(text));
    const notBefore = parsed.ok ? parsed.value.notBefore : undefined;
    return notBefore !== undefined && Date.parse(notBefore) > Date.parse(now) ? notBefore : undefined;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// The waits

export interface WaitPorts {
  readonly fs: FilesystemPort;
  readonly clock: ClockPort;
  /** A delay that an abort ends at once, resolving (`abortableSleep`). */
  readonly sleep: (ms: number, signal: AbortSignal) => Promise<void>;
  readonly signal: AbortSignal;
}

function remainingMs(until: string, clock: ClockPort): number {
  return Date.parse(until) - Date.parse(clock.now());
}

/** Spends one wait. Returns early on an abort. `signature` is the input signature the wait compares against. */
export async function runWait(wait: SessionWait, ports: WaitPorts, signature: string): Promise<void> {
  switch (wait.kind) {
    case 'none': {
      return;
    }
    case 'until': {
      return waitUntil(wait, ports, signature);
    }
    case 'input-change': {
      return waitForInputChange(wait, ports, signature);
    }
    case 'lock': {
      return waitForLock(ports);
    }
  }
}

async function waitUntil(
  wait: Extract<SessionWait, { kind: 'until' }>,
  ports: WaitPorts,
  signature: string,
): Promise<void> {
  const { fs, clock, sleep: pause, signal } = ports;
  /* eslint-disable no-await-in-loop -- polling loop: each pause or probe decides whether the next iteration runs */
  for (;;) {
    const left = remainingMs(wait.until, clock);
    if (left <= 0 || signal.aborted) {
      return;
    }
    await pause(wait.orInputChange ? Math.min(left, LOCAL_POLL_MS) : left, signal);
    if (signal.aborted) {
      return;
    }
    if (wait.orInputChange && (await inputSignature(fs)) !== signature) {
      return;
    }
  }
  /* eslint-enable no-await-in-loop -- end of the polling loop above */
}

async function waitForInputChange(
  wait: Extract<SessionWait, { kind: 'input-change' }>,
  ports: WaitPorts,
  signature: string,
): Promise<void> {
  const { fs, clock, sleep: pause, signal } = ports;
  /* eslint-disable no-await-in-loop -- polling loop: each pause or probe decides whether the next iteration runs */
  for (;;) {
    const left = wait.until === undefined ? LOCAL_POLL_MS : remainingMs(wait.until, clock);
    if (left <= 0 || signal.aborted) {
      return;
    }
    await pause(Math.min(left, LOCAL_POLL_MS), signal);
    if (signal.aborted || (await inputSignature(fs)) !== signature) {
      return;
    }
  }
  /* eslint-enable no-await-in-loop -- end of the polling loop above */
}

async function waitForLock(ports: WaitPorts): Promise<void> {
  const { fs, clock, sleep: pause, signal } = ports;
  /* eslint-disable no-await-in-loop -- polling loop: each pause or probe decides whether the next iteration runs */
  for (;;) {
    if (signal.aborted || (await isLockFree(fs, clock))) {
      return;
    }
    await pause(LOCAL_POLL_MS, signal);
  }
  /* eslint-enable no-await-in-loop -- end of the polling loop above */
}

function describeWait(wait: Exclude<SessionWait, { kind: 'none' }>): string {
  switch (wait.kind) {
    case 'until': {
      return `waiting until ${wait.until} (${wait.reason}${wait.orInputChange ? ', or an input file change' : ''})`;
    }
    case 'input-change': {
      return `waiting for an input file under data/ to change (${wait.reason}${
        wait.until === undefined ? '' : `, at most until ${wait.until}`
      })`;
    }
    case 'lock': {
      return `waiting for the lock to be free (${wait.reason})`;
    }
  }
}

function describeOutcome(outcome: ChunkOutcome): string {
  let kind: string = outcome.kind;
  if (outcome.kind === 'deferred') {
    kind = `deferred until ${outcome.notBefore}`;
  } else if (outcome.kind === 'bounded') {
    kind = `bounded by ${outcome.bound}`;
  }
  const keys = outcome.completed.length === 0 ? '' : `: ${outcome.completed.join(', ')}`;
  return `${kind}, ${String(outcome.completed.length)} completed${keys}`;
}

// ---------------------------------------------------------------------------
// The command

/** The session's ports: `composeChunk`'s, less what the session itself supplies. */
export type SyncSessionPorts = Omit<
  ComposeChunkPorts,
  'userAgent' | 'pacing' | 'spread' | 'requests' | 'session' | 'wrapStep' | 'auth'
>;

export interface SyncSessionDependencies extends SyncSessionPorts {
  /**
   * Where the contact `User-Agent` (`POE_SYNC_USER_AGENT`) and the optional
   * session cookie (`POESESSID`, AD-30) are read from.
   */
  readonly env: Readonly<Record<string, string | undefined>>;
  /** The command's arguments, after the script name. */
  readonly argv: readonly string[];
  readonly stdout: (line: string) => void;
  readonly stderr: (line: string) => void;
  /** Aborted by the first SIGINT or SIGTERM. */
  readonly signal: AbortSignal;
  /** The session's waits, cut short by `signal` (`abortableSleep`). The in-chunk waits use `wait`. */
  readonly sleep: (ms: number, signal: AbortSignal) => Promise<void>;
}

/** What every iteration of the session loop shares. */
interface SessionRuntime {
  readonly ports: SyncSessionPorts;
  readonly userAgent: string;
  readonly pinnedMaxAgeMs: number;
  readonly auth: SessionAuth;
  readonly pacing: PacingState;
  readonly requests: RequestCounter;
  readonly waitPorts: WaitPorts;
  readonly stdout: (line: string) => void;
  readonly stderr: (line: string) => void;
}

/** Waits out the spread delay before a chunk, outside the lock. `true` when an abort ended it. */
async function isAbortedDuringSpreadWait(runtime: SessionRuntime, isWithGate: boolean): Promise<boolean> {
  const { pacing, waitPorts, stdout } = runtime;
  const { clock, sleep: pause, signal } = waitPorts;
  const delayMs = preWaitMs(pacing, clock.now(), isWithGate);
  if (delayMs <= 0) {
    return false;
  }
  stdout(`${PREFIX} waiting until ${plus(clock.now(), delayMs)} (spreading requests over the rate-limit buckets)`);
  await pause(delayMs, signal);
  return signal.aborted;
}

/** Runs one chunk bounded to one entry. A throw is printed and returned, never rethrown. */
async function runSessionChunk(runtime: SessionRuntime, state: SessionState): Promise<ChunkResult> {
  const { ports, auth, stdout, stderr } = runtime;
  try {
    const outcome = await composeChunk({
      ...ports,
      userAgent: runtime.userAgent,
      pacing: runtime.pacing,
      auth,
      spread: true,
      requests: runtime.requests,
      session: {
        maxEntries: 1,
        pinnedMaxAgeMs: runtime.pinnedMaxAgeMs,
        ...(state.passStart !== undefined && { requestsSince: state.passStart }),
        ...(state.confirmedLeague !== undefined && { confirmedLeague: state.confirmedLeague }),
      },
    }).run();
    stdout(`${PREFIX} ${describeOutcome(outcome)}`);
    return { kind: 'outcome', outcome };
  } catch (error_) {
    // The governor already redacted what it passed on; this covers the rest (§13.6).
    const error = auth.redact(error_);
    stderr(`${PREFIX} ${error instanceof Error ? error.message : String(error)}`);
    return { kind: 'error', error };
  }
}

async function readChunkContext(
  runtime: SessionRuntime,
  result: ChunkResult,
  ledgerBefore: PacingState['ledger'],
  isWithGate: boolean,
): Promise<ChunkContext> {
  const { pacing, waitPorts } = runtime;
  const now = waitPorts.clock.now();
  const notBefore = await pendingNotBefore(waitPorts.fs, now);
  return {
    now,
    ...(notBefore !== undefined && { notBefore }),
    // The downgrade's in-place reset gives the ledger a new reference; it
    // is no State reading (§13.4).
    freshReading: !isSessionExpired(result) && pacing.ledger !== ledgerBefore,
    evenIntervalMs: sessionEvenIntervalMs(pacing, isWithGate),
  };
}

/** One pass of the session loop: pre-wait, one chunk, then the wait it earned. Returns the state after it. */
async function runIteration(runtime: SessionRuntime, state: SessionState): Promise<SessionState> {
  const { waitPorts, requests, pacing, stdout } = runtime;
  const signature = await inputSignature(waitPorts.fs);
  const isWithGate = isGateDue(state, signature);

  if (await isAbortedDuringSpreadWait(runtime, isWithGate)) {
    return state;
  }

  const before = requests.snapshot();
  const ledgerBefore = pacing.ledger;
  const result = await runSessionChunk(runtime, state);

  const context = await readChunkContext(runtime, result, ledgerBefore, isWithGate);
  const wait = nextWait(result, state, context);
  const next = nextState(state, result, context, { signature, before });

  if (wait.kind === 'none' || waitPorts.signal.aborted) {
    return next;
  }

  stdout(`${PREFIX} ${describeWait(wait)}`);
  await runWait(wait, waitPorts, signature);
  return next;
}

/** The session: runs until `signal` aborts, then exits `0`. `1` only on a refusal before any request. */
export async function syncSessionCommand(dependencies: SyncSessionDependencies): Promise<number> {
  const { env, argv, stdout, stderr, signal, sleep: pause, ...ports } = dependencies;

  const arguments_ = parseArguments(argv);
  if (!arguments_.ok) {
    stderr(`${PREFIX} ${arguments_.message}`);
    return 1;
  }
  const contact = resolveUserAgent(env);
  if (!contact.ok) {
    // Refused before anything is issued (NFR-9).
    stderr(`${PREFIX} ${contact.message}`);
    return 1;
  }

  // One holder per process, beside the pacing state. Each settle prints one
  // line, once per process, at the moment it settles: an edge state here,
  // before the first request; a probe outcome from a chunk's governor
  // (IMPLEMENTATION-NOTES.md §13.1–§13.3, §13.5).
  const auth = createSessionAuth(env, { onSettle: (line) => stderr(`${PREFIX} ${line}`) });
  const runtime: SessionRuntime = {
    ports,
    userAgent: contact.userAgent,
    pinnedMaxAgeMs: arguments_.options.pinnedMaxAgeMs,
    auth,
    pacing: createPacingState(),
    requests: createRequestCounter(),
    waitPorts: { fs: ports.fs, clock: ports.clock, sleep: pause, signal },
    stdout,
    stderr,
  };
  let state = INITIAL_SESSION_STATE;

  try {
    /* eslint-disable no-await-in-loop -- sequential on purpose: one chunk per pass, and each pass reads the state the last one left */
    while (!signal.aborted) {
      state = await runIteration(runtime, state);
    }
    /* eslint-enable no-await-in-loop -- end of the sequential block above */
  } finally {
    // Runs on a throw too, so the process never ends unsettled without its
    // line. A holder still unsettled had no 2xx pricing search to probe on,
    // or only probe 429s (§13.5).
    auth.settle('not-probed');
  }

  stdout(`${PREFIX} stopped`);
  return 0;
}

/** `packages/sync/src/` → the repository root, whose `data/` the chunk owns. */
const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

async function main(): Promise<void> {
  const controller = new AbortController();
  const stop = (): void => {
    controller.abort();
  };
  // `once`: the first signal stops the session gracefully; a second one gets
  // Node's default handling and ends the process.
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  process.exitCode = await syncSessionCommand({
    fs: createNodeFilesystemPort(REPO_ROOT),
    clock: systemClock,
    http: createFetchHttpPort(),
    git: createReadOnlyGitPort(REPO_ROOT),
    wait: sleep,
    sleep: abortableSleep,
    pid: process.pid,
    env: process.env,
    argv: process.argv.slice(2),
    signal: controller.signal,
    stdout: (line) => process.stdout.write(`${line}\n`),
    stderr: (line) => process.stderr.write(`${line}\n`),
  });
}

/** Realpaths both sides, as `dry-run.ts` does, so a junction path still runs. */
function isInvokedDirectly(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) {
    return false;
  }
  try {
    return realpathSync(nodePath.resolve(entry)) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isInvokedDirectly()) {
  try {
    await main();
  } catch (error) {
    process.stderr.write(`${PREFIX} ${String(error)}\n`);
    // `process.exitCode`, not `process.exit(1)`: an immediate exit truncates a piped stderr write.
    process.exitCode = 1;
  }
}
