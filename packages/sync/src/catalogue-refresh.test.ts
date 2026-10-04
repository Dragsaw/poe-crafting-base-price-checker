import { execFile } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createFakeClockPort, createFakeHttpPort, SUPPORTED_SCHEMA_VERSION } from '@poe/contracts';
import type { HttpResponse } from '@poe/contracts';
import { expect, it, vi } from 'vitest';

import {
  catalogueFilePathOf,
  printRefreshOutcome,
  refreshCatalogue,
  serialiseCatalogue,
} from './catalogue-refresh.ts';
import type * as TradeClientModule from './trade/client.ts';
import { CATALOGUE_ENDPOINTS, TRADE_LEAGUES_URL } from './trade/endpoints.ts';
import { USER_AGENT_ENV_VAR } from './trade/user-agent.ts';

const byCodeUnit = (a: string, b: string): number => Number(a > b) - Number(a < b);

/** Every option set the command built its trade client with, in build order. */
const tradeClientOptions = vi.hoisted((): unknown[] => []);

// A pass-through: the real client is built, and the options are recorded so a
// test can inspect what the shell passed (AD-8, IMPLEMENTATION-NOTES.md §5.3).
vi.mock('./trade/client.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof TradeClientModule>();
  return {
    ...actual,
    createTradeClient: (options: Parameters<typeof actual.createTradeClient>[0]) => {
      tradeClientOptions.push(options);
      return actual.createTradeClient(options);
    },
  };
});

// The entry guard makes the import above run nothing. It is asserted by
// behaviour below, with spawns, because a source scan passes on an inverted guard.

const SCRIPT = fileURLToPath(new URL('catalogue-refresh.ts', import.meta.url));
const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const CONTACT = 'poe-crafting-base-price-checker/0.0.0 (contact: someone@example.test)';

/** Room left in the bucket: nothing has to wait. */
const RATE_LIMIT_HEADERS = {
  'x-rate-limit-policy': 'trade-data-request-limit',
  'x-rate-limit-rules': 'Ip',
  'x-rate-limit-ip': '5:10:60',
  'x-rate-limit-ip-state': '1:10:0',
};

/** The same policy, saturated: the *next* request against it must wait 10 s. */
const SATURATED_HEADERS = { ...RATE_LIMIT_HEADERS, 'x-rate-limit-ip-state': '5:10:0' };

const CAPTURED: Readonly<Record<string, unknown>> = Object.fromEntries(
  CATALOGUE_ENDPOINTS.map((endpoint) => [
    endpoint.artifact,
    JSON.parse(readFileSync(`${REPO_ROOT}fixtures/trade-data-${endpoint.artifact}.json`, 'utf8')),
  ]),
);

interface Run {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

/** The environment the refresher must refuse in: the overlay removed. */
function environmentWithoutContact(): NodeJS.ProcessEnv {
  const environment = { ...process.env };
  delete environment[USER_AGENT_ENV_VAR];
  return environment;
}

function run(arguments_: readonly string[]): Promise<Run> {
  return new Promise((settle) => {
    const child = execFile(
      process.execPath,
      [...arguments_],
      { encoding: 'utf8', env: environmentWithoutContact() },
      (_error, stdout, stderr) => {
        settle({ code: child.exitCode, stdout, stderr });
      },
    );
  });
}

function respond(body: unknown, headers = RATE_LIMIT_HEADERS): HttpResponse {
  return { status: 200, headers, body: JSON.stringify(body) };
}

/** One fixtured 200 per catalogue endpoint, from the committed captures. */
function capturedResponses(
  overrides: Readonly<Record<string, unknown>> = {},
  headers = RATE_LIMIT_HEADERS,
): Record<string, HttpResponse> {
  const fixtures: Record<string, HttpResponse> = {};
  for (const endpoint of CATALOGUE_ENDPOINTS) {
    fixtures[`GET ${endpoint.url}`] = respond(
      overrides[endpoint.artifact] ?? CAPTURED[endpoint.artifact],
      headers,
    );
  }
  return fixtures;
}

interface Harness {
  readonly http: ReturnType<typeof createFakeHttpPort>;
  readonly writes: { path: string; contents: string }[];
  readonly waits: number[];
  refresh: () => ReturnType<typeof refreshCatalogue>;
}

function harness(
  fixtures: Record<string, HttpResponse>,
  /** Lets one case refuse a write the way a full disk would. */
  shouldRefuseWriteAt?: (path: string) => boolean,
): Harness {
  const http = createFakeHttpPort(fixtures);
  const writes: { path: string; contents: string }[] = [];
  const waits: number[] = [];
  const clock = createFakeClockPort('2026-09-20T12:00:00.000Z');
  return {
    http,
    writes,
    waits,
    refresh: () =>
      refreshCatalogue({
        http,
        clock,
        wait: (ms) => {
          waits.push(ms);
          // The ledger ages each rule against the clock, so a wait that does
          // not move time is a wait the pacer never sees having happened — and
          // the pacing assertion below would then be measuring nothing.
          clock.set(new Date(Date.parse(clock.now()) + ms).toISOString());
          return Promise.resolve();
        },
        userAgent: CONTACT,
        writeCatalogueFile: (path, contents) => {
          if (shouldRefuseWriteAt?.(path) === true) {
            return Promise.reject(new Error(`EACCES: permission denied, open '${path}'`));
          }
          writes.push({ path, contents });
          return Promise.resolve();
        },
      }),
  };
}

function endpointFor(artifact: string): (typeof CATALOGUE_ENDPOINTS)[number] {
  const endpoint = CATALOGUE_ENDPOINTS.find((candidate) => candidate.artifact === artifact);
  if (endpoint === undefined) {
    throw new Error(`no endpoint declared for ${artifact}`);
  }
  return endpoint;
}

/** Narrows to the failure branch; `expect(outcome.ok).toBe(false)` would not narrow for the compiler. */
function failureOf(
  outcome: Awaited<ReturnType<typeof refreshCatalogue>>,
): { readonly failure: string; readonly written: readonly string[] } {
  if (outcome.ok) {
    throw new Error('expected a refused refresh, got a successful one');
  }
  return outcome;
}

function writtenValue(
  writes: readonly { path: string; contents: string }[],
  artifact: string,
): Record<string, unknown> {
  const path = catalogueFilePathOf(endpointFor(artifact));
  const write = writes.find((candidate) => candidate.path === path);
  expect(write, `${artifact} was not written`).toBeDefined();
  return JSON.parse(write?.contents ?? '{}') as Record<string, unknown>;
}

// --- the entry guard, asserted by behaviour ---------------------------------

it('refuses and exits non-zero when spawned directly with no contact overlay', async () => {
  const result = await run([SCRIPT]);

  expect(result.code).not.toBe(0);
  expect(result.stderr).toContain(USER_AGENT_ENV_VAR);
  expect(result.stdout).toBe('');
});

it('runs nothing when the module is imported rather than invoked', async () => {
  const importer = `await import(${JSON.stringify(pathToFileURL(SCRIPT).href)});\nprocess.stdout.write('imported');`;
  const result = await run(['--input-type=module', '-e', importer]);

  // An inverted guard would run `main` here and refuse on stderr, as the direct spawn does.
  expect(result.stdout).toBe('imported');
  expect(result.stderr).toBe('');
  expect(result.code).toBe(0);
});

const read = (entryPoint: string): string | undefined => {
  try {
    return readFileSync(`${REPO_ROOT}${entryPoint}`, 'utf8');
  } catch {
    return undefined;
  }
};

it('is referenced by no vitest config and by no setup file', () => {
  // A missing required entry means a config moved; skipping it would pass silently.
  // `web` has no suite yet, so its paths are optional.
  const required = [
    'vitest.config.ts',
    'test/setup.ts',
    'packages/contracts/vitest.config.ts',
    'packages/core/vitest.config.ts',
    'packages/sync/vitest.config.ts',
  ];
  const optional = [
    'packages/web/vitest.config.ts',
    'packages/web/vite.config.ts',
    'packages/web/src/test-setup.ts',
  ];

  for (const entryPoint of required) {
    const source = read(entryPoint);
    expect(source, `${entryPoint} must exist for this scan to mean anything`).toBeDefined();
    expect(source, `${entryPoint} must not reach the refresher`).not.toContain('catalogue-refresh');
  }

  for (const entryPoint of optional) {
    const source = read(entryPoint);
    if (source === undefined) {
      continue;
    }
    expect(source, `${entryPoint} must not reach the refresher`).not.toContain('catalogue-refresh');
  }
});

/**
 * Node's type stripping resolves no extensions, so a relative specifier below
 * `contracts/src` without `.ts` kills the command at load. Vitest accepts
 * either spelling, so only a spawn catches it.
 */
it('loads @poe/contracts under bare node, as the command itself must', async () => {
  const packageRoot = fileURLToPath(new URL('../', import.meta.url));
  const result = await new Promise<Run>((settle) => {
    const child = execFile(
      process.execPath,
      ['--input-type=module', '-e', "await import('@poe/contracts');"],
      { encoding: 'utf8', cwd: packageRoot, env: environmentWithoutContact() },
      (_error, stdout, stderr) => {
        settle({ code: child.exitCode, stdout, stderr });
      },
    );
  });

  expect(result.stderr).toBe('');
  expect(result.code).toBe(0);
});

it('names the real fetch port in no test file', () => {
  // The real port runs only against loopback, only in `shell-fetch.test.ts` (AD-8);
  // `test/setup.ts` fails remote requests. A bare identifier scan, because a
  // specifier regex misses `from './shell'`, dynamic imports and re-exports.
  const sourceDirectory = fileURLToPath(new URL('.', import.meta.url));
  const testFiles = readdirSync(sourceDirectory, { recursive: true, encoding: 'utf8' }).filter((name) =>
    name.endsWith('.test.ts'),
  );

  expect(testFiles.length).toBeGreaterThan(0);
  // The exemption below must not go dead silently: a rename or a deletion of the
  // loopback test would reopen L-V1 with no failure.
  expect(testFiles).toContain('shell-fetch.test.ts');
  expect(readFileSync(`${sourceDirectory}shell-fetch.test.ts`, 'utf8')).toContain('createFetchHttpPort');
  for (const name of testFiles) {
    if (name === 'catalogue-refresh.test.ts') {
      // This file names it in the comment above, and nowhere else.
      continue;
    }
    if (name === 'shell-fetch.test.ts') {
      // The one file that executes the port, against its own loopback server.
      continue;
    }
    const source = readFileSync(`${sourceDirectory}${name}`, 'utf8');
    expect(source, `${name} must not name the real fetch port`).not.toContain(
      'createFetchHttpPort',
    );
  }
});

it('is reachable at the script name the human is told to run', () => {
  // The string a human types lives in the root manifest; every other spawn here
  // uses a path this file computes, so only this test catches a typo in it.
  const manifest = JSON.parse(readFileSync(`${REPO_ROOT}package.json`, 'utf8')) as {
    scripts: Record<string, string>;
  };
  const script = manifest.scripts['catalogue:refresh'];

  expect(script).toBeDefined();
  const entry = (script ?? '').split(/\s+/).at(-1);
  expect(nodePath.resolve(REPO_ROOT, entry ?? '')).toBe(SCRIPT);
  // The recorder's precedent, and what lets `.env` supply the contact overlay.
  expect(script).toContain('--env-file-if-exists=.env');
});

// --- the four requests ------------------------------------------------------

it('sends each data endpoint at its declared URL', () => {
  // Seeding every fake from the same constant makes a mutated URL invisible, so
  // the literals are pinned here, once.
  for (const artifact of ['items', 'stats', 'filters', 'static'] as const) {
    expect(endpointFor(artifact).url).toBe(
      `https://www.pathofexile.com/api/trade2/data/${artifact}`,
    );
  }
  expect(CATALOGUE_ENDPOINTS).toHaveLength(4);
  expect(TRADE_LEAGUES_URL.endsWith('/data/leagues')).toBe(true);
});

it('issues exactly four requests, one per data endpoint and no leagues request', async () => {
  const instance = harness(capturedResponses());

  const outcome = await instance.refresh();

  expect(outcome.ok).toBe(true);
  expect(instance.http.requests).toHaveLength(4);
  expect(instance.http.requests.map((request) => request.url).toSorted(byCodeUnit)).toEqual(
    CATALOGUE_ENDPOINTS.map((endpoint) => endpoint.url).toSorted(byCodeUnit),
  );
  for (const request of instance.http.requests) {
    expect(request.method).toBe('GET');
    expect(request.url).not.toBe(TRADE_LEAGUES_URL);
  }
});

it('builds its trade client with the invalid-request threshold of 1 (§5.3)', async () => {
  tradeClientOptions.length = 0;

  await harness(capturedResponses()).refresh();

  expect(tradeClientOptions).toEqual([expect.objectContaining({ invalidRequestThreshold: 1 })]);
});

it('counts its requests: four on success, and the count printed (AD-12)', async () => {
  const outcome = await harness(capturedResponses()).refresh();

  expect(outcome).toMatchObject({ ok: true, requests: 4 });
  const stdout: string[] = [];
  const stderr: string[] = [];
  expect(printRefreshOutcome(outcome, { stdout: (line) => { stdout.push(line); }, stderr: (line) => { stderr.push(line); } })).toBe(0);
  expect(stdout[0]).toBe('requests: 4');
  expect(stderr).toEqual([]);
});

it('counts the requests sent before a failure, and prints the count beside it', async () => {
  const fixtures = capturedResponses();
  const second = CATALOGUE_ENDPOINTS[1];
  if (second === undefined) {
    throw new Error('the catalogue declares fewer than two endpoints');
  }
  fixtures[`GET ${second.url}`] = { status: 503, headers: RATE_LIMIT_HEADERS, body: '' };

  const outcome = await harness(fixtures).refresh();

  expect(outcome).toMatchObject({ ok: false, requests: 2 });
  const stdout: string[] = [];
  expect(printRefreshOutcome(outcome, { stdout: (line) => { stdout.push(line); }, stderr: () => {} })).toBe(1);
  expect(stdout).toEqual(['requests: 2']);
});

it('carries the standing headers on every request', async () => {
  const instance = harness(capturedResponses());

  await instance.refresh();

  for (const request of instance.http.requests) {
    expect(request.headers['user-agent']).toBe(CONTACT);
    expect(request.headers['x-requested-with']).toBe('XMLHttpRequest');
  }
});

it('paces all four against one lane rather than seeding four cold lanes', async () => {
  // The policy is saturated on every response. A request whose lane already
  // knows that policy must therefore wait out the window; a cold lane knows no
  // policy and would issue straight away. Three waits is one shared lane.
  const instance = harness(capturedResponses({}, SATURATED_HEADERS));

  const outcome = await instance.refresh();

  expect(outcome.ok).toBe(true);
  expect(instance.waits).toEqual([10_000, 10_000, 10_000]);
});

// --- what lands on disk -----------------------------------------------------

it('writes four artifacts, each the captured payload plus schemaVersion', async () => {
  const instance = harness(capturedResponses());

  const outcome = await instance.refresh();

  expect(outcome.ok).toBe(true);
  expect(instance.writes).toHaveLength(4);
  expect(outcome.written).toEqual(
    CATALOGUE_ENDPOINTS.map((endpoint) => catalogueFilePathOf(endpoint)),
  );

  for (const endpoint of CATALOGUE_ENDPOINTS) {
    const path = catalogueFilePathOf(endpoint);
    expect(path.endsWith(`${endpoint.artifact}.json`)).toBe(true);
    const write = instance.writes.find((candidate) => candidate.path === path);
    expect(write?.contents).toBe(
      serialiseCatalogue({
        ...(CAPTURED[endpoint.artifact] as Record<string, unknown>),
        schemaVersion: SUPPORTED_SCHEMA_VERSION,
      }),
    );
    // Two-space JSON with a trailing newline, so a second refresh against an
    // unchanged API diffs as nothing at all.
    expect(write?.contents.endsWith('\n')).toBe(true);
    expect(write?.contents.includes('\n  "')).toBe(true);
    expect(writtenValue(instance.writes, endpoint.artifact).schemaVersion).toBe(
      SUPPORTED_SCHEMA_VERSION,
    );
  }
});

it('writes the committed catalogue back byte for byte on a second refresh against an unchanged API', async () => {
  // Checked against the committed artifacts, not one serialisation compared with
  // itself. The envelope appends `schemaVersion` last, so key order is preserved.
  const committed: Record<string, string> = {};
  const fixtures: Record<string, HttpResponse> = {};
  for (const endpoint of CATALOGUE_ENDPOINTS) {
    const bytes = readFileSync(catalogueFilePathOf(endpoint), 'utf8');
    committed[endpoint.artifact] = bytes;
    const payload = JSON.parse(bytes) as Record<string, unknown>;
    expect(payload.schemaVersion, `${endpoint.artifact}.json carries no schemaVersion`).toBe(
      SUPPORTED_SCHEMA_VERSION,
    );
    delete payload.schemaVersion;
    fixtures[`GET ${endpoint.url}`] = respond(payload);
  }

  const rounds = ['first', 'second'] as const;
  await Promise.all(
    rounds.map(async (round) => {
      const instance = harness(fixtures);

      const outcome = await instance.refresh();

      expect(outcome, `${round} refresh failed`).toMatchObject({ ok: true });
      expect(instance.writes, `${round} refresh did not write four artifacts`).toHaveLength(4);
      for (const endpoint of CATALOGUE_ENDPOINTS) {
        const path = catalogueFilePathOf(endpoint);
        const write = instance.writes.find((candidate) => candidate.path === path);
        expect(write, `${round} refresh did not write ${endpoint.artifact}`).toBeDefined();
        expect(
          write?.contents === committed[endpoint.artifact],
          `${round} refresh wrote ${endpoint.artifact}.json with bytes that differ from the committed file`,
        ).toBe(true);
      }
    }),
  );
});

it('writes every artifact under the repository root, in data/catalogue', async () => {
  const instance = harness(capturedResponses());

  await instance.refresh();

  expect(instance.writes).toHaveLength(4);
  for (const { path } of instance.writes) {
    expect(nodePath.isAbsolute(path)).toBe(true);
    // Resolved against the repository root the test computes for itself, not
    // against `catalogueFilePathOf` — which is the thing under test. A root
    // one level too shallow would land these in `packages/data/catalogue/`.
    const within = nodePath.relative(REPO_ROOT, path);
    expect(within.startsWith('..')).toBe(false);
    expect(within.split(nodePath.sep)).not.toContain('packages');
    expect(within.split(nodePath.sep).slice(0, 2)).toEqual(['data', 'catalogue']);
  }
  expect(instance.writes.map(({ path }) => nodePath.relative(REPO_ROOT, path).split(nodePath.sep).join('/')).toSorted(byCodeUnit)).toEqual(
    CATALOGUE_ENDPOINTS.map((endpoint) => endpoint.outputPath).toSorted(byCodeUnit),
  );
});

it('keeps an unknown field GGG sends', async () => {
  const items = CAPTURED['items'] as { result: Record<string, unknown>[] };
  const patched = {
    ...items,
    result: [
      { ...items.result[0], entries: [{ type: 'Crimson Amulet', anUndeclaredKey: 'kept' }] },
      ...items.result.slice(1),
    ],
  };
  const instance = harness(capturedResponses({ items: patched }));

  const outcome = await instance.refresh();

  expect(outcome.ok).toBe(true);
  expect(writtenValue(instance.writes, 'items')).toEqual({
    ...patched,
    schemaVersion: SUPPORTED_SCHEMA_VERSION,
  });
});

it('keeps the stats category groups exactly as they arrived', async () => {
  const instance = harness(capturedResponses());

  await instance.refresh();

  const stats = writtenValue(instance.writes, 'stats');
  const captured = CAPTURED['stats'] as { result: unknown[] };
  expect(stats['result']).toEqual(captured.result);

  const groups = stats['result'] as { id: string; label: string; entries: unknown[] }[];
  expect(groups.length).toBeGreaterThan(0);
  for (const group of groups) {
    expect(typeof group.id).toBe('string');
    expect(typeof group.label).toBe('string');
    expect(Array.isArray(group.entries)).toBe(true);
  }
});

// --- the all-or-nothing failures -------------------------------------------

it('writes nothing at all when one endpoint answers a non-200 mid-run', async () => {
  const fixtures = capturedResponses();
  const failing = endpointFor('filters');
  fixtures[`GET ${failing.url}`] = {
    status: 503,
    headers: RATE_LIMIT_HEADERS,
    body: 'upstream is unwell',
  };
  const instance = harness(fixtures);

  const outcome = await instance.refresh();

  const failed = failureOf(outcome);
  expect(failed.failure).toContain(failing.artifact);
  expect(failed.failure).toContain('503');
  expect(failed.written).toEqual([]);
  expect(instance.writes).toEqual([]);
});

it('returns a failure naming the yield rather than throwing when rate limited', async () => {
  const fixtures = capturedResponses();
  const limited = endpointFor('items');
  fixtures[`GET ${limited.url}`] = {
    status: 429,
    headers: { ...RATE_LIMIT_HEADERS, 'retry-after': '43' },
    body: '{}',
  };
  const instance = harness(fixtures);

  const outcome = await instance.refresh();

  const failed = failureOf(outcome);
  expect(failed.failure).toContain('rate limited');
  expect(failed.failure).toContain('43000');
  expect(failed.failure).toContain('retry-after-header');
  expect(instance.writes).toEqual([]);
});

it('names the artifact when a 200 carries an HTML interstitial', async () => {
  const fixtures = capturedResponses();
  const html = endpointFor('stats');
  fixtures[`GET ${html.url}`] = {
    status: 200,
    headers: RATE_LIMIT_HEADERS,
    body: '<!doctype html><title>maintenance</title>',
  };
  const instance = harness(fixtures);

  const outcome = await instance.refresh();

  const failed = failureOf(outcome);
  expect(failed.failure).toContain(html.artifact);
  expect(failed.failure).toContain('not JSON');
  expect(instance.writes).toEqual([]);
});

it('names the artifact and the first issue path when a payload is schema-invalid', async () => {
  const stats = CAPTURED['stats'] as { result: { entries: unknown[] }[] };
  const firstGroup = stats.result[0];
  const invalid = {
    ...stats,
    result: [
      { ...firstGroup, entries: [{ text: '+#% to Fire Resistance', type: 'explicit' }] },
      ...stats.result.slice(1),
    ],
  };
  const instance = harness(capturedResponses({ stats: invalid }));

  const outcome = await instance.refresh();

  const failed = failureOf(outcome);
  expect(failed.failure).toContain('stats');
  expect(failed.failure).toContain('result.0.entries.0.id');
  expect(instance.writes).toEqual([]);
});

it('returns a failure naming the artifact when the request itself rejects', async () => {
  // A rejection, not a status: the real port rejects on abort, DNS failure and
  // socket reset. Without a catch the human gets a stack trace and no `written`.
  const fixtures = capturedResponses();
  const unreachable = endpointFor('stats');
  delete fixtures[`GET ${unreachable.url}`];
  const instance = harness(fixtures);

  const outcome = await instance.refresh();

  const failed = failureOf(outcome);
  expect(failed.failure).toContain(unreachable.artifact);
  expect(failed.failure).toContain('could not be reached');
  expect(failed.written).toEqual([]);
  expect(instance.writes).toEqual([]);
});

it('says how many artifacts landed when a write fails part way down', async () => {
  const refusedPath = catalogueFilePathOf(endpointFor('filters'));
  const instance = harness(capturedResponses(), (path) => path === refusedPath);

  const outcome = await instance.refresh();

  const failed = failureOf(outcome);
  expect(failed.failure).toContain(refusedPath);
  // Two had already landed, so the tree is mixed and the message has to say so
  // — nothing here can roll a completed write back.
  expect(failed.failure).toContain('2 of 4');
  expect(failed.written).toEqual([
    catalogueFilePathOf(endpointFor('items')),
    catalogueFilePathOf(endpointFor('stats')),
  ]);
  expect(instance.writes).toHaveLength(2);
});
