import { canonicalKey, createFakeClockPort, createFakeHttpPort, DatasetEntrySchema } from '@poe/contracts';
import type { DatasetEntry, TrackedEntry } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { createTradeClient } from '../trade/client.ts';
import type { TradeResult } from '../trade/client.ts';
import { rejectionOf } from '../test-support/rejection-of.ts';
import { createPricingStep, MalformedRequestError, UnexpectedTradeResponseError } from './price-entry.ts';
import { itemTypesOf } from './search-body.ts';
import type { ItemTypes } from './search-body.ts';
import { ENTRY, ids, KEY, LEAGUE, NOW, ok, PREVIOUS, rate, RATES, SEARCH_ID, SEARCH_URL, setup, status, timeoutError } from './price-entry.test-support.ts';

describe('createPricingStep: unanswered and refused requests', () => {
  it.each([
    ['a 429', { status: 429, headers: { 'retry-after': '60' }, body: '' }, { retryAfterMs: 60_000 }],
    ['a 503', status(503), {}],
  ])('%s on the search stamps lastAttemptedAt alone and yields', async (_label, response, penalty) => {
    const { run } = setup({ search: response, dataset: [PREVIOUS] });

    // Only a 429 carries the delay the chunk remembers as notBefore.
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

    const error = await rejectionOf(run());

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

    const error = await rejectionOf(run());

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
    const error = await rejectionOf(run());
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
    const error = await rejectionOf(run());
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
    const error = await rejectionOf(run());
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

describe('createPricingStep: the session-expired yield (AD-30)', () => {
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
