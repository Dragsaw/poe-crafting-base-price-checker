import { INITIAL_SCHEMA_VERSION } from '@poe/contracts';
import { CORE_PLACEHOLDER } from '@poe/core';

/**
 * Placeholder export. `sync` is the imperative shell: trade client, rate
 * governor, chunk runner, lock and writers. It may import `@poe/contracts` and
 * `@poe/core`, and never `@poe/web`.
 */
export const SYNC_PLACEHOLDER = `${CORE_PLACEHOLDER}:sync`;

export const SYNC_CONTRACTS_SCHEMA_VERSION = INITIAL_SCHEMA_VERSION;

/**
 * The one governed trade request path (FR-20, AD-8). `createTradeClient` is the
 * **only** exported way to make a trade request, and `HttpPort` is deliberately
 * not re-exported from `sync`: a second call site that wanted to build its own
 * request would have to reach into `@poe/contracts` for the port, which makes
 * the violation visible rather than convenient.
 */
export { createTradeClient } from './trade/client';
export type {
  TradeClient,
  TradeClientOptions,
  TradeRequest,
  TradeResponseResult,
  TradeResult,
  TradeYieldReason,
  TradeYieldResult,
} from './trade/client';

export { MissingUserAgentError, resolveUserAgent, USER_AGENT_ENV_VAR } from './trade/user-agent';
export type { UserAgentRefused, UserAgentResolved, UserAgentResult } from './trade/user-agent';

/**
 * The skip record a `TradeResult` carries. The **parser, the ledger and the
 * pacing functions are deliberately not exported**: together they are
 * everything a second call site needs to assemble a parallel pacer against the
 * same budget, which is exactly what withholding `HttpPort` was meant to
 * prevent. They are imported by path inside this package, and by its tests.
 */
export type { RateLimitSkip, RateLimitSkipReason } from './trade/rate-limit-headers';

/**
 * One bounded, resumable, single-instance chunk (FR-19, AD-7). Stories 1.7 and
 * 1.8 wire the live command; until then the tests and `pnpm sync:dry` drive it.
 */
export { DATASET_PATH, PROGRESS_PATH, runChunk, TRACKED_PATH } from './chunk/run-chunk';
export type {
  ChunkBound,
  ChunkOutcome,
  ChunkOutcomeKind,
  ChunkPorts,
  ChunkStarvation,
  ChunkStep,
  GateContext,
  StepResult,
} from './chunk/run-chunk';
export { LOCK_PATH, STALE_LOCK_AFTER_MS } from './chunk/lock';

/**
 * The load-time pinned cap and the starvation record (AD-7,
 * IMPLEMENTATION-NOTES.md §6) — the only readers of `minChunkSearches`, kept
 * outside `chunk/` so the yardstick can never bound a chunk.
 */
export { checkPinnedCap, pinnedStarvationRecord } from './pinned-cap';
export type { PinnedCapExceeded, PinnedCapResult } from './pinned-cap';

/**
 * The pricing step (FR-21, FR-23, AD-16, AD-20): one search and at most one
 * fetch per tracked entry through the governed client, normalised to divine
 * once. It plugs into `runChunk` as its `ChunkStep`; Story 1.8 publishes the
 * entries it returns.
 */
export {
  createPricingStep,
  FETCH_LIMIT,
  MalformedRequestError,
  UnexpectedTradeResponseError,
} from './pricing/price-entry';
export type { PricingStepOptions, RequestKind } from './pricing/price-entry';
export {
  buildSearchBody,
  itemTypesOf,
  UnknownClassBaseTypeError,
} from './pricing/search-body';
export type { ItemTypes, SearchBody } from './pricing/search-body';
export { currentRates, lowerMedian, outputRates, roundDivine, toDivine } from './pricing/normalise';
export { CURRENCIES_PATH, loadCurrencies } from './pricing/load-currencies';
export { CATALOGUE_ITEMS_PATH, loadItemTypes } from './pricing/load-item-types';
export { CONFIG_PATH, loadActiveLeague } from './load-config';
export { DataFileError } from './load-data-file';
export type { DataFileRefusal, DataFileResult } from './load-data-file';
