// The pricing step yields only on a timeout or network failure, so an unfixtured request's
// rejection fails the run instead of pricing from another question's answer (NFR-1, NFR-2).

import { readdir, readFile } from 'node:fs/promises';
import nodePath from 'node:path';

import type { HttpPort, HttpRequest } from '@poe/contracts';

import { servedFixtureName } from './fixture-names.ts';

/** Fixture name (no extension) → the recorded body text. */
export type PricingFixtures = ReadonlyMap<string, string>;

const PRICING_FIXTURE_FILE = /^(trade-(?:search|fetch)-[0-9a-f]+|trade-data-leagues)\.json$/;

/** Reads every `trade-search-*`, `trade-fetch-*` and `trade-data-leagues` file of a directory. */
export async function readPricingFixtures(directory: string): Promise<PricingFixtures> {
  const fixtures = new Map<string, string>();
  const entries = await readdir(directory);
  const names = entries.toSorted((a, b) => Number(a > b) - Number(a < b));
  const read = await Promise.allSettled(
    names.map(async (file) => {
      const name = PRICING_FIXTURE_FILE.exec(file)?.[1];
      return name === undefined ? undefined : ([name, await readFile(nodePath.join(directory, file), { encoding: 'utf8' })] as const);
    }),
  );
  for (const settled of read) {
    if (settled.status === 'rejected') {
      throw settled.reason;
    }
    if (settled.value !== undefined) {
      fixtures.set(settled.value[0], settled.value[1]);
    }
  }
  return fixtures;
}

export interface FixtureHttpPort extends HttpPort {
  /** Every request sent, in order. */
  readonly requests: readonly HttpRequest[];
}

export function createFixtureHttpPort(fixtures: PricingFixtures): FixtureHttpPort {
  const requests: HttpRequest[] = [];
  return {
    requests,
    send(request) {
      requests.push(request);
      const name = servedFixtureName(request);
      const body = fixtures.get(name);
      return body === undefined ? Promise.reject(
          new Error(
            `[fixture-http] no recorded fixture ${name} for ${request.method} ${request.url} — run pnpm fixtures:record (NFR-2)`,
          ),
        ) : Promise.resolve({ status: 200, headers: {}, body });
    },
  };
}
