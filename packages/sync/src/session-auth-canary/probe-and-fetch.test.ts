import { Buffer } from 'node:buffer';

import { createFakeClockPort, createFakeGitPort, createFakeHttpPort } from '@poe/contracts';
import type { HttpRequest } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { composeChunk } from '../compose-chunk.ts';
import { NamedError } from '../test-support/named-error.ts';
import { TRADE_LEAGUES_URL, tradeFetchUrl, tradeSearchUrl } from '../trade/endpoints.ts';
import { createSessionAuth, SESSION_COOKIE_ENV_VAR } from '../trade/session-auth.ts';
import { USER_AGENT_ENV_VAR } from '../trade/user-agent.ts';
import type { Failure, ThrowingHttp } from './test-support.ts';
import { CANARY, CONTACT, LEAGUE, LEAGUES_BODY, NOW, capturing, leaksIn, runBatch, runSession, textOf } from './test-support.ts';

const ENV = { [USER_AGENT_ENV_VAR]: CONTACT, [SESSION_COOKIE_ENV_VAR]: CANARY };

describe('CAP-4: the probe and the requests after it (IMPLEMENTATION-NOTES.md §13.2, §13.6)', () => {
  const RESULTS = ['r1'];
  const SEARCHED = JSON.stringify({ id: 'S1', complexity: 1, result: RESULTS, total: RESULTS.length });
  /** One rule more than the baseline answer, which names none: a live probe. */
  const LIVE_HEADERS = {
    'x-rate-limit-policy': 'search-policy',
    'x-rate-limit-rules': 'Ip',
    'x-rate-limit-ip': '30:300:60',
    'x-rate-limit-ip-state': '1:300:0',
  };

  /** An error whose message, stack and cause chain quote the request's own `cookie` header. */
  function quotingRequestError(request: HttpRequest, failure: Failure): Error {
    const header = request.headers['cookie'] ?? '';
    const cause = new Error(`socket said ${encodeURIComponent(header)}`, {
      cause: new Error(`header ${Buffer.from(header).toString('base64')}`, { cause: `raw ${header}` }),
    });
    let error: Error;
    if (failure === 'transport') {
      error = new TypeError('fetch failed', { cause });
    } else if (failure === 'timeout') {
      error = new NamedError('TimeoutError', `The operation timed out (Cookie: ${header})`, { cause });
    } else {
      error = new Error(`unexpected Cookie: ${header}`, { cause });
    }
    error.stack = `${error.name}: ${error.message}\n    at send (${header})\n    at ${Buffer.from(header).toString('base64')}`;
    Object.assign(error, { request: { headers: { ...request.headers } } });
    return error;
  }

  /** `probe`: the first cookie search throws. `fetch`: the probe is live, the fetch throws. */
  function cookieThrowingHttp(target: 'probe' | 'fetch', failure: Failure): ThrowingHttp {
    let threw = 0;
    let isProbed = false;
    const fake = createFakeHttpPort({
      [`GET ${TRADE_LEAGUES_URL}`]: { status: 200, headers: {}, body: LEAGUES_BODY },
      [`POST ${tradeSearchUrl(LEAGUE)}`]: { status: 200, headers: {}, body: SEARCHED },
      [`GET ${tradeFetchUrl(RESULTS, 'S1')}`]: { status: 200, headers: {}, body: '{"result":[]}' },
    });
    return {
      port: {
        send: (request: HttpRequest) => {
          const cookie = request.headers['cookie'];
          if (cookie === undefined) {
            return fake.send(request);
          }
          expect(cookie).toBe(`POESESSID=${CANARY}`);
          const isProbe = request.method === 'POST' && !isProbed;
          isProbed = true;
          if ((target === 'probe' && isProbe) || (target === 'fetch' && request.method === 'GET')) {
            threw += 1;
            return Promise.reject(quotingRequestError(request, failure));
          }
          return Promise.resolve({ status: 200, headers: LIVE_HEADERS, body: SEARCHED });
        },
      },
      threw: () => threw,
    };
  }

  const FAILURES: readonly Failure[] = ['transport', 'timeout', 'other'];

  it.each(FAILURES)('pnpm sync:batch: the probe throws a %s error; it does not reach the caller', async (failure) => {
    const captured = capturing();
    const http = cookieThrowingHttp('probe', failure);

    const { code, lines } = await runBatch(captured, http.port, ENV);

    expect(http.threw()).toBe(1);
    expect(code).toBe(0);
    expect(lines).toContain('pnpm sync:batch: unauthenticated (probe-failed)');
    const scanned = [...lines, ...captured.texts, ...(await captured.files())].join('\n');
    expect(leaksIn(scanned)).toEqual([]);
  });

  it.each(FAILURES)('pnpm sync: the probe throws a %s error; it does not reach the caller', async (failure) => {
    const captured = capturing();
    const http = cookieThrowingHttp('probe', failure);

    const { code, lines } = await runSession(captured, http.port, ENV);

    expect(http.threw()).toBe(1);
    expect(code).toBe(0);
    expect(lines).toContain('pnpm sync: unauthenticated (probe-failed)');
    const scanned = [...lines, ...captured.texts, ...(await captured.files())].join('\n');
    expect(leaksIn(scanned)).toEqual([]);
  });

  it.each(FAILURES)('pnpm sync:batch: a fetch after a live probe throws a %s error quoting its cookie', async (failure) => {
    const captured = capturing();
    const http = cookieThrowingHttp('fetch', failure);

    const { lines } = await runBatch(captured, http.port, ENV);

    expect(http.threw()).toBe(1);
    expect(lines).toContain('pnpm sync:batch: authenticated');
    const scanned = [...lines, ...captured.texts, ...(await captured.files())].join('\n');
    expect(leaksIn(scanned)).toEqual([]);
  });

  it.each(FAILURES)('pnpm sync: a fetch after a live probe throws a %s error quoting its cookie', async (failure) => {
    const captured = capturing();
    const http = cookieThrowingHttp('fetch', failure);

    const { code, lines } = await runSession(captured, http.port, ENV);

    expect(code).toBe(0);
    expect(http.threw()).toBeGreaterThan(0);
    const scanned = [...lines, ...captured.texts, ...(await captured.files())].join('\n');
    expect(leaksIn(scanned)).toEqual([]);
  });

  it.each([
    ['probe', 'other'],
    ['fetch', 'transport'],
    ['fetch', 'timeout'],
    ['fetch', 'other'],
  ] as const)('the thrown value of a chunk whose %s throws a %s error', async (target, failure) => {
    const captured = capturing();
    const http = cookieThrowingHttp(target, failure);
    let thrown: unknown;
    try {
      await composeChunk({
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
    } catch (error) {
      thrown = error;
    }

    expect(http.threw()).toBe(1);
    // The probe error is never passed on; a transport throw on the fetch yields.
    const wasPassedOn = target !== 'probe' && failure === 'other';
    expect(thrown instanceof Error ? 'an Error' : thrown).toEqual(wasPassedOn ? 'an Error' : undefined);
    const scanned = [textOf(thrown), ...captured.texts, ...(await captured.files())].join('\n');
    expect(leaksIn(scanned)).toEqual([]);
  });
});
