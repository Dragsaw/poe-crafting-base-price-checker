import { canonicalKey, createFakeClockPort, createFakeHttpPort } from '@poe/contracts';
import type { CurrencyRate, DatasetEntry, HttpRequest, HttpResponse, TrackedEntry } from '@poe/contracts';

import { createTradeClient } from '../trade/client.ts';
import { tradeFetchUrl, tradeSearchUrl } from '../trade/endpoints.ts';
import { NamedError } from '../test-support/named-error.ts';
import { createPricingStep } from './price-entry.ts';
import { itemTypesOf } from './search-body.ts';

export const LEAGUE = 'Forbidden Rites';
export const NOW = '2026-09-26T12:00:00.000Z';
export const SEARCH_ID = 'Ab3dE';
export const SEARCH_URL = tradeSearchUrl(LEAGUE);

export const ENTRY: TrackedEntry = { kind: 'raw', baseTypeId: 'Gold Amulet', itemLevelMin: 82, status: 'active' };
export const KEY = canonicalKey(ENTRY);

export function rate(currencyId: string, value: number, league = LEAGUE): CurrencyRate {
  return { currencyId, rate: value, source: 'measured', league, asOf: '2026-09-26T00:00:00Z' };
}

export const RATES = [rate('divine', 1), rate('exalted', 0.002012)];

export function ok(body: unknown, headers: Record<string, string> = {}): HttpResponse {
  return { status: 200, headers, body: JSON.stringify(body) };
}

export function status(code: number): HttpResponse {
  return { status: code, headers: {}, body: '{"error":{}}' };
}

export function ids(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `id${String(index)}`);
}

export function listings(prices: readonly (readonly [number, string])[]): unknown {
  return {
    result: prices.map(([amount, currency], index) => ({
      id: `id${String(index)}`,
      listing: { price: { type: '~price', amount, currency } },
      item: {},
    })),
  };
}

export interface Setup {
  readonly search?: HttpResponse;
  readonly results?: readonly string[];
  readonly fetch?: HttpResponse;
  readonly rates?: readonly CurrencyRate[];
  readonly dataset?: readonly DatasetEntry[];
  readonly entry?: TrackedEntry;
  readonly rejectFetch?: boolean;
}

/** What `AbortSignal.timeout` rejects with (`shell.ts`). */
export function timeoutError(): Error {
  return new NamedError('TimeoutError', 'The operation was aborted due to timeout');
}

export function setup(options: Setup) {
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

export const PREVIOUS: DatasetEntry = {
  entryKey: KEY,
  price: { state: 'no-listings' },
  lastAttemptedAt: '2026-09-20T00:00:00.000Z',
  lastSearchId: 'old',
  // A past league, so a test can tell a kept search field from a set one.
  lastSearchLeague: 'Standard',
};
