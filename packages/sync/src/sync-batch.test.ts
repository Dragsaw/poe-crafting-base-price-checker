import { readFileSync } from 'node:fs';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';

import { canonicalKey } from '@poe/contracts';
import { describe, expect, it, vi } from 'vitest';

import { LOCK_PATH } from './chunk/lock.ts';
import { DATASET_PATH, PROGRESS_PATH, REPORT_PATH, TRACKED_PATH } from './chunk/run-chunk.ts';
import { LeagueMismatchError } from './league/league-gate.ts';
import { runSync, syncCommand } from './sync-batch.ts';
import { dependenciesFor, CONTACT, ENTRY, LEAGUE, NOW, THROTTLED, reportOf } from './sync-batch/test-support.ts';
import type * as TradeClientModule from './trade/client.ts';
import { TRADE_LEAGUES_URL, tradeSearchUrl } from './trade/endpoints.ts';
import { SESSION_COOKIE_ENV_VAR } from './trade/session-auth.ts';
import { USER_AGENT_ENV_VAR } from './trade/user-agent.ts';

/** Every option set the shell built its trade clients with, in build order. */
const tradeClientOptions = vi.hoisted((): { readonly auth?: { readonly holder: unknown; readonly probe: unknown } }[] => []);

// A pass-through: the real clients are built, and the options are recorded so
// a test can inspect what the shell passed (AD-8).
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

/** The `pnpm sync:batch` composition with injected ports: no network, no writes under `data/`. */

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SCRIPT = fileURLToPath(new URL('sync-batch.ts', import.meta.url));

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
    // One pinned entry against a yardstick of 1: 1 > 0.5 × 1.
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
  it('builds its trade clients with the invalid-request threshold of 1', async () => {
    tradeClientOptions.length = 0;
    const { deps } = dependenciesFor(LEAGUE);

    expect(await syncCommand(deps)).toBe(0);

    expect(tradeClientOptions).toEqual([expect.objectContaining({ invalidRequestThreshold: 1 })]);
    // The batch pacer, cold: no even spread and no shared pacing state (AD-8).
    expect(tradeClientOptions[0]).not.toHaveProperty('spread');
    expect(tradeClientOptions[0]).not.toHaveProperty('pacing');
  });

  describe('the session cookie at the shell edge (AD-30)', () => {
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
