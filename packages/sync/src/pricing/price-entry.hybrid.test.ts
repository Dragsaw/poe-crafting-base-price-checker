import { createFakeClockPort } from '@poe/contracts';
import type { CurrencyRate, HttpPort, TrackedEntry } from '@poe/contracts';
import { http, HttpResponse } from 'msw';
import type { SetupServer } from 'msw/node';
import { describe, expect, it } from 'vitest';

import { createTradeClient } from '../trade/client.ts';
import { tradeFetchUrl, tradeSearchUrl } from '../trade/endpoints.ts';
import { createPricingStep } from './price-entry.ts';
import { itemTypesOf } from './search-body.ts';

/**
 * SPEC-tracked-hybrid-mods CAP-2 against an MSW fixture: the search a hybrid
 * entry sends, as the trade server receives it. The shared server of
 * `test/setup.ts` answers; its no-network guard still fails any other request.
 * The port below is a plain `fetch` wrapper, so MSW intercepts it. It is not
 * the shell's real port, which only `shell-fetch.test.ts` may name.
 */

// The shared server lives outside this package's `rootDir`, so it is imported
// dynamically, as `web`'s `artifact-server.ts` does.
const SHARED_SETUP = `${(import.meta as ImportMeta & { readonly dirname: string }).dirname}/../../../../test/setup.ts`;

async function sharedServer(): Promise<SetupServer> {
  const setup = (await import(/* @vite-ignore */ SHARED_SETUP)) as { server: SetupServer };
  return setup.server;
}

const LEAGUE = 'Forbidden Rites';
const NOW = '2026-09-26T12:00:00.000Z';
const SEARCH_ID = 'Hy8rId';
const RESULT_IDS = ['id0', 'id1', 'id2'];

const RATES: CurrencyRate[] = [
  { currencyId: 'divine', rate: 1, source: 'measured', league: LEAGUE, asOf: '2026-09-26T00:00:00Z' },
];

const HYBRID_ENTRY: TrackedEntry = {
  kind: 'crafted',
  categoryId: 'weapon.bow',
  className: 'Bows',
  itemLevelMin: 75,
  prefix: {
    kind: 'hybrid',
    lines: [
      { statId: 'explicit.stat_1509134228', valueMin: 15, valueMax: 29 },
      { statId: 'explicit.stat_691932474' },
    ],
  },
  suffix: { kind: 'banded', statId: 'explicit.stat_3', valueMin: 40, valueMax: 49 },
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
    for (const [name, value] of response.headers.entries()) {
      headers[name.toLowerCase()] = value;
    }
    return { status: response.status, headers, body: await response.text() };
  },
};

describe('createPricingStep: a hybrid entry against an MSW trade server', () => {
  it('posts one filter per line in one and group, and prices from the answer', async () => {
    const server = await sharedServer();
    const received: unknown[] = [];
    server.use(
      http.post(tradeSearchUrl(LEAGUE), async ({ request }) => {
        received.push(await request.json());
        return HttpResponse.json({ id: SEARCH_ID, complexity: 1, result: RESULT_IDS, total: 3 });
      }),
      http.get(tradeFetchUrl(RESULT_IDS, SEARCH_ID), () =>
        HttpResponse.json({
          result: [1, 2, 3].map((amount, index) => ({
            id: `id${String(index)}`,
            listing: { price: { type: '~price', amount, currency: 'divine' } },
            item: {},
          })),
        }),
      ),
    );
    const clock = createFakeClockPort(NOW);
    const step = createPricingStep({
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

    const result = await step(HYBRID_ENTRY);

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      query: {
        stats: [
          {
            type: 'and',
            filters: [
              { id: 'explicit.stat_1509134228', value: { min: 15, max: 29 }, disabled: false },
              { id: 'explicit.stat_691932474', value: {}, disabled: false },
              { id: 'explicit.stat_3', value: { min: 40, max: 49 }, disabled: false },
            ],
          },
        ],
      },
    });
    expect(result.kind).toBe('completed');
    expect(result.entry?.price).toMatchObject({ state: 'priced', observation: { priceDivine: 2, sampleSize: 3 } });
  });
});
