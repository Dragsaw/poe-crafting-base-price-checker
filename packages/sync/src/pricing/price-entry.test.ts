import {
  canonicalKey,
  createFakeClockPort,
  createFakeHttpPort,
  DatasetEntrySchema,
} from '@poe/contracts';
import type { CurrencyRate, DatasetEntry, HttpRequest, HttpResponse, TrackedEntry } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { createTradeClient } from '../trade/client.ts';
import type { TradeRequest, TradeResult } from '../trade/client.ts';
import { tradeFetchUrl, tradeSearchUrl } from '../trade/endpoints.ts';
import { createPricingStep, MalformedRequestError, UnexpectedTradeResponseError } from './price-entry.ts';
import { itemTypesOf } from './search-body.ts';
import type { ItemTypes } from './search-body.ts';
import { NamedError } from '../test-support/named-error.ts';

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
  return new NamedError('TimeoutError', 'The operation was aborted due to timeout');
}

function setup(options: Setup) {
  const results = options.results ?? ids(10);
  const fake = createFakeHttpPort({
    [`POST ${SEARCH_URL}`]: options.search ?? ok({ id: SEARCH_ID, complexity: 1, result: results, total: results.length }),
    ...(!(options.fetch === undefined || options.rejectFetch === true) && { [`GET ${tradeFetchUrl(results.slice(0, 10), SEARCH_ID)}`]: options.fetch }),
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
  // A past league, so a test can tell a kept search field from a set one.
  lastSearchLeague: 'Standard',
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
    ['a 429', { status: 429, headers: { 'retry-after': '60' }, body: '' }, { retryAfterMs: 60_000 }],
    ['a 503', status(503), {}],
  ])('%s on the search stamps lastAttemptedAt alone and yields', async (_label, response, penalty) => {
    const { run } = setup({ search: response, dataset: [PREVIOUS] });

    // Only a 429 carries the delay the chunk remembers as notBefore (§5.3).
    expect(await run()).toStrictEqual({
      kind: 'yielded',
      entry: { ...PREVIOUS, lastAttemptedAt: NOW },
      ...penalty,
    });
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
    // No Retry-After: the client derives the floor from the same response.
    ['a 429', { status: 429, headers: {}, body: '' }, false, { retryAfterMs: 1000 }],
    ['a 502', status(502), false, {}],
    ['a timeout', undefined, true, {}],
  ])('%s on the fetch keeps the answered search fields and the price state, and yields', async (_label, response, rejectFetch, penalty) => {
    const { run } = setup({ results: ids(1), fetch: response ?? status(200), rejectFetch, dataset: [PREVIOUS] });

    // The unit is the request (AD-9): the answered search sets its two fields.
    expect(await run()).toStrictEqual({
      kind: 'yielded',
      entry: { ...PREVIOUS, lastAttemptedAt: NOW, lastSearchId: SEARCH_ID, lastSearchLeague: LEAGUE },
      ...penalty,
    });
  });

  it('another 4xx on the search throws MalformedRequestError with the stamped entry', async () => {
    const { run } = setup({ search: status(400), dataset: [PREVIOUS] });

    const error = await run().then(
      () => {},
      (error_: unknown) => error_,
    );

    expect(error).toBeInstanceOf(MalformedRequestError);
    expect(error).toMatchObject({
      entryKey: KEY,
      requestKind: 'search',
      status: 400,
      entry: { ...PREVIOUS, lastAttemptedAt: NOW },
    });
  });

  it('another 4xx on the fetch throws MalformedRequestError with the answered search fields and the price state kept', async () => {
    const { run } = setup({ results: ids(1), fetch: status(404), dataset: [PREVIOUS] });

    const error = await run().then(
      () => {},
      (error_: unknown) => error_,
    );

    expect(error).toBeInstanceOf(MalformedRequestError);
    expect(error).toMatchObject({ entryKey: KEY, requestKind: 'fetch', status: 404 });
    expect((error as MalformedRequestError).entry).toStrictEqual({
      ...PREVIOUS,
      lastAttemptedAt: NOW,
      lastSearchId: SEARCH_ID,
      lastSearchLeague: LEAGUE,
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

  it('a search answered 200 with {} throws UnexpectedTradeResponseError with lastAttemptedAt stamped, the search fields and the price state kept, and sends no fetch', async () => {
    const { http, run } = setup({ search: ok({}), dataset: [PREVIOUS] });
    const error = await run().then(
      () => {},
      (error_: unknown) => error_,
    );
    expect(error).toBeInstanceOf(UnexpectedTradeResponseError);
    expect(error).toMatchObject({ entryKey: KEY, requestKind: 'search' });
    // A request was issued, so lastAttemptedAt is stamped (AD-9); no search
    // was answered, so the previous search fields stay (AD-16).
    expect((error as UnexpectedTradeResponseError).entry).toStrictEqual({
      ...PREVIOUS,
      lastAttemptedAt: NOW,
    });
    expect(http.requests).toHaveLength(1);
  });

  it('a search answered 200 with {} for a never-published entry carries a stamped never-synced entry', async () => {
    const { http, run } = setup({ search: ok({}) });
    const error = await run().then(
      () => {},
      (error_: unknown) => error_,
    );
    expect(error).toBeInstanceOf(UnexpectedTradeResponseError);
    expect(error).toMatchObject({ entryKey: KEY, requestKind: 'search' });
    expect((error as UnexpectedTradeResponseError).entry).toStrictEqual({
      entryKey: KEY,
      price: { state: 'not-yet-synced', reason: 'never-synced' },
      lastAttemptedAt: NOW,
    });
    expect(http.requests).toHaveLength(1);
  });

  it('a fetch answered 200 with {} throws UnexpectedTradeResponseError with the answered search fields and the price state kept', async () => {
    const { run } = setup({ results: ids(1), fetch: ok({}), dataset: [PREVIOUS] });
    const error = await run().then(
      () => {},
      (error_: unknown) => error_,
    );
    expect(error).toBeInstanceOf(UnexpectedTradeResponseError);
    expect(error).toMatchObject({ entryKey: KEY, requestKind: 'fetch' });
    // The answered search sets its two fields whatever the fetch returns (AD-9).
    expect((error as UnexpectedTradeResponseError).entry).toStrictEqual({
      ...PREVIOUS,
      lastAttemptedAt: NOW,
      lastSearchId: SEARCH_ID,
      lastSearchLeague: LEAGUE,
    });
  });

  const MISSPELT: TrackedEntry = {
    kind: 'crafted',
    categoryId: 'jewel',
    className: 'Emerld',
    itemLevelMin: 1,
    prefix: { kind: 'valueless', statId: 'explicit.x' },
    suffix: { kind: 'valueless', statId: 'explicit.y' },
    status: 'active',
  };

  it('a jewel-arm class the catalogue lacks is marked unresolvable, reported, and costs no request', async () => {
    const { http, run } = setup({ entry: MISSPELT });

    const result = await run();

    expect(http.requests).toHaveLength(0);
    // Completed, so the chunk continues; no allowance, so it bounds nothing.
    expect(result).toEqual({
      kind: 'completed',
      entry: { entryKey: canonicalKey(MISSPELT), price: { state: 'unresolvable' } },
      records: [
        {
          kind: 'unresolvable',
          entryKey: canonicalKey(MISSPELT),
          identifier: 'Emerld',
          identifierKind: 'baseTypeId',
        },
      ],
    });
  });

  it('a jewel-arm miss keeps the attempt metadata, drops the observation, and stamps nothing', async () => {
    const previous: DatasetEntry = {
      entryKey: canonicalKey(MISSPELT),
      price: {
        state: 'priced',
        observation: {
          league: LEAGUE,
          observedAt: '2026-09-20T00:00:00.000Z',
          priceDivine: 1,
          sampleSize: 1,
          exchangeObservation: rate('divine', 1),
        },
      },
      lastAttemptedAt: '2026-09-20T00:00:00.000Z',
      lastSearchId: 'old',
      lastSearchLeague: LEAGUE,
    };
    const { run } = setup({ entry: MISSPELT, dataset: [previous] });

    const result = await run();

    expect(result.entry).toEqual({
      entryKey: canonicalKey(MISSPELT),
      price: { state: 'unresolvable' },
      lastAttemptedAt: '2026-09-20T00:00:00.000Z',
      lastSearchId: 'old',
      lastSearchLeague: LEAGUE,
    });
    expect(DatasetEntrySchema.safeParse(result.entry).success).toBe(true);
  });

  it('rethrows any other build failure', async () => {
    const step = createPricingStep({
      client: createTradeClient({
        http: createFakeHttpPort({}),
        clock: createFakeClockPort(NOW),
        wait: () => Promise.resolve(),
        userAgent: 'test (x@y.test)',
      }),
      league: LEAGUE,
      rates: RATES,
      // Only the jewel-arm miss is caught: a fault in the catalogue itself is not.
      itemTypes: {
        get: () => {
          throw new RangeError('broken catalogue');
        },
      } as unknown as ItemTypes,
      dataset: [],
      clock: createFakeClockPort(NOW),
    });

    await expect(step(MISSPELT)).rejects.toBeInstanceOf(RangeError);
  });
});

describe('createPricingStep: the session cookie marker (AD-30)', () => {
  it('marks the search and the fetch as cookie-eligible, so only the governor decides to probe or attach', async () => {
    const results = ids(3);
    const fake = createFakeHttpPort({
      [`POST ${SEARCH_URL}`]: ok({ id: SEARCH_ID, complexity: 1, result: results, total: results.length }),
      [`GET ${tradeFetchUrl(results, SEARCH_ID)}`]: ok(listings([[1, 'divine']]), FETCH_HEADERS),
    });
    const clock = createFakeClockPort(NOW);
    const client = createTradeClient({ http: fake, clock, wait: () => Promise.resolve(), userAgent: 'test (x@y.test)' });
    const sent: TradeRequest[] = [];
    const step = createPricingStep({
      client: {
        send: (request) => {
          sent.push(request);
          return client.send(request);
        },
      },
      league: LEAGUE,
      rates: RATES,
      itemTypes: itemTypesOf({ result: [] }),
      dataset: [],
      clock,
    });

    await step(ENTRY);

    expect(sent.map((request) => [request.method, request.cookieEligible])).toEqual([
      ['POST', true],
      ['GET', true],
    ]);
  });
});

describe('createPricingStep: the session-expired yield (AD-30, IMPLEMENTATION-NOTES.md §13.4)', () => {
  const EXPIRED: TradeResult = {
    kind: 'yield',
    lane: 'x',
    policy: undefined,
    waitedMs: 0,
    skips: [],
    invalidRequests: 0,
    retryAfterMs: 0,
    reason: 'session-expired',
  };

  /** A client that answers the search, then yields `session-expired` on the request `expireOn`. */
  function expiringStep(expireOn: 'POST' | 'GET') {
    const results = ids(1);
    const fake = createFakeHttpPort({
      [`POST ${SEARCH_URL}`]: ok({ id: SEARCH_ID, complexity: 1, result: results, total: results.length }),
    });
    const clock = createFakeClockPort(NOW);
    const client = createTradeClient({ http: fake, clock, wait: () => Promise.resolve(), userAgent: 'test (x@y.test)' });
    return createPricingStep({
      client: {
        send: (request) => (request.method === expireOn ? Promise.resolve(EXPIRED) : client.send(request)),
      },
      league: LEAGUE,
      rates: RATES,
      itemTypes: itemTypesOf({ result: [] }),
      dataset: [PREVIOUS],
      clock,
    });
  }

  it('on the search: stamps lastAttemptedAt alone, keeps the earlier search fields and the price, no retryAfterMs', async () => {
    expect(await expiringStep('POST')(ENTRY)).toStrictEqual({
      kind: 'yielded',
      entry: { ...PREVIOUS, lastAttemptedAt: NOW },
      sessionExpired: true,
    });
  });

  it('on the fetch: keeps the search fields from this entry’s search and the price, no retryAfterMs', async () => {
    expect(await expiringStep('GET')(ENTRY)).toStrictEqual({
      kind: 'yielded',
      entry: { ...PREVIOUS, lastAttemptedAt: NOW, lastSearchId: SEARCH_ID, lastSearchLeague: LEAGUE },
      sessionExpired: true,
    });
  });
});
