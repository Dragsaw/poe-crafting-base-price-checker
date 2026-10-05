// Every search shares one URL, so a fixture is named for its request (kind plus digest of
// method, URL and body): a changed request is unfixtured, never a stale answer (NFR-2, AD-13).

import { createHash } from 'node:crypto';

import type { HttpRequest, LeagueId, TrackedEntry } from '@poe/contracts';

import { TRADE_LEAGUES_URL, tradeSearchUrl } from '../trade/endpoints.ts';
import { buildSearchBody } from './search-body.ts';
import type { ItemTypes } from './search-body.ts';

/** Long enough that two distinct requests never share a name in practice. */
const DIGEST_LENGTH = 16;

export type PricingFixtureRequest = Pick<HttpRequest, 'method' | 'url' | 'body'>;

function requestDigest(request: PricingFixtureRequest): string {
  return createHash('sha256')
    .update(`${request.method} ${request.url}\n${request.body ?? ''}`)
    .digest('hex')
    .slice(0, DIGEST_LENGTH);
}

/** `trade-search-<digest>` for a POST, `trade-fetch-<digest>` for a GET. */
export function pricingFixtureName(request: PricingFixtureRequest): string {
  const kind = request.method === 'POST' ? 'search' : 'fetch';
  return `trade-${kind}-${requestDigest(request)}`;
}

/** The leagues GET has no body and one URL, so it is named for the interaction, not by digest. */
export const LEAGUES_FIXTURE_NAME = 'trade-data-leagues';

/** The leagues fixture for the league gate's GET, the digest name for every pricing request. */
export function servedFixtureName(request: PricingFixtureRequest): string {
  return request.method === 'GET' && request.url === TRADE_LEAGUES_URL && request.body === undefined ? LEAGUES_FIXTURE_NAME : pricingFixtureName(request);
}

// Not `data/tracked.json`: the player's list changes freely. Editing this file changes the
// digests, so it needs a new `pnpm fixtures:record` (AGENT-WORKFLOW.md, Fixture hygiene).
export const FIXTURE_WORKLOAD_PATH = 'fixtures/tracked.json';

/** The name of the search fixture that answers `entry`'s pricing search. */
export function searchFixtureName(entry: TrackedEntry, league: LeagueId, itemTypes: ItemTypes): string {
  return pricingFixtureName({
    method: 'POST',
    url: tradeSearchUrl(league),
    body: JSON.stringify(buildSearchBody(entry, itemTypes)),
  });
}
