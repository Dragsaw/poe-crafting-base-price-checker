import { describe, expect, it } from 'vitest';

import { CrossFileGateError } from '../chunk/cross-file-gate.ts';
import { STALE_LOCK_AFTER_MS } from '../chunk/lock.ts';
import type { ChunkOutcome } from '../chunk/run-chunk.ts';
import { DATASET_PATH } from '../chunk/run-chunk.ts';
import { LeagueMismatchError, LeagueRequestRejectedError } from '../league/league-gate.ts';
import { DataFileError } from '../load-data-file.ts';
import { MalformedRequestError, UnexpectedTradeResponseError } from '../pricing/price-entry.ts';
import { zeroRequests } from '../request-counter.ts';
import {
  backoffMs,
  COLD_EVEN_INTERVAL_MS,
  INITIAL_SESSION_STATE,
  nextState,
  nextWait,
  parseArguments,
} from '../sync.ts';
import type { ChunkContext, ChunkResult, SessionState } from '../sync.ts';
import { LEAGUE, NOW } from './test-support.ts';

describe('parseArguments', () => {
  it('defaults the pinned maximum age to 4 hours', () => {
    expect(parseArguments([])).toEqual({ ok: true, options: { pinnedMaxAgeMs: 4 * 3_600_000 } });
  });

  it('reads --pinned-max-age in hours and skips a literal --', () => {
    expect(parseArguments(['--', '--pinned-max-age', '2'])).toEqual({
      ok: true,
      options: { pinnedMaxAgeMs: 2 * 3_600_000 },
    });
  });

  it.each([[['--pinned-max-age']], [['--pinned-max-age', '0']], [['--pinned-max-age', 'x']], [['--nope']]])(
    'refuses %j',
    (argv) => {
      expect(parseArguments(argv)).toMatchObject({ ok: false });
    },
  );
});

const outcome = (value: ChunkOutcome): ChunkResult => ({ kind: 'outcome', outcome: value });

const failure = (error: unknown): ChunkResult => ({ kind: 'error', error });

describe('nextWait: the session matrix', () => {
  const COLD: ChunkContext = { now: NOW, freshReading: false, evenIntervalMs: COLD_EVEN_INTERVAL_MS };
  const base = { completed: [], entries: [], records: [] };
  const at = (ms: number): string => new Date(Date.parse(NOW) + ms).toISOString();

  it('5xx or timeout with a State reading: continue, the spread paces the retry', () => {
    expect(nextWait(outcome({ ...base, kind: 'yielded' }), INITIAL_SESSION_STATE, { ...COLD, freshReading: true })).toEqual({
      kind: 'none',
    });
  });

  it('no answer on a cold lane: 36 s, then 72 s, then back to 36 s after a reading', () => {
    const noAnswer = outcome({ ...base, kind: 'yielded', newPass: false });
    const first = nextWait(noAnswer, INITIAL_SESSION_STATE, COLD);
    expect(first).toEqual({ kind: 'until', until: at(36_000), reason: 'no answer', orInputChange: false });

    const once = nextState(INITIAL_SESSION_STATE, noAnswer, COLD, { signature: 's', before: zeroRequests() });
    expect(nextWait(noAnswer, once, COLD)).toMatchObject({ until: at(72_000) });

    const twice = nextState(once, noAnswer, COLD, { signature: 's', before: zeroRequests() });
    const read = nextState(twice, outcome({ ...base, kind: 'bounded', bound: 'entries', newPass: false }), {
      ...COLD,
      freshReading: true,
    }, { signature: 's', before: zeroRequests() });
    expect(read.backoffCount).toBe(0);
    expect(nextWait(noAnswer, read, COLD)).toMatchObject({ until: at(36_000) });
  });

  it('session-expired: backoff(1) whatever the backoff count, and no fresh reading resets it', () => {
    const expired = outcome({ ...base, kind: 'yielded', newPass: false, sessionExpired: true });
    const deep: SessionState = { ...INITIAL_SESSION_STATE, backoffCount: 3 };
    const wait = { kind: 'until', until: at(36_000), reason: 'the session cookie expired', orInputChange: false };

    expect(nextWait(expired, deep, COLD)).toEqual(wait);
    // Even a context that saw the reset ledger as a reading.
    expect(nextWait(expired, deep, { ...COLD, freshReading: true })).toEqual(wait);
    expect(nextState(deep, expired, COLD, { signature: 's', before: zeroRequests() }).backoffCount).toBe(1);
    expect(
      nextState(deep, expired, { ...COLD, freshReading: true }, { signature: 's', before: zeroRequests() }).backoffCount,
    ).toBe(1);
  });

  it('caps the backoff at the 6 h stale threshold', () => {
    expect(backoffMs(COLD_EVEN_INTERVAL_MS, 30)).toBe(STALE_LOCK_AFTER_MS);
  });

  it('other throw: until an input change, or at most the backoff', () => {
    for (const error of [new UnexpectedTradeResponseError('k', 'search', 'bad'), Object.assign(new Error('EBUSY'), { code: 'EBUSY' })]) {
      expect(nextWait(failure(error), INITIAL_SESSION_STATE, COLD)).toEqual({
        kind: 'input-change',
        reason: 'an unexpected failure',
        until: at(36_000),
      });
    }
  });

  it('429: until the notBefore the chunk wrote', () => {
    expect(
      nextWait(outcome({ ...base, kind: 'yielded' }), INITIAL_SESSION_STATE, { ...COLD, notBefore: at(60_000) }),
    ).toEqual({ kind: 'until', until: at(60_000), reason: 'a 429', orInputChange: false });
  });

  it('penalty: a deferred chunk waits until its notBefore', () => {
    expect(nextWait(outcome({ ...base, kind: 'deferred', notBefore: at(5000) }), INITIAL_SESSION_STATE, COLD)).toEqual({
      kind: 'until',
      until: at(5000),
      reason: 'a trade penalty',
      orInputChange: false,
    });
  });

  it('gate 4xx: until the abort notBefore, not ended by an input change', () => {
    expect(
      nextWait(failure(new LeagueRequestRejectedError(404)), INITIAL_SESSION_STATE, {
        ...COLD,
        notBefore: at(STALE_LOCK_AFTER_MS),
      }),
    ).toMatchObject({ kind: 'until', until: at(STALE_LOCK_AFTER_MS), orInputChange: false });
  });

  it('malformed request: until the abort notBefore, or an input change if sooner', () => {
    expect(
      nextWait(failure(new MalformedRequestError('k', 'search', 400, undefined as never)), INITIAL_SESSION_STATE, {
        ...COLD,
        notBefore: at(STALE_LOCK_AFTER_MS),
      }),
    ).toMatchObject({ kind: 'until', until: at(STALE_LOCK_AFTER_MS), orInputChange: true });
  });

  it('refusal or league mismatch: until an input file changes, with no time bound', () => {
    for (const error of [
      new DataFileError('data/config.json', 'absent', 'the file is absent'),
      new LeagueMismatchError('X', []),
      new CrossFileGateError([]),
    ]) {
      expect(nextWait(failure(error), INITIAL_SESSION_STATE, COLD)).toEqual({
        kind: 'input-change',
        reason: 'a refused input or a league mismatch',
      });
    }
  });

  it('a refused sync-owned file is not watched, so it takes the other-throw backoff', () => {
    const error = new DataFileError(DATASET_PATH, 'invalid', 'invalid: entries');
    expect(nextWait(failure(error), INITIAL_SESSION_STATE, COLD)).toEqual({
      kind: 'input-change',
      reason: 'an unexpected failure',
      until: at(36_000),
    });
  });

  it('a throw keeps the confirmed league, except a league mismatch', () => {
    const confirmed: SessionState = { ...INITIAL_SESSION_STATE, confirmedLeague: LEAGUE, confirmedSignature: 's' };
    const iteration = { signature: 's', before: zeroRequests() };
    const transient = nextState(confirmed, failure(new Error('EBUSY')), COLD, iteration);
    expect(transient).toEqual({ ...confirmed, backoffCount: 1 });
    const mismatch = nextState(confirmed, failure(new LeagueMismatchError('X', [])), COLD, iteration);
    expect(mismatch.confirmedLeague).toBeUndefined();
    expect(mismatch.backoffCount).toBe(0);
  });

  it('a malformed request with no notBefore doubles its backoff like any other throw', () => {
    const malformed = failure(new MalformedRequestError('k', 'search', 400, undefined as never));
    const once = nextState(INITIAL_SESSION_STATE, malformed, COLD, { signature: 's', before: zeroRequests() });
    expect(once.backoffCount).toBe(1);
    expect(nextWait(malformed, once, COLD)).toMatchObject({ until: at(72_000) });
  });

  it('nothing due: until an input change, or at most the unresolvable retry interval', () => {
    expect(nextWait(outcome({ ...base, kind: 'completed' }), INITIAL_SESSION_STATE, COLD)).toEqual({
      kind: 'input-change',
      reason: 'nothing due',
      until: at(24 * 3_600_000),
    });
  });

  it('an entry completed or bounded: continue', () => {
    expect(nextWait(outcome({ ...base, completed: ['k'], kind: 'completed' }), INITIAL_SESSION_STATE, COLD)).toEqual({ kind: 'none' });
    expect(nextWait(outcome({ ...base, kind: 'bounded', bound: 'entries' }), INITIAL_SESSION_STATE, COLD)).toEqual({ kind: 'none' });
  });

  it('lock held: poll the lock file', () => {
    expect(nextWait(outcome({ ...base, kind: 'busy' }), INITIAL_SESSION_STATE, COLD)).toMatchObject({ kind: 'lock' });
    expect(nextWait(outcome({ ...base, kind: 'dispossessed' }), INITIAL_SESSION_STATE, COLD)).toMatchObject({ kind: 'lock' });
  });
});
