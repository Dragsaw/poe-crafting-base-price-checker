import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createFakeClockPort, createFakeHttpPort } from '@poe/contracts';
import type { HttpRequest, HttpResponse, TrackedEntry } from '@poe/contracts';
import { describe, expect, it, vi } from 'vitest';

import { pricingFixtureName } from './pricing/fixture-names.ts';
import { buildSearchBody, itemTypesOf } from './pricing/search-body.ts';
import { tradeFetchUrl, tradeSearchUrl } from './trade/endpoints.ts';
import { JSON_NULL } from './test-support/json-null.ts';
import {
  FIXTURE_INTERACTIONS,
  fixturePathOf,
  recordFixtures,
  REDACTED,
  serialiseFixture,
  stripPersonalIdentifiers,
} from './fixtures-record.ts';
import type * as TradeClientModule from './trade/client.ts';
import { USER_AGENT_ENV_VAR } from './trade/user-agent.ts';

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

const SCRIPT = fileURLToPath(new URL('fixtures-record.ts', import.meta.url));
const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const CONTACT = 'poe-crafting-base-price-checker/0.0.0 (contact: someone@example.test)';

const RATE_LIMIT_HEADERS = {
  'x-rate-limit-policy': 'trade-data-request-limit',
  'x-rate-limit-rules': 'Ip',
  'x-rate-limit-ip': '5:10:60',
  'x-rate-limit-ip-state': '1:10:0',
};

interface Run {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

/** The environment the recorder must refuse in: the overlay removed. */
function environmentWithoutContact(): NodeJS.ProcessEnv {
  const environment = { ...process.env };
  delete environment[USER_AGENT_ENV_VAR];
  return environment;
}

function run(arguments_: readonly string[]): Promise<Run> {
  return new Promise((resolve) => {
    const child = execFile(
      process.execPath,
      [...arguments_],
      { encoding: 'utf8', env: environmentWithoutContact() },
      (_error, stdout, stderr) => {
        resolve({ code: child.exitCode, stdout, stderr });
      },
    );
  });
}

function respond(body: unknown): HttpResponse {
  return { status: 200, headers: RATE_LIMIT_HEADERS, body: JSON.stringify(body) };
}

function fixturesFor(bodies: Readonly<Record<string, unknown>>): Record<string, HttpResponse> {
  const fixtures: Record<string, HttpResponse> = {};
  for (const interaction of FIXTURE_INTERACTIONS) {
    fixtures[`GET ${interaction.url}`] = respond(bodies[interaction.name] ?? { result: [] });
  }
  return fixtures;
}

function recorderHarness(fixtures: Record<string, HttpResponse>): {
  readonly http: ReturnType<typeof createFakeHttpPort>;
  readonly writes: { path: string; contents: string }[];
  record: () => ReturnType<typeof recordFixtures>;
} {
  const http = createFakeHttpPort(fixtures);
  const writes: { path: string; contents: string }[] = [];
  return {
    http,
    writes,
    record: () =>
      recordFixtures({
        http,
        clock: createFakeClockPort('2026-09-20T12:00:00.000Z'),
        wait: () => Promise.resolve(),
        userAgent: CONTACT,
        writeFixture: (path, contents) => {
          writes.push({ path, contents });
          return Promise.resolve();
        },
      }),
  };
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

  // Had the guard been inverted, `main` would have run here and written the
  // refusal to stderr with a non-zero exit — exactly the direct spawn above.
  expect(result.stdout).toBe('imported');
  expect(result.stderr).toBe('');
  expect(result.code).toBe(0);
});

it('is referenced by no vitest config and by no setup file', () => {
  const entryPoints = [
    'vitest.config.ts',
    'test/setup.ts',
    'packages/contracts/vitest.config.ts',
    'packages/core/vitest.config.ts',
    'packages/sync/vitest.config.ts',
    'packages/web/vitest.config.ts',
    'packages/web/vite.config.ts',
    'packages/web/src/test-setup.ts',
  ];

  for (const relative of entryPoints) {
    let source: string;
    try {
      source = readFileSync(`${REPO_ROOT}${relative}`, 'utf8');
    } catch {
      continue;
    }
    expect(source, `${relative} must not reach the recorder`).not.toContain('fixtures-record');
  }
});

// --- the interaction set ----------------------------------------------------

it('records the five GET interactions it can construct by itself today', () => {
  expect(FIXTURE_INTERACTIONS).toHaveLength(5);
  for (const interaction of FIXTURE_INTERACTIONS) {
    expect(interaction.method).toBe('GET');
    expect(interaction.url.startsWith('https://www.pathofexile.com/api/trade2/')).toBe(true);
    expect(fixturePathOf(interaction).endsWith(`${interaction.name}.json`)).toBe(true);
  }
  expect(FIXTURE_INTERACTIONS.map((interaction) => interaction.name).toSorted((a, b) => Number(a > b) - Number(a < b))).toEqual([
    'trade-data-filters',
    'trade-data-items',
    'trade-data-leagues',
    'trade-data-static',
    'trade-data-stats',
  ]);
});

// --- the write pipeline -----------------------------------------------------

it('writes one stripped, newline-terminated payload per interaction', async () => {
  const leagues = {
    result: [{ id: 'Some League', realm: 'poe2', account: { name: 'SomePlayer#1234' } }],
  };
  const harness = recorderHarness(fixturesFor({ 'trade-data-leagues': leagues }));

  const outcome = await harness.record();

  expect(outcome.ok).toBe(true);
  expect(harness.writes).toHaveLength(5);

  const first = harness.writes[0];
  const firstInteraction = FIXTURE_INTERACTIONS[0];
  expect(firstInteraction).toBeDefined();
  expect(first?.path).toBe(firstInteraction === undefined ? '' : fixturePathOf(firstInteraction));
  // The exact bytes: stripped, two-space JSON, trailing newline. Removing the
  // strip call or the newline fails here.
  expect(first?.contents).toBe(
    serialiseFixture({
      result: [{ id: 'Some League', realm: 'poe2', account: { name: REDACTED } }],
    }),
  );
  expect(first?.contents.endsWith('}\n')).toBe(true);
});

it('builds its trade client with the invalid-request threshold of 1 (§5.3)', async () => {
  tradeClientOptions.length = 0;

  await recorderHarness(fixturesFor({})).record();

  expect(tradeClientOptions).toEqual([expect.objectContaining({ invalidRequestThreshold: 1 })]);
});

it('issues every interaction through the governed client, standing headers and all', async () => {
  const harness = recorderHarness(fixturesFor({}));

  await harness.record();

  expect(harness.http.requests).toHaveLength(5);
  for (const request of harness.http.requests) {
    expect(request.method).toBe('GET');
    expect(request.headers['user-agent']).toBe(CONTACT);
    expect(request.headers['x-requested-with']).toBe('XMLHttpRequest');
  }
});

it('writes nothing at all when one interaction fails mid-loop', async () => {
  const fixtures = fixturesFor({});
  const failing = FIXTURE_INTERACTIONS[2];
  fixtures[`GET ${failing?.url ?? ''}`] = {
    status: 503,
    headers: RATE_LIMIT_HEADERS,
    body: 'upstream is unwell',
  };
  const harness = recorderHarness(fixtures);

  const outcome = await harness.record();

  expect(outcome.ok).toBe(false);
  expect(outcome.failure).toContain(failing?.name ?? '');
  expect(outcome.written).toEqual([]);
  expect(harness.writes).toEqual([]);
});

it('names the interaction when a 200 carries something that is not JSON', async () => {
  const fixtures = fixturesFor({});
  const html = FIXTURE_INTERACTIONS[1];
  fixtures[`GET ${html?.url ?? ''}`] = {
    status: 200,
    headers: RATE_LIMIT_HEADERS,
    body: '<!doctype html><title>maintenance</title>',
  };
  const harness = recorderHarness(fixtures);

  const outcome = await harness.record();

  expect(outcome.ok).toBe(false);
  expect(outcome.failure).toContain(html?.name ?? '');
  expect(outcome.failure).toContain('not JSON');
  expect(harness.writes).toEqual([]);
});

it('yields rather than recording when the API rate limits the run', async () => {
  const fixtures = fixturesFor({});
  const limited = FIXTURE_INTERACTIONS[0];
  fixtures[`GET ${limited?.url ?? ''}`] = {
    status: 429,
    headers: { ...RATE_LIMIT_HEADERS, 'retry-after': '43' },
    body: '{}',
  };
  const harness = recorderHarness(fixtures);

  const outcome = await harness.record();

  expect(outcome.ok).toBe(false);
  expect(outcome.failure).toContain('rate limited');
  expect(harness.writes).toEqual([]);
});

// --- identifier stripping ---------------------------------------------------

it('strips account and character names from a captured payload, keeping the structure', () => {
  const captured = {
    result: [
      {
        id: 'abc',
        listing: {
          account: {
            name: 'SomePlayer#1234',
            lastCharacterName: 'SomeCharacter',
            online: { league: 'Some League' },
          },
          accountName: 'SomePlayer#1234',
          whisper: '@SomeCharacter Hi, I would like to buy your item',
          whisper_token: 'eyJhbGciOiJzb21lLWNoYXJhY3Rlci1uYW1lIn0',
          price: { amount: 1, currency: 'divine' },
        },
      },
    ],
  };

  expect(stripPersonalIdentifiers(captured)).toEqual({
    result: [
      {
        id: 'abc',
        listing: {
          account: {
            name: REDACTED,
            lastCharacterName: REDACTED,
            online: { league: 'Some League' },
          },
          accountName: REDACTED,
          whisper: REDACTED,
          whisper_token: REDACTED,
          price: { amount: 1, currency: 'divine' },
        },
      },
    ],
  });
});

it('strips an identifier held in an array, element by element', () => {
  expect(
    stripPersonalIdentifiers({
      account: { name: ['SomePlayer#1234', 'SomePlayer#5678'] },
      whisper: ['@CharacterOne hi', '@CharacterTwo hi'],
      leagues: ['Some League', 'Another League'],
    }),
  ).toEqual({
    account: { name: [REDACTED, REDACTED] },
    whisper: [REDACTED, REDACTED],
    leagues: ['Some League', 'Another League'],
  });
});

it('strips an identifier nested below an identifier key', () => {
  expect(stripPersonalIdentifiers({ whisper: { template: '@SomeCharacter hi' } })).toEqual({
    whisper: { template: REDACTED },
  });
});

it('leaves a catalogue label named `name` alone — only an identity container hides one', () => {
  const catalogue = {
    result: [
      { id: 'weapon', label: 'Weapons', entries: [{ id: 'weapon.bow', name: 'Bow', text: 'Bow' }] },
    ],
  };

  expect(stripPersonalIdentifiers(catalogue)).toEqual(catalogue);
});

it('leaves a non-string identifier value alone rather than inventing a shape', () => {
  expect(stripPersonalIdentifiers({ account: { name: JSON_NULL, lastCharacterName: 7 } })).toEqual({
    account: { name: JSON_NULL, lastCharacterName: 7 },
  });
});

// --- the pricing interactions (Story 1.7) ------------------------------------

describe('recordFixtures: the search and fetch leg per tracked entry', () => {
  const league = 'Forbidden Rites';
  const itemTypes = itemTypesOf({ result: [] });
  const priced: TrackedEntry = { kind: 'raw', baseTypeId: 'Gold Amulet', itemLevelMin: 82, status: 'active' };
  const empty: TrackedEntry = { kind: 'raw', baseTypeId: 'Solar Amulet', itemLevelMin: 82, status: 'pinned' };
  const pruned: TrackedEntry = {
    kind: 'raw',
    baseTypeId: 'Wide Belt',
    itemLevelMin: 82,
    status: 'pruned',
    prunedReason: 'no market',
  };
  const resultIds = Array.from({ length: 12 }, (_, index) => `r${String(index)}`);

  function searchOf(entry: TrackedEntry) {
    return {
      method: 'POST' as const,
      url: tradeSearchUrl(league),
      body: JSON.stringify(buildSearchBody(entry, itemTypes)),
    };
  }
  const fetchOfPriced = { method: 'GET' as const, url: tradeFetchUrl(resultIds.slice(0, 10), 'S1') };

  /** The fake keys by method and URL; every search shares one URL, so answer by body. */
  function pricingHarness(searchStatus = 200) {
    const base = createFakeHttpPort({
      ...fixturesFor({}),
      [`GET ${fetchOfPriced.url}`]: respond({
        result: [{ id: 'r0', listing: { account: { name: 'Someone#1' }, price: { amount: 1, currency: 'divine' } } }],
      }),
    });
    const bodies = new Map([
      [searchOf(priced).body, { id: 'S1', result: resultIds, total: 12 }],
      [searchOf(empty).body, { id: 'S2', result: [], total: 0 }],
    ]);
    const requests: HttpRequest[] = [];
    const http = {
      send(request: HttpRequest) {
        requests.push(request);
        if (request.method === 'POST') {
          const answer = bodies.get(request.body ?? '');
          return answer === undefined
            ? Promise.reject(new Error('unfixtured search'))
            : Promise.resolve({ status: searchStatus, headers: RATE_LIMIT_HEADERS, body: JSON.stringify(answer) });
        }
        return base.send(request);
      },
    };
    const writes: { path: string; contents: string }[] = [];
    return {
      requests,
      writes,
      record: () =>
        recordFixtures(
          {
            http,
            clock: createFakeClockPort('2026-09-20T12:00:00.000Z'),
            wait: () => Promise.resolve(),
            userAgent: CONTACT,
            writeFixture: (path, contents) => {
              writes.push({ path, contents });
              return Promise.resolve();
            },
          },
          { league, entries: [priced, empty, pruned], itemTypes },
        ),
    };
  }

  it('records one search per non-pruned entry and one fetch of at most 10 ids where it found any', async () => {
    const harness = pricingHarness();

    const outcome = await harness.record();

    expect(outcome.ok).toBe(true);
    const pricing = harness.requests.slice(FIXTURE_INTERACTIONS.length);
    expect(pricing.map((request) => `${request.method} ${request.url}`)).toEqual([
      `POST ${searchOf(priced).url}`,
      `GET ${fetchOfPriced.url}`,
      `POST ${searchOf(empty).url}`,
    ]);
    expect(pricing[0]?.body).toBe(searchOf(priced).body);
    expect(pricing[0]?.headers['user-agent']).toBe(CONTACT);

    const names = harness.writes.map((write) => write.path).slice(FIXTURE_INTERACTIONS.length);
    expect(names).toEqual([
      fixturePathOf({ name: pricingFixtureName(searchOf(priced)) }),
      fixturePathOf({ name: pricingFixtureName(fetchOfPriced) }),
      fixturePathOf({ name: pricingFixtureName(searchOf(empty)) }),
    ]);
    expect(names.every((path) => /trade-(search|fetch)-[0-9a-f]{16}\.json$/.test(path))).toBe(true);
  });

  it('strips personal identifiers from the fetch payload', async () => {
    const harness = pricingHarness();
    await harness.record();
    const fetchWrite = harness.writes.find((write) => write.path.includes('trade-fetch-'));
    expect(fetchWrite?.contents).toContain(REDACTED);
    expect(fetchWrite?.contents).not.toContain('Someone#1');
  });

  it('writes nothing when a search is refused', async () => {
    const harness = pricingHarness(400);
    const outcome = await harness.record();
    expect(outcome.ok).toBe(false);
    expect(outcome.failure).toContain('trade-search-');
    expect(harness.writes).toEqual([]);
  });
});
