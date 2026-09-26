import {
  canonicalKey,
  createFakeClockPort,
  createFakeHttpPort,
  DatasetEntrySchema,
} from '@poe/contracts';
import type { CurrencyRate, DatasetEntry, HttpRequest, HttpResponse, TrackedEntry } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { createTradeClient } from '../trade/client.ts';
import { tradeFetchUrl, tradeSearchUrl } from '../trade/endpoints.ts';
import { createPricingStep, MalformedRequestError, UnexpectedTradeResponseError } from './price-entry.ts';
import { itemTypesOf, UnknownClassBaseTypeError } from './search-body.ts';

const LEAGUE = 'Forbidden Rites';
const NOW = '2026-09-26T12:00:00.000Z';
const SEARCH_ID = 'Ab3dE';
const SEARCH_URL = tradeSearchUrl(LEAGUE);

const ENTRY: TrackedEntry = { kind: 'raw', baseTypeId: 'Gold Amulet', itemLevelMin: 82, status: 'active' };
const KEY = canonicalKey(ENTRY);

function rate(currencyId: string, value: number, league = LEAGUE): CurrencyRate {
  return { currencyId, rate: value, source: 'measured', league, asOf: '2026-09-26T00:00:00Z' };
}

const RATES = [rate('divine', 1), rate('exalted', 0.002012)];

const SEARCH_HEADERS = {
  'x-rate-limit-policy': 'trade-search-request-limit',
  'x-rate-limit-rules': 'Ip',
  'x-rate-limit-ip': '5:10:60',
  'x-rate-limit-ip-state': '2:10:0',
};
const FETCH_HEADERS = {
  'x-rate-limit-policy': 'trade-fetch-request-limit',
  'x-rate-limit-rules': 'Ip',
  'x-rate-limit-ip': '12:4:10',
  'x-rate-limit-ip-state': '5:4:0',
};

function ok(body: unknown, headers: Record<string, string> = {}): HttpResponse {
  return { status: 200, headers, body: JSON.stringify(body) };
}

function status(code: number): HttpResponse {
  return { status: code, headers: {}, body: '{"error":{}}' };
}

function ids(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `id${String(index)}`);
}

function listings(prices: readonly (readonly [number, string])[]): unknown {
  return {
    result: prices.map(([amount, currency], index) => ({
      id: `id${String(index)}`,
      listing: { price: { type: '~price', amount, currency } },
      item: {},
    })),
  };
}

interface Setup {
  readonly search?: HttpResponse;
  readonly results?: readonly string[];
  readonly fetch?: HttpResponse;
  readonly rates?: readonly CurrencyRate[];
  readonly dataset?: readonly DatasetEntry[];
  readonly entry?: TrackedEntry;
  readonly rejectFetch?: boolean;
}

/** What `AbortSignal.timeout` rejects with (`shell.ts`). */
function timeoutError(): Error {
  const error = new Error('The operation was aborted due to timeout');
  error.name = 'TimeoutError';
  return error;
}

function setup(options: Setup) {
  const results = options.results ?? ids(10);
  const fake = createFakeHttpPort({
    [`POST ${SEARCH_URL}`]: options.search ?? ok({ id: SEARCH_ID, complexity: 1, result: results, total: results.length }),
    ...(options.fetch === undefined || options.rejectFetch === true
      ? {}
      : { [`GET ${tradeFetchUrl(results.slice(0, 10), SEARCH_ID)}`]: options.fetch }),
  });
  const http = {
    requests: fake.requests,
    send: (request: HttpRequest) =>
      options.rejectFetch === true && request.method === 'GET'
        ? Promise.reject(timeoutError())
        : fake.send(request),
  };
  const clock = createFakeClockPort(NOW);
  const client = createTradeClient({ http, clock, wait: () => Promise.resolve(), userAgent: 'test (x@y.test)' });
  const step = createPricingStep({
    client,
    league: LEAGUE,
    rates: options.rates ?? RATES,
    itemTypes: itemTypesOf({ result: [{ id: 'jewel', label: 'Jewels', entries: [{ type: 'Emerald' }] }] }),
    dataset: options.dataset ?? [],
    clock,
  });
  return { http, run: () => step(options.entry ?? ENTRY) };
}

const PREVIOUS: DatasetEntry = {
  entryKey: KEY,
  price: { state: 'no-listings' },
  lastAttemptedAt: '2026-09-20T00:00:00.000Z',
  lastSearchId: 'old',
  lastSearchLeague: LEAGUE,
};

describe('createPricingStep: a priced entry', () => {
  it('sends one search and one fetch of at most 10 ids, then takes the lower median', async () => {
    const prices = [10, 1, 9, 2, 8, 3, 7, 4, 6, 5].map((n) => [n, 'divine'] as const);
    const { http, run } = setup({ results: ids(12), fetch: ok(listings(prices), FETCH_HEADERS), search: undefined });

    const result = await run();

    expect(http.requests.map((request) => request.method)).toEqual(['POST', 'GET']);
    const fetchUrl = new URL(http.requests[1]?.url ?? '');
    expect(fetchUrl.pathname.split('/').at(-1)?.split(',')).toHaveLength(10);
    expect(fetchUrl.searchParams.get('query')).toBe(SEARCH_ID);

    expect(result.kind).toBe('completed');
    expect(result.entry).toEqual({
      entryKey: KEY,
      price: {
        state: 'priced',
        observation: {
          league: LEAGUE,
          observedAt: NOW,
          priceDivine: 5,
          sampleSize: 10,
          exchangeObservation: rate('divine', 1),
        },
      },
      lastAttemptedAt: NOW,
      lastSearchId: SEARCH_ID,
      lastSearchLeague: LEAGUE,
    });
    expect(DatasetEntrySchema.parse(result.entry)).toEqual(result.entry);
  });

  it('normalises each listing once and records the median listing’s rate', async () => {
    // 100 ex = 0.2012 div, 1 div = 1, 300 ex = 0.6036 div → median 0.6036 (exalted).
    const { run } = setup({
      results: ids(3),
      fetch: ok(listings([[100, 'exalted'], [1, 'divine'], [300, 'exalted']])),
    });

    const result = await run();

    expect(result.entry?.price).toEqual({
      state: 'priced',
      observation: {
        league: LEAGUE,
        observedAt: NOW,
        priceDivine: 0.6036,
        sampleSize: 3,
        exchangeObservation: rate('exalted', 0.002),
      },
    });
  });

  it('prices a short sample with its true size', async () => {
    const { run } = setup({ results: ids(3), fetch: ok(listings([[1, 'divine'], [2, 'divine'], [3, 'divine']])) });
    const result = await run();
    expect(result.entry?.price.state === 'priced' && result.entry.price.observation.sampleSize).toBe(3);
  });

  it('reports the allowances each lane’s headers declared', async () => {
    const { run } = setup({
      search: ok({ id: SEARCH_ID, result: ids(1) }, SEARCH_HEADERS),
      results: ids(1),
      fetch: ok(listings([[1, 'divine']]), FETCH_HEADERS),
    });
    const result = await run();
    expect(result).toMatchObject({ kind: 'completed', searchRemaining: 3, fetchRemaining: 7 });
  });
});

describe('createPricingStep: states by cause', () => {
  it('zero results is no-listings, with no fetch and the search fields set', async () => {
    const { http, run } = setup({ results: [] });

    const result = await run();

    expect(http.requests).toHaveLength(1);
    expect(result).toEqual({
      kind: 'completed',
      entry: {
        entryKey: KEY,
        price: { state: 'no-listings' },
        lastAttemptedAt: NOW,
        lastSearchId: SEARCH_ID,
        lastSearchLeague: LEAGUE,
      },
    });
  });

  it('one listing in a currency with no rate is not-yet-synced / no-exchange-rate', async () => {
    const { run } = setup({ results: ids(2), fetch: ok(listings([[1, 'divine'], [5, 'chaos']])) });
    const result = await run();
    expect(result.kind).toBe('completed');
    expect(result.entry?.price).toEqual({ state: 'not-yet-synced', reason: 'no-exchange-rate' });
    expect(result.entry?.lastSearchId).toBe(SEARCH_ID);
  });

  it('a rate from another league is treated as missing', async () => {
    const { run } = setup({
      results: ids(1),
      fetch: ok(listings([[100, 'exalted']])),
      rates: [rate('divine', 1), rate('exalted', 0.002, 'Standard')],
    });
    const result = await run();
    expect(result.entry?.price).toEqual({ state: 'not-yet-synced', reason: 'no-exchange-rate' });
  });

  it('a fetch with no priceable listing is no-listings, with the search fields set', async () => {
    const { run } = setup({
      results: ids(2),
      fetch: ok({ result: [null, { id: 'id1', listing: { price: { amount: 0, currency: 'divine' } } }] }),
    });
    expect(await run()).toEqual({
      kind: 'completed',
      entry: {
        entryKey: KEY,
        price: { state: 'no-listings' },
        lastAttemptedAt: NOW,
        lastSearchId: SEARCH_ID,
        lastSearchLeague: LEAGUE,
      },
    });
  });

  it('leaves null listings out of sampleSize', async () => {
    const { run } = setup({
      results: ids(4),
      fetch: ok({
        result: [
          null,
          { id: 'id1', listing: { price: { amount: 1, currency: 'divine' } } },
          null,
          { id: 'id3', listing: { price: { amount: 3, currency: 'divine' } } },
        ],
      }),
    });
    const result = await run();
    expect(result.entry?.price.state === 'priced' && result.entry.price.observation.sampleSize).toBe(2);
  });

  it('never puts the search fields on the observation', async () => {
    const { run } = setup({ results: ids(1), fetch: ok(listings([[1, 'divine']])) });
    const result = await run();
    const observation = result.entry?.price.state === 'priced' ? result.entry.price.observation : {};
    expect(Object.keys(observation)).not.toContain('lastSearchId');
    expect(Object.keys(observation)).not.toContain('lastAttemptedAt');
  });
});

describe('createPricingStep: unanswered and refused requests', () => {
  it.each([
    ['a 429', { status: 429, headers: { 'retry-after': '60' }, body: '' }],
    ['a 503', status(503)],
  ])('%s on the search stamps lastAttemptedAt alone and yields', async (_label, response) => {
    const { run } = setup({ search: response, dataset: [PREVIOUS] });

    expect(await run()).toEqual({ kind: 'yielded', entry: { ...PREVIOUS, lastAttemptedAt: NOW } });
  });

  it('a timeout on the search stamps lastAttemptedAt alone and yields', async () => {
    const http = { send: () => Promise.reject(timeoutError()) };
    const clock = createFakeClockPort(NOW);
    const step = createPricingStep({
      client: createTradeClient({ http, clock, wait: () => Promise.resolve(), userAgent: 'test (x@y.test)' }),
      league: LEAGUE,
      rates: RATES,
      itemTypes: new Map(),
      dataset: [],
      clock,
    });

    expect(await step(ENTRY)).toEqual({
      kind: 'yielded',
      entry: { entryKey: KEY, price: { state: 'not-yet-synced', reason: 'never-synced' }, lastAttemptedAt: NOW },
    });
  });

  it.each([
    ['a 429', { status: 429, headers: {}, body: '' }, false],
    ['a 502', status(502), false],
    ['a timeout', undefined, true],
  ])('%s on the fetch stamps lastAttemptedAt alone and yields', async (_label, response, rejectFetch) => {
    const { run } = setup({ results: ids(1), fetch: response ?? status(200), rejectFetch, dataset: [PREVIOUS] });

    expect(await run()).toEqual({ kind: 'yielded', entry: { ...PREVIOUS, lastAttemptedAt: NOW } });
  });

  it('another 4xx on the search throws MalformedRequestError with the stamped entry', async () => {
    const { run } = setup({ search: status(400), dataset: [PREVIOUS] });

    const error = await run().then(
      () => undefined,
      (thrown: unknown) => thrown,
    );

    expect(error).toBeInstanceOf(MalformedRequestError);
    expect(error).toMatchObject({
      entryKey: KEY,
      requestKind: 'search',
      status: 400,
      entry: { ...PREVIOUS, lastAttemptedAt: NOW },
    });
  });

  it('another 4xx on the fetch throws MalformedRequestError with the stamped entry', async () => {
    const { run } = setup({ results: ids(1), fetch: status(404), dataset: [PREVIOUS] });
    await expect(run()).rejects.toMatchObject({
      requestKind: 'fetch',
      status: 404,
      entry: { ...PREVIOUS, lastAttemptedAt: NOW },
    });
  });

  it('a rejection that is not a timeout or a network failure is rethrown, not yielded', async () => {
    const failure = new Error('[fake-http] no fixture');
    const clock = createFakeClockPort(NOW);
    const step = createPricingStep({
      client: createTradeClient({
        http: { send: () => Promise.reject(failure) },
        clock,
        wait: () => Promise.resolve(),
        userAgent: 'test (x@y.test)',
      }),
      league: LEAGUE,
      rates: RATES,
      itemTypes: new Map(),
      dataset: [],
      clock,
    });
    await expect(step(ENTRY)).rejects.toBe(failure);
  });

  it('a search answered 200 with {} throws UnexpectedTradeResponseError and sends no fetch', async () => {
    const { http, run } = setup({ search: ok({}) });
    const error = await run().then(
      () => undefined,
      (thrown: unknown) => thrown,
    );
    expect(error).toBeInstanceOf(UnexpectedTradeResponseError);
    expect(error).toMatchObject({ entryKey: KEY, requestKind: 'search' });
    expect(http.requests).toHaveLength(1);
  });

  it('a fetch answered 200 with {} throws UnexpectedTradeResponseError naming the fetch', async () => {
    const { run } = setup({ results: ids(1), fetch: ok({}) });
    const error = await run().then(
      () => undefined,
      (thrown: unknown) => thrown,
    );
    expect(error).toBeInstanceOf(UnexpectedTradeResponseError);
    expect(error).toMatchObject({ entryKey: KEY, requestKind: 'fetch' });
  });

  it('a jewel-arm class the catalogue lacks is refused before any request', async () => {
    const { http, run } = setup({
      entry: {
        kind: 'crafted',
        categoryId: 'jewel',
        className: 'Emerld',
        itemLevelMin: 1,
        prefix: { kind: 'valueless', statId: 'explicit.x' },
        status: 'active',
      },
    });

    await expect(run()).rejects.toBeInstanceOf(UnknownClassBaseTypeError);
    expect(http.requests).toHaveLength(0);
  });
});
