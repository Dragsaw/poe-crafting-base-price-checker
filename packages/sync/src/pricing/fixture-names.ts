/**
 * The names of the recorded pricing fixtures (NFR-2, AD-13).
 *
 * Every search goes to one URL, so a search fixture cannot be keyed by URL
 * alone. Each pricing fixture is instead named for **the request that produced
 * it**: its kind, then a digest of its method, URL and body. `fixtures:record`
 * writes under that name, and `pnpm sync:dry` serves a request back only where
 * a fixture of exactly that name exists — so a change to the search builder or
 * to the league is an unfixtured request that fails loudly, never a stale
 * answer served to a different question.
 */

import { createHash } from 'node:crypto';

import type { HttpRequest } from '@poe/contracts';

import { TRADE_LEAGUES_URL } from '../trade/endpoints.ts';

/** Long enough that two distinct requests never share a name in practice. */
const DIGEST_LENGTH = 16;

export type PricingFixtureRequest = Pick<HttpRequest, 'method' | 'url' | 'body'>;

export function requestDigest(request: PricingFixtureRequest): string {
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

/**
 * The recorded leagues answer, `fixtures/trade-data-leagues.json`. The leagues
 * GET carries no body and one fixed URL, so `fixtures:record` names it for the
 * interaction rather than by digest (`FIXTURE_INTERACTIONS`).
 */
export const LEAGUES_FIXTURE_NAME = 'trade-data-leagues';

/**
 * The fixture an offline run serves a request from: the leagues fixture for
 * the league gate's GET, the digest name for every pricing request.
 */
export function servedFixtureName(request: PricingFixtureRequest): string {
  if (request.method === 'GET' && request.url === TRADE_LEAGUES_URL && request.body === undefined) {
    return LEAGUES_FIXTURE_NAME;
  }
  return pricingFixtureName(request);
}
