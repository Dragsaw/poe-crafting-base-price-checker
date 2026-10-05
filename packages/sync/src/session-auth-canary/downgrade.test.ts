import { Buffer } from 'node:buffer';

import { createFakeClockPort, createFakeGitPort, createFakeHttpPort } from '@poe/contracts';
import type { HttpPort, HttpRequest, TrackedEntry } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { composeChunk } from '../compose-chunk.ts';
import { TRADE_LEAGUES_URL, tradeFetchUrl, tradeSearchUrl } from '../trade/endpoints.ts';
import { createSessionAuth, SESSION_COOKIE_ENV_VAR } from '../trade/session-auth.ts';
import { USER_AGENT_ENV_VAR } from '../trade/user-agent.ts';
import { CANARY, CONTACT, ENTRY, LEAGUE, LEAGUES_BODY, NOW, capturing, leaksIn, runBatch, runSession } from './test-support.ts';

/** A body and headers that quote the request's cookie in every form. */
const quoting = (cookie: string) => ({
  body: `echo ${cookie} ${encodeURIComponent(cookie)} ${Buffer.from(cookie).toString('base64')}`,
  headers: { 'set-cookie': cookie, 'x-echo': Buffer.from(cookie).toString('base64') },
});

const ENV = { [USER_AGENT_ENV_VAR]: CONTACT, [SESSION_COOKIE_ENV_VAR]: CANARY };

describe('CAP-4: the downgrade (IMPLEMENTATION-NOTES.md §13.4, §13.6)', () => {
  const RESULTS = ['r1'];
  const SEARCHED = JSON.stringify({ id: 'S1', complexity: 1, result: RESULTS, total: RESULTS.length });
  /** Every answer names its policy, as the live API does; a search and a fetch differ (§13.2). */
  const SEARCH_HEADERS = {
    'x-rate-limit-policy': 'trade-search-request-limit',
    'x-rate-limit-rules': 'Ip',
    'x-rate-limit-ip': '30:300:60',
    'x-rate-limit-ip-state': '1:300:0',
  };
  const FETCH_HEADERS = { ...SEARCH_HEADERS, 'x-rate-limit-policy': 'trade-fetch-request-limit' };
  /** The search policy with one more rule than the baseline: a live probe; names illustrative. */
  const LIVE_HEADERS = {
    ...SEARCH_HEADERS,
    'x-rate-limit-rules': 'Ip,Account',
    'x-rate-limit-account': '60:300:60',
    'x-rate-limit-account-state': '1:300:0',
  };
  /** A second entry, so a search carries the cookie after the probe. */
  const TRACKED: readonly TrackedEntry[] = [ENTRY, { ...ENTRY, itemLevelMin: 83 }];
  type Downgrade = '401' | '403' | 'not-live';

  /** A live probe, then a downgrade quoting the cookie: `401`/`403` answers the fetch. */
  function downgradingHttp(kind: Downgrade): { readonly port: HttpPort; readonly downgraded: () => number } {
    let downgraded = 0;
    let isProbed = false;
    const fake = createFakeHttpPort({
      [`GET ${TRADE_LEAGUES_URL}`]: { status: 200, headers: {}, body: LEAGUES_BODY },
      [`POST ${tradeSearchUrl(LEAGUE)}`]: { status: 200, headers: SEARCH_HEADERS, body: SEARCHED },
      [`GET ${tradeFetchUrl(RESULTS, 'S1')}`]: { status: 200, headers: FETCH_HEADERS, body: '{"result":[]}' },
    });
    return {
      port: {
        send: (request: HttpRequest) => {
          const cookie = request.headers['cookie'];
          if (cookie === undefined) {
            return fake.send(request);
          }
          if (!isProbed && request.method === 'POST') {
            isProbed = true;
            return Promise.resolve({ status: 200, headers: LIVE_HEADERS, body: SEARCHED });
          }
          const echo = quoting(cookie);
          if (kind === 'not-live' && request.method === 'POST') {
            downgraded += 1;
            return Promise.resolve({ status: 200, headers: { ...SEARCH_HEADERS, ...echo.headers }, body: echo.body });
          }
          if (kind !== 'not-live' && request.method === 'GET') {
            downgraded += 1;
            return Promise.resolve({ status: Number(kind), headers: echo.headers, body: echo.body });
          }
          return fake.send(request);
        },
      },
      downgraded: () => downgraded,
    };
  }

  const KINDS: readonly Downgrade[] = ['401', '403', 'not-live'];

  it.each(KINDS)('pnpm sync:batch: a %s downgrade quoting the cookie leaves no trace', async (kind) => {
    const captured = capturing({ tracked: TRACKED });
    const http = downgradingHttp(kind);

    const { code, lines } = await runBatch(captured, http.port, ENV);

    expect(code).toBe(0);
    expect(http.downgraded()).toBe(1);
    expect(lines).toContain('pnpm sync:batch: unauthenticated (expired)');
    const scanned = [...lines, ...captured.texts, ...(await captured.files())].join('\n');
    expect(scanned).toContain('authHoldOffUntil');
    expect(leaksIn(scanned)).toEqual([]);
  });

  it.each(KINDS)('pnpm sync: a %s downgrade quoting the cookie leaves no trace', async (kind) => {
    const captured = capturing({ tracked: TRACKED });
    const http = downgradingHttp(kind);

    const { code, lines } = await runSession(captured, http.port, ENV);

    expect(code).toBe(0);
    expect(http.downgraded()).toBe(1);
    expect(lines).toContain('pnpm sync: unauthenticated (expired)');
    const scanned = [...lines, ...captured.texts, ...(await captured.files())].join('\n');
    expect(scanned).toContain('authHoldOffUntil');
    expect(leaksIn(scanned)).toEqual([]);
  });

  it.each(KINDS)('the outcome of a chunk with a %s downgrade carries no trace', async (kind) => {
    const captured = capturing({ tracked: TRACKED });
    const http = downgradingHttp(kind);

    const outcome = await composeChunk({
      fs: captured.fs,
      clock: createFakeClockPort(NOW),
      http: http.port,
      git: createFakeGitPort(),
      wait: () => Promise.resolve(),
      userAgent: CONTACT,
      pid: 4242,
      log: () => {},
      auth: createSessionAuth(ENV),
    }).run();

    expect(outcome).toMatchObject({ kind: 'yielded', sessionExpired: true });
    expect(http.downgraded()).toBe(1);
    const scanned = [JSON.stringify(outcome), ...captured.texts, ...(await captured.files())].join('\n');
    expect(leaksIn(scanned)).toEqual([]);
  });
});
