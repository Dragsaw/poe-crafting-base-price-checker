import { expect, it, vi } from 'vitest';

import { FIXTURE_INTERACTIONS, fixturePathOf, REDACTED, serialiseFixture } from '../fixtures-record.ts';
import type * as TradeClientModule from '../trade/client.ts';
import { CONTACT, fixturesFor, recorderHarness } from './test-support.ts';

const RATE_LIMIT_HEADERS = {
  'x-rate-limit-policy': 'trade-data-request-limit',
  'x-rate-limit-rules': 'Ip',
  'x-rate-limit-ip': '5:10:60',
  'x-rate-limit-ip-state': '1:10:0',
};

/** Every option set the command built its trade client with, in build order. */
const tradeClientOptions = vi.hoisted((): unknown[] => []);

// A pass-through: the real client is built, and the options are recorded so a
// test can inspect what the shell passed (AD-8).
vi.mock('../trade/client.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof TradeClientModule>();
  return {
    ...actual,
    createTradeClient: (options: Parameters<typeof actual.createTradeClient>[0]) => {
      tradeClientOptions.push(options);
      return actual.createTradeClient(options);
    },
  };
});

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

it('writes one stripped, newline-terminated payload per interaction', async () => {
  const leagues = {
    result: [{ id: 'Some League', realm: 'poe2', account: { name: 'SomePlayer#1234' } }],
  };
  const harness = recorderHarness(fixturesFor(RATE_LIMIT_HEADERS, { 'trade-data-leagues': leagues }));

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

it('builds its trade client with the invalid-request threshold of 1', async () => {
  tradeClientOptions.length = 0;

  await recorderHarness(fixturesFor(RATE_LIMIT_HEADERS)).record();

  expect(tradeClientOptions).toEqual([expect.objectContaining({ invalidRequestThreshold: 1 })]);
});

it('issues every interaction through the governed client, standing headers and all', async () => {
  const harness = recorderHarness(fixturesFor(RATE_LIMIT_HEADERS));

  await harness.record();

  expect(harness.http.requests).toHaveLength(5);
  for (const request of harness.http.requests) {
    expect(request.method).toBe('GET');
    expect(request.headers['user-agent']).toBe(CONTACT);
    expect(request.headers['x-requested-with']).toBe('XMLHttpRequest');
  }
});

it('writes nothing at all when one interaction fails mid-loop', async () => {
  const fixtures = fixturesFor(RATE_LIMIT_HEADERS);
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
  const fixtures = fixturesFor(RATE_LIMIT_HEADERS);
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
  const fixtures = fixturesFor(RATE_LIMIT_HEADERS);
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
