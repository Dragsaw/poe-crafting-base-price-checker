import { createFakeHttpPort, SYNC_PROGRESS_SCHEMA_VERSION } from '@poe/contracts';
import type { HttpPort, HttpRequest, HttpResponse, TrackedEntry } from '@poe/contracts';
import { describe, expect, it, vi } from 'vitest';

import { PROGRESS_PATH } from '../chunk/run-chunk.ts';
import { backoffMs, COLD_EVEN_INTERVAL_MS, syncSessionCommand } from '../sync.ts';
import type { SyncSessionDependencies } from '../sync.ts';
import type * as TradeClientModule from '../trade/client.ts';
import { tradeFetchUrl, tradeSearchUrl } from '../trade/endpoints.ts';
import { SESSION_COOKIE_ENV_VAR } from '../trade/session-auth.ts';
import { USER_AGENT_ENV_VAR } from '../trade/user-agent.ts';
import { announced, CONTACT, ENTRY, LEAGUE, lines, NO_RESULTS, reportOf, SECOND, sessionFor } from './test-support.ts';

/** Every option set a chunk built its governor with, in build order. */
const governorOptions = vi.hoisted((): Record<string, unknown>[] => []);

// A pass-through: the real governor is built, and the options are recorded so
// a test can inspect what the session passed (AD-8).
vi.mock('../trade/client.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof TradeClientModule>();
  return {
    ...actual,
    createTradeGovernor: (options: Parameters<typeof actual.createTradeGovernor>[0]) => {
      governorOptions.push(options as unknown as Record<string, unknown>);
      return actual.createTradeGovernor(options);
    },
  };
});

const cookies = (http: ReturnType<typeof createFakeHttpPort>) =>
  http.requests.map((request) => [request.method, request.headers['cookie']]);

describe('pnpm sync: the session with injected ports', () => {
  describe('the session probe (AD-30, IMPLEMENTATION-NOTES.md §13.2, §13.3, §13.5)', () => {
    const VALUE = `"${'Z'.repeat(32)}"`;
    const COOKIE = `POESESSID=${VALUE}`;
    const THIRD: TrackedEntry = { ...ENTRY, itemLevelMin: 84 };
    const COOKIE_ENV = { [USER_AGENT_ENV_VAR]: CONTACT, [SESSION_COOKIE_ENV_VAR]: VALUE };
    /** One rule more than the fake's baseline answer, which names none. */
    const LIVE: HttpResponse = {
      status: 200,
      headers: {
        'x-rate-limit-policy': 'search-policy',
        'x-rate-limit-rules': 'Ip',
        'x-rate-limit-ip': '30:300:60',
        'x-rate-limit-ip-state': '1:300:0',
      },
      body: NO_RESULTS,
    };

    /** Answers each cookie-carrying search from `answers` in turn: those are the probes, before any `authenticated` settle. */
    function probing(...answers: (HttpResponse | Error)[]) {
      return probingThen(answers);
    }

    /** As `probing`; every later cookie request is answered by `after`, live by default so the cookie stays live (§13.4). */
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
});
