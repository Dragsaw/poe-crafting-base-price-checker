import { canonicalKey, createFakeHttpPort, SYNC_PROGRESS_SCHEMA_VERSION, SYNC_REPORT_SCHEMA_VERSION } from '@poe/contracts';
import type { DatasetEntry, FilesystemPort, HttpRequest, HttpResponse, TrackedEntry } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { DATASET_PATH, PROGRESS_PATH } from '../chunk/run-chunk.ts';
import type { SyncCommandDependencies } from '../sync-batch.ts';
import { syncCommand } from '../sync-batch.ts';
import { tradeFetchUrl } from '../trade/endpoints.ts';
import { SESSION_COOKIE_ENV_VAR } from '../trade/session-auth.ts';
import { USER_AGENT_ENV_VAR } from '../trade/user-agent.ts';
import type { Setup } from './test-support.ts';
import { CONTACT, dependenciesFor, ENTRY, LEAGUE, NOW, reportOf, THROTTLED } from './test-support.ts';

const cookies = (http: ReturnType<typeof createFakeHttpPort>) =>
  http.requests.map((request) => [request.method, request.headers['cookie']]);

describe('pnpm sync:batch: the live composition with injected ports', () => {
  describe('the session probe (AD-30, IMPLEMENTATION-NOTES.md §13.2, §13.3, §13.5)', () => {
    const VALUE = 'b'.repeat(16) + '0123456789abcdef0123';
    const COOKIE = `POESESSID=${VALUE}`;
    const COOKIE_ENV = { [USER_AGENT_ENV_VAR]: CONTACT, [SESSION_COOKIE_ENV_VAR]: VALUE };
    const RESULTS = ['r1', 'r2'];
    /** Every answer names its policy; a search and a fetch differ (§13.2). */
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
    /** The search policy with one more rule than the baseline: a live cookie; names invented. */
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

    /** Answers each cookie-carrying search from `answers` in turn: the probes. */
    function probing(dependencies: SyncCommandDependencies, ...answers: (HttpResponse | Error)[]): SyncCommandDependencies {
      return probingThen(dependencies, answers);
    }

    /** As `probing`; later cookie requests are answered by `after`, live by default (§13.4). */
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
      // The fetch answers fewer rules than the probe, under its own policy: not tested, no
      // downgrade (§13.4).
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
      // The entry is stamped and keeps this entry's search fields; the price is unchanged.
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
});
