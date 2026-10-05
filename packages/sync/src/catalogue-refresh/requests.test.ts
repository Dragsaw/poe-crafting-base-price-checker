import { expect, it, vi } from 'vitest';

import { printRefreshOutcome } from '../catalogue-refresh.ts';
import type * as TradeClientModule from '../trade/client.ts';
import { CATALOGUE_ENDPOINTS, TRADE_LEAGUES_URL } from '../trade/endpoints.ts';
import {
  byCodeUnit,
  capturedResponses,
  CONTACT,
  endpointFor,
  harness,
} from './test-support.ts';

/** Every option set the command built its trade client with, in build order. */
const tradeClientOptions = vi.hoisted((): unknown[] => []);

// A pass-through: the real client is built, and the options are recorded so a
// test can inspect what the shell passed (AD-8, IMPLEMENTATION-NOTES.md §5.3).
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


/** Room left in the bucket: nothing has to wait. */
const RATE_LIMIT_HEADERS = {
  'x-rate-limit-policy': 'trade-data-request-limit',
  'x-rate-limit-rules': 'Ip',
  'x-rate-limit-ip': '5:10:60',
  'x-rate-limit-ip-state': '1:10:0',
};

/** The same policy, saturated: the *next* request against it must wait 10 s. */
const SATURATED_HEADERS = { ...RATE_LIMIT_HEADERS, 'x-rate-limit-ip-state': '5:10:0' };

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
  const instance = harness(capturedResponses(RATE_LIMIT_HEADERS));

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

  await harness(capturedResponses(RATE_LIMIT_HEADERS)).refresh();

  expect(tradeClientOptions).toEqual([expect.objectContaining({ invalidRequestThreshold: 1 })]);
});

it('counts its requests: four on success, and the count printed (AD-12)', async () => {
  const outcome = await harness(capturedResponses(RATE_LIMIT_HEADERS)).refresh();

  expect(outcome).toMatchObject({ ok: true, requests: 4 });
  const stdout: string[] = [];
  const stderr: string[] = [];
  expect(printRefreshOutcome(outcome, { stdout: (line) => { stdout.push(line); }, stderr: (line) => { stderr.push(line); } })).toBe(0);
  expect(stdout[0]).toBe('requests: 4');
  expect(stderr).toEqual([]);
});

it('counts the requests sent before a failure, and prints the count beside it', async () => {
  const fixtures = capturedResponses(RATE_LIMIT_HEADERS);
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
  const instance = harness(capturedResponses(RATE_LIMIT_HEADERS));

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
  const instance = harness(capturedResponses(SATURATED_HEADERS));

  const outcome = await instance.refresh();

  expect(outcome.ok).toBe(true);
  expect(instance.waits).toEqual([10_000, 10_000, 10_000]);
});
