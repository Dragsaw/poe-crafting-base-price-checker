/**
 * An offline `HttpPort` that serves the recorded pricing fixtures back
 * (NFR-1, NFR-2). `pnpm sync:dry` and the fixture-backed tests use it.
 *
 * A request is answered only where a fixture carries **its own name**
 * (`fixture-names.ts`: a digest of method, URL and body, or
 * `trade-data-leagues` for the league gate's GET). Every other request
 * rejects loudly with a message naming the missing fixture. The pricing step
 * yields only on a timeout or a network failure, so this rejection is
 * rethrown and fails the run, rather than yielding or pricing from an answer
 * to another question.
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { HttpPort, HttpRequest } from '@poe/contracts';

import { servedFixtureName } from './fixture-names.ts';

/** Fixture name (no extension) → the recorded body text. */
export type PricingFixtures = ReadonlyMap<string, string>;

const PRICING_FIXTURE_FILE = /^(trade-(?:search|fetch)-[0-9a-f]+|trade-data-leagues)\.json$/;

/**
 * Reads every `trade-search-*` and `trade-fetch-*` file of a directory, and
 * `trade-data-leagues.json`, which the league gate's GET is served from.
 */
export async function readPricingFixtures(directory: string): Promise<PricingFixtures> {
  const fixtures = new Map<string, string>();
  const entries = await readdir(directory);
  const names = entries.toSorted((a, b) => Number(a > b) - Number(a < b));
  const read = await Promise.allSettled(
    names.map(async (file) => {
      const name = PRICING_FIXTURE_FILE.exec(file)?.[1];
      return name === undefined ? undefined : ([name, await readFile(join(directory, file), { encoding: 'utf8' })] as const);
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
