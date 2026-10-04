/**
 * The pricing step: one Divine price per entry, one search and at most one fetch (FR-21, FR-23, AD-9, AD-16).
 */

import { canonicalKey } from '@poe/contracts';
import type {
  ClockPort,
  CurrencyRate,
  DatasetEntry,
  LeagueId,
  PriceState,
  TrackedEntry,
} from '@poe/contracts';

import { markUnresolvable } from '../chunk/catalogue-check.ts';
import type { ChunkStep, StepResult } from '../chunk/run-chunk.ts';
import { penaltyRetryAfterMs } from '../trade/client.ts';
import type { TradeClient, TradeResult } from '../trade/client.ts';
import { FETCH_LANE, SEARCH_LANE, tradeFetchUrl, tradeSearchUrl } from '../trade/endpoints.ts';
import { isTransportFailure } from '../trade/transport-failure.ts';
import { currentRates, lowerMedian, outputRate, toDivine } from './normalise.ts';
import { buildSearchBody, UnknownClassBaseTypeError } from './search-body.ts';
import type { ItemTypes } from './search-body.ts';
import { UnexpectedTradeResponseError } from './unexpected-trade-response-error.ts';

export { UnexpectedTradeResponseError } from './unexpected-trade-response-error.ts';

/** AD-16: the cheapest ten result ids are fetched, never more. */
export const FETCH_LIMIT = 10;

export type RequestKind = 'search' | 'fetch';

/**
 * A 4xx other than 429 would spend the Invalid Requests Threshold if repeated, so the chunk aborts (AD-9).
 */
export class MalformedRequestError extends Error {
  readonly entryKey: string;
  readonly requestKind: RequestKind;
  readonly status: number;
  readonly entry: DatasetEntry;

  constructor(entryKey: string, requestKind: RequestKind, status: number, entry: DatasetEntry) {
    super(`${entryKey}: the trade ${requestKind} answered ${String(status)}; the chunk is aborted`);
    this.name = 'MalformedRequestError';
    this.entryKey = entryKey;
    this.requestKind = requestKind;
    this.status = status;
    this.entry = entry;
  }
}

export interface PricingStepOptions {
  readonly client: TradeClient;
  /** The active league (AD-19). The caller reads it; this module never does. */
  readonly league: LeagueId;
  /** Every rate in `data/currencies.json`; only the current ones are used. */
  readonly rates: readonly CurrencyRate[];
  readonly itemTypes: ItemTypes;
  /** The published entries, so an unanswered attempt keeps what was there. */
  readonly dataset: readonly DatasetEntry[];
  readonly clock: ClockPort;
}

const NEVER_SYNCED: PriceState = { state: 'not-yet-synced', reason: 'never-synced' };

interface SearchAnswer {
  readonly id: string;
  readonly result: readonly string[];
}

interface Listing {
  readonly amount: number;
  readonly currency: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

function parseSearchAnswer(body: string): SearchAnswer | undefined {
  const data = parseJson(body);
  if (!isRecord(data)) {
    return undefined;
  }
  const { id, result } = data;
  if (typeof id !== 'string' || id === '' || !Array.isArray(result)) {
    return undefined;
  }
  return result.every((item): item is string => typeof item === 'string') ? { id, result } : undefined;
}

/** A `null` result or a listing with no readable price is not counted in `sampleSize`. */
function parseListings(body: string): Listing[] | undefined {
  const data = parseJson(body);
  if (!isRecord(data) || !Array.isArray(data['result'])) {
    return undefined;
  }
  const listings: Listing[] = [];
  const items = data['result'];
  for (const item of items) {
    if (!isRecord(item) || !isRecord(item['listing'])) {
      continue;
    }
    const price = item['listing']['price'];
    if (!isRecord(price)) {
      continue;
    }
    const { amount, currency } = price;
    if (typeof amount !== 'number' || typeof currency !== 'string' || currency === '' || !Number.isFinite(amount) || amount <= 0) {
      continue;
    }
    listings.push({ amount, currency });
  }
  return listings;
}

type Leg =
  | { readonly kind: 'answered'; readonly result: Extract<TradeResult, { kind: 'response' }> }
  | {
      readonly kind: 'yield';
      /** Set only on a `429` yield: the delay the client's yield carried (§5.3). */
      readonly retryAfterMs?: number;
      /** AD-30's downgrade (IMPLEMENTATION-NOTES.md §13.4): read as a request with no answer. */
      readonly sessionExpired?: true;
    }
  | { readonly kind: 'malformed'; readonly status: number };

/** The step's yield, carrying the leg's `retryAfterMs` where it has one. */
function yieldedWith(
  leg: Extract<Leg, { kind: 'yield' }>,
  entry: DatasetEntry,
): Extract<StepResult, { kind: 'yielded' }> {
  return {
    kind: 'yielded',
    entry,
    ...(leg.retryAfterMs !== undefined && { retryAfterMs: leg.retryAfterMs }),
    ...((leg.sessionExpired === true) && { sessionExpired: true }),
  };
}

const SERVER_ERROR = 500;

/** A timeout or a lost connection yields as a 429 and a 5xx do: server trouble stops the chunk. */
async function sendLeg(send: () => Promise<TradeResult>): Promise<Leg> {
  let result: TradeResult;
  try {
    result = await send();
  } catch (error) {
    if (isTransportFailure(error)) {
      return { kind: 'yield' };
    }
    throw error;
  }
  if (result.kind === 'yield') {
    if (result.reason === 'session-expired') {
      // The downgrading answer is discarded: AD-9's request with no answer.
      return { kind: 'yield', sessionExpired: true };
    }
    const retryAfterMs = penaltyRetryAfterMs(result);
    return retryAfterMs === undefined ? { kind: 'yield' } : { kind: 'yield', retryAfterMs };
  }
  const { status } = result.response;
  if (status >= SERVER_ERROR) {
    return { kind: 'yield' };
  }
  return status < 200 || status >= 300 ? { kind: 'malformed', status } : { kind: 'answered', result };
}

/** `no-exchange-rate` where any listing's currency has no current rate: nothing is stored unnormalised (AD-20). */
function priceOf(
  listings: readonly Listing[],
  rates: ReadonlyMap<string, CurrencyRate>,
  league: LeagueId,
  observedAt: string,
): PriceState {
  if (listings.length === 0) {
    return { state: 'no-listings' };
  }
  const normalised: { readonly value: number; readonly rate: CurrencyRate }[] = [];
  for (const listing of listings) {
    const rate = rates.get(listing.currency);
    if (rate === undefined) {
      return { state: 'not-yet-synced', reason: 'no-exchange-rate' };
    }
    normalised.push({ value: toDivine(listing.amount, rate), rate });
  }
  const priceDivine = lowerMedian(normalised.map((listing) => listing.value));
  // The exchange observation is the one behind the median listing itself.
  const median = normalised.find((listing) => listing.value === priceDivine);
  if (median === undefined) {
    throw new RangeError('priceOf: the median is not one of the listings');
  }
  return {
    state: 'priced',
    observation: {
      league,
      observedAt,
      priceDivine,
      sampleSize: normalised.length,
      exchangeObservation: outputRate(median.rate),
    },
  };
}

export function createPricingStep(options: PricingStepOptions): ChunkStep {
  const { client, league, itemTypes, clock } = options;
  const rates = currentRates(options.rates, league);
  const published = new Map(options.dataset.map((entry) => [entry.entryKey, entry]));

  return async (tracked: TrackedEntry): Promise<StepResult> => {
    const entryKey = canonicalKey(tracked);
    // Built first: a jewel-arm miss is decided before any request.
    let body: string;
    try {
      body = JSON.stringify(buildSearchBody(tracked, itemTypes));
    } catch (error) {
      if (!(error instanceof UnknownClassBaseTypeError)) {
        throw error;
      }
      // AD-25: the entry is marked and reported, no search is issued, and the
      // chunk continues. Offline work stamps nothing.
      return {
        kind: 'completed',
        entry: markUnresolvable(entryKey, published.get(entryKey)),
        records: [
          {
            kind: 'unresolvable',
            entryKey,
            identifier: error.baseTypeId,
            identifierKind: 'baseTypeId',
          },
        ],
      };
    }
    const before: DatasetEntry = published.get(entryKey) ?? { entryKey, price: NEVER_SYNCED };

    const attemptedAt = clock.now();
    const stamped: DatasetEntry = { ...before, lastAttemptedAt: attemptedAt };

    const search = await sendLeg(() =>
      // Cookie-eligible: the governor probes on the first answered search and
      // attaches the session cookie once it is live (AD-30).
      client.send({ method: 'POST', url: tradeSearchUrl(league), body, lane: SEARCH_LANE, cookieEligible: true }),
    );
    if (search.kind === 'yield') {
      return yieldedWith(search, stamped);
    }
    if (search.kind === 'malformed') {
      throw new MalformedRequestError(entryKey, 'search', search.status, stamped);
    }

    const answer = parseSearchAnswer(search.result.response.body);
    if (answer === undefined) {
      throw new UnexpectedTradeResponseError(entryKey, 'search', 'no top-level `id` and `result`', stamped);
    }
    // An answered search sets the search fields, whatever the answer holds (AD-16).
    const searched: DatasetEntry = {
      ...stamped,
      lastSearchId: answer.id,
      lastSearchLeague: league,
    };
    const searchRemaining = search.result.remaining;

    if (answer.result.length === 0) {
      return {
        kind: 'completed',
        entry: { ...searched, price: { state: 'no-listings' } },
        ...(searchRemaining !== undefined && { searchRemaining }),
      };
    }

    const ids = answer.result.slice(0, FETCH_LIMIT);
    const fetched = await sendLeg(() =>
      client.send({ method: 'GET', url: tradeFetchUrl(ids, answer.id), lane: FETCH_LANE, cookieEligible: true }),
    );
    // The unit is the request (AD-9): a fetch that yields or answers 4xx keeps
    // the answered search's fields, and the price state stays as published.
    if (fetched.kind === 'yield') {
      return yieldedWith(fetched, searched);
    }
    if (fetched.kind === 'malformed') {
      throw new MalformedRequestError(entryKey, 'fetch', fetched.status, searched);
    }

    const listings = parseListings(fetched.result.response.body);
    if (listings === undefined) {
      throw new UnexpectedTradeResponseError(entryKey, 'fetch', 'no top-level `result` array', searched);
    }
    const fetchRemaining = fetched.result.remaining;

    return {
      kind: 'completed',
      entry: { ...searched, price: priceOf(listings, rates, league, attemptedAt) },
      ...(searchRemaining !== undefined && { searchRemaining }),
      ...(fetchRemaining !== undefined && { fetchRemaining }),
    };
  };
}
