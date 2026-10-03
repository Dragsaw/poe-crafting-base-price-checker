import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  canonicalKey,
  CatalogueItemsFileSchema,
  ConfigFileSchema,
  createFakeClockPort,
  DatasetEntrySchema,
  TrackedFileSchema,
} from '@poe/contracts';
import type { CurrencyRate, TrackedEntry } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { createTradeClient } from '../trade/client.ts';
import { FIXTURE_WORKLOAD_PATH, pricingFixtureName, searchFixtureName } from './fixture-names.ts';
import { createFixtureHttpPort, readPricingFixtures } from './fixture-port.ts';
import { createPricingStep, FETCH_LIMIT } from './price-entry.ts';
import { itemTypesOf } from './search-body.ts';

/**
 * The parser against **real captured responses** (NFR-2): the searches and
 * fetches `pnpm fixtures:record` recorded for the fixture workload
 * (`FIXTURE_WORKLOAD_PATH`). The config file and the workload are read, never
 * written, because the fixture digests depend on them; the rates are pinned
 * below.
 */

const ROOT = new URL('../../../../', import.meta.url);
const FIXTURES_DIR = fileURLToPath(new URL('fixtures/', ROOT));
const NOW = '2026-09-26T12:00:00.000Z';

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(new URL(path, ROOT), 'utf8'));
}

const league = ConfigFileSchema.parse(readJson('data/config.json')).league;
/**
 * Pinned here rather than read from the player-maintained
 * `data/currencies.json`, so a routine rate edit cannot turn the suite red.
 * The recorded fixtures' digests do not depend on rates.
 */
const PINNED_AS_OF = '2026-09-26T00:00:00Z';
const rates: CurrencyRate[] = [
  { currencyId: 'divine', rate: 1, source: 'measured', league, asOf: PINNED_AS_OF },
  { currencyId: 'exalted', rate: 0.002012, source: 'measured', league, asOf: PINNED_AS_OF },
  { currencyId: 'chaos', rate: 0.13078, source: 'measured', league, asOf: PINNED_AS_OF },
];
const itemTypes = itemTypesOf(CatalogueItemsFileSchema.parse(readJson('data/catalogue/items.json')));
const tracked = TrackedFileSchema.parse(readJson(FIXTURE_WORKLOAD_PATH)).entries.filter(
  (entry) => entry.status !== 'pruned',
);

interface RecordedListing {
  readonly listing?: { readonly price?: { readonly amount?: number; readonly currency?: string } };
}

async function priceWithCaptures(entry: TrackedEntry) {
  const fixtures = await readPricingFixtures(FIXTURES_DIR);
  const http = createFixtureHttpPort(fixtures);
  const clock = createFakeClockPort(NOW);
  const step = createPricingStep({
    client: createTradeClient({ http, clock, wait: () => Promise.resolve(), userAgent: 'test (x@y.test)' }),
    league,
    rates,
    itemTypes,
    dataset: [],
    clock,
  });
  const result = await step(entry);
  return { fixtures, http, result };
}

describe('createPricingStep against the recorded captures', () => {
  it('has a recorded search for every non-pruned workload entry', async () => {
    expect(tracked.length).toBeGreaterThan(0);
    const fixtures = await readPricingFixtures(FIXTURES_DIR);
    for (const entry of tracked) {
      const name = searchFixtureName(entry, league, itemTypes);
      expect(fixtures.has(name), `${canonicalKey(entry)} → ${name}`).toBe(true);
    }
  });

  it.each(tracked.map((entry) => [canonicalKey(entry), entry] as const))(
    '%s: one search, one fetch of ≤10 ids, priced from the captured listings',
    async (_key, entry) => {
      const { fixtures, http, result } = await priceWithCaptures(entry);

      expect(http.requests.map((request) => request.method)).toEqual(['POST', 'GET']);
      const [search, fetch] = http.requests;
      const searchAnswer = JSON.parse(fixtures.get(pricingFixtureName(search ?? { method: 'POST', url: '' })) ?? '{}') as {
        id: string;
        result: string[];
      };
      const fetchIds = new URL(fetch?.url ?? '').pathname.split('/').at(-1)?.split(',') ?? [];
      expect(fetchIds.length).toBeLessThanOrEqual(FETCH_LIMIT);
      expect(fetchIds).toEqual(searchAnswer.result.slice(0, FETCH_LIMIT));

      const captured = (
        JSON.parse(fixtures.get(pricingFixtureName(fetch ?? { method: 'GET', url: '' })) ?? '{}') as {
          result: (RecordedListing | null)[];
        }
      ).result.filter((item) => item?.listing?.price?.amount !== undefined);

      expect(result.kind).toBe('completed');
      const priced = result.entry;
      expect(DatasetEntrySchema.parse(priced)).toEqual(priced);
      expect(priced?.lastSearchId).toBe(searchAnswer.id);
      expect(priced?.lastSearchLeague).toBe(league);
      expect(priced?.lastAttemptedAt).toBe(NOW);
      expect(priced?.price.state).toBe('priced');
      if (priced?.price.state === 'priced') {
        expect(priced.price.observation.sampleSize).toBe(captured.length);
        expect(priced.price.observation.league).toBe(league);
      }
    },
  );

  it('takes the lower median of the normalised captures', async () => {
    const prices: number[] = [];
    for (const entry of tracked) {
      const { result } = await priceWithCaptures(entry);
      if (result.entry?.price.state === 'priced') {
        prices.push(result.entry.price.observation.priceDivine);
      }
    }
    // Worked by hand from the five recorded fetches and the pinned rates above:
    // e.g. ten listings → the 5th of 10 is 55 ex × 0.002012 = 0.1107.
    expect(prices.toSorted((a, b) => a - b)).toEqual([0.1107, 0.2012, 1, 2, 100]);
  });
});
