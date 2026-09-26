import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  canonicalKey,
  createFakeClockPort,
  createFakeFilesystemPort,
  createFakeGitPort,
  createFakeHttpPort,
  SyncReportFileSchema,
} from '@poe/contracts';
import type {
  DatasetEntry,
  FakeFilesystemPort,
  FilesystemPort,
  HttpResponse,
  SyncReportFile,
  TrackedEntry,
} from '@poe/contracts';
import { describe, expect, it, vi } from 'vitest';

import { LOCK_PATH, serialiseLock } from './chunk/lock.ts';
import { DATASET_PATH, PROGRESS_PATH, REPORT_PATH, TRACKED_PATH } from './chunk/run-chunk.ts';
import { LeagueMismatchError } from './league/league-gate.ts';
import { runSync, syncCommand } from './sync.ts';
import type { SyncCommandDeps } from './sync.ts';
import type * as TradeClientModule from './trade/client.ts';
import { TRADE_LEAGUES_URL, tradeSearchUrl } from './trade/endpoints.ts';
import { USER_AGENT_ENV_VAR } from './trade/user-agent.ts';

/** Every option set the shell built its trade clients with, in build order. */
const tradeClientOptions = vi.hoisted((): unknown[] => []);

// A pass-through: the real clients are built, and the options are recorded so
// a test can inspect what the shell passed (AD-8, IMPLEMENTATION-NOTES.md §5.3).
vi.mock('./trade/client.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof TradeClientModule>();
  return {
    ...actual,
    createTradeClients: (options: Parameters<typeof actual.createTradeClients>[0]) => {
      tradeClientOptions.push(options);
      return actual.createTradeClients(options);
    },
  };
});

/**
 * The live `pnpm sync` composition, driven with injected ports. Nothing here
 * runs the command itself, touches the network, or writes under `data/`.
 */

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SCRIPT = fileURLToPath(new URL('./sync.ts', import.meta.url));

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
      contents: JSON.stringify({ schemaVersion: '1.0.0', entries: tracked }),
      modifiedAt: '2026-09-20T07:00:00.000Z',
    },
    'data/config.json': { contents: JSON.stringify({ schemaVersion: '1.0.0', league, minChunkSearches: 1 }) },
    'data/currencies.json': {
      contents: JSON.stringify({
        schemaVersion: '1.0.0',
        rates: [{ currencyId: 'divine', rate: 1, source: 'measured', league: LEAGUE, asOf: '2026-01-01T00:00:00Z' }],
      }),
    },
    'data/catalogue/items.json': {
      contents: JSON.stringify({
        schemaVersion: '1.0.0',
        result: [{ id: 'accessory', label: 'Accessories', entries: [{ type: 'Solar Amulet' }] }],
      }),
    },
    'data/catalogue/stats.json': { contents: JSON.stringify({ schemaVersion: '1.0.0', result: [] }) },
    'data/catalogue/filters.json': { contents: JSON.stringify({ schemaVersion: '1.0.0', result: [] }) },
    'data/weights.json': { contents: JSON.stringify({ schemaVersion: '6.0.0', bases: {} }) },
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
  readonly seeded?: Parameters<typeof createFakeFilesystemPort>[0];
  /** The tracked entries; one `ENTRY` by default. */
  readonly tracked?: readonly TrackedEntry[];
  readonly wait?: (ms: number) => Promise<void>;
}

function depsFor(league: string, setup: Setup = {}) {
  const env = setup.env ?? { [USER_AGENT_ENV_VAR]: CONTACT };
  const recorded = recording(createFakeFilesystemPort({ ...inputs(league, setup.tracked), ...setup.seeded }));
  const http = httpFor(league, setup.answers);
  const out: string[] = [];
  const err: string[] = [];
  const deps: SyncCommandDeps = {
    fs: recorded.fs,
    clock: createFakeClockPort(NOW),
    http,
    git: createFakeGitPort(),
    wait: setup.wait ?? (() => Promise.resolve()),
    pid: 4242,
    log: () => undefined,
    env,
    stdout: (line) => out.push(line),
    stderr: (line) => err.push(line),
  };
  return { deps, fs: recorded.fs, writes: recorded.writes, http, out, err };
}

async function reportOf(fs: FilesystemPort): Promise<SyncReportFile | undefined> {
  const text = await fs.readTextFile(REPORT_PATH);
  return text === undefined ? undefined : SyncReportFileSchema.parse(JSON.parse(text));
}

describe('pnpm sync: the live composition with injected ports', () => {
  it('runs the gate first, then the pricing step as the chunk step, and exits 0', async () => {
    const { deps, fs, http, out } = depsFor(LEAGUE);

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
    });
    // No git history, so the edit date falls to the file's modification time (AD-12).
    expect(report?.figures.trackedListEditedAt).toEqual({
      source: 'file-modified',
      at: '2026-09-20T07:00:00.000Z',
    });
    expect(report?.runFinishedAt).toBe(NOW);
    expect(out).toEqual(['pnpm sync: completed, 1 completed']);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });

  it('a league mismatch: exit 1, the report is the only write, the lock is released', async () => {
    const { deps, fs, writes, http, err } = depsFor('Nope League');

    expect(await syncCommand(deps)).toBe(1);

    expect(http.requests.map((request) => request.url)).toEqual([TRADE_LEAGUES_URL]);
    expect(writes).toEqual([REPORT_PATH]);
    expect(await fs.exists(DATASET_PATH)).toBe(false);
    expect(await fs.exists(PROGRESS_PATH)).toBe(false);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
    expect((await reportOf(fs))?.records).toEqual([
      { kind: 'league-mismatch', configuredLeague: 'Nope League', availableLeagues: ['Standard', LEAGUE] },
    ]);
    expect(err).toHaveLength(1);
    expect(err[0]).toMatch(/^pnpm sync: the configured league "Nope League"/);
  });

  it('runSync rethrows the gate throw after the report is written', async () => {
    const { deps } = depsFor('Nope League');
    const { fs, clock, http, git, wait, pid, log } = deps;

    await expect(
      runSync({ fs, clock, http, git, wait, pid, log, userAgent: CONTACT }),
    ).rejects.toBeInstanceOf(LeagueMismatchError);
    expect((await reportOf(fs))?.records.map((record) => record.kind)).toEqual(['league-mismatch']);
  });

  it('refuses a blank contact before any request or write, with exit 1', async () => {
    const { deps, http, writes, err } = depsFor(LEAGUE, { env: {} });

    expect(await syncCommand(deps)).toBe(1);

    expect(http.requests).toEqual([]);
    expect(writes).toEqual([]);
    expect(err[0]).toContain(USER_AGENT_ENV_VAR);
  });

  it('refuses an absent config, naming it, before any request or write', async () => {
    const { deps, fs, http, writes, err } = depsFor(LEAGUE);
    await fs.deleteFile('data/config.json');

    expect(await syncCommand(deps)).toBe(1);

    expect(http.requests).toEqual([]);
    expect(writes).toEqual([]);
    expect(err[0]).toContain('data/config.json');
  });

  it('publishes the priced entry under the configured league', async () => {
    const { deps, fs } = depsFor(LEAGUE);

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

  it('a gate 429 yields the chunk: exit 0, no search, progress and the report, no run-failure', async () => {
    const { deps, fs, writes, http, out } = depsFor(LEAGUE, { answers: { leagues: THROTTLED } });

    expect(await syncCommand(deps)).toBe(0);

    expect(http.requests.map((request) => request.url)).toEqual([TRADE_LEAGUES_URL]);
    // Progress carries the penalty as notBefore, its completed keys unchanged (§5.3).
    expect(writes).toEqual([PROGRESS_PATH, REPORT_PATH]);
    expect(JSON.parse((await fs.readTextFile(PROGRESS_PATH)) ?? '')).toEqual({
      completed: [],
      notBefore: '2026-09-26T12:01:00.000Z',
      schemaVersion: '1.1.0',
    });
    const report = await reportOf(fs);
    expect(report?.records).toEqual([]);
    expect(report?.runFinishedAt).toBe(NOW);
    expect(report?.figures.requestsBySource).toEqual({
      'tracked-list': 0,
      'league-validation': 1,
    });
    expect(out).toEqual(['pnpm sync: yielded, 0 completed']);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
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
    const { deps, http } = depsFor(LEAGUE, {
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
    const { deps } = depsFor(LEAGUE);

    expect(await syncCommand(deps)).toBe(0);

    expect(tradeClientOptions).toEqual([expect.objectContaining({ invalidRequestThreshold: 1 })]);
  });

  it('a penalty still running defers: exit 0, no request, no write, the pause printed', async () => {
    const progress = JSON.stringify({
      schemaVersion: '1.1.0',
      completed: [],
      notBefore: '2026-09-26T12:30:00.000Z',
    });
    const { deps, fs, writes, http, out } = depsFor(LEAGUE, {
      seeded: { [PROGRESS_PATH]: { contents: progress } },
    });

    expect(await syncCommand(deps)).toBe(0);

    expect(http.requests).toEqual([]);
    expect(writes).toEqual([]);
    expect(out).toEqual(['pnpm sync: deferred until 2026-09-26T12:30:00.000Z, 0 completed']);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });

  it('a live lock is busy: exit 0, no request, no write', async () => {
    const lock = serialiseLock({ pid: 99, startedAt: NOW });
    const { deps, fs, writes, http, out } = depsFor(LEAGUE, { seeded: { [LOCK_PATH]: { contents: lock } } });

    expect(await syncCommand(deps)).toBe(0);

    expect(http.requests).toEqual([]);
    expect(writes).toEqual([]);
    expect(out).toEqual(['pnpm sync: busy, 0 completed']);
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
        schemaVersion: '1.0.0',
        league: LEAGUE,
        generatedAt: '2026-09-25T12:00:00.000Z',
        entries: [priced],
        currencyRates: [],
      },
      null,
      2,
    )}\n`;
    const { deps, fs, out } = depsFor(LEAGUE, {
      seeded: { [DATASET_PATH]: { contents: published } },
      answers: { search: THROTTLED },
    });

    expect(await syncCommand(deps)).toBe(0);

    expect(out).toEqual(['pnpm sync: yielded, 0 completed']);
    const dataset = JSON.parse((await fs.readTextFile(DATASET_PATH)) ?? '{}') as {
      entries: DatasetEntry[];
    };
    expect(dataset.entries).toHaveLength(1);
    expect(dataset.entries[0]?.price).toEqual(priced.price);
    expect((await reportOf(fs))?.records).toEqual([]);
  });

  it('a malformed published dataset: exit 1, no request, no write', async () => {
    const { deps, fs, writes, http, err } = depsFor(LEAGUE, {
      seeded: { [DATASET_PATH]: { contents: '{ not json' } },
    });

    expect(await syncCommand(deps)).toBe(1);

    expect(http.requests).toEqual([]);
    expect(writes).toEqual([]);
    expect(err[0]).toContain(DATASET_PATH);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });

  it('is reachable at the script name, with the .env overlay', () => {
    const manifest = JSON.parse(readFileSync(`${REPO_ROOT}package.json`, 'utf8')) as {
      scripts: Record<string, string>;
    };
    const script = manifest.scripts['sync'];

    expect(script).toBeDefined();
    const entry = (script ?? '').split(/\s+/).at(-1);
    expect(resolve(REPO_ROOT, entry ?? '')).toBe(SCRIPT);
    expect(script).toContain('--env-file-if-exists=.env');
  });
});
