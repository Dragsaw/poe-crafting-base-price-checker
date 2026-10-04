import { Buffer } from 'node:buffer';

import {
  createFakeClockPort,
  createFakeFilesystemPort,
  createFakeGitPort,
  SUPPORTED_SCHEMA_VERSION,
  TRACKED_SCHEMA_VERSION,
  WEIGHTS_SCHEMA_VERSION,
} from '@poe/contracts';
import type { FilesystemPort, HttpPort, TrackedEntry } from '@poe/contracts';

import { TRACKED_PATH } from '../chunk/run-chunk.ts';
import { syncCommand } from '../sync-batch.ts';
import { syncSessionCommand } from '../sync.ts';
import { NamedError } from '../test-support/named-error.ts';
import { SESSION_COOKIE_ENV_VAR } from '../trade/session-auth.ts';
import { USER_AGENT_ENV_VAR } from '../trade/user-agent.ts';

export const CANARY = 'k3Zq8VwT1nRb6YpXe4LmHs9DjCg2FaUo7Qi5';
export const LEAGUE = 'Test League';
export const NOW = '2026-09-26T12:00:00.000Z';
export const CONTACT = 'poe-crafting-base-price-checker/0.0.0 (contact: someone@example.test)';
export const ENV = { [USER_AGENT_ENV_VAR]: CONTACT, [SESSION_COOKIE_ENV_VAR]: CANARY };
export const ENTRY: TrackedEntry = { kind: 'raw', baseTypeId: 'Solar Amulet', itemLevelMin: 82, status: 'active' };

export const LEAGUES_BODY = JSON.stringify({
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

/** The base64 characters of `bytes` that survive inside a longer value: whole 3-byte groups from byte 0, 1 or 2. */
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
    const forms = alignedBase64(Buffer.from(window));
    for (const form of forms) {
      found.add(form);
      // base64 carries `+` and `/`, which a URL encodes.
      found.add(encodeURIComponent(form));
    }
  }
  return [...found];
})();

export function leaksIn(text: string): string[] {
  return NEEDLES.filter((needle) => text.includes(needle));
}

/** Every text an error carries: message, stack, own string fields and the cause chain. */
export function textOf(thrown: unknown): string {
  return collectText(thrown, new Set());
}

function collectText(thrown: unknown, seen: Set<unknown>): string {
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
    parts.push(collectText((thrown as Record<string | symbol, unknown>)[key], seen));
  }
  return parts.join('\n');
}


export type Failure = 'transport' | 'timeout' | 'other';

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

export interface ThrowingHttp {
  readonly port: HttpPort;
  /** How many times the port rejected with the canary error. */
  readonly threw: () => number;
}

export interface Captured {
  readonly texts: string[];
  readonly fs: FilesystemPort;
  readonly files: () => Promise<string[]>;
  /** How many times the lock create rejected with the canary error. */
  readonly lockFaults: () => number;
}

/** A fake filesystem that records every write. `lockFault` rejects the lock create: a throw outside the governor. */
export function capturing(
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
      const pairs = await Promise.all(
        [...written].map(async (path) => [path, (await fs.readTextFile(path)) ?? ''] as const),
      );
      return pairs.flat();
    },
    lockFaults: () => lockFaults,
  };
}

export interface ShellRun {
  readonly code: number;
  readonly lines: string[];
}

export async function runBatch(captured: Captured, http: HttpPort): Promise<ShellRun> {
  const lines: string[] = [];
  const code = await syncCommand({
    fs: captured.fs,
    clock: createFakeClockPort(NOW),
    http,
    git: createFakeGitPort(),
    wait: () => Promise.resolve(),
    pid: 4242,
    log: (line) => {
      lines.push(line);
    },
    env: ENV,
    stdout: (line) => {
      lines.push(line);
    },
    stderr: (line) => {
      lines.push(line);
    },
  });
  return { code, lines };
}

/** More pauses than any passing case needs; past it, `runSession` throws. */
const MAX_SESSION_PAUSES = 200;

export async function runSession(captured: Captured, http: HttpPort): Promise<ShellRun> {
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
    const resumed = Date.parse(clock.now()) + ms;
    clock.set(new Date(resumed).toISOString());
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
    log: (text) => {
      lines.push(text);
    },
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
