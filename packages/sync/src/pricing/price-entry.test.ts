import { createFakeClockPort, createFakeHttpPort, DatasetEntrySchema } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { createTradeClient } from '../trade/client.ts';
import type { TradeRequest } from '../trade/client.ts';
import { tradeFetchUrl } from '../trade/endpoints.ts';
import { JSON_NULL } from '../test-support/json-null.ts';
import { createPricingStep } from './price-entry.ts';
import { itemTypesOf } from './search-body.ts';
import { ENTRY, ids, KEY, LEAGUE, listings, NOW, ok, rate, RATES, SEARCH_ID, SEARCH_URL, setup } from './price-entry.test-support.ts';

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
      fetch: ok({ result: [JSON_NULL, { id: 'id1', listing: { price: { amount: 0, currency: 'divine' } } }] }),
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
          JSON_NULL,
          { id: 'id1', listing: { price: { amount: 1, currency: 'divine' } } },
          JSON_NULL,
          { id: 'id3', listing: { price: { amount: 3, currency: 'divine' } } },
        ],
      }),
    });
    const result = await run();
    expect(result.entry?.price.state === 'priced' && result.entry.price.observation.sampleSize).toBe(2);
  });

  it('leaves listings with no readable price out of sampleSize', async () => {
    const { run } = setup({
      results: ids(8),
      fetch: ok({
        result: [
          { id: 'a' },
          { id: 'b', listing: {} },
          { id: 'c', listing: { price: 'free' } },
          { id: 'd', listing: { price: { amount: '3', currency: 'divine' } } },
          { id: 'e', listing: { price: { amount: 3, currency: '' } } },
          { id: 'f', listing: { price: { amount: -1, currency: 'divine' } } },
          { id: 'g', listing: { price: { amount: 3, currency: 7 } } },
          { id: 'h', listing: { price: { amount: 2, currency: 'divine' } } },
        ],
      }),
    });
    const result = await run();
    expect(result.entry?.price.state === 'priced' && result.entry.price.observation.sampleSize).toBe(1);
  });

  it('never puts the search fields on the observation', async () => {
    const { run } = setup({ results: ids(1), fetch: ok(listings([[1, 'divine']])) });
    const result = await run();
    const observation = result.entry?.price.state === 'priced' ? result.entry.price.observation : {};
    expect(Object.keys(observation)).not.toContain('lastSearchId');
    expect(Object.keys(observation)).not.toContain('lastAttemptedAt');
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
