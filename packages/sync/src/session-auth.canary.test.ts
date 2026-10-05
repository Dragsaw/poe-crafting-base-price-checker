import { Buffer } from 'node:buffer';

import { createFakeClockPort, createFakeGitPort, createFakeHttpPort } from '@poe/contracts';
import type { HttpRequest } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { NamedError } from './test-support/named-error.ts';

import { composeChunk } from './compose-chunk.ts';
import { TRADE_LEAGUES_URL, tradeSearchUrl } from './trade/endpoints.ts';
import { createSessionAuth, SESSION_COOKIE_ENV_VAR } from './trade/session-auth.ts';
import { USER_AGENT_ENV_VAR } from './trade/user-agent.ts';
import type { ThrowingHttp } from './session-auth-canary/test-support.ts';
import { CANARY, CONTACT, LEAGUE, LEAGUES_BODY, NOW, capturing, leaksIn, runBatch, runSession, textOf } from './session-auth-canary/test-support.ts';
import type { Failure } from './session-auth-canary/test-support.ts';

/** SPEC-poesessid-sync CAP-4, IN §13.6: no 8+ character substring of the canary may leak. */

const ENV = { [USER_AGENT_ENV_VAR]: CONTACT, [SESSION_COOKIE_ENV_VAR]: CANARY };

/** An error whose message, stack and nested cause all quote the canary. */
export function quotingError(failure: Failure): Error {
  const cookie = `POESESSID=${CANARY}`;
  const cause = new Error(`socket said ${encodeURIComponent(cookie)}`, {
    cause: new Error(`header ${Buffer.from(cookie).toString('base64')}`, {
      cause: `raw ${CANARY}`,
    }),
  });
  let error: Error;
  if (failure === 'transport') {
    error = new TypeError('fetch failed', { cause });
  } else if (failure === 'timeout') {
    error = new NamedError('TimeoutError', `The operation timed out (Cookie: POESESSID=${CANARY})`, { cause });
  } else {
    error = new Error(`unexpected Cookie: POESESSID=${CANARY}`, { cause });
  }
  error.stack = `${error.name}: ${error.message}\n    at send (cookie=${CANARY})\n    at ${Buffer.from(CANARY).toString('base64')}`;
  Object.assign(error, { request: { headers: { cookie: `POESESSID=${CANARY}` } } });
  return error;
}

type Target = 'leagues' | 'search';

function throwingHttp(target: Target | 'none', failure: Failure = 'other'): ThrowingHttp {
  let threw = 0;
  const fake = createFakeHttpPort({
    [`GET ${TRADE_LEAGUES_URL}`]: { status: 200, headers: {}, body: LEAGUES_BODY },
    [`POST ${tradeSearchUrl(LEAGUE)}`]: {
      status: 200,
      headers: {},
      body: JSON.stringify({ id: 'S0', complexity: 1, result: [], total: 0 }),
    },
  });
  return {
    port: {
      send: (request: HttpRequest) => {
        const isTarget =
          target === 'leagues' ? request.method === 'GET' : target === 'search' && request.method === 'POST';
        if (isTarget) {
          threw += 1;
          return Promise.reject(quotingError(failure));
        }
        return fake.send(request);
      },
    },
    threw: () => threw,
  };
}

const CASES: readonly (readonly [Target, Failure])[] = [
  ['leagues', 'transport'],
  ['leagues', 'timeout'],
  ['leagues', 'other'],
  ['search', 'transport'],
  ['search', 'timeout'],
  ['search', 'other'],
];

describe('CAP-4: the canary never leaves the holder', () => {
  it('the needles are the canary windows (a self-check of the scan)', () => {
    expect(leaksIn(`x ${CANARY.slice(3, 12)} y`)).not.toEqual([]);
    expect(leaksIn(Buffer.from(CANARY.slice(0, 9)).toString('base64'))).not.toEqual([]);
  });

  it.each(['', 'x', 'xy'])('every 8 characters of the canary, base64 behind %j, are caught at the end of a value or before more bytes', (prefix) => {
    const missed: string[] = [];
    for (let start = 0; start + 8 <= CANARY.length; start += 1) {
      for (const suffix of ['', '!']) {
        for (const encoding of ['base64', 'base64url'] as const) {
          const leak = Buffer.from(`${prefix}${CANARY.slice(start, start + 8)}${suffix}`).toString(encoding);
          if (leaksIn(leak).length === 0) {
            missed.push(`${encoding} at ${start}${suffix === '' ? ', at the end' : ''}`);
          }
        }
      }
    }
    expect(missed).toEqual([]);
  });

  it('control: a chunk built with no holder passes the canary on, so the scan can see a leak', async () => {
    const http = throwingHttp('search', 'other');
    let thrown: unknown;
    try {
      await composeChunk({
        fs: capturing().fs,
        clock: createFakeClockPort(NOW),
        http: http.port,
        git: createFakeGitPort(),
        wait: () => Promise.resolve(),
        userAgent: CONTACT,
        pid: 4242,
        log: () => {},
      }).run();
    } catch (error) {
      thrown = error;
    }
    expect(http.threw()).toBeGreaterThan(0);
    expect(leaksIn(textOf(thrown))).not.toEqual([]);
  });

  it.each(CASES)('pnpm sync:batch, the %s request throws a %s error', async (target, failure) => {
    const captured = capturing();
    const http = throwingHttp(target, failure);

    const { lines } = await runBatch(captured, http.port, ENV);

    expect(http.threw()).toBeGreaterThan(0);
    const scanned = [...lines, ...captured.texts, ...(await captured.files())].join('\n');
    expect(leaksIn(scanned)).toEqual([]);
  });

  it.each(CASES)('pnpm sync, the %s request throws a %s error', async (target, failure) => {
    const captured = capturing();
    const http = throwingHttp(target, failure);

    const { code, lines } = await runSession(captured, http.port, ENV);

    expect(code).toBe(0);
    expect(http.threw()).toBeGreaterThan(0);
    const scanned = [...lines, ...captured.texts, ...(await captured.files())].join('\n');
    expect(leaksIn(scanned)).toEqual([]);
  });

  it.each([
    ['pnpm sync:batch', runBatch, 1],
    ['pnpm sync', runSession, 0],
  ] as const)('%s: a throw from outside the governor (the lock create) is redacted by the shell', async (_shell, run, exit) => {
    const captured = capturing({ lockFault: () => quotingError('other') });
    const http = throwingHttp('none');

    const { code, lines } = await run(captured, http.port, ENV);

    expect(code).toBe(exit);
    expect(captured.lockFaults()).toBeGreaterThan(0);
    expect(http.threw()).toBe(0);
    // The shell printed the error, with the value replaced.
    expect(lines.some((line) => line.includes('[redacted]'))).toBe(true);
    const scanned = [...lines, ...captured.texts, ...(await captured.files())].join('\n');
    expect(leaksIn(scanned)).toEqual([]);
  });

  it.each(CASES)('the thrown value of a chunk whose %s request throws a %s error', async (target, failure) => {
    const captured = capturing();
    const http = throwingHttp(target, failure);
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

    expect(http.threw()).toBeGreaterThan(0);
    const scanned = [textOf(thrown), ...captured.texts, ...(await captured.files())].join('\n');
    expect(leaksIn(scanned)).toEqual([]);
    // The non-transport throw reached the caller with its class intact.
    expect(failure !== 'other' || thrown instanceof Error).toBe(true);
  });
});
