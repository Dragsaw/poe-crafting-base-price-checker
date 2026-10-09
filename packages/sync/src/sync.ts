/**
 * `pnpm sync`: one entry per iteration; the lock is never held across a wait (FR-19, AD-7, AD-8).
 */

import { fileURLToPath } from 'node:url';

import type { ChunkOutcome } from './chunk/run-chunk.ts';
import { composeChunk } from './compose-chunk.ts';
import type { ComposeChunkPorts } from './compose-chunk.ts';
import { isInvokedDirectly } from './entry/is-invoked-directly.ts';
import { createReadOnlyGitPort } from './git/read-only-git-port.ts';
import { createRequestCounter } from './request-counter.ts';
import type { RequestCounter } from './request-counter.ts';
import {
  abortableSleep,
  createFetchHttpPort,
  createNodeFilesystemPort,
  sleep,
  systemClock,
} from './shell.ts';
import { INITIAL_SESSION_STATE, isGateDue, isSessionExpired, nextState, nextWait, plus } from './sync/session-state.ts';
import type { ChunkContext, ChunkResult, SessionState } from './sync/session-state.ts';
import { inputSignature, pendingNotBefore } from './sync/session-inputs.ts';
import { preWaitMs, sessionEvenIntervalMs } from './sync/session-pacing.ts';
import { describeWait, runWait } from './sync/session-wait.ts';
import type { WaitPorts } from './sync/session-wait.ts';
import { createPacingState } from './trade/client.ts';
import type { PacingState } from './trade/client.ts';
import { createSessionAuth } from './trade/session-auth.ts';
import type { SessionAuth } from './trade/session-auth.ts';
import { resolveUserAgent } from './trade/user-agent.ts';

export { COLD_EVEN_INTERVAL_MS } from './sync/session-pacing.ts';
export { INPUT_PATHS, inputSignature, isLockFree } from './sync/session-inputs.ts';
export { backoffMs, INITIAL_SESSION_STATE, isGateDue, isSessionExpired, nextState, nextWait } from './sync/session-state.ts';
export type { ChunkContext, ChunkResult, SessionState, SessionWait } from './sync/session-state.ts';
export { LOCAL_POLL_MS, runWait } from './sync/session-wait.ts';
export type { WaitPorts } from './sync/session-wait.ts';
export { preWaitMs, sessionEvenIntervalMs } from './sync/session-pacing.ts';

const PREFIX = 'pnpm sync:';
const MS_PER_HOUR = 60 * 60 * 1000;

/** `--pinned-max-age <hours>`'s default (AD-7): a pinned entry is due once it is older. */
export const DEFAULT_PINNED_MAX_AGE_HOURS = 4;

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
  /** Where the contact `User-Agent` and the optional session cookie (AD-30) are read from. */
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
    // The governor already redacted what it passed on; this covers the rest.
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
    // is no State reading.
    freshReading: !isSessionExpired(result) && pacing.ledger !== ledgerBefore,
    evenIntervalMs: sessionEvenIntervalMs(pacing, isWithGate),
  };
}

/** One pass of the session loop: pre-wait, one chunk, then the wait it earned. */
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

  // One holder per process: each settle prints one line, once.
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
    // or only probe 429s.
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
if (isInvokedDirectly(import.meta.url)) {
  try {
    await main();
  } catch (error) {
    process.stderr.write(`${PREFIX} ${String(error)}\n`);
    // `process.exitCode`, not `process.exit(1)`: an immediate exit truncates a piped stderr write.
    process.exitCode = 1;
  }
}
