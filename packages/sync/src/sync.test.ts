import { readFileSync } from 'node:fs';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  canonicalKey,
  createFakeClockPort,
  createFakeFilesystemPort,
  createFakeGitPort,
  createFakeHttpPort,
  SUPPORTED_SCHEMA_VERSION,
  SYNC_PROGRESS_SCHEMA_VERSION,
  SyncReportFileSchema,
  TRACKED_SCHEMA_VERSION,
  WEIGHTS_SCHEMA_VERSION,
} from '@poe/contracts';
import type {
  DatasetEntry,
  FakeClockPort,
  FakeFilesystemPort,
  HttpPort,
  HttpRequest,
  HttpResponse,
  SyncReportFile,
  TrackedEntry,
} from '@poe/contracts';
import { describe, expect, it, vi } from 'vitest';

import { CrossFileGateError } from './chunk/cross-file-gate.ts';
import { LOCK_PATH, serialiseLock, STALE_LOCK_AFTER_MS } from './chunk/lock.ts';
import type { ChunkOutcome } from './chunk/run-chunk.ts';
import { DATASET_PATH, PROGRESS_PATH, REPORT_PATH, TRACKED_PATH } from './chunk/run-chunk.ts';
import { LeagueMismatchError, LeagueRequestRejectedError } from './league/league-gate.ts';
import { DataFileError } from './load-data-file.ts';
import { MalformedRequestError, UnexpectedTradeResponseError } from './pricing/price-entry.ts';
import { zeroRequests } from './request-counter.ts';
import { abortableSleep } from './shell.ts';
import {
  backoffMs,
  COLD_EVEN_INTERVAL_MS,
  isGateDue,
  INITIAL_SESSION_STATE,
  inputSignature,
  isLockFree,
  LOCAL_POLL_MS,
  nextState,
  nextWait,
  parseArguments,
  preWaitMs,
  runWait,
  sessionEvenIntervalMs,
  syncSessionCommand,
} from './sync.ts';
import type { ChunkContext, ChunkResult, SessionState, SyncSessionDependencies } from './sync.ts';
import { createPacingState } from './trade/client.ts';
import type * as TradeClientModule from './trade/client.ts';
import { DATA_LANE, FETCH_LANE, SEARCH_LANE, TRADE_LEAGUES_URL, tradeFetchUrl, tradeSearchUrl } from './trade/endpoints.ts';
import { recordObservation } from './trade/ledger.ts';
import { parseRateLimitHeaders } from './trade/rate-limit-headers.ts';
import { SESSION_COOKIE_ENV_VAR } from './trade/session-auth.ts';
import { USER_AGENT_ENV_VAR } from './trade/user-agent.ts';

/** Every option set a chunk built its governor with, in build order. */
const governorOptions = vi.hoisted((): Record<string, unknown>[] => []);

// A pass-through: the real governor is built, and the options are recorded so
// a test can inspect what the session passed (AD-8).
vi.mock('./trade/client.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof TradeClientModule>();
  return {
    ...actual,
    createTradeGovernor: (options: Parameters<typeof actual.createTradeGovernor>[0]) => {
      governorOptions.push(options as unknown as Record<string, unknown>);
      return actual.createTradeGovernor(options);
    },
  };
});

/**
 * The `pnpm sync` session, driven with injected ports and a fake clock that
 * each session wait advances. Nothing here runs the command itself, touches
 * the network, or writes under `data/`.
 */

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SCRIPT = fileURLToPath(new URL('sync.ts', import.meta.url));

const LEAGUE = 'Test League';
const NOW = '2026-09-26T12:00:00.000Z';
const CONTACT = 'poe-crafting-base-price-checker/0.0.0 (contact: someone@example.test)';

const ENTRY: TrackedEntry = { kind: 'raw', baseTypeId: 'Solar Amulet', itemLevelMin: 82, status: 'active' };
const SECOND: TrackedEntry = { ...ENTRY, itemLevelMin: 83 };

const LEAGUES_BODY = JSON.stringify({
  result: [
    { id: 'Standard', realm: 'poe2', text: 'Standard' },
    { id: LEAGUE, realm: 'poe2', text: LEAGUE },
  ],
});
const NO_RESULTS = JSON.stringify({ id: 'S0', complexity: 1, result: [], total: 0 });

function inputs(
  tracked: readonly TrackedEntry[],
  minChunkSearches = 1,
): Parameters<typeof createFakeFilesystemPort>[0] {
  return {
    [TRACKED_PATH]: {
      contents: JSON.stringify({ schemaVersion: TRACKED_SCHEMA_VERSION, entries: tracked }),
      modifiedAt: '2026-09-20T07:00:00.000Z',
    },
    'data/config.json': {
      contents: JSON.stringify({ schemaVersion: SUPPORTED_SCHEMA_VERSION, league: LEAGUE, minChunkSearches }),
      modifiedAt: '2026-09-20T07:00:00.000Z',
    },
    'data/currencies.json': {
      contents: JSON.stringify({
        schemaVersion: SUPPORTED_SCHEMA_VERSION,
        rates: [{ currencyId: 'divine', rate: 1, source: 'measured', league: LEAGUE, asOf: '2026-01-01T00:00:00Z' }],
      }),
    },
    'data/catalogue/items.json': {
      contents: JSON.stringify({
        schemaVersion: SUPPORTED_SCHEMA_VERSION,
        result: [{ id: 'accessory', label: 'Accessories', entries: [{ type: 'Solar Amulet' }] }],
      }),
    },
    'data/catalogue/stats.json': { contents: JSON.stringify({ schemaVersion: SUPPORTED_SCHEMA_VERSION, result: [] }) },
    'data/catalogue/filters.json': { contents: JSON.stringify({ schemaVersion: SUPPORTED_SCHEMA_VERSION, result: [] }) },
    'data/weights.json': { contents: JSON.stringify({ schemaVersion: WEIGHTS_SCHEMA_VERSION, gamePatch: '0.5.5', producer: { id: 'test', generatedAt: '2026-09-26T00:00:00Z' }, bases: {} }) },
  };
}

function headers(policy: string, rule: string, state: string): Record<string, string> {
  return {
    'x-rate-limit-policy': policy,
    'x-rate-limit-rules': 'Ip',
    'x-rate-limit-ip': rule,
    'x-rate-limit-ip-state': state,
  };
}

interface SessionSetup {
  readonly tracked?: readonly TrackedEntry[];
  readonly minChunkSearches?: number;
  readonly seeded?: NonNullable<Parameters<typeof createFakeFilesystemPort>[0]>;
  readonly fixtures?: Readonly<Record<string, HttpResponse>>;
  /** Replaces the fake http port, e.g. to fail with a network error. */
  readonly http?: (fake: ReturnType<typeof createFakeHttpPort>) => HttpPort;
  readonly env?: Record<string, string | undefined>;
  readonly argv?: readonly string[];
  /** The session stops after this many chunk lines (stdout outcome or stderr error). */
  readonly stopAfter?: number;
}

const OUTCOME_LINE = /^pnpm sync: (completed|bounded|yielded|busy|deferred|dispossessed)/;
const AUTH_LINE = /^pnpm sync: (authenticated|unauthenticated \()/;

function sessionFor(setup: SessionSetup = {}) {
  const fs = createFakeFilesystemPort({
    ...inputs(setup.tracked ?? [ENTRY], setup.minChunkSearches),
    ...setup.seeded,
  });
  const clock = createFakeClockPort(NOW);
  const fake = createFakeHttpPort({
    [`GET ${TRADE_LEAGUES_URL}`]: { status: 200, headers: {}, body: LEAGUES_BODY },
    [`POST ${tradeSearchUrl(LEAGUE)}`]: { status: 200, headers: {}, body: NO_RESULTS },
    ...setup.fixtures,
  });
  const http = setup.http === undefined ? fake : setup.http(fake);
  const controller = new AbortController();
  const out: { readonly line: string; readonly at: string }[] = [];
  const error: string[] = [];
  const auth: { readonly line: string; readonly requestsBefore: number }[] = [];
  /** The session's waits, in order. Each advances the fake clock. */
  const sleeps: number[] = [];
  /** The in-chunk waits the governor asked for. */
  const waits: number[] = [];
  const stopAfter = setup.stopAfter ?? 1;
  let chunks = 0;
  const countChunk = (): void => {
    chunks += 1;
    if (chunks >= stopAfter) {
      controller.abort();
    }
  };
  const dependencies: SyncSessionDependencies = {
    fs,
    clock,
    http,
    git: createFakeGitPort(),
    wait: (ms) => {
      waits.push(ms);
      clock.set(new Date(Date.parse(clock.now()) + ms).toISOString());
      return Promise.resolve();
    },
    sleep: (ms) => {
      sleeps.push(ms);
      clock.set(new Date(Date.parse(clock.now()) + ms).toISOString());
      // A guard against a test that never stops.
      if (sleeps.length > 200) {
        controller.abort();
      }
      return Promise.resolve();
    },
    pid: 4242,
    log: () => {},
    env: setup.env ?? { [USER_AGENT_ENV_VAR]: CONTACT },
    argv: setup.argv ?? [],
    signal: controller.signal,
    stdout: (line) => {
      out.push({ line, at: clock.now() });
      if (OUTCOME_LINE.test(line)) {
        countChunk();
      }
    },
    stderr: (line) => {
      // A §13.5 auth line is not a chunk line: kept apart, with the requests sent before it.
      if (AUTH_LINE.test(line)) {
        auth.push({ line, requestsBefore: fake.requests.length });
        return;
      }
      error.push(line);
      countChunk();
    },
  };
  return { deps: dependencies, fs, clock, http: fake, out, err: error, auth, sleeps, waits, controller };
}

async function reportOf(fs: FakeFilesystemPort): Promise<SyncReportFile | undefined> {
  const text = await fs.readTextFile(REPORT_PATH);
  return text === undefined ? undefined : SyncReportFileSchema.parse(JSON.parse(text));
}

const lines = (out: readonly { readonly line: string }[]): string[] => out.map((entry) => entry.line);

/** The duration each matching wait line announced, from the instant it was printed. */
function announced(out: readonly { readonly line: string; readonly at: string }[], reason: string): number[] {
  return out
    .filter((entry) => entry.line.includes(`(${reason}`))
    .map((entry) => {
      const until = /waiting until (\S+)/.exec(entry.line)?.[1] ?? '';
      return Date.parse(until) - Date.parse(entry.at);
    });
}

const networkDown = (): HttpPort => ({
  send: () => Promise.reject(new TypeError('fetch failed')),
});

// ---------------------------------------------------------------------------

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

  it('session-expired: backoff(1) whatever the backoff count, and no fresh reading resets it (§13.4)', () => {
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

describe('the gate-due pre-wait', () => {
  const DATA_POLICY = 'data-policy';

  it('is due with no confirmed league, after a completed pass, and after an input change', () => {
    const confirmed: SessionState = { ...INITIAL_SESSION_STATE, confirmedLeague: LEAGUE, confirmedSignature: 's' };
    expect(isGateDue(INITIAL_SESSION_STATE, 's')).toBe(true);
    expect(isGateDue(confirmed, 's')).toBe(false);
    expect(isGateDue({ ...confirmed, passEnded: true }, 's')).toBe(true);
    expect(isGateDue(confirmed, 't')).toBe(true);
  });

  it('includes DATA_LANE only when the gate is due', () => {
    const pacing = createPacingState();
    pacing.ledger = recordObservation(
      pacing.ledger,
      parseRateLimitHeaders(headers(DATA_POLICY, '10:100:60', '5:100:0')),
      NOW,
    );
    pacing.lanePolicies.set(DATA_LANE, DATA_POLICY);

    expect(preWaitMs(pacing, NOW, true)).toBe(20_000);
    expect(preWaitMs(pacing, NOW, false)).toBe(0);
    // A cold lane counts as the measured 36 s for the backoff.
    expect(sessionEvenIntervalMs(pacing, false)).toBe(COLD_EVEN_INTERVAL_MS);
    pacing.lanePolicies.set(SEARCH_LANE, DATA_POLICY);
    pacing.lanePolicies.set(FETCH_LANE, DATA_POLICY);
    expect(sessionEvenIntervalMs(pacing, false)).toBe(10_000);
  });
});

function waitPorts(fs: FakeFilesystemPort, clock: FakeClockPort, step = LOCAL_POLL_MS) {
  const controller = new AbortController();
  const sleeps: number[] = [];
  return {
    controller,
    sleeps,
    ports: {
      fs,
      clock,
      signal: controller.signal,
      sleep: (ms: number) => {
        sleeps.push(ms);
        clock.set(new Date(Date.parse(clock.now()) + Math.min(ms, step)).toISOString());
        return Promise.resolve();
      },
    },
  };
}

describe('runWait and the local polls', () => {
  it('an other-throw wait ends at the backoff', async () => {
    const fs = createFakeFilesystemPort(inputs([ENTRY]));
    const clock = createFakeClockPort(NOW);
    const { ports } = waitPorts(fs, clock);
    const until = new Date(Date.parse(NOW) + 36_000).toISOString();

    await runWait({ kind: 'input-change', reason: 'r', until }, ports, await inputSignature(fs));

    expect(clock.now()).toBe(until);
  });

  it('an other-throw wait ends at an input change, if that is sooner', async () => {
    const fs = createFakeFilesystemPort(inputs([ENTRY]));
    const clock = createFakeClockPort(NOW);
    const { ports, sleeps } = waitPorts(fs, clock);
    const signature = await inputSignature(fs);
    const edit = ports.sleep;
    const until = new Date(Date.parse(NOW) + 36_000).toISOString();

    await runWait(
      { kind: 'input-change', reason: 'r', until },
      {
        ...ports,
        sleep: async (ms) => {
          await edit(ms);
          fs.setFile('data/config.json', { contents: '{}', modifiedAt: clock.now() });
        },
      },
      signature,
    );

    expect(sleeps).toHaveLength(1);
    expect(clock.now()).toBe(new Date(Date.parse(NOW) + LOCAL_POLL_MS).toISOString());
  });

  it('a held lock that ages past 6 h ends the wait', async () => {
    const fs = createFakeFilesystemPort({ [LOCK_PATH]: { contents: serialiseLock({ pid: 99, startedAt: NOW }) } });
    const clock = createFakeClockPort(NOW);
    const { ports } = waitPorts(fs, clock, 3_600_000);

    expect(await isLockFree(fs, clock)).toBe(false);
    await runWait({ kind: 'lock', reason: 'r' }, ports, '');

    expect(Date.parse(clock.now()) - Date.parse(NOW)).toBeGreaterThan(STALE_LOCK_AFTER_MS);
    expect(await isLockFree(fs, clock)).toBe(true);
  });

  it('an unreadable lock is free only once its file time is stale', async () => {
    const clock = createFakeClockPort(NOW);
    const recent = createFakeFilesystemPort({ [LOCK_PATH]: { contents: '', modifiedAt: NOW } });
    const old = createFakeFilesystemPort({ [LOCK_PATH]: { contents: '', modifiedAt: '2026-09-26T05:00:00.000Z' } });
    const untimed = createFakeFilesystemPort({ [LOCK_PATH]: { contents: '' } });

    expect(await isLockFree(recent, clock)).toBe(false);
    expect(await isLockFree(old, clock)).toBe(true);
    expect(await isLockFree(untimed, clock)).toBe(false);
    expect(await isLockFree(createFakeFilesystemPort(), clock)).toBe(true);
  });

  it('a lock read that throws is not free, and an input read that throws still signs', async () => {
    const fs = createFakeFilesystemPort(inputs([ENTRY]));
    const broken: FakeFilesystemPort = {
      ...fs,
      readTextFile: () => Promise.reject(new Error('EPERM')),
      lastModifiedAt: () => Promise.reject(new Error('EBUSY')),
    };

    expect(await isLockFree(broken, createFakeClockPort(NOW))).toBe(false);
    await expect(inputSignature(broken)).resolves.toContain('error');
  });

  it('a wait cancels at once on an abort', async () => {
    const fs = createFakeFilesystemPort(inputs([ENTRY]));
    const clock = createFakeClockPort(NOW);
    const controller = new AbortController();
    const started = Date.now();
    const waiting = runWait(
      { kind: 'until', until: new Date(Date.parse(NOW) + 3_600_000).toISOString(), reason: 'r', orInputChange: false },
      { fs, clock, signal: controller.signal, sleep: abortableSleep },
      '',
    );
    setTimeout(() => {
      controller.abort();
    }, 10);

    await waiting;

    expect(Date.now() - started).toBeLessThan(5000);
  });
});

const cookies = (http: ReturnType<typeof createFakeHttpPort>) =>
  http.requests.map((request) => [request.method, request.headers['cookie']]);

/** A pinned entry last attempted 1 h before NOW, beside one active entry. */
function hourOldPinned(argv: readonly string[]) {
  const pinned: TrackedEntry = { ...SECOND, status: 'pinned' };
  const dataset = {
    schemaVersion: SUPPORTED_SCHEMA_VERSION,
    league: LEAGUE,
    generatedAt: NOW,
    entries: [
      { entryKey: canonicalKey(pinned), price: { state: 'no-listings' }, lastAttemptedAt: '2026-09-26T11:00:00.000Z' },
    ] satisfies DatasetEntry[],
    currencyRates: [],
  };
  const session = sessionFor({
    tracked: [pinned, ENTRY],
    minChunkSearches: 2,
    seeded: { [DATASET_PATH]: { contents: JSON.stringify(dataset) } },
    argv,
  });
  return { ...session, pinned };
}

describe('pnpm sync: the session with injected ports', () => {
  it('refuses a blank contact before any request, with exit 1', async () => {
    const { deps, http, err } = sessionFor({ env: {} });

    expect(await syncSessionCommand(deps)).toBe(1);

    expect(http.requests).toEqual([]);
    expect(err[0]).toContain(USER_AGENT_ENV_VAR);
  });

  it('refuses an unknown argument with exit 1', async () => {
    const { deps, http, err } = sessionFor({ argv: ['--nope'] });

    expect(await syncSessionCommand(deps)).toBe(1);

    expect(http.requests).toEqual([]);
    expect(err[0]).toMatch(/^pnpm sync: unknown argument "--nope"/);
  });

  it('cold start: the gate request goes out at once, one entry per chunk, exit 0 on the stop', async () => {
    governorOptions.length = 0;
    const { deps, http, out, sleeps, fs } = sessionFor({ tracked: [ENTRY, SECOND] });

    expect(await syncSessionCommand(deps)).toBe(0);

    expect(sleeps).toEqual([]);
    expect(http.requests.map((request) => `${request.method} ${request.url}`)).toEqual([
      `GET ${TRADE_LEAGUES_URL}`,
      `POST ${tradeSearchUrl(LEAGUE)}`,
    ]);
    expect(lines(out)).toEqual([
      `pnpm sync: bounded by entries, 1 completed: ${canonicalKey(ENTRY)}`,
      'pnpm sync: stopped',
    ]);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
    // Each chunk: the spread pacer, the shared pacing state and the threshold of 1.
    expect(governorOptions).toHaveLength(1);
    expect(governorOptions[0]).toMatchObject({ spread: true, invalidRequestThreshold: 1 });
    expect(governorOptions[0]?.['pacing']).toBeTypeOf("object");
    expect(governorOptions[0]?.['pacing']).not.toBeNull();
  });

  it('pass-level requestsBySource after two iterations, and the gate runs once', async () => {
    const { deps, http, fs } = sessionFor({ tracked: [ENTRY, SECOND], stopAfter: 2 });

    expect(await syncSessionCommand(deps)).toBe(0);

    expect(http.requests.map((request) => request.method)).toEqual(['GET', 'POST', 'POST']);
    const report = await reportOf(fs);
    expect(report?.figures.requestsBySource).toEqual({ 'league-validation': 1, 'tracked-list': 2, 'session-probe': 0 });
  });

  it('an absent cookie over several chunks: exactly one unauthenticated (absent) line, before the first request', async () => {
    const { deps, http, auth } = sessionFor({ tracked: [ENTRY, SECOND], stopAfter: 3 });

    expect(await syncSessionCommand(deps)).toBe(0);

    expect(http.requests.length).toBeGreaterThanOrEqual(3);
    expect(auth).toEqual([{ line: 'pnpm sync: unauthenticated (absent)', requestsBefore: 0 }]);
  });

  it.each(['a b', 'a;b', 'a,b', '"x', 'café'])('a malformed cookie %j: one malformed line, exit 0', async (value) => {
    const { deps, auth } = sessionFor({
      env: { [USER_AGENT_ENV_VAR]: CONTACT, [SESSION_COOKIE_ENV_VAR]: value },
      stopAfter: 2,
      tracked: [ENTRY, SECOND],
    });

    expect(await syncSessionCommand(deps)).toBe(0);

    expect(auth).toEqual([{ line: 'pnpm sync: unauthenticated (malformed)', requestsBefore: 0 }]);
  });

  it('a blank contact is refused before the auth line is printed', async () => {
    const { deps, auth } = sessionFor({ env: { [SESSION_COOKIE_ENV_VAR]: ' '.repeat(3) } });

    expect(await syncSessionCommand(deps)).toBe(1);

    expect(auth).toEqual([]);
  });

  describe('the session probe (AD-30, IMPLEMENTATION-NOTES.md §13.2, §13.3, §13.5)', () => {
    const VALUE = `"${'Z'.repeat(32)}"`;
    const COOKIE = `POESESSID=${VALUE}`;
    const THIRD: TrackedEntry = { ...ENTRY, itemLevelMin: 84 };
    const COOKIE_ENV = { [USER_AGENT_ENV_VAR]: CONTACT, [SESSION_COOKIE_ENV_VAR]: VALUE };
    /** One rule more than the fake's baseline answer, which names none. */
    const LIVE: HttpResponse = {
      status: 200,
      headers: headers('search-policy', '30:300:60', '1:300:0'),
      body: NO_RESULTS,
    };

    /**
     * Answers each cookie-carrying search from `answers` in turn while any
     * are left: those are the probes, because nothing else carries the cookie
     * before an `authenticated` settle. The fake records every request.
     */
    function probing(...answers: (HttpResponse | Error)[]) {
      return probingThen(answers);
    }

    /**
     * As `probing`, and every later cookie request is answered by `after`: by
     * default the fake's answer with the live rule set added, so the cookie
     * stays live (§13.4).
     */
    function probingThen(
      answers: (HttpResponse | Error)[],
      after: (request: HttpRequest, answer: HttpResponse) => HttpResponse = (_request, answer) => ({
        ...answer,
        headers: { ...answer.headers, ...LIVE.headers },
      }),
    ) {
      return (fake: ReturnType<typeof createFakeHttpPort>): HttpPort => ({
        async send(request) {
          const sent = fake.send(request);
          if (request.headers['cookie'] === undefined) {
            return sent;
          }
          const answer = request.method === 'POST' ? answers.shift() : undefined;
          const fakeAnswer = await sent;
          if (answer === undefined) {
            return after(request, fakeAnswer);
          }
          if (answer instanceof Error) {
            throw answer;
          }
          return answer;
        },
      });
    }

    it('a live cookie over three chunks: one probe, one authenticated line, and session-probe 1 for the pass', async () => {
      governorOptions.length = 0;
      const { deps, auth, err, http, fs } = sessionFor({
        env: COOKIE_ENV,
        tracked: [ENTRY, SECOND, THIRD],
        stopAfter: 3,
        http: probing(LIVE),
      });

      expect(await syncSessionCommand(deps)).toBe(0);

      // CAP-1: the baseline without the cookie, the probe with it, every later
      // pricing search with it, and the league request never.
      expect(cookies(http)).toEqual([
        ['GET', undefined],
        ['POST', undefined],
        ['POST', COOKIE],
        ['POST', COOKIE],
        ['POST', COOKIE],
      ]);
      expect(auth).toEqual([{ line: 'pnpm sync: authenticated', requestsBefore: 3 }]);
      expect(err).toEqual([]);
      const report = await reportOf(fs);
      expect(report?.figures.requestsBySource).toEqual({
        'league-validation': 1,
        'tracked-list': 3,
        'session-probe': 1,
      });
      // One holder for the process: every chunk's governor gets the same one.
      expect(governorOptions).toHaveLength(3);
      const holders = new Set(governorOptions.map((options) => (options['auth'] as { holder: unknown }).holder));
      expect(holders.size).toBe(1);
    });

    it.each([
      ['not-elevated', { status: 200, headers: {}, body: NO_RESULTS }],
      ['probe-rejected', { status: 403, headers: {}, body: 'forbidden' }],
      ['probe-failed', { status: 503, headers: {}, body: '' }],
      ['probe-failed', new TypeError('fetch failed')],
    ])('%s: one line after the probe, no later request carries the cookie, exit 0', async (reason, answer) => {
      const { deps, auth, err, http } = sessionFor({
        env: COOKIE_ENV,
        tracked: [ENTRY, SECOND, THIRD],
        stopAfter: 2,
        http: probing(answer),
      });

      expect(await syncSessionCommand(deps)).toBe(0);

      expect(auth).toEqual([{ line: `pnpm sync: unauthenticated (${reason})`, requestsBefore: 3 }]);
      expect(err).toEqual([]);
      expect(cookies(http)).toEqual([
        ['GET', undefined],
        ['POST', undefined],
        ['POST', COOKIE],
        ['POST', undefined],
      ]);
    });

    it('a probe 429: no line, notBefore persisted, and the next chunk probes again', async () => {
      const { deps, auth, http, fs, clock } = sessionFor({
        env: COOKIE_ENV,
        tracked: [ENTRY, SECOND, THIRD],
        stopAfter: 2,
        http: probing({ status: 429, headers: { 'retry-after': '60' }, body: '' }, LIVE),
      });
      // At the session's first wait: the notBefore the probe-429 chunk left in
      // the progress file, and the instant the wait ends.
      let first: { readonly persisted: unknown; readonly until: string } | undefined;
      const sleep = deps.sleep;
      const watched: SyncSessionDependencies = {
        ...deps,
        sleep: async (ms, signal) => {
          if (first === undefined) {
            const progress = JSON.parse((await fs.readTextFile(PROGRESS_PATH)) ?? '{}') as Record<string, unknown>;
            first = { persisted: progress['notBefore'], until: new Date(Date.parse(clock.now()) + ms).toISOString() };
          }
          await sleep(ms, signal);
        },
      };

      expect(await syncSessionCommand(watched)).toBe(0);

      // retry-after: 60 from the probe at NOW.
      expect(first).toEqual({ persisted: '2026-09-26T12:01:00.000Z', until: '2026-09-26T12:01:00.000Z' });

      expect(cookies(http)).toEqual([
        ['GET', undefined],
        ['POST', undefined],
        ['POST', COOKIE],
        // The next chunk: a fresh governor, no latch, so its first 2xx search probes again.
        ['POST', undefined],
        ['POST', COOKIE],
      ]);
      expect(auth).toEqual([{ line: 'pnpm sync: authenticated', requestsBefore: 5 }]);
    });

    it('CAP-3: the second chunk’s fetch gets a 403: one expired line, the hold-off written, backoff(1), and no later Cookie or probe', async () => {
      const RESULTS = ['r1'];
      const SEARCH = JSON.stringify({ id: 'S1', complexity: 1, result: RESULTS, total: 1 });
      const FETCHED = JSON.stringify({ result: [{ listing: { price: { amount: 2, currency: 'divine' } } }] });
      let cookieFetches = 0;
      const { deps, auth, err, http, fs, out } = sessionFor({
        env: COOKIE_ENV,
        tracked: [ENTRY, SECOND, THIRD],
        stopAfter: 3,
        fixtures: {
          [`POST ${tradeSearchUrl(LEAGUE)}`]: { status: 200, headers: {}, body: SEARCH },
          [`GET ${tradeFetchUrl(RESULTS, 'S1')}`]: { status: 200, headers: {}, body: FETCHED },
        },
        http: probingThen([{ ...LIVE, body: SEARCH }], (request, answer) => {
          if (request.method === 'GET') {
            cookieFetches += 1;
            if (cookieFetches === 2) {
              return { status: 403, headers: { 'content-type': 'text/html' }, body: 'cloudflare' };
            }
          }
          return { ...answer, headers: { ...answer.headers, ...LIVE.headers } };
        }),
      });

      expect(await syncSessionCommand(deps)).toBe(0);

      expect(auth.map((entry) => entry.line)).toEqual(['pnpm sync: authenticated', 'pnpm sync: unauthenticated (expired)']);
      expect(err).toEqual([]);
      expect(cookies(http)).toEqual([
        // Chunk 1: the gate, the baseline, the probe, the fetch.
        ['GET', undefined],
        ['POST', undefined],
        ['POST', COOKIE],
        ['GET', COOKIE],
        // Chunk 2: the search, then the fetch that got the 403.
        ['POST', COOKIE],
        ['GET', COOKIE],
        // Chunk 3: no cookie and no probe.
        ['POST', undefined],
        ['GET', undefined],
      ]);
      const yielded = out.find((entry) => entry.line === 'pnpm sync: yielded, 0 completed');
      expect(yielded).toBeDefined();
      const progress = JSON.parse((await fs.readTextFile(PROGRESS_PATH)) ?? '{}') as Record<string, unknown>;
      // Written by chunk 2, carried forward by chunk 3.
      expect(progress['authHoldOffUntil']).toBe(new Date(Date.parse(yielded?.at ?? '') + 24 * 3_600_000).toISOString());
      expect(progress).not.toHaveProperty('notBefore');
      // The downgrade reset the pacing to cold, so backoff(1) is the cold even interval.
      expect(announced(out, 'the session cookie expired')).toEqual([backoffMs(COLD_EVEN_INTERVAL_MS, 1)]);
      const report = await reportOf(fs);
      expect(report?.figures.requestsBySource['session-probe']).toBe(1);
    });

    it('CAP-5: a due hold-off settles held-off once, before any request, and the session never probes', async () => {
      const HOLD_OFF = '2026-09-27T06:00:00.000Z';
      const { deps, auth, http, fs } = sessionFor({
        env: COOKIE_ENV,
        tracked: [ENTRY, SECOND, THIRD],
        stopAfter: 3,
        seeded: {
          [PROGRESS_PATH]: { contents: JSON.stringify({ schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION, completed: [], authHoldOffUntil: HOLD_OFF }) },
        },
        http: probing(LIVE),
      });

      expect(await syncSessionCommand(deps)).toBe(0);

      expect(auth).toEqual([{ line: 'pnpm sync: unauthenticated (held-off)', requestsBefore: 0 }]);
      expect(http.requests.every((request) => request.headers['cookie'] === undefined)).toBe(true);
      const progress = JSON.parse((await fs.readTextFile(PROGRESS_PATH)) ?? '{}') as Record<string, unknown>;
      expect(progress['authHoldOffUntil']).toBe(HOLD_OFF);
    });

    it('no 2xx pricing search: unauthenticated (not-probed) once, at the end of the session', async () => {
      const { deps, auth, http, out } = sessionFor({
        env: COOKIE_ENV,
        fixtures: { [`POST ${tradeSearchUrl(LEAGUE)}`]: { status: 429, headers: { 'retry-after': '60' }, body: '' } },
      });

      expect(await syncSessionCommand(deps)).toBe(0);

      expect(http.requests.every((request) => request.headers['cookie'] === undefined)).toBe(true);
      expect(auth).toEqual([{ line: 'pnpm sync: unauthenticated (not-probed)', requestsBefore: http.requests.length }]);
      expect(lines(out).at(-1)).toBe('pnpm sync: stopped');
    });
  });

  it('a new pass restarts the pass-level requestsBySource', async () => {
    // Pass 1: gate + search, search. Pass 2: gate + search, search.
    const { deps, http, fs } = sessionFor({ tracked: [ENTRY, SECOND], stopAfter: 4 });

    expect(await syncSessionCommand(deps)).toBe(0);

    expect(http.requests.map((request) => request.method)).toEqual(['GET', 'POST', 'POST', 'GET', 'POST', 'POST']);
    // The new pass only, not the six requests of both passes.
    const report = await reportOf(fs);
    expect(report?.figures.requestsBySource).toEqual({ 'league-validation': 1, 'tracked-list': 2, 'session-probe': 0 });
  });

  it('a transient fs fault on a local read does not end the session', async () => {
    const { deps, out } = sessionFor();
    let faults = 0;
    const flaky: SyncSessionDependencies = {
      ...deps,
      fs: {
        ...deps.fs,
        lastModifiedAt: (path) => {
          if (faults === 0) {
            faults += 1;
            return Promise.reject(Object.assign(new Error('EBUSY: resource busy'), { code: 'EBUSY' }));
          }
          return deps.fs.lastModifiedAt(path);
        },
      },
    };

    expect(await syncSessionCommand(flaky)).toBe(0);

    expect(faults).toBe(1);
    expect(lines(out)[0]).toBe(`pnpm sync: completed, 1 completed: ${canonicalKey(ENTRY)}`);
  });

  it('a fresh pinned entry is skipped under the 4 h default: the first search prices the active one', async () => {
    const { deps, out } = hourOldPinned([]);

    expect(await syncSessionCommand(deps)).toBe(0);

    expect(lines(out)[0]).toBe(`pnpm sync: completed, 1 completed: ${canonicalKey(ENTRY)}`);
  });

  it('--pinned-max-age 0.5 makes the 1 h old pinned entry stale, so it goes first', async () => {
    const { deps, out, pinned } = hourOldPinned(['--pinned-max-age', '0.5']);

    expect(await syncSessionCommand(deps)).toBe(0);

    expect(lines(out)[0]).toBe(`pnpm sync: bounded by entries, 1 completed: ${canonicalKey(pinned)}`);
  });

  it('a stale pinned entry goes first', async () => {
    const pinned: TrackedEntry = { ...SECOND, status: 'pinned' };
    const { deps, out } = sessionFor({ tracked: [pinned, ENTRY], minChunkSearches: 2 });

    expect(await syncSessionCommand(deps)).toBe(0);

    expect(lines(out)[0]).toBe(`pnpm sync: bounded by entries, 1 completed: ${canonicalKey(pinned)}`);
  });

  it('spreads the fetch inside the lock once the pre-wait has cleared the entry lanes', async () => {
    const policy = 'shared-policy';
    const state = (used: number): Record<string, string> => headers(policy, '5:10:60', `${String(used)}:10:0`);
    let searches = 0;
    const listing = JSON.stringify({
      result: [{ id: 'a', listing: { price: { type: '~price', amount: 1, currency: 'divine' } } }],
    });
    const { deps, sleeps, waits } = sessionFor({
      tracked: [ENTRY, SECOND],
      stopAfter: 2,
      http: (fake) => ({
        send: async (request) => {
          if (request.method === 'POST') {
            searches += 1;
            await fake.send(request);
            return {
              status: 200,
              headers: state(searches * 2 - 1),
              body: JSON.stringify({ id: 'S0', complexity: 1, result: ['a'], total: 1 }),
            };
          }
          if (request.url === tradeFetchUrl(['a'], 'S0')) {
            await fake.send({ ...request, url: TRADE_LEAGUES_URL });
            return { status: 200, headers: state(searches * 2), body: listing };
          }
          return fake.send(request);
        },
      }),
    });

    expect(await syncSessionCommand(deps)).toBe(0);

    // Iteration 1: search (1 used), fetch on a cold lane (2 used). The pre-wait
    // of iteration 2 spreads the 3 left over 10 s (rounded up to a whole
    // millisecond); its search then leaves 2, so the fetch inside the lock
    // waits 10 000 / 2 − 0.
    expect(sleeps).toEqual([3334]);
    expect(waits).toEqual([10_000 / 2]);
  });

  it('a new pass pre-waits DATA_LANE before the gate runs again', async () => {
    const { deps, sleeps, http } = sessionFor({
      stopAfter: 2,
      fixtures: {
        [`GET ${TRADE_LEAGUES_URL}`]: {
          status: 200,
          headers: headers('data-policy', '10:100:60', '5:100:0'),
          body: LEAGUES_BODY,
        },
      },
    });

    expect(await syncSessionCommand(deps)).toBe(0);

    expect(http.requests.map((request) => request.method)).toEqual(['GET', 'POST', 'GET', 'POST']);
    expect(sleeps).toEqual([20_000]);
  });

  it('no answer on a cold lane waits 36 s, then 72 s, and resets after a reading', async () => {
    let calls = 0;
    const { deps, out } = sessionFor({
      stopAfter: 5,
      http: () => ({
        send: () => {
          calls += 1;
          if (calls === 3) {
            // A 503 that carried headers: a State reading.
            return Promise.resolve({
              status: 503,
              headers: headers('data-policy', '600:21600:60', '0:21600:0'),
              body: '',
            });
          }
          return networkDown().send({ method: 'GET', url: TRADE_LEAGUES_URL, headers: {} });
        },
      }),
    });

    expect(await syncSessionCommand(deps)).toBe(0);

    expect(announced(out, 'no answer')).toEqual([36_000, 72_000, 36_000]);
  });

  it('a 429 on the search waits until the notBefore the chunk wrote', async () => {
    const { deps, out } = sessionFor({
      fixtures: { [`POST ${tradeSearchUrl(LEAGUE)}`]: { status: 429, headers: { 'retry-after': '60' }, body: '' } },
      stopAfter: 2,
    });

    expect(await syncSessionCommand(deps)).toBe(0);

    expect(lines(out)).toContain('pnpm sync: waiting until 2026-09-26T12:01:00.000Z (a 429)');
  });

  it('a league mismatch is printed and waited out until an input file changes', async () => {
    const { deps, err, out, fs, http } = sessionFor({ stopAfter: 2 });
    fs.setFile('data/config.json', {
      contents: JSON.stringify({ schemaVersion: SUPPORTED_SCHEMA_VERSION, league: 'Nope League', minChunkSearches: 1 }),
      modifiedAt: NOW,
    });
    let polls = 0;
    const sleep = deps.sleep;
    const edited: SyncSessionDependencies = {
      ...deps,
      sleep: async (ms, signal) => {
        await sleep(ms, signal);
        polls += 1;
        if (polls === 3) {
          fs.setFile('data/config.json', {
            contents: JSON.stringify({ schemaVersion: SUPPORTED_SCHEMA_VERSION, league: LEAGUE, minChunkSearches: 1 }),
            modifiedAt: '2026-09-26T13:00:00.000Z',
          });
        }
      },
    };

    expect(await syncSessionCommand(edited)).toBe(0);

    expect(err[0]).toMatch(/^pnpm sync: the configured league "Nope League"/);
    expect(lines(out)).toContain(
      'pnpm sync: waiting for an input file under data/ to change (a refused input or a league mismatch)',
    );
    expect(polls).toBe(3);
    expect(lines(out)).toContain(`pnpm sync: completed, 1 completed: ${canonicalKey(ENTRY)}`);
    expect(http.requests.filter((request) => request.method === 'GET')).toHaveLength(2);
  });

  it('a live lock is waited for by polling, then the entry runs', async () => {
    const { deps, fs, out } = sessionFor({
      seeded: { [LOCK_PATH]: { contents: serialiseLock({ pid: 99, startedAt: NOW }) } },
      stopAfter: 2,
    });
    let polls = 0;
    const sleep = deps.sleep;
    const released: SyncSessionDependencies = {
      ...deps,
      sleep: async (ms, signal) => {
        await sleep(ms, signal);
        polls += 1;
        if (polls === 2) {
          await fs.deleteFile(LOCK_PATH);
        }
      },
    };

    expect(await syncSessionCommand(released)).toBe(0);

    expect(lines(out).slice(0, 3)).toEqual([
      'pnpm sync: busy, 0 completed',
      'pnpm sync: waiting for the lock to be free (another run holds the lock)',
      `pnpm sync: completed, 1 completed: ${canonicalKey(ENTRY)}`,
    ]);
  });

  it('an abort during a chunk lets the entry finish, releases the lock and exits 0', async () => {
    const { deps, fs, http, out, controller } = sessionFor({ stopAfter: 100 });
    const aborting: SyncSessionDependencies = {
      ...deps,
      http: {
        send: (request) => {
          if (request.method === 'POST') {
            controller.abort();
          }
          return http.send(request);
        },
      },
    };

    expect(await syncSessionCommand(aborting)).toBe(0);

    expect(lines(out)).toEqual([`pnpm sync: completed, 1 completed: ${canonicalKey(ENTRY)}`, 'pnpm sync: stopped']);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
    expect(http.requests).toHaveLength(2);
  });

  it('is reachable at the script name, with the .env overlay; sync:batch is the one-chunk command', () => {
    const manifest = JSON.parse(readFileSync(`${REPO_ROOT}package.json`, 'utf8')) as {
      scripts: Record<string, string>;
    };
    const script = manifest.scripts['sync'];

    expect(script).toBeDefined();
    const entry = (script ?? '').split(/\s+/).at(-1);
    expect(nodePath.resolve(REPO_ROOT, entry ?? '')).toBe(SCRIPT);
    expect(script).toContain('--env-file-if-exists=.env');
    expect(manifest.scripts['sync:batch']).toContain('--env-file-if-exists=.env');
  });
});
