import { UNRESOLVABLE_RETRY_MS } from '@poe/core';

import { CrossFileGateError } from '../chunk/cross-file-gate.ts';
import { STALE_LOCK_AFTER_MS } from '../chunk/lock.ts';
import type { ChunkOutcome } from '../chunk/run-chunk.ts';
import { LeagueMismatchError } from '../league/league-gate.ts';
import { DataFileError } from '../load-data-file.ts';
import { PinnedCapExceededError } from '../pinned-cap.ts';
import { MalformedRequestError } from '../pricing/price-entry.ts';
import { UnknownClassBaseTypeError } from '../pricing/search-body.ts';
import type { RequestsBySource } from '../request-counter.ts';
import { INPUT_PATHS } from './session-inputs.ts';

/** What one iteration's chunk ended with. */
export type ChunkResult =
  | { readonly kind: 'outcome'; readonly outcome: ChunkOutcome }
  | { readonly kind: 'error'; readonly error: unknown };

export interface SessionState {
  /** The league the last chunk confirmed; absent until one does, and after a throw or yield. */
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

/** A throw only an input-file edit clears; a refused sync-owned file is no input: backoff. */
function isRefusal(error: unknown): boolean {
  return (
    (error instanceof DataFileError && INPUT_PATHS.includes(error.path)) ||
    error instanceof PinnedCapExceededError ||
    error instanceof UnknownClassBaseTypeError ||
    error instanceof LeagueMismatchError ||
    error instanceof CrossFileGateError
  );
}

/** Decisions 5 and 6: no `notBefore`, and a yield with no State reading or a non-refusal throw. */
function isBackoff(result: ChunkResult, context: ChunkContext): boolean {
  if (context.notBefore !== undefined) {
    return false;
  }
  return result.kind === 'outcome' ? result.outcome.kind === 'yielded' && (!context.freshReading || isSessionExpired(result)) : !isRefusal(result.error);
}

/** AD-30's downgrade (§13.4) resets pacing in place, so only the outcome tells it apart. */
export function isSessionExpired(result: ChunkResult): boolean {
  return result.kind === 'outcome' && result.outcome.kind === 'yielded' && result.outcome.sessionExpired === true;
}

/** `1` after a State reading or a downgrade (pacing is cold again), else one more than the last. */
function backoffCountFor(state: SessionState, context: ChunkContext, result: ChunkResult): number {
  return context.freshReading || isSessionExpired(result) ? 1 : state.backoffCount + 1;
}

/** The even interval doubled per consecutive backoff, capped at the 6 h stale threshold. */
export function backoffMs(evenInterval: number, count: number): number {
  const doubled = evenInterval * 2 ** Math.max(0, count - 1);
  return Math.min(doubled, STALE_LOCK_AFTER_MS);
}

export function plus(now: string, ms: number): string {
  return new Date(Date.parse(now) + ms).toISOString();
}

/** The wait after one chunk (the session's I/O matrix); pure. */
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

/** The state after one chunk; `signature` and `before` are the iteration's, read pre-chunk. */
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

/** The gate is due when no league is confirmed, a new pass starts, or an input changed since. */
export function isGateDue(state: SessionState, signature: string): boolean {
  return (
    state.confirmedLeague === undefined || state.passEnded || signature !== state.confirmedSignature
  );
}
