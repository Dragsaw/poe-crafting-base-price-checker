/**
 * The pricing step: one Divine price per entry, one search, one fetch at most (FR-21, FR-23, AD-9).
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
import type { TradeClient } from '../trade/client.ts';
import { FETCH_LANE, SEARCH_LANE, tradeFetchUrl, tradeSearchUrl } from '../trade/endpoints.ts';
import { currentRates, lowerMedian, outputRate, toDivine } from './normalise.ts';
import { sendLeg, yieldedWith } from './price-entry-leg.ts';
import { buildSearchBody, UnknownClassBaseTypeError } from './search-body.ts';
import type { ItemTypes } from './search-body.ts';
import { UnexpectedTradeResponseError } from './unexpected-trade-response-error.ts';

export { UnexpectedTradeResponseError } from './unexpected-trade-response-error.ts';

/** AD-16: the cheapest ten result ids are fetched, never more. */
export const FETCH_LIMIT = 10;

export type RequestKind = 'search' | 'fetch';

/**
 * A 4xx other than 429 would spend the Invalid Requests Threshold if repeated: abort (AD-9).
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
function listingOf(item: unknown): Listing | undefined {
  if (!isRecord(item) || !isRecord(item['listing'])) {
    return undefined;
  }
  const price = item['listing']['price'];
  if (!isRecord(price)) {
    return undefined;
  }
  const { amount, currency } = price;
  const isReadable =
    typeof amount === 'number' && typeof currency === 'string' && currency !== '' && Number.isFinite(amount) && amount > 0;
  return isReadable ? { amount, currency } : undefined;
}

function parseListings(body: string): Listing[] | undefined {
  const data = parseJson(body);
  if (!isRecord(data) || !Array.isArray(data['result'])) {
    return undefined;
  }
  const items: unknown[] = data['result'];
  return items.flatMap((item) => listingOf(item) ?? []);
}

/** `no-exchange-rate` where a listing's currency has no rate: nothing unnormalised (AD-20). */
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

interface StepContext {
  readonly client: TradeClient;
  readonly league: LeagueId;
  readonly itemTypes: ItemTypes;
  readonly clock: ClockPort;
  readonly rates: ReadonlyMap<string, CurrencyRate>;
  readonly published: ReadonlyMap<string, DatasetEntry>;
}

type Yielded = Extract<StepResult, { kind: 'yielded' }>;

interface Searched {
  readonly kind: 'searched';
  readonly answer: SearchAnswer;
  readonly entry: DatasetEntry;
  readonly remaining: number | undefined;
}

interface Fetched {
  readonly kind: 'fetched';
  readonly listings: readonly Listing[];
  readonly remaining: number | undefined;
}

type BuiltSearch =
  | { readonly kind: 'body'; readonly body: string }
  | { readonly kind: 'unresolvable'; readonly error: UnknownClassBaseTypeError };

// Built first: a jewel-arm miss is decided before any request.
function serialisedSearch(tracked: TrackedEntry, itemTypes: ItemTypes): BuiltSearch {
  try {
    return { kind: 'body', body: JSON.stringify(buildSearchBody(tracked, itemTypes)) };
  } catch (error) {
    if (error instanceof UnknownClassBaseTypeError) {
      return { kind: 'unresolvable', error };
    }
    throw error;
  }
}

// AD-25: the entry is marked and reported, no search is issued, and the chunk continues.
function unresolvableStep(
  error: UnknownClassBaseTypeError,
  entryKey: string,
  published: ReadonlyMap<string, DatasetEntry>,
): StepResult {
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

async function runSearch(
  context: StepContext,
  entryKey: string,
  body: string,
  stamped: DatasetEntry,
): Promise<Searched | Yielded> {
  const { client, league } = context;
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
  const entry: DatasetEntry = { ...stamped, lastSearchId: answer.id, lastSearchLeague: league };
  return { kind: 'searched', answer, entry, remaining: search.result.remaining };
}

async function runFetch(
  context: StepContext,
  entryKey: string,
  answer: SearchAnswer,
  searched: DatasetEntry,
): Promise<Fetched | Yielded> {
  const ids = answer.result.slice(0, FETCH_LIMIT);
  const fetched = await sendLeg(() =>
    context.client.send({ method: 'GET', url: tradeFetchUrl(ids, answer.id), lane: FETCH_LANE, cookieEligible: true }),
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
  return { kind: 'fetched', listings, remaining: fetched.result.remaining };
}

async function priceEntry(context: StepContext, tracked: TrackedEntry): Promise<StepResult> {
  const { league, clock, rates, published } = context;
  const entryKey = canonicalKey(tracked);
  const built = serialisedSearch(tracked, context.itemTypes);
  if (built.kind === 'unresolvable') {
    return unresolvableStep(built.error, entryKey, published);
  }
  const before: DatasetEntry = published.get(entryKey) ?? { entryKey, price: NEVER_SYNCED };

  const attemptedAt = clock.now();
  const stamped: DatasetEntry = { ...before, lastAttemptedAt: attemptedAt };

  const search = await runSearch(context, entryKey, built.body, stamped);
  if (search.kind === 'yielded') {
    return search;
  }
  const { answer, entry: searched, remaining: searchRemaining } = search;
  if (answer.result.length === 0) {
    return {
      kind: 'completed',
      entry: { ...searched, price: { state: 'no-listings' } },
      ...(searchRemaining !== undefined && { searchRemaining }),
    };
  }

  const fetch = await runFetch(context, entryKey, answer, searched);
  if (fetch.kind === 'yielded') {
    return fetch;
  }
  const { listings, remaining: fetchRemaining } = fetch;
  return {
    kind: 'completed',
    entry: { ...searched, price: priceOf(listings, rates, league, attemptedAt) },
    ...(searchRemaining !== undefined && { searchRemaining }),
    ...(fetchRemaining !== undefined && { fetchRemaining }),
  };
}

export function createPricingStep(options: PricingStepOptions): ChunkStep {
  const { client, league, itemTypes, clock } = options;
  const context: StepContext = {
    client,
    league,
    itemTypes,
    clock,
    rates: currentRates(options.rates, league),
    published: new Map(options.dataset.map((entry) => [entry.entryKey, entry])),
  };
  return (tracked: TrackedEntry) => priceEntry(context, tracked);
}
