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
  SYNC_REPORT_SCHEMA_VERSION,
  SyncReportFileSchema,
  TRACKED_SCHEMA_VERSION,
  WEIGHTS_SCHEMA_VERSION,
} from '@poe/contracts';
import type {
  DatasetEntry,
  FakeFilesystemPort,
  FilesystemPort,
  HttpRequest,
  HttpResponse,
  SyncReportFile,
  TrackedEntry,
} from '@poe/contracts';
import { describe, expect, it, vi } from 'vitest';

import { LOCK_PATH, serialiseLock } from './chunk/lock.ts';
import { DATASET_PATH, PROGRESS_PATH, REPORT_PATH, TRACKED_PATH } from './chunk/run-chunk.ts';
import { LeagueMismatchError } from './league/league-gate.ts';
import { runSync, syncCommand } from './sync-batch.ts';
import type { SyncCommandDependencies } from './sync-batch.ts';
import type * as TradeClientModule from './trade/client.ts';
import { TRADE_LEAGUES_URL, tradeFetchUrl, tradeSearchUrl } from './trade/endpoints.ts';
import { SESSION_COOKIE_ENV_VAR } from './trade/session-auth.ts';
import { USER_AGENT_ENV_VAR } from './trade/user-agent.ts';

/** Every option set the shell built its trade clients with, in build order. */
const tradeClientOptions = vi.hoisted((): { readonly auth?: { readonly holder: unknown; readonly probe: unknown } }[] => []);

// A pass-through: the real clients are built, and the options are recorded so
// a test can inspect what the shell passed (AD-8, IMPLEMENTATION-NOTES.md §5.3).
vi.mock('./trade/client.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof TradeClientModule>();
  return {
    ...actual,
    createTradeGovernor: (options: Parameters<typeof actual.createTradeGovernor>[0]) => {
      tradeClientOptions.push(options);
      return actual.createTradeGovernor(options);
    },
  };
});

/** The `pnpm sync:batch` composition, driven with injected ports: no network, no writes under `data/`. */

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SCRIPT = fileURLToPath(new URL('sync-batch.ts', import.meta.url));

const LEAGUE = 'Test League';
const NOW = '2026-09-26T12:00:00.000Z';
const CONTACT = 'poe-crafting-base-price-checker/0.0.0 (contact: someone@example.test)';

const ENTRY: TrackedEntry = { kind: 'raw', baseTypeId: 'Solar Amulet', itemLevelMin: 82, status: 'active' };

function inputs(
  league: string,
  tracked: readonly TrackedEntry[] = [ENTRY],
): Parameters<typeof createFakeFilesystemPort>[0] {
  return {
    [TRACKED_PATH]: {
      contents: JSON.stringify({ schemaVersion: TRACKED_SCHEMA_VERSION, entries: tracked }),
      modifiedAt: '2026-09-20T07:00:00.000Z',
    },
    'data/config.json': { contents: JSON.stringify({ schemaVersion: SUPPORTED_SCHEMA_VERSION, league, minChunkSearches: 1 }) },
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

const LEAGUES_BODY = JSON.stringify({
  result: [
    { id: 'Standard', realm: 'poe2', text: 'Standard' },
    { id: LEAGUE, realm: 'poe2', text: LEAGUE },
  ],
});

interface Answers {
  readonly leagues?: HttpResponse;
  readonly search?: HttpResponse;
}

const THROTTLED: HttpResponse = { status: 429, headers: { 'retry-after': '60' }, body: '' };

function httpFor(league: string, answers: Answers = {}) {
  return createFakeHttpPort({
    [`GET ${TRADE_LEAGUES_URL}`]: answers.leagues ?? { status: 200, headers: {}, body: LEAGUES_BODY },
    [`POST ${tradeSearchUrl(league)}`]: answers.search ?? {
      status: 200,
      headers: {},
      body: JSON.stringify({ id: 'S0', complexity: 1, result: [], total: 0 }),
    },
  });
}

const cookies = (http: ReturnType<typeof httpFor>) =>
  http.requests.map((request) => [request.method, request.headers['cookie']]);

/** A fake filesystem that records every path written through it. */
function recording(fs: FakeFilesystemPort): { readonly fs: FakeFilesystemPort; readonly writes: string[] } {
  const writes: string[] = [];
  return {
    writes,
    fs: {
      ...fs,
      writeTextFile: (path, contents) => {
        writes.push(path);
        return fs.writeTextFile(path, contents);
      },
    },
  };
}

interface Setup {
  readonly env?: Record<string, string | undefined>;
  readonly answers?: Answers;
  /** Files seeded beside the inputs, e.g. a published dataset or a live lock. */
  readonly seeded?: NonNullable<Parameters<typeof createFakeFilesystemPort>[0]>;
  /** The tracked entries; one `ENTRY` by default. */
  readonly tracked?: readonly TrackedEntry[];
  readonly wait?: (ms: number) => Promise<void>;
}

const AUTH_LINE = /^pnpm sync:batch: (authenticated|unauthenticated \()/;

function dependenciesFor(league: string, setup: Setup = {}) {
  const environment = setup.env ?? { [USER_AGENT_ENV_VAR]: CONTACT };
  const recorded = recording(createFakeFilesystemPort({ ...inputs(league, setup.tracked), ...setup.seeded }));
  const http = httpFor(league, setup.answers);
  const out: string[] = [];
  const error: string[] = [];
  /** The §13.5 auth lines, kept apart from `err`, with the requests sent before each. */
  const auth: { readonly line: string; readonly requestsBefore: number }[] = [];
  const dependencies: SyncCommandDependencies = {
    fs: recorded.fs,
    clock: createFakeClockPort(NOW),
    http,
    git: createFakeGitPort(),
    wait: setup.wait ?? (() => Promise.resolve()),
    pid: 4242,
    log: () => {},
    env: environment,
    stdout: (line) => {
      out.push(line);
    },
    stderr: (line) => {
      if (AUTH_LINE.test(line)) {
        auth.push({ line, requestsBefore: http.requests.length });
        return;
      }
      error.push(line);
    },
  };
  return { deps: dependencies, fs: recorded.fs, writes: recorded.writes, http, out, err: error, auth };
}

async function reportOf(fs: FilesystemPort): Promise<SyncReportFile | undefined> {
  const text = await fs.readTextFile(REPORT_PATH);
  return text === undefined ? undefined : SyncReportFileSchema.parse(JSON.parse(text));
}

describe('pnpm sync:batch: the live composition with injected ports', () => {
  it('runs the gate first, then the pricing step as the chunk step, and exits 0', async () => {
    const { deps, fs, http, out } = dependenciesFor(LEAGUE);

    expect(await syncCommand(deps)).toBe(0);

    expect(http.requests.map((request) => `${request.method} ${request.url}`)).toEqual([
      `GET ${TRADE_LEAGUES_URL}`,
      `POST ${tradeSearchUrl(LEAGUE)}`,
    ]);
    // The contact overlay reached both requests through the one governor.
    for (const request of http.requests) {
      expect(request.headers['user-agent']).toBe(CONTACT);
    }
    const report = await reportOf(fs);
    expect(report?.figures.requestsBySource).toEqual({
      'tracked-list': 1,
      'league-validation': 1,
      'session-probe': 0,
    });
    // No git history, so the edit date falls to the file's modification time (AD-12).
    expect(report?.figures.trackedListEditedAt).toEqual({
      source: 'file-modified',
      at: '2026-09-20T07:00:00.000Z',
    });
    expect(report?.runFinishedAt).toBe(NOW);
    expect(out).toEqual(['pnpm sync:batch: completed, 1 completed']);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });

  it('a league mismatch: exit 1, the report is the only write, the lock is released', async () => {
    const { deps, fs, writes, http, err } = dependenciesFor('Nope League');

    expect(await syncCommand(deps)).toBe(1);

    expect(http.requests.map((request) => request.url)).toEqual([TRADE_LEAGUES_URL]);
    expect(writes).toEqual([REPORT_PATH]);
    expect(await fs.exists(DATASET_PATH)).toBe(false);
    expect(await fs.exists(PROGRESS_PATH)).toBe(false);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
    const report = await reportOf(fs);
    expect(report?.records).toEqual([
      { kind: 'league-mismatch', configuredLeague: 'Nope League', availableLeagues: ['Standard', LEAGUE] },
    ]);
    expect(err).toHaveLength(1);
    expect(err[0]).toMatch(/^pnpm sync:batch: the configured league "Nope League"/);
  });

  it('runSync rethrows the gate throw after the report is written', async () => {
    const { deps } = dependenciesFor('Nope League');
    const { fs, clock, http, git, wait, pid, log } = deps;

    await expect(
      runSync({ fs, clock, http, git, wait, pid, log, userAgent: CONTACT }),
    ).rejects.toBeInstanceOf(LeagueMismatchError);
    const report = await reportOf(fs);
    expect(report?.records.map((record) => record.kind)).toEqual(['league-mismatch']);
  });

  it('refuses a blank contact before any request or write, with exit 1', async () => {
    const { deps, http, writes, err } = dependenciesFor(LEAGUE, { env: {} });

    expect(await syncCommand(deps)).toBe(1);

    expect(http.requests).toEqual([]);
    expect(writes).toEqual([]);
    expect(err[0]).toContain(USER_AGENT_ENV_VAR);
  });

  it('refuses an absent config under the lock, naming it: no request, the report is the only write', async () => {
    const { deps, fs, http, writes, err } = dependenciesFor(LEAGUE);
    await fs.deleteFile('data/config.json');

    expect(await syncCommand(deps)).toBe(1);

    expect(http.requests).toEqual([]);
    expect(writes).toEqual([REPORT_PATH]);
    expect(err[0]).toContain('data/config.json');
    const report = await reportOf(fs);
    const records = report?.records ?? [];
    expect(records).toEqual([expect.objectContaining({ kind: 'run-failure', reason: 'unrecoverable-error' })]);
    expect(records[0]).toHaveProperty('message', expect.stringContaining('data/config.json'));
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });

  it('refuses a pinned set over the cap: exit 1, no request, a run-failure naming data/tracked.json', async () => {
    // One pinned entry against a yardstick of 1: 1 > 0.5 × 1 (IMPLEMENTATION-NOTES.md §6).
    const { deps, fs, http, writes, err } = dependenciesFor(LEAGUE, { tracked: [{ ...ENTRY, status: 'pinned' }] });

    expect(await syncCommand(deps)).toBe(1);

    expect(http.requests).toEqual([]);
    expect(writes).toEqual([REPORT_PATH]);
    expect(err[0]).toContain(TRACKED_PATH);
    const report = await reportOf(fs);
    const records = report?.records ?? [];
    expect(records).toEqual([expect.objectContaining({ kind: 'run-failure' })]);
    expect(records[0]).toHaveProperty('message', expect.stringContaining(TRACKED_PATH));
    expect(await fs.exists(DATASET_PATH)).toBe(false);
    expect(await fs.exists(PROGRESS_PATH)).toBe(false);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });

  it('reports a pinned-cap excess ahead of a later load refusal (the currencies file absent)', async () => {
    const { deps, fs, http } = dependenciesFor(LEAGUE, { tracked: [{ ...ENTRY, status: 'pinned' }] });
    await fs.deleteFile('data/currencies.json');

    expect(await syncCommand(deps)).toBe(1);

    expect(http.requests).toEqual([]);
    const report = await reportOf(fs);
    const records = report?.records ?? [];
    expect(records).toEqual([expect.objectContaining({ kind: 'run-failure' })]);
    expect(records[0]).toHaveProperty('message', expect.stringContaining(TRACKED_PATH));
  });

  it('publishes the priced entry under the configured league', async () => {
    const { deps, fs } = dependenciesFor(LEAGUE);

    await syncCommand(deps);

    const dataset = JSON.parse((await fs.readTextFile(DATASET_PATH)) ?? '{}') as {
      league: string;
      entries: { entryKey: string; price: { state: string } }[];
    };
    expect(dataset.league).toBe(LEAGUE);
    expect(dataset.entries).toEqual([
      expect.objectContaining({ entryKey: canonicalKey(ENTRY), price: { state: 'no-listings' } }),
    ]);
  });

  it('a gate 429 yields the chunk: exit 0, no search, dataset, progress and the report, no run-failure', async () => {
    const { deps, fs, writes, http, out } = dependenciesFor(LEAGUE, { answers: { leagues: THROTTLED } });

    expect(await syncCommand(deps)).toBe(0);

    expect(http.requests.map((request) => request.url)).toEqual([TRADE_LEAGUES_URL]);
    // A gate yield publishes like a yielded chunk; progress carries the penalty as notBefore (§5.3).
    expect(writes).toEqual([DATASET_PATH, PROGRESS_PATH, REPORT_PATH]);
    expect(JSON.parse((await fs.readTextFile(PROGRESS_PATH)) ?? '')).toEqual({
      completed: [],
      notBefore: '2026-09-26T12:01:00.000Z',
      schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION,
    });
    const report = await reportOf(fs);
    expect(report?.records).toEqual([]);
    expect(report?.runFinishedAt).toBe(NOW);
    expect(report?.figures.requestsBySource).toEqual({
      'tracked-list': 0,
      'league-validation': 1,
      'session-probe': 0,
    });
    expect(out).toEqual(['pnpm sync:batch: yielded, 0 completed']);
    expect(report?.figures.notReachedCount).toBe(1);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });

  it("a 429's diagnostic line reaches the chunk's operator log", async () => {
    const { deps } = dependenciesFor(LEAGUE, { answers: { leagues: THROTTLED } });
    const lines: string[] = [];

    expect(await syncCommand({ ...deps, log: (line) => { lines.push(line); } })).toBe(0);

    expect(lines.filter((line) => line.includes('answered 429'))).toEqual([
      expect.stringContaining('response headers {"retry-after":"60"}; paced on no reading'),
    ]);
  });

  it('a gate 429 publishes the catalogue marks, and the not-reached count is every eligible entry', async () => {
    const ghost: TrackedEntry = { kind: 'raw', baseTypeId: 'Ghost Amulet', itemLevelMin: 82, status: 'active' };
    const others: TrackedEntry[] = [ENTRY, { ...ENTRY, itemLevelMin: 83 }, { ...ENTRY, itemLevelMin: 84 }];
    const { deps, fs, http } = dependenciesFor(LEAGUE, {
      tracked: [ghost, ...others],
      answers: { leagues: THROTTLED },
    });

    expect(await syncCommand(deps)).toBe(0);

    expect(http.requests.map((request) => request.url)).toEqual([TRADE_LEAGUES_URL]);
    const dataset = JSON.parse((await fs.readTextFile(DATASET_PATH)) ?? '{}') as {
      entries: DatasetEntry[];
    };
    expect(dataset.entries.find((entry) => entry.entryKey === canonicalKey(ghost))?.price).toEqual(
      expect.objectContaining({ state: 'unresolvable' }),
    );
    const report = await reportOf(fs);
    expect(report?.figures.notReachedCount).toBe(3);
    expect(report?.records).toEqual([
      expect.objectContaining({ kind: 'unresolvable', entryKey: canonicalKey(ghost) }),
    ]);
    expect(JSON.parse((await fs.readTextFile(PROGRESS_PATH)) ?? '')).toHaveProperty('notBefore');
  });

  it('paces the tracked-list searches off the leagues GET: one governor for both sources', async () => {
    const policy = 'trade-search-request-limit';
    // The leagues answer saturates the Client rule; the searches report only the Ip rule.
    const saturated = {
      'x-rate-limit-policy': policy,
      'x-rate-limit-rules': 'Ip,Client',
      'x-rate-limit-ip': '5:10:60',
      'x-rate-limit-ip-state': '5:10:0',
      'x-rate-limit-client': '30:300:1800',
      'x-rate-limit-client-state': '30:300:0',
    };
    const clear = {
      'x-rate-limit-policy': policy,
      'x-rate-limit-rules': 'Ip',
      'x-rate-limit-ip': '5:10:60',
      'x-rate-limit-ip-state': '1:10:0',
    };
    const waits: number[] = [];
    const second: TrackedEntry = { ...ENTRY, itemLevelMin: 83 };
    const { deps, http } = dependenciesFor(LEAGUE, {
      tracked: [ENTRY, second],
      wait: (ms) => {
        waits.push(ms);
        return Promise.resolve();
      },
      answers: {
        leagues: { status: 200, headers: saturated, body: LEAGUES_BODY },
        search: {
          status: 200,
          headers: clear,
          body: JSON.stringify({ id: 'S0', complexity: 1, result: [], total: 0 }),
        },
      },
    });

    expect(await syncCommand(deps)).toBe(0);

    expect(http.requests.map((request) => request.method)).toEqual(['GET', 'POST', 'POST']);
    // The first search, on a cold lane, learns the shared policy; the second
    // waits out the Client window the leagues GET recorded. Two independent
    // clients would record no wait.
    expect(waits).toEqual([300_000]);
  });

  it('builds its trade clients with the invalid-request threshold of 1 (§5.3)', async () => {
    tradeClientOptions.length = 0;
    const { deps } = dependenciesFor(LEAGUE);

    expect(await syncCommand(deps)).toBe(0);

    expect(tradeClientOptions).toEqual([expect.objectContaining({ invalidRequestThreshold: 1 })]);
    // The batch pacer, cold: no even spread and no shared pacing state (AD-8).
    expect(tradeClientOptions[0]).not.toHaveProperty('spread');
    expect(tradeClientOptions[0]).not.toHaveProperty('pacing');
  });

  it('a penalty still running defers: exit 0, no request, no write, the pause printed', async () => {
    const progress = JSON.stringify({
      schemaVersion: '1.1.0',
      completed: [],
      notBefore: '2026-09-26T12:30:00.000Z',
    });
    const { deps, fs, writes, http, out } = dependenciesFor(LEAGUE, {
      seeded: { [PROGRESS_PATH]: { contents: progress } },
    });

    expect(await syncCommand(deps)).toBe(0);

    expect(http.requests).toEqual([]);
    expect(writes).toEqual([]);
    expect(out).toEqual(['pnpm sync:batch: deferred until 2026-09-26T12:30:00.000Z, 0 completed']);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });

  it('a live lock is busy: exit 0, no request, no write', async () => {
    const lock = serialiseLock({ pid: 99, startedAt: NOW });
    const { deps, fs, writes, http, out } = dependenciesFor(LEAGUE, { seeded: { [LOCK_PATH]: { contents: lock } } });

    expect(await syncCommand(deps)).toBe(0);

    expect(http.requests).toEqual([]);
    expect(writes).toEqual([]);
    expect(out).toEqual(['pnpm sync:batch: busy, 0 completed']);
    expect(await fs.readTextFile(LOCK_PATH)).toBe(lock);
  });

  it('a priced entry whose search answers 429 keeps its price in the written dataset', async () => {
    const priced: DatasetEntry = {
      entryKey: canonicalKey(ENTRY),
      price: {
        state: 'priced',
        observation: {
          league: LEAGUE,
          observedAt: '2026-09-25T12:00:00.000Z',
          priceDivine: 0.5,
          sampleSize: 10,
          exchangeObservation: {
            currencyId: 'divine',
            rate: 1,
            source: 'measured',
            league: LEAGUE,
            asOf: '2026-01-01T00:00:00Z',
          },
        },
      },
      lastAttemptedAt: '2026-09-25T12:00:00.000Z',
    };
    const published = `${JSON.stringify(
      {
        schemaVersion: SUPPORTED_SCHEMA_VERSION,
        league: LEAGUE,
        generatedAt: '2026-09-25T12:00:00.000Z',
        entries: [priced],
        currencyRates: [],
      },
      undefined,
      2,
    )}\n`;
    const { deps, fs, out } = dependenciesFor(LEAGUE, {
      seeded: { [DATASET_PATH]: { contents: published } },
      answers: { search: THROTTLED },
    });

    expect(await syncCommand(deps)).toBe(0);

    expect(out).toEqual(['pnpm sync:batch: yielded, 0 completed']);
    const dataset = JSON.parse((await fs.readTextFile(DATASET_PATH)) ?? '{}') as {
      entries: DatasetEntry[];
    };
    expect(dataset.entries).toHaveLength(1);
    expect(dataset.entries[0]?.price).toEqual(priced.price);
    const report = await reportOf(fs);
    expect(report?.records).toEqual([]);
  });

  it('a malformed published dataset: exit 1, no request, a run-failure naming it, the dataset untouched', async () => {
    const { deps, fs, writes, http, err } = dependenciesFor(LEAGUE, {
      seeded: { [DATASET_PATH]: { contents: '{ not json' } },
    });

    expect(await syncCommand(deps)).toBe(1);

    expect(http.requests).toEqual([]);
    expect(writes).toEqual([REPORT_PATH]);
    expect(err[0]).toContain(DATASET_PATH);
    expect(await fs.readTextFile(DATASET_PATH)).toBe('{ not json');
    const report = await reportOf(fs);
    const records = report?.records ?? [];
    expect(records).toEqual([expect.objectContaining({ kind: 'run-failure' })]);
    expect(records[0]).toHaveProperty('message', expect.stringContaining(DATASET_PATH));
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });

  describe('the session cookie at the shell edge (AD-30, IMPLEMENTATION-NOTES.md §13.1, §13.5)', () => {
    const VALID = 'a'.repeat(16) + '0123456789abcdef0123';

    it('an absent value: one unauthenticated (absent) line before the first request, exit unchanged', async () => {
      const { deps, http, auth, out } = dependenciesFor(LEAGUE);

      expect(await syncCommand(deps)).toBe(0);

      expect(auth).toEqual([{ line: 'pnpm sync:batch: unauthenticated (absent)', requestsBefore: 0 }]);
      expect(http.requests).toHaveLength(2);
      expect(out).toEqual(['pnpm sync:batch: completed, 1 completed']);
    });

    it('a blank value trims to absent', async () => {
      const { deps, auth } = dependenciesFor(LEAGUE, { env: { [USER_AGENT_ENV_VAR]: CONTACT, [SESSION_COOKIE_ENV_VAR]: ' '.repeat(3) } });

      expect(await syncCommand(deps)).toBe(0);

      expect(auth.map((entry) => entry.line)).toEqual(['pnpm sync:batch: unauthenticated (absent)']);
    });

    it.each(['a b', 'a;b', 'a,b', '"x', 'café'])('a malformed value %j: one malformed line without the value', async (value) => {
      const { deps, auth, http } = dependenciesFor(LEAGUE, {
        env: { [USER_AGENT_ENV_VAR]: CONTACT, [SESSION_COOKIE_ENV_VAR]: value },
      });

      expect(await syncCommand(deps)).toBe(0);

      expect(auth).toEqual([{ line: 'pnpm sync:batch: unauthenticated (malformed)', requestsBefore: 0 }]);
      for (const request of http.requests) {
        expect(request.headers).not.toHaveProperty('cookie');
      }
    });

    it('a blank contact is still refused first: exit 1 and no auth line', async () => {
      const { deps, auth, err } = dependenciesFor(LEAGUE, { env: { [SESSION_COOKIE_ENV_VAR]: 'a b' } });

      expect(await syncCommand(deps)).toBe(1);

      expect(auth).toEqual([]);
      expect(err[0]).toContain(USER_AGENT_ENV_VAR);
    });

    it('a valid value prints no line at the edge, and the holder reaches the chunk governor with a probe port', async () => {
      tradeClientOptions.length = 0;
      const { deps, auth } = dependenciesFor(LEAGUE, {
        env: { [USER_AGENT_ENV_VAR]: CONTACT, [SESSION_COOKIE_ENV_VAR]: VALID },
        answers: { search: THROTTLED },
      });

      expect(await syncCommand(deps)).toBe(0);

      // No 2xx search, so nothing settled until the process end.
      expect(auth.map((entry) => entry.line)).toEqual(['pnpm sync:batch: unauthenticated (not-probed)']);
      expect(tradeClientOptions).toHaveLength(1);
      const governorAuth = tradeClientOptions[0]?.auth;
      expect(governorAuth?.holder).toBeDefined();
      expect(governorAuth?.holder).not.toBeNull();
      expect(governorAuth?.probe).toBeDefined();
      expect(governorAuth?.probe).not.toBeNull();
    });
  });

  describe('the session probe (AD-30, IMPLEMENTATION-NOTES.md §13.2, §13.3, §13.5)', () => {
    const VALUE = 'b'.repeat(16) + '0123456789abcdef0123';
    const COOKIE = `POESESSID=${VALUE}`;
    const COOKIE_ENV = { [USER_AGENT_ENV_VAR]: CONTACT, [SESSION_COOKIE_ENV_VAR]: VALUE };
    const RESULTS = ['r1', 'r2'];
    /** Every answer names its policy, and a search and a fetch differ (§13.2); the baseline search answers one rule. */
    const SEARCH_HEADERS = {
      'x-rate-limit-policy': 'trade-search-request-limit',
      'x-rate-limit-rules': 'Ip',
      'x-rate-limit-ip': '30:300:60',
      'x-rate-limit-ip-state': '1:300:0',
    };
    /** One rule, under the fetch's own policy: never `tested` against the search baseline. */
    const FETCH_HEADERS = {
      'x-rate-limit-policy': 'trade-fetch-request-limit',
      'x-rate-limit-rules': 'Ip',
      'x-rate-limit-ip': '30:300:60',
      'x-rate-limit-ip-state': '1:300:0',
    };
    const SEARCH_WITH_RESULTS: HttpResponse = {
      status: 200,
      headers: SEARCH_HEADERS,
      body: JSON.stringify({ id: 'S1', complexity: 1, result: RESULTS, total: RESULTS.length }),
    };
    const FETCHED: HttpResponse = {
      status: 200,
      headers: FETCH_HEADERS,
      body: JSON.stringify({ result: [{ listing: { price: { amount: 2, currency: 'divine' } } }] }),
    };
    /** The search policy with one rule more than the baseline: a live cookie. The rule name and bucket are illustrative. */
    const LIVE: HttpResponse = {
      status: 200,
      headers: {
        ...SEARCH_HEADERS,
        'x-rate-limit-rules': 'Ip,Account',
        'x-rate-limit-account': '60:300:60',
        'x-rate-limit-account-state': '1:300:0',
      },
      body: SEARCH_WITH_RESULTS.body,
    };

    /** Answers each cookie-carrying search from `answers` in turn: those are the probes, before any `authenticated` settle. */
    function probing(dependencies: SyncCommandDependencies, ...answers: (HttpResponse | Error)[]): SyncCommandDependencies {
      return probingThen(dependencies, answers);
    }

    /** As `probing`; every later cookie request is answered by `after`, live by default so the cookie stays live (§13.4). */
    function probingThen(
      dependencies: SyncCommandDependencies,
      answers: (HttpResponse | Error)[],
      after: (answer: HttpResponse, request: HttpRequest) => HttpResponse = (answer, request) =>
        request.method === 'POST' ? { ...answer, headers: { ...answer.headers, ...LIVE.headers } } : answer,
    ): SyncCommandDependencies {
      const fake = dependencies.http;
      return {
        ...dependencies,
        http: {
          async send(request) {
            const sent = fake.send(request);
            if (request.headers['cookie'] === undefined) {
              return sent;
            }
            const answer = request.method === 'POST' ? answers.shift() : undefined;
            const response = await sent;
            if (answer === undefined) {
              return after(response, request);
            }
            if (answer instanceof Error) {
              throw answer;
            }
            return answer;
          },
        },
      };
    }

    const progressOf = async (fs: FilesystemPort): Promise<Record<string, unknown>> =>
      JSON.parse((await fs.readTextFile(PROGRESS_PATH)) ?? '{}') as Record<string, unknown>;

    const NOW_PLUS_24H = '2026-09-27T12:00:00.000Z';
    const HOLD_OFF = '2026-09-27T06:00:00.000Z';
    const PAST_HOLD_OFF = '2026-09-26T11:00:00.000Z';
    const progressSeed = (fields: Record<string, unknown>) => ({
      [PROGRESS_PATH]: { contents: JSON.stringify({ schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION, completed: [], ...fields }) },
    });

    function withResults(setup: Setup = {}) {
      const built = dependenciesFor(LEAGUE, { env: COOKIE_ENV, answers: { search: SEARCH_WITH_RESULTS }, ...setup });
      built.http.respondTo('GET', tradeFetchUrl(RESULTS, 'S1'), FETCHED);
      return built;
    }

    it('live: the baseline without the cookie, the probe with it, the fetch with it, the league request without it', async () => {
      const { deps, http, auth, err, out, fs } = withResults();

      expect(await syncCommand(probing(deps, LIVE))).toBe(0);

      expect(cookies(http)).toEqual([
        ['GET', undefined],
        ['POST', undefined],
        ['POST', COOKIE],
        ['GET', COOKIE],
      ]);
      expect(http.requests[3]?.url).toBe(tradeFetchUrl(RESULTS, 'S1'));
      // The fetch answers fewer rules than the probe, under its own policy: not tested, no downgrade (§13.4).
      expect(auth).toEqual([{ line: 'pnpm sync:batch: authenticated', requestsBefore: 3 }]);
      expect(err).toEqual([]);
      expect(out).toEqual(['pnpm sync:batch: completed, 1 completed']);
      const report = await reportOf(fs);
      expect(report?.schemaVersion).toBe(SYNC_REPORT_SCHEMA_VERSION);
      expect(report?.figures.requestsBySource).toEqual({
        'tracked-list': 2,
        'league-validation': 1,
        'session-probe': 1,
      });
      // The baseline's answer is the step's result: its search id, never the probe's.
      const dataset = JSON.parse((await fs.readTextFile(DATASET_PATH)) ?? '{}') as { entries: DatasetEntry[] };
      expect(dataset.entries[0]?.lastSearchId).toBe('S1');
    });

    it.each([
      ['not-elevated', { ...SEARCH_WITH_RESULTS, body: JSON.stringify({ id: 'PROBE', result: RESULTS }) }],
      ['probe-rejected', { status: 401, headers: {}, body: 'unauthorized' }],
      ['probe-rejected', { status: 403, headers: {}, body: 'cloudflare' }],
      ['probe-rejected', { status: 400, headers: {}, body: 'bad' }],
      ['probe-failed', { status: 503, headers: {}, body: '' }],
      ['probe-failed', new TypeError('fetch failed')],
    ])('%s: one line, the fetch goes without the cookie, the exit code is unchanged', async (reason, answer) => {
      const { deps, http, auth, err, out, fs } = withResults();

      expect(await syncCommand(probing(deps, answer))).toBe(0);

      expect(auth).toEqual([{ line: `pnpm sync:batch: unauthenticated (${reason})`, requestsBefore: 3 }]);
      expect(err).toEqual([]);
      expect(out).toEqual(['pnpm sync:batch: completed, 1 completed']);
      expect(cookies(http)).toEqual([
        ['GET', undefined],
        ['POST', undefined],
        ['POST', COOKIE],
        ['GET', undefined],
      ]);
      // A rejected probe is no malformed abort: no run-failure record.
      const report = await reportOf(fs);
      expect(report?.records).toEqual([]);
    });

    it('a probe 429 on an entry with 0 results: the chunk yields, notBefore is persisted, not-probed at the end', async () => {
      const { deps, http, auth, out, fs } = dependenciesFor(LEAGUE, { env: COOKIE_ENV });

      expect(await syncCommand(probing(deps, { status: 429, headers: { 'retry-after': '60' }, body: '' }))).toBe(0);

      expect(cookies(http)).toEqual([
        ['GET', undefined],
        ['POST', undefined],
        ['POST', COOKIE],
      ]);
      expect(out).toEqual(['pnpm sync:batch: yielded, 1 completed']);
      const progress = JSON.parse((await fs.readTextFile(PROGRESS_PATH)) ?? '{}') as { notBefore?: string };
      expect(progress.notBefore).toBe('2026-09-26T12:01:00.000Z');
      expect(auth).toEqual([{ line: 'pnpm sync:batch: unauthenticated (not-probed)', requestsBefore: 3 }]);
    });

    it('a probe 429 before a fetch: the fetch yields with nothing sent, and notBefore is persisted', async () => {
      const { deps, http, out, fs } = withResults();

      expect(await syncCommand(probing(deps, { status: 429, headers: { 'retry-after': '90' }, body: '' }))).toBe(0);

      expect(cookies(http)).toEqual([
        ['GET', undefined],
        ['POST', undefined],
        ['POST', COOKIE],
      ]);
      expect(out).toEqual(['pnpm sync:batch: yielded, 0 completed']);
      const progress = JSON.parse((await fs.readTextFile(PROGRESS_PATH)) ?? '{}') as { notBefore?: string };
      expect(progress.notBefore).toBe('2026-09-26T12:01:30.000Z');
    });

    it('a baseline 4xx: no probe, the existing malformed abort, and not-probed after the throw', async () => {
      const { deps, http, auth, err } = dependenciesFor(LEAGUE, {
        env: COOKIE_ENV,
        answers: { search: { status: 400, headers: {}, body: 'bad' } },
      });

      expect(await syncCommand(deps)).toBe(1);

      expect(http.requests.every((request) => request.headers['cookie'] === undefined)).toBe(true);
      expect(err).toHaveLength(1);
      expect(auth).toEqual([{ line: 'pnpm sync:batch: unauthenticated (not-probed)', requestsBefore: 2 }]);
    });

    it.each([
      ['a 403', { status: 403, headers: { 'content-type': 'text/html' }, body: 'cloudflare' }],
      ['a 401', { status: 401, headers: {}, body: 'unauthorized' }],
    ])('CAP-3, %s on the cookie fetch: one expired line, the entry stamped, yielded, the hold-off written, exit 0', async (_label, downgrading) => {
      const { deps, http, auth, err, out, fs } = withResults();

      expect(await syncCommand(probingThen(deps, [LIVE], () => downgrading))).toBe(0);

      expect(auth.map((entry) => entry.line)).toEqual([
        'pnpm sync:batch: authenticated',
        'pnpm sync:batch: unauthenticated (expired)',
      ]);
      expect(err).toEqual([]);
      expect(out).toEqual(['pnpm sync:batch: yielded, 0 completed']);
      const progress = await progressOf(fs);
      expect(progress).toEqual({ schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION, completed: [], authHoldOffUntil: NOW_PLUS_24H });
      // The entry is stamped and keeps the search fields from this entry's search; the price is unchanged.
      const dataset = JSON.parse((await fs.readTextFile(DATASET_PATH)) ?? '{}') as { entries: DatasetEntry[] };
      expect(dataset.entries[0]).toMatchObject({
        lastAttemptedAt: NOW,
        lastSearchId: 'S1',
        price: { state: 'not-yet-synced', reason: 'never-synced' },
      });
      // A downgrade is not a request-rejected abort: no record.
      const report = await reportOf(fs);
      expect(report?.records).toEqual([]);
      expect(cookies(http).at(-1)).toEqual(['GET', COOKIE]);
    });

    it('CAP-3, a search 2xx that is not live: the next entry’s search expires the cookie, the fetch before it did not', async () => {
      const second: TrackedEntry = { ...ENTRY, itemLevelMin: 83 };
      const { deps, http, auth, err, out, fs } = withResults({ tracked: [ENTRY, second] });

      // After the probe, every cookie request gets the answer the cookie-less request gets.
      expect(await syncCommand(probingThen(deps, [LIVE], (answer) => answer))).toBe(0);

      expect(cookies(http)).toEqual([
        ['GET', undefined],
        ['POST', undefined],
        ['POST', COOKIE],
        ['GET', COOKIE],
        ['POST', COOKIE],
      ]);
      expect(auth.map((entry) => entry.line)).toEqual([
        'pnpm sync:batch: authenticated',
        'pnpm sync:batch: unauthenticated (expired)',
      ]);
      expect(err).toEqual([]);
      expect(out).toEqual(['pnpm sync:batch: yielded, 1 completed']);
      const progress = await progressOf(fs);
      expect(progress['authHoldOffUntil']).toBe(NOW_PLUS_24H);
      // The second entry is stamped with no search fields: the downgrading search was its first.
      const dataset = JSON.parse((await fs.readTextFile(DATASET_PATH)) ?? '{}') as { entries: DatasetEntry[] };
      // The first entry was priced from its fetch, which was not a downgrade.
      expect(dataset.entries.find((entry) => entry.entryKey === canonicalKey(ENTRY))).toMatchObject({
        lastSearchId: 'S1',
        price: { state: 'priced' },
      });
      const stamped = dataset.entries.find((entry) => entry.entryKey === canonicalKey(second));
      expect(stamped).toMatchObject({ lastAttemptedAt: NOW, price: { state: 'not-yet-synced', reason: 'never-synced' } });
      expect(stamped).not.toHaveProperty('lastSearchId');
      const report = await reportOf(fs);
      expect(report?.records).toEqual([]);
    });

    it('CAP-5, held off: unauthenticated (held-off), no session-probe request, exit 0, the field unchanged', async () => {
      const { deps, http, auth, fs } = withResults({ seeded: progressSeed({ authHoldOffUntil: HOLD_OFF }) });

      expect(await syncCommand(probing(deps, LIVE))).toBe(0);

      expect(auth).toEqual([{ line: 'pnpm sync:batch: unauthenticated (held-off)', requestsBefore: 0 }]);
      expect(http.requests.every((request) => request.headers['cookie'] === undefined)).toBe(true);
      const report = await reportOf(fs);
      expect(report?.figures.requestsBySource['session-probe']).toBe(0);
      const progress = await progressOf(fs);
      expect(progress['authHoldOffUntil']).toBe(HOLD_OFF);
    });

    it('CAP-5, the hold-off is past: the run probes, and live clears the field', async () => {
      const { deps, auth, fs } = withResults({ seeded: progressSeed({ authHoldOffUntil: PAST_HOLD_OFF }) });

      expect(await syncCommand(probing(deps, LIVE))).toBe(0);

      expect(auth.map((entry) => entry.line)).toEqual(['pnpm sync:batch: authenticated']);
      expect(await progressOf(fs)).not.toHaveProperty('authHoldOffUntil');
    });

    it.each([
      ['not-elevated', { ...SEARCH_WITH_RESULTS, body: JSON.stringify({ id: 'PROBE', result: RESULTS }) }],
      ['probe-rejected', { status: 403, headers: {}, body: 'cloudflare' }],
    ])('CAP-5, %s writes the hold-off in the chunk’s progress write', async (_reason, answer) => {
      const { deps, fs } = withResults();

      expect(await syncCommand(probing(deps, answer))).toBe(0);

      const progress = await progressOf(fs);
      expect(progress['authHoldOffUntil']).toBe(NOW_PLUS_24H);
    });

    it.each([
      ['probe-failed', COOKIE_ENV, [{ status: 503, headers: {}, body: '' }]],
      ['a probe 429', COOKIE_ENV, [{ status: 429, headers: { 'retry-after': '60' }, body: '' }]],
      ['absent', { [USER_AGENT_ENV_VAR]: CONTACT }, []],
      ['malformed', { [USER_AGENT_ENV_VAR]: CONTACT, [SESSION_COOKIE_ENV_VAR]: 'a b' }, []],
    ])('CAP-5, %s carries the field forward unchanged', async (_label, environment, answers) => {
      const { deps, fs } = withResults({ env: environment, seeded: progressSeed({ authHoldOffUntil: PAST_HOLD_OFF }) });

      expect(await syncCommand(probing(deps, ...answers))).toBe(0);

      const progress = await progressOf(fs);
      expect(progress['authHoldOffUntil']).toBe(PAST_HOLD_OFF);
    });

    it('CAP-5, not-probed (no 2xx search) carries the field forward unchanged', async () => {
      const { deps, auth, fs } = dependenciesFor(LEAGUE, {
        env: COOKIE_ENV,
        answers: { search: { status: 503, headers: {}, body: '' } },
        seeded: progressSeed({ authHoldOffUntil: PAST_HOLD_OFF }),
      });

      expect(await syncCommand(deps)).toBe(0);

      expect(auth.map((entry) => entry.line)).toEqual(['pnpm sync:batch: unauthenticated (not-probed)']);
      const progress = await progressOf(fs);
      expect(progress['authHoldOffUntil']).toBe(PAST_HOLD_OFF);
    });

    it('no entry attempted (a gate 429): no probe, not-probed at the end, exit 0', async () => {
      const { deps, http, auth } = dependenciesFor(LEAGUE, { env: COOKIE_ENV, answers: { leagues: THROTTLED } });

      expect(await syncCommand(deps)).toBe(0);

      expect(http.requests).toHaveLength(1);
      expect(auth).toEqual([{ line: 'pnpm sync:batch: unauthenticated (not-probed)', requestsBefore: 1 }]);
    });
  });

  it('is reachable at the script name, with the .env overlay', () => {
    const manifest = JSON.parse(readFileSync(`${REPO_ROOT}package.json`, 'utf8')) as {
      scripts: Record<string, string>;
    };
    const script = manifest.scripts['sync:batch'];

    expect(script).toBeDefined();
    const entry = (script ?? '').split(/\s+/).at(-1);
    expect(nodePath.resolve(REPO_ROOT, entry ?? '')).toBe(SCRIPT);
    expect(script).toContain('--env-file-if-exists=.env');
  });
});
