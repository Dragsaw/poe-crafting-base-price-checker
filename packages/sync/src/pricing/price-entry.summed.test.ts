import { createFakeClockPort } from '@poe/contracts';
import type { CraftedTrackedEntry, CurrencyRate, HttpPort, ModifierWeight, TrackedEntry } from '@poe/contracts';
import { contains } from '@poe/core';
import { http, HttpResponse } from 'msw';
import type { SetupServerApi } from 'msw/node';
import { describe, expect, it } from 'vitest';

import { createTradeClient } from '../trade/client.ts';
import { TRADE_API_BASE, tradeFetchUrl, tradeSearchUrl } from '../trade/endpoints.ts';
import { createPricingStep } from './price-entry.ts';
import { itemTypesOf } from './search-body.ts';

/**
 * SPEC-tracked-hybrid-mods CAP-6 against an MSW fixture: the search an entry
 * with a summed `statId` sends, as the trade server receives it, and the
 * divergence AD-16 accepts (IMPLEMENTATION-NOTES.md §5.5). The shared server
 * of `test/setup.ts` answers; its no-network guard still fails any other
 * request. The port below is a plain `fetch` wrapper, so MSW intercepts it. It
 * is not the shell's real port, which only `shell-fetch.test.ts` may name.
 */

// The shared server lives outside this package's `rootDir`, so it is imported
// dynamically, as `web`'s `artifact-server.ts` does.
const SHARED_SETUP = `${(import.meta as ImportMeta & { readonly dirname: string }).dirname}/../../../../test/setup.ts`;

async function sharedServer(): Promise<SetupServerApi> {
  const setup = (await import(/* @vite-ignore */ SHARED_SETUP)) as { server: SetupServerApi };
  return setup.server;
}

const LEAGUE = 'Forbidden Rites';
const NOW = '2026-10-04T12:00:00.000Z';
const SEARCH_ID = 'Sum3dId';

const RARITY = 'explicit.stat_3917489142';
const PHYS = 'explicit.stat_1509134228';
const ACCURACY = 'explicit.stat_691932474';
const LIGHT = 'explicit.stat_1263695895';

const RATES: CurrencyRate[] = [
  { currencyId: 'divine', rate: 1, source: 'measured', league: LEAGUE, asOf: '2026-10-04T00:00:00Z' },
];

/** `data/tracked.json` entry 161: Amulets, T1 rarity prefix and T1 rarity suffix. */
const RARITY_ENTRY: CraftedTrackedEntry = {
  kind: 'crafted',
  categoryId: 'accessory.amulet',
  className: 'Amulets',
  itemLevelMin: 82,
  prefix: { kind: 'banded', statId: RARITY, valueMin: 16, valueMax: 19, acceptedTier: 'T1' },
  suffix: { kind: 'banded', statId: RARITY, valueMin: 15, valueMax: 18, acceptedTier: 'T1' },
  status: 'active',
};

/** The Bows phys%+accuracy hybrid T1 prefix with the `LightRadiusAndAccuracy` T1 suffix. */
const BOWS_ENTRY: TrackedEntry = {
  kind: 'crafted',
  categoryId: 'weapon.bow',
  className: 'Bows',
  itemLevelMin: 81,
  prefix: {
    kind: 'hybrid',
    lines: [
      { statId: PHYS, valueMin: 75, valueMax: 79 },
      { statId: ACCURACY, valueMin: 175, valueMax: 200 },
    ],
  },
  suffix: {
    kind: 'hybrid',
    lines: [
      { statId: LIGHT, valueMin: 15, valueMax: 15 },
      { statId: ACCURACY, valueMin: 41, valueMax: 60 },
    ],
  },
  status: 'active',
};

const fetchPort: HttpPort = {
  async send(request) {
    const response = await fetch(request.url, {
      method: request.method,
      headers: { ...request.headers },
      body: request.body,
    });
    const headers: Record<string, string> = {};
    response.headers.forEach((value, name) => {
      headers[name.toLowerCase()] = value;
    });
    return { status: response.status, headers, body: await response.text() };
  },
};

function stepFor() {
  const clock = createFakeClockPort(NOW);
  return createPricingStep({
    client: createTradeClient({
      http: fetchPort,
      clock,
      wait: () => Promise.resolve(),
      userAgent: 'test (x@y.test)',
    }),
    league: LEAGUE,
    rates: RATES,
    itemTypes: itemTypesOf({ result: [] }),
    dataset: [],
    clock,
  });
}

interface Listing {
  readonly id: string;
  readonly prefixRarity: number;
  readonly suffixRarity: number;
  readonly amount: number;
}

/**
 * A trade server over a small listing table. It answers a search the way trade
 * answers one filter on a `statId` two mods carry: it compares the filter
 * with the **sum** of the two mods' values (§5.1d, AD-16).
 */
async function tradeServerOver(listings: readonly Listing[], received: unknown[]): Promise<void> {
  const server = await sharedServer();
  const matched = (body: unknown): readonly Listing[] => {
    const filters = (body as { query: { stats: [{ filters: { id: string; value: { min?: number; max?: number } }[] }] } })
      .query.stats[0].filters;
    return listings.filter((listing) =>
      filters.every((filter) => {
        const value = filter.id === RARITY ? listing.prefixRarity + listing.suffixRarity : undefined;
        return (
          value !== undefined &&
          (filter.value.min === undefined || value >= filter.value.min) &&
          (filter.value.max === undefined || value <= filter.value.max)
        );
      }),
    );
  };
  let answered: readonly Listing[] = [];
  server.use(
    http.post(tradeSearchUrl(LEAGUE), async ({ request }) => {
      const body = await request.json();
      received.push(body);
      answered = matched(body);
      const ids = answered.map((listing) => listing.id);
      return HttpResponse.json({ id: SEARCH_ID, complexity: 1, result: ids, total: ids.length });
    }),
    // The fetch names whichever ids the search answered; the response is that answer's listings.
    http.get(`${TRADE_API_BASE}/fetch/:ids`, () =>
      HttpResponse.json({
        result: answered.map((listing) => ({
          id: listing.id,
          listing: { price: { type: '~price', amount: listing.amount, currency: 'divine' } },
          item: {},
        })),
      }),
    ),
  );
}

/** One weights tier on one rarity line, as `data/weights.json` publishes it for Amulets. */
function rarityTier(sourceModifierId: string, min: number, max: number): ModifierWeight {
  return {
    sourceModifierId,
    modGroup: sourceModifierId.replace(/\d+$/, ''),
    itemLevelMin: 1,
    weight: 1000,
    weightSource: 'published',
    lines: [{ statId: RARITY, ranges: [[min, max]] }],
  };
}

describe('createPricingStep: a summed statId against an MSW trade server (CAP-6)', () => {
  it('posts one rarity filter whose edges are the sums', async () => {
    const received: unknown[] = [];
    await tradeServerOver([{ id: 't1t1', prefixRarity: 16, suffixRarity: 15, amount: 2 }], received);

    const result = await stepFor()(RARITY_ENTRY);

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      query: { stats: [{ type: 'and', filters: [{ id: RARITY, value: { min: 31, max: 37 }, disabled: false }] }] },
    });
    expect(result.kind).toBe('completed');
  });

  it('posts the Bows hybrid with LightRadiusAndAccuracy as one summed accuracy filter, with no id repeated', async () => {
    const server = await sharedServer();
    const received: unknown[] = [];
    server.use(
      http.post(tradeSearchUrl(LEAGUE), async ({ request }) => {
        received.push(await request.json());
        return HttpResponse.json({ id: SEARCH_ID, complexity: 1, result: ['b0'], total: 1 });
      }),
      http.get(tradeFetchUrl(['b0'], SEARCH_ID), () =>
        HttpResponse.json({
          result: [{ id: 'b0', listing: { price: { type: '~price', amount: 4, currency: 'divine' } }, item: {} }],
        }),
      ),
    );

    const result = await stepFor()(BOWS_ENTRY);

    expect(received).toHaveLength(1);
    const [body] = received as [{ query: { stats: [{ type: string; filters: { id: string }[] }] } }];
    expect(body.query.stats).toEqual([
      {
        type: 'and',
        filters: [
          { id: PHYS, value: { min: 75, max: 79 }, disabled: false },
          { id: ACCURACY, value: { min: 216, max: 260 }, disabled: false },
          { id: LIGHT, value: { min: 15, max: 15 }, disabled: false },
        ],
      },
    ]);
    const ids = body.query.stats[0].filters.map((filter) => filter.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(result.kind).toBe('completed');
    expect(result.entry?.price).toMatchObject({ state: 'priced', observation: { priceDivine: 4, sampleSize: 1 } });
  });

  it('prices a low T2 prefix with a high T1 suffix, which per-slot containment excludes (the accepted divergence)', async () => {
    const received: unknown[] = [];
    await tradeServerOver(
      [
        { id: 't1t1', prefixRarity: 16, suffixRarity: 15, amount: 3 },
        // 15 is the top of the T2 prefix [12, 15]; 18 the top of the T1 suffix [15, 18]. 33 is in [31, 37].
        { id: 't2t1', prefixRarity: 15, suffixRarity: 18, amount: 1 },
        { id: 't2t2', prefixRarity: 12, suffixRarity: 11, amount: 1 },
      ],
      received,
    );

    const result = await stepFor()(RARITY_ENTRY);

    // The summed filter admits the T2+T1 listing, so it is in the priced set.
    expect(result.kind).toBe('completed');
    expect(result.entry?.price).toMatchObject({ state: 'priced', observation: { sampleSize: 2 } });

    // The probability reads per-slot containment, which excludes that listing's prefix tier.
    const prefixT1 = rarityTier('ItemFoundRarityIncreasePrefix47', 16, 19);
    const prefixT2 = rarityTier('ItemFoundRarityIncreasePrefix29', 12, 15);
    const suffixT1 = rarityTier('ItemFoundRarityIncrease40', 15, 18);
    expect(contains(RARITY_ENTRY.prefix, prefixT1)).toBe(true);
    expect(contains(RARITY_ENTRY.prefix, prefixT2)).toBe(false);
    expect(contains(RARITY_ENTRY.suffix, suffixT1)).toBe(true);
  });
});
