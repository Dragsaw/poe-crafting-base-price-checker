/**
 * The pricing step: one Divine price estimate for one tracked entry (FR-21,
 * FR-23, AD-16, AD-20).
 *
 * For each entry it builds the AD-16 search from the entry alone, sends **one
 * search** and **at most one fetch** of the cheapest 10 result ids through the
 * governed client, normalises every listing to divine once, and takes the
 * lower median. It returns the updated `DatasetEntry` to the chunk runner and
 * writes nothing.
 *
 * The consequences of a request, by cause (AD-9):
 *
 * | Answer | Entry | Chunk |
 * | --- | --- | --- |
 * | search answered | `lastSearchId`, `lastSearchLeague`, `lastAttemptedAt` set, whatever the fetch returns | — |
 * | 429, 5xx, timeout | `lastAttemptedAt` stamped, price state kept; the search fields unchanged on the search, set on the fetch | yields |
 * | any other 4xx | `lastAttemptedAt` stamped, price state kept; the search fields unchanged on the search, set on the fetch | `MalformedRequestError` thrown |
 * | none: the `jewel` arm derives a base type `items.json` lacks | `unresolvable`, nothing stamped, a `baseTypeId` record | continues |
 *
 * The league, the rates and the item types arrive as values; this module
 * names no player file.
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

/** AD-16: the cheapest ten result ids are fetched, never more. */
export const FETCH_LIMIT = 10;

export type RequestKind = 'search' | 'fetch';

/**
 * A 4xx other than 429: the request itself was wrong, and repeating it would
 * spend the Invalid Requests Threshold. The chunk aborts; the runner releases
 * the lock and rethrows. `entry` is the dataset entry with `lastAttemptedAt`
 * stamped and the price state unchanged. Story 1.9 turns it into a record.
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

/**
 * A 2xx whose body is not the shape the trade site returns. It is not a
 * request fault and not a rate limit, so it is neither counted nor yielded:
 * the chunk aborts loudly and names the entry.
 */
export class UnexpectedTradeResponseError extends Error {
  readonly entryKey: string;
  readonly requestKind: RequestKind;

  constructor(entryKey: string, requestKind: RequestKind, detail: string) {
    super(`${entryKey}: the trade ${requestKind} answered an unexpected body: ${detail}`);
    this.name = 'UnexpectedTradeResponseError';
    this.entryKey = entryKey;
    this.requestKind = requestKind;
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
  if (!result.every((item): item is string => typeof item === 'string')) {
    return undefined;
  }
  return { id, result };
}

/**
 * The priced listings of a fetch answer. A `null` result (a listing gone since
 * the search) or a listing with no readable price is not a priced listing, so
 * it is not counted in `sampleSize`.
 */
function parseListings(body: string): Listing[] | undefined {
  const data = parseJson(body);
  if (!isRecord(data) || !Array.isArray(data['result'])) {
    return undefined;
  }
  const listings: Listing[] = [];
  for (const item of data['result']) {
    if (!isRecord(item) || !isRecord(item['listing'])) {
      continue;
    }
    const price = item['listing']['price'];
    if (!isRecord(price)) {
      continue;
    }
    const { amount, currency } = price;
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      continue;
    }
    if (typeof currency !== 'string' || currency === '') {
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
    ...(leg.retryAfterMs === undefined ? {} : { retryAfterMs: leg.retryAfterMs }),
  };
}

const SERVER_ERROR = 500;

/**
 * One request's consequence. A timeout or a lost connection yields exactly as
 * a 429 and a 5xx do: server trouble stops the chunk.
 */
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
    const retryAfterMs = penaltyRetryAfterMs(result);
    return retryAfterMs === undefined ? { kind: 'yield' } : { kind: 'yield', retryAfterMs };
  }
  const { status } = result.response;
  if (status >= SERVER_ERROR) {
    return { kind: 'yield' };
  }
  if (status < 200 || status >= 300) {
    return { kind: 'malformed', status };
  }
  return { kind: 'answered', result };
}

/**
 * The priced state from a set of listings, or `no-exchange-rate` where any one
 * listing's currency has no current rate: no listing is stored unnormalised
 * (AD-20).
 */
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
      client.send({ method: 'POST', url: tradeSearchUrl(league), body, lane: SEARCH_LANE }),
    );
    if (search.kind === 'yield') {
      return yieldedWith(search, stamped);
    }
    if (search.kind === 'malformed') {
      throw new MalformedRequestError(entryKey, 'search', search.status, stamped);
    }

    const answer = parseSearchAnswer(search.result.response.body);
    if (answer === undefined) {
      throw new UnexpectedTradeResponseError(entryKey, 'search', 'no top-level `id` and `result`');
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
        ...(searchRemaining === undefined ? {} : { searchRemaining }),
      };
    }

    const ids = answer.result.slice(0, FETCH_LIMIT);
    const fetched = await sendLeg(() =>
      client.send({ method: 'GET', url: tradeFetchUrl(ids, answer.id), lane: FETCH_LANE }),
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
      throw new UnexpectedTradeResponseError(entryKey, 'fetch', 'no top-level `result` array');
    }
    const fetchRemaining = fetched.result.remaining;

    return {
      kind: 'completed',
      entry: { ...searched, price: priceOf(listings, rates, league, attemptedAt) },
      ...(searchRemaining === undefined ? {} : { searchRemaining }),
      ...(fetchRemaining === undefined ? {} : { fetchRemaining }),
    };
  };
}
