import { readFileSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { LeaguesPayloadSchema } from '@poe/contracts';
import { describe, expect, it, vi } from 'vitest';

import { rejectionOf } from '../test-support/rejection-of.ts';
import { TRADE_LEAGUES_URL } from '../trade/endpoints.ts';
import { LEAGUES_FIXTURE_NAME, pricingFixtureName, servedFixtureName } from './fixture-names.ts';
import { createFixtureHttpPort, readPricingFixtures } from './fixture-port.ts';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return { ...actual, readFile: vi.fn(actual.readFile) };
});

const FIXTURES_DIR = fileURLToPath(new URL('../../../../fixtures/', import.meta.url));

describe('the offline fixture port', () => {
  it('names the league gate GET for the recorded leagues interaction, and nothing else', () => {
    expect(servedFixtureName({ method: 'GET', url: TRADE_LEAGUES_URL })).toBe(LEAGUES_FIXTURE_NAME);
    const search = { method: 'POST', url: 'https://example.test/search', body: '{}' } as const;
    expect(servedFixtureName(search)).toBe(pricingFixtureName(search));
    const queried = { method: 'GET', url: `${TRADE_LEAGUES_URL}?x=1` } as const;
    expect(servedFixtureName(queried)).toBe(pricingFixtureName(queried));
  });

  it('reads the recorded leagues fixture beside the pricing fixtures', async () => {
    const fixtures = await readPricingFixtures(FIXTURES_DIR);

    expect(fixtures.get(LEAGUES_FIXTURE_NAME)).toBe(
      readFileSync(`${FIXTURES_DIR}trade-data-leagues.json`, 'utf8'),
    );
    // The catalogue captures are not pricing answers and stay unserved.
    expect([...fixtures.keys()].filter((name) => name.startsWith('trade-data-'))).toEqual([
      LEAGUES_FIXTURE_NAME,
    ]);
  });

  it('surfaces the first unreadable fixture in sorted order, however the reads settle', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'poe-fixture-port-'));
    const names = ['trade-search-aa', 'trade-search-bb', 'trade-search-cc'];
    const original = vi.mocked(readFile).getMockImplementation();
    try {
      await Promise.all(names.map((name) => writeFile(path.join(directory, `${name}.json`), name)));
      const fixtures = await readPricingFixtures(directory);
      const order: string[] = [];
      fixtures.forEach((_body, name) => {
        order.push(name);
      });
      expect(order).toEqual(names);

      const failures = new Map([
        ['trade-search-bb.json', 20],
        ['trade-search-cc.json', 0],
      ]);
      vi.mocked(readFile).mockImplementation(async (file, options) => {
        const delay = failures.get(path.basename(String(file)));
        if (delay === undefined) {
          return original?.(file, options) ?? '';
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
        throw new Error(String(file));
      });

      const failure = await rejectionOf(readPricingFixtures(directory));
      expect(failure).toHaveProperty('message', path.join(directory, 'trade-search-bb.json'));
    } finally {
      vi.mocked(readFile).mockImplementation(original ?? (async () => ''));
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('serves the recorded leagues answer for GET TRADE_LEAGUES_URL', async () => {
    const http = createFixtureHttpPort(await readPricingFixtures(FIXTURES_DIR));

    const response = await http.send({ method: 'GET', url: TRADE_LEAGUES_URL, headers: {} });

    expect(response.status).toBe(200);
    const leagues = LeaguesPayloadSchema.parse(JSON.parse(response.body));
    expect(leagues.result.map((league) => league.id)).toContain('Forbidden Rites');
    expect(http.requests).toHaveLength(1);
  });

  it('still rejects an unrecorded request, naming the missing fixture', async () => {
    const http = createFixtureHttpPort(new Map());

    await expect(http.send({ method: 'GET', url: TRADE_LEAGUES_URL, headers: {} })).rejects.toThrow(
      /no recorded fixture trade-data-leagues/,
    );
  });
});
