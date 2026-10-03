import { Buffer } from 'node:buffer';

import {
  createFakeClockPort,
  createFakeFilesystemPort,
  createFakeGitPort,
  createFakeHttpPort,
} from '@poe/contracts';
import type { FilesystemPort, HttpPort, HttpRequest, TrackedEntry } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { TRACKED_PATH } from './chunk/run-chunk.ts';
import { composeChunk } from './compose-chunk.ts';
import { syncCommand } from './sync-batch.ts';
import { syncSessionCommand } from './sync.ts';
import { TRADE_LEAGUES_URL, tradeSearchUrl } from './trade/endpoints.ts';
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

function inputs(): Parameters<typeof createFakeFilesystemPort>[0] {
  return {
    [TRACKED_PATH]: {
      contents: JSON.stringify({ schemaVersion: '1.0.0', entries: [ENTRY] }),
      modifiedAt: '2026-09-20T07:00:00.000Z',
    },
    'data/config.json': { contents: JSON.stringify({ schemaVersion: '1.0.0', league: LEAGUE, minChunkSearches: 1 }) },
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
    'data/weights.json': {
      contents: JSON.stringify({
        schemaVersion: '6.0.0',
        gamePatch: '0.5.5',
        producer: { id: 'test', generatedAt: '2026-09-26T00:00:00Z' },
        bases: {},
      }),
    },
  };
}

/** Every 8-character window of the canary, in each form a leak could take. */
const NEEDLES: readonly string[] = (() => {
  const found = new Set<string>();
  for (let start = 0; start + 8 <= CANARY.length; start += 1) {
    const window = CANARY.slice(start, start + 8);
    found.add(window);
    found.add(encodeURIComponent(window));
    found.add(Buffer.from(window).toString('base64').replace(/=+$/, ''));
    found.add(Buffer.from(window).toString('base64url'));
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
function capturing(options: { readonly lockFault?: boolean } = {}): Captured {
  const fs = createFakeFilesystemPort(inputs());
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

async function runSession(captured: Captured, http: HttpPort): Promise<ShellRun> {
  const lines: string[] = [];
  const controller = new AbortController();
  let chunks = 0;
  const clock = createFakeClockPort(NOW);
  const advance = (ms: number): Promise<void> => {
    clock.set(new Date(Date.parse(clock.now()) + ms).toISOString());
    return Promise.resolve();
  };
  const line = (text: string): void => {
    lines.push(text);
    if (/^pnpm sync: (?!unauthenticated|authenticated|waiting)/.test(text)) {
      chunks += 1;
      if (chunks >= 2) {
        controller.abort();
      }
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
        log: () => undefined,
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
        log: () => undefined,
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
