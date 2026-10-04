import { Buffer } from 'node:buffer';

import {
  createFakeClockPort,
  createFakeFilesystemPort,
  createFakeGitPort,
  createFakeHttpPort,
  SUPPORTED_SCHEMA_VERSION,
  TRACKED_SCHEMA_VERSION,
  WEIGHTS_SCHEMA_VERSION,
} from '@poe/contracts';
import type { FilesystemPort, HttpPort, HttpRequest, TrackedEntry } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { TRACKED_PATH } from './chunk/run-chunk.ts';
import { composeChunk } from './compose-chunk.ts';
import { syncCommand } from './sync-batch.ts';
import { syncSessionCommand } from './sync.ts';
import { TRADE_LEAGUES_URL, tradeFetchUrl, tradeSearchUrl } from './trade/endpoints.ts';
import { createSessionAuth, SESSION_COOKIE_ENV_VAR } from './trade/session-auth.ts';
import { USER_AGENT_ENV_VAR } from './trade/user-agent.ts';

/**
 * SPEC-poesessid-sync CAP-4, IMPLEMENTATION-NOTES.md §13.6: with a known
 * canary of 32+ characters as the session cookie, every throw path is forced
 * through both shells. The test fails on any 8+ character substring of the
 * canary, raw, URL-encoded or base64, in stdout, stderr, the chunk log, a
 * thrown value or any file written.
 */

const CANARY = 'k3Zq8VwT1nRb6YpXe4LmHs9DjCg2FaUo7Qi5';
const LEAGUE = 'Test League';
const NOW = '2026-09-26T12:00:00.000Z';
const CONTACT = 'poe-crafting-base-price-checker/0.0.0 (contact: someone@example.test)';
const ENV = { [USER_AGENT_ENV_VAR]: CONTACT, [SESSION_COOKIE_ENV_VAR]: CANARY };
const ENTRY: TrackedEntry = { kind: 'raw', baseTypeId: 'Solar Amulet', itemLevelMin: 82, status: 'active' };

const LEAGUES_BODY = JSON.stringify({
  result: [
    { id: 'Standard', realm: 'poe2', text: 'Standard' },
    { id: LEAGUE, realm: 'poe2', text: LEAGUE },
  ],
});

function inputs(entries: readonly TrackedEntry[] = [ENTRY]): Parameters<typeof createFakeFilesystemPort>[0] {
  return {
    [TRACKED_PATH]: {
      contents: JSON.stringify({ schemaVersion: TRACKED_SCHEMA_VERSION, entries }),
      modifiedAt: '2026-09-20T07:00:00.000Z',
    },
    'data/config.json': { contents: JSON.stringify({ schemaVersion: SUPPORTED_SCHEMA_VERSION, league: LEAGUE, minChunkSearches: 1 }) },
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
    'data/weights.json': {
      contents: JSON.stringify({
        schemaVersion: WEIGHTS_SCHEMA_VERSION,
        gamePatch: '0.5.5',
        producer: { id: 'test', generatedAt: '2026-09-26T00:00:00Z' },
        bases: {},
      }),
    },
  };
}

/**
 * The base64 and base64url characters that encode `bytes` inside any longer
 * value. A 3-byte group of the encoding starts at the window's byte 0, 1 or 2,
 * depending on where the window sits. From that byte, each whole group made
 * of the window's own bytes encodes the same characters whatever surrounds it.
 */
function alignedBase64(bytes: Buffer): string[] {
  const forms: string[] = [];
  for (const encoding of ['base64', 'base64url'] as const) {
    for (let lead = 0; lead < 3; lead += 1) {
      const groups = Math.floor((bytes.length - lead) / 3);
      forms.push(bytes.subarray(lead, lead + groups * 3).toString(encoding));
    }
  }
  return forms;
}

/** Every 8-character window of the canary, in each form a leak could take. */
const NEEDLES: readonly string[] = (() => {
  const found = new Set<string>();
  for (let start = 0; start + 8 <= CANARY.length; start += 1) {
    const window = CANARY.slice(start, start + 8);
    found.add(window);
    found.add(encodeURIComponent(window));
    for (const form of alignedBase64(Buffer.from(window))) {
      found.add(form);
      // base64 carries `+` and `/`, which a URL encodes.
      found.add(encodeURIComponent(form));
    }
  }
  return [...found];
})();

function leaksIn(text: string): string[] {
  return NEEDLES.filter((needle) => text.includes(needle));
}

/** Every text an error carries: message, stack, own string fields and the cause chain. */
function textOf(thrown: unknown, seen = new Set<unknown>()): string {
  if (typeof thrown === 'string') {
    return thrown;
  }
  if (typeof thrown !== 'object' || thrown === null || seen.has(thrown)) {
    return String(thrown);
  }
  seen.add(thrown);
  const parts: string[] = [];
  if (thrown instanceof Error) {
    parts.push(thrown.message, thrown.stack ?? '', String(thrown));
  }
  for (const key of Reflect.ownKeys(thrown)) {
    parts.push(textOf((thrown as Record<string | symbol, unknown>)[key], seen));
  }
  return parts.join('\n');
}

type Failure = 'transport' | 'timeout' | 'other';
type Target = 'leagues' | 'search';

/** An error whose message, stack and nested cause all quote the canary. */
function quotingError(failure: Failure): Error {
  const cause = new Error(`socket said ${encodeURIComponent(`POESESSID=${CANARY}`)}`, {
    cause: new Error(`header ${Buffer.from(`POESESSID=${CANARY}`).toString('base64')}`, {
      cause: `raw ${CANARY}`,
    }),
  });
  let error: Error;
  if (failure === 'transport') {
    error = new TypeError('fetch failed', { cause });
  } else if (failure === 'timeout') {
    error = Object.assign(new Error(`The operation timed out (Cookie: POESESSID=${CANARY})`, { cause }), {
      name: 'TimeoutError',
    });
  } else {
    error = new Error(`unexpected Cookie: POESESSID=${CANARY}`, { cause });
  }
  error.stack = `${error.name}: ${error.message}\n    at send (cookie=${CANARY})\n    at ${Buffer.from(CANARY).toString('base64')}`;
  Object.assign(error, { request: { headers: { cookie: `POESESSID=${CANARY}` } } });
  return error;
}

interface ThrowingHttp {
  readonly port: HttpPort;
  /** How many times the port rejected with the canary error. */
  readonly threw: () => number;
}

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

interface Captured {
  readonly texts: string[];
  readonly fs: FilesystemPort;
  readonly files: () => Promise<string[]>;
  /** How many times the lock create rejected with the canary error. */
  readonly lockFaults: () => number;
}

/**
 * A fake filesystem that records every write. With `lockFault`, taking the
 * lock rejects with the canary error: a throw from outside the governor that
 * reaches the shell's own `catch` before any report is written.
 */
function capturing(
  options: { readonly lockFault?: boolean; readonly tracked?: readonly TrackedEntry[] } = {},
): Captured {
  const fs = createFakeFilesystemPort(inputs(options.tracked));
  const written = new Set<string>();
  const texts: string[] = [];
  let lockFaults = 0;
  return {
    texts,
    fs: {
      ...fs,
      writeTextFile: (path, contents) => {
        written.add(path);
        texts.push(contents);
        return fs.writeTextFile(path, contents);
      },
      createExclusive: (path, contents) => {
        if (options.lockFault === true) {
          lockFaults += 1;
          return Promise.reject(quotingError('other'));
        }
        return fs.createExclusive(path, contents);
      },
    },
    files: async () => {
      const contents: string[] = [];
      for (const path of written) {
        contents.push(path, (await fs.readTextFile(path)) ?? '');
      }
      return contents;
    },
    lockFaults: () => lockFaults,
  };
}

interface ShellRun {
  readonly code: number;
  readonly lines: string[];
}

async function runBatch(captured: Captured, http: HttpPort): Promise<ShellRun> {
  const lines: string[] = [];
  const code = await syncCommand({
    fs: captured.fs,
    clock: createFakeClockPort(NOW),
    http,
    git: createFakeGitPort(),
    wait: () => Promise.resolve(),
    pid: 4242,
    log: (line) => lines.push(line),
    env: ENV,
    stdout: (line) => lines.push(line),
    stderr: (line) => lines.push(line),
  });
  return { code, lines };
}

/** More pauses than any passing case needs; past it, `runSession` throws. */
const MAX_SESSION_PAUSES = 200;

async function runSession(captured: Captured, http: HttpPort): Promise<ShellRun> {
  const lines: string[] = [];
  const controller = new AbortController();
  let chunks = 0;
  let pauses = 0;
  const clock = createFakeClockPort(NOW);
  // The fake pause resolves at once, so a session that never prints a second
  // chunk line spins and starves Vitest's timeout. The cap ends it loudly.
  const advance = (ms: number): Promise<void> => {
    pauses += 1;
    if (pauses > MAX_SESSION_PAUSES) {
      controller.abort();
    }
    clock.set(new Date(Date.parse(clock.now()) + ms).toISOString());
    return Promise.resolve();
  };
  const line = (text: string): void => {
    lines.push(text);
    if (!/^pnpm sync: (?!unauthenticated|authenticated|waiting)/.test(text)) {
      return;
    }

    chunks += 1;
    if (chunks >= 2) {
      controller.abort();
    }
  };
  const code = await syncSessionCommand({
    fs: captured.fs,
    clock,
    http,
    git: createFakeGitPort(),
    wait: advance,
    sleep: advance,
    pid: 4242,
    log: (text) => lines.push(text),
    env: ENV,
    argv: [],
    signal: controller.signal,
    stdout: line,
    stderr: line,
  });
  if (pauses > MAX_SESSION_PAUSES) {
    throw new Error(
      `runSession: no second chunk line after ${String(MAX_SESSION_PAUSES)} pauses; lines:\n${lines.join('\n')}`,
    );
  }
  return { code, lines };
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

    const { lines } = await runBatch(captured, http.port);

    expect(http.threw()).toBeGreaterThan(0);
    const scanned = [...lines, ...captured.texts, ...(await captured.files())].join('\n');
    expect(leaksIn(scanned)).toEqual([]);
  });

  it.each(CASES)('pnpm sync, the %s request throws a %s error', async (target, failure) => {
    const captured = capturing();
    const http = throwingHttp(target, failure);

    const { code, lines } = await runSession(captured, http.port);

    expect(code).toBe(0);
    expect(http.threw()).toBeGreaterThan(0);
    const scanned = [...lines, ...captured.texts, ...(await captured.files())].join('\n');
    expect(leaksIn(scanned)).toEqual([]);
  });

  it.each([
    ['pnpm sync:batch', runBatch, 1],
    ['pnpm sync', runSession, 0],
  ] as const)('%s: a throw from outside the governor (the lock create) is redacted by the shell', async (_shell, run, exit) => {
    const captured = capturing({ lockFault: true });
    const http = throwingHttp('none');

    const { code, lines } = await run(captured, http.port);

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
    if (failure === 'other') {
      // The non-transport throw reached the caller with its class intact.
      expect(thrown).toBeInstanceOf(Error);
    }
  });
});

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
      error = Object.assign(new Error(`The operation timed out (Cookie: ${header})`, { cause }), {
        name: 'TimeoutError',
      });
    } else {
      error = new Error(`unexpected Cookie: ${header}`, { cause });
    }
    error.stack = `${error.name}: ${error.message}\n    at send (${header})\n    at ${Buffer.from(header).toString('base64')}`;
    Object.assign(error, { request: { headers: { ...request.headers } } });
    return error;
  }

  /**
   * `probe`: the probe (the first cookie-carrying search) throws. `fetch`: the
   * probe is live, then the fetch that carries the cookie throws.
   */
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

    const { code, lines } = await runBatch(captured, http.port);

    expect(http.threw()).toBe(1);
    expect(code).toBe(0);
    expect(lines).toContain('pnpm sync:batch: unauthenticated (probe-failed)');
    const scanned = [...lines, ...captured.texts, ...(await captured.files())].join('\n');
    expect(leaksIn(scanned)).toEqual([]);
  });

  it.each(FAILURES)('pnpm sync: the probe throws a %s error; it does not reach the caller', async (failure) => {
    const captured = capturing();
    const http = cookieThrowingHttp('probe', failure);

    const { code, lines } = await runSession(captured, http.port);

    expect(http.threw()).toBe(1);
    expect(code).toBe(0);
    expect(lines).toContain('pnpm sync: unauthenticated (probe-failed)');
    const scanned = [...lines, ...captured.texts, ...(await captured.files())].join('\n');
    expect(leaksIn(scanned)).toEqual([]);
  });

  it.each(FAILURES)('pnpm sync:batch: a fetch after a live probe throws a %s error quoting its cookie', async (failure) => {
    const captured = capturing();
    const http = cookieThrowingHttp('fetch', failure);

    const { lines } = await runBatch(captured, http.port);

    expect(http.threw()).toBe(1);
    expect(lines).toContain('pnpm sync:batch: authenticated');
    const scanned = [...lines, ...captured.texts, ...(await captured.files())].join('\n');
    expect(leaksIn(scanned)).toEqual([]);
  });

  it.each(FAILURES)('pnpm sync: a fetch after a live probe throws a %s error quoting its cookie', async (failure) => {
    const captured = capturing();
    const http = cookieThrowingHttp('fetch', failure);

    const { code, lines } = await runSession(captured, http.port);

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
    if (target === 'probe' || failure !== 'other') {
      // The probe error is never passed on; a transport throw on the fetch yields.
      expect(thrown).toBeUndefined();
    } else {
      expect(thrown).toBeInstanceOf(Error);
    }
    const scanned = [textOf(thrown), ...captured.texts, ...(await captured.files())].join('\n');
    expect(leaksIn(scanned)).toEqual([]);
  });
});

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
  /** The search policy with one rule more than the baseline: a live probe. The rule name and bucket are illustrative. */
  const LIVE_HEADERS = {
    ...SEARCH_HEADERS,
    'x-rate-limit-rules': 'Ip,Account',
    'x-rate-limit-account': '60:300:60',
    'x-rate-limit-account-state': '1:300:0',
  };
  /** A second entry, so a search carries the cookie after the probe. */
  const TRACKED: readonly TrackedEntry[] = [ENTRY, { ...ENTRY, itemLevelMin: 83 }];
  /** A body and headers that quote the request's cookie in every form. */
  const quoting = (cookie: string) => ({
    body: `echo ${cookie} ${encodeURIComponent(cookie)} ${Buffer.from(cookie).toString('base64')}`,
    headers: { 'set-cookie': cookie, 'x-echo': Buffer.from(cookie).toString('base64') },
  });

  type Downgrade = '401' | '403' | 'not-live';

  /**
   * A live probe, then a downgrade that quotes the cookie. A `401` or `403`
   * answers the fetch. `not-live` answers the next entry's search with the
   * baseline's rule count under the baseline's policy; the fetch before it
   * answers fewer rules under its own policy and is not tested.
   */
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
          if (request.method === 'POST' && !isProbed) {
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

    const { code, lines } = await runBatch(captured, http.port);

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

    const { code, lines } = await runSession(captured, http.port);

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
