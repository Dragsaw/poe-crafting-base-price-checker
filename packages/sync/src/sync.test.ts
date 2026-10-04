import { readFileSync } from 'node:fs';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';

import { canonicalKey, SUPPORTED_SCHEMA_VERSION } from '@poe/contracts';
import type { DatasetEntry, TrackedEntry } from '@poe/contracts';
import { describe, expect, it, vi } from 'vitest';

import { LOCK_PATH, serialiseLock } from './chunk/lock.ts';
import { DATASET_PATH } from './chunk/run-chunk.ts';
import { syncSessionCommand } from './sync.ts';
import type { SyncSessionDependencies } from './sync.ts';
import { CONTACT, ENTRY, LEAGUE, lines, NOW, reportOf, SECOND, sessionFor } from './sync/test-support.ts';
import type * as TradeClientModule from './trade/client.ts';
import { TRADE_LEAGUES_URL, tradeSearchUrl } from './trade/endpoints.ts';
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

/** The `pnpm sync` session, driven with injected ports and a fake clock each wait advances: no network, no writes under `data/`. */

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SCRIPT = fileURLToPath(new URL('sync.ts', import.meta.url));

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
    expect(governorOptions[0]?.['pacing']).toBeTypeOf('object');
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
