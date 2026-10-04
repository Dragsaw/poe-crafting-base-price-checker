import { createFakeClockPort, createFakeHttpPort } from '@poe/contracts';
import type { HttpRequest, TrackedEntry } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { FIXTURE_INTERACTIONS, fixturePathOf, recordFixtures, REDACTED } from '../fixtures-record.ts';
import { pricingFixtureName } from '../pricing/fixture-names.ts';
import { buildSearchBody, itemTypesOf } from '../pricing/search-body.ts';
import { tradeFetchUrl, tradeSearchUrl } from '../trade/endpoints.ts';
import { CONTACT, fixturesFor, respond } from './test-support.ts';

const RATE_LIMIT_HEADERS = {
  'x-rate-limit-policy': 'trade-data-request-limit',
  'x-rate-limit-rules': 'Ip',
  'x-rate-limit-ip': '5:10:60',
  'x-rate-limit-ip-state': '1:10:0',
};

describe('recordFixtures: the search and fetch leg per tracked entry', () => {
  const league = 'Forbidden Rites';
  const itemTypes = itemTypesOf({ result: [] });
  const priced: TrackedEntry = { kind: 'raw', baseTypeId: 'Gold Amulet', itemLevelMin: 82, status: 'active' };
  const empty: TrackedEntry = { kind: 'raw', baseTypeId: 'Solar Amulet', itemLevelMin: 82, status: 'pinned' };
  const pruned: TrackedEntry = {
    kind: 'raw',
    baseTypeId: 'Wide Belt',
    itemLevelMin: 82,
    status: 'pruned',
    prunedReason: 'no market',
  };
  const resultIds = Array.from({ length: 12 }, (_, index) => `r${String(index)}`);

  function searchOf(entry: TrackedEntry) {
    return {
      method: 'POST' as const,
      url: tradeSearchUrl(league),
      body: JSON.stringify(buildSearchBody(entry, itemTypes)),
    };
  }
  const fetchOfPriced = { method: 'GET' as const, url: tradeFetchUrl(resultIds.slice(0, 10), 'S1') };

  /** The fake keys by method and URL; every search shares one URL, so answer by body. */
  function pricingHarness(searchStatus = 200) {
    const base = createFakeHttpPort({
      ...fixturesFor(RATE_LIMIT_HEADERS),
      [`GET ${fetchOfPriced.url}`]: respond(
        { result: [{ id: 'r0', listing: { account: { name: 'Someone#1' }, price: { amount: 1, currency: 'divine' } } }] },
        RATE_LIMIT_HEADERS,
      ),
    });
    const bodies = new Map([
      [searchOf(priced).body, { id: 'S1', result: resultIds, total: 12 }],
      [searchOf(empty).body, { id: 'S2', result: [], total: 0 }],
    ]);
    const requests: HttpRequest[] = [];
    const http = {
      send(request: HttpRequest) {
        requests.push(request);
        if (request.method === 'POST') {
          const answer = bodies.get(request.body ?? '');
          return answer === undefined
            ? Promise.reject(new Error('unfixtured search'))
            : Promise.resolve({ status: searchStatus, headers: RATE_LIMIT_HEADERS, body: JSON.stringify(answer) });
        }
        return base.send(request);
      },
    };
    const writes: { path: string; contents: string }[] = [];
    return {
      requests,
      writes,
      record: () =>
        recordFixtures(
          {
            http,
            clock: createFakeClockPort('2026-09-20T12:00:00.000Z'),
            wait: () => Promise.resolve(),
            userAgent: CONTACT,
            writeFixture: (path, contents) => {
              writes.push({ path, contents });
              return Promise.resolve();
            },
          },
          { league, entries: [priced, empty, pruned], itemTypes },
        ),
    };
  }

  it('records one search per non-pruned entry and one fetch of at most 10 ids where it found any', async () => {
    const harness = pricingHarness();

    const outcome = await harness.record();

    expect(outcome.ok).toBe(true);
    const pricing = harness.requests.slice(FIXTURE_INTERACTIONS.length);
    expect(pricing.map((request) => `${request.method} ${request.url}`)).toEqual([
      `POST ${searchOf(priced).url}`,
      `GET ${fetchOfPriced.url}`,
      `POST ${searchOf(empty).url}`,
    ]);
    expect(pricing[0]?.body).toBe(searchOf(priced).body);
    expect(pricing[0]?.headers['user-agent']).toBe(CONTACT);

    const names = harness.writes.map((write) => write.path).slice(FIXTURE_INTERACTIONS.length);
    expect(names).toEqual([
      fixturePathOf({ name: pricingFixtureName(searchOf(priced)) }),
      fixturePathOf({ name: pricingFixtureName(fetchOfPriced) }),
      fixturePathOf({ name: pricingFixtureName(searchOf(empty)) }),
    ]);
    expect(names.every((path) => /trade-(search|fetch)-[0-9a-f]{16}\.json$/.test(path))).toBe(true);
  });

  it('strips personal identifiers from the fetch payload', async () => {
    const harness = pricingHarness();
    await harness.record();
    const fetchWrite = harness.writes.find((write) => write.path.includes('trade-fetch-'));
    expect(fetchWrite?.contents).toContain(REDACTED);
    expect(fetchWrite?.contents).not.toContain('Someone#1');
  });

  it('writes nothing when a search is refused', async () => {
    const harness = pricingHarness(400);
    const outcome = await harness.record();
    expect(outcome.ok).toBe(false);
    expect(outcome.failure).toContain('trade-search-');
    expect(harness.writes).toEqual([]);
  });
});
