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
 * The one governed trade request path (FR-20, AD-8). `createTradeClient`, and
 * `createTradeClients` for sibling clients that share one governor (one per
 * request source), and `createTradeGovernor`, which makes that governor's
 * pacing memory (`PacingState`) and its pacer explicit for the `pnpm sync`
 * session, are the **only** exported ways to make a trade request,
 * and `HttpPort` is deliberately not re-exported from `sync`: a second call
 * site that wanted to build its own request would have to reach into
 * `@poe/contracts` for the port, which makes the violation visible rather
 * than convenient.
 */
export {
  createPacingState,
  createTradeClient,
  createTradeClients,
  createTradeGovernor,
} from './trade/client';
export type {
  PacingState,
  TradeClient,
  TradeClientOptions,
  TradeClientsOptions,
  TradeGovernor,
  TradeGovernorOptions,
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
 * One bounded, resumable, single-instance chunk (FR-19, AD-7). Under the lock
 * it writes `data/dataset.json`, `data/sync-progress.json` and
 * `data/sync-report.json` by explicit path and performs no git write (AD-3).
 * The report carries requests per source (AD-12, FR-14), the not-reached count
 * and the tracked-list edit date as figures, and every unacknowledged record
 * (FR-25). A throw still writes the report, with a `run-failure` record.
 * `pnpm sync` (`./sync.ts`, a long-running session of one-entry chunks) and
 * `pnpm sync:batch` (`./sync-batch.ts`, one chunk per invocation) drive it
 * live; the tests and `pnpm sync:dry` drive it against in-memory fakes.
 */
export { DATASET_PATH, PROGRESS_PATH, REPORT_PATH, runChunk, TRACKED_PATH } from './chunk/run-chunk';
/**
 * The one chunk composition `pnpm sync`, `pnpm sync:batch` and `pnpm sync:dry` share: one
 * governor of two counted trade clients, the catalogue loader and the
 * runner's under-lock `load` hook (AD-8, AD-12).
 */
export { composeChunk } from './compose-chunk';
export type { ComposeChunkPorts, ComposedChunk } from './compose-chunk';
export { buildDatasetFile } from './chunk/publish-dataset';
export type { DatasetInputs } from './chunk/publish-dataset';
export { buildSyncReport, carryRecords } from './chunk/sync-report';
export type { SyncReportFigures, SyncReportInputs } from './chunk/sync-report';

/**
 * Per-source request accounting (AD-12, FR-14): a shell wraps each `HttpPort`
 * it hands out with the source it serves, and passes the counter to
 * `runChunk`. The wrapper adds no request path of its own.
 */
export { createRequestCounter, requestsBetween, zeroRequests } from './request-counter';
export type { RequestCounter, RequestsBySource } from './request-counter';
export type {
  ChunkBound,
  ChunkLoadContext,
  ChunkOutcome,
  ChunkOutcomeKind,
  ChunkPorts,
  ChunkPublication,
  ChunkSession,
  ChunkSetup,
  ChunkStarvation,
  ChunkStep,
  GateContext,
  GateResult,
  StepResult,
} from './chunk/run-chunk';
export { LOCK_PATH, STALE_LOCK_AFTER_MS } from './chunk/lock';

/**
 * The one validate-then-serialise write for every artifact `sync` writes: the
 * value is parsed with its schema and the parsed value is serialised, so the
 * keys follow the schema's declared order. An invalid artifact is refused with
 * `InvalidArtifactError` and nothing is written.
 */
export { InvalidArtifactError, writeArtifact } from './write-artifact';
export type { ArtifactSchema } from './write-artifact';

/**
 * The load-time pinned cap and the starvation record (AD-7,
 * IMPLEMENTATION-NOTES.md §6) — the only readers of `minChunkSearches`, kept
 * outside `chunk/` so the yardstick can never bound a chunk.
 */
export { checkPinnedCap, PinnedCapExceededError, pinnedStarvationRecord } from './pinned-cap';
export type { PinnedCapExceeded, PinnedCapResult } from './pinned-cap';

/**
 * The pricing step (FR-21, FR-23, AD-16, AD-20): one search and at most one
 * fetch per tracked entry through the governed client, normalised to divine
 * once. It plugs into `runChunk` as its `ChunkStep`, and `runChunk` publishes
 * the entries it returns into the dataset.
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
export { CONFIG_PATH, loadActiveLeague, loadConfig } from './load-config';
export { DataFileError } from './load-data-file';
export type { DataFileRefusal, DataFileResult } from './load-data-file';

/**
 * The run-start catalogue check (FR-24, AD-9, AD-25): the committed
 * catalogue's id sets, the pure check `runChunk` runs under the lock before
 * any request, and the `weights.json` reader, which refuses a file that breaks
 * the weights contract and whose ids are checked report-only. `className` is
 * never checked against the catalogue.
 */
export { CATALOGUE_FILTERS_PATH, CATALOGUE_STATS_PATH, loadCatalogueIds } from './catalogue/catalogue-ids';
export type { CatalogueIds } from './catalogue/catalogue-ids';
export { checkCatalogue, markUnresolvable } from './chunk/catalogue-check';
export type { CatalogueCheck } from './chunk/catalogue-check';
export { checkWeightsIds, readWeightsIds, WEIGHTS_PATH, weightsAbsentRecord } from './catalogue/weights-ids';
/** The weights contract this build reads, defined once in `contracts`. */
export { WEIGHTS_SCHEMA_VERSION } from '@poe/contracts';
export type { WeightsIds } from './catalogue/weights-ids';

/**
 * The run-start league gate (FR-32, AD-19): one `league-validation` GET under
 * the lock, before any search. A mismatch throws `LeagueMismatchError`, which
 * `runChunk` reports as a `league-mismatch` record; an unanswered request
 * yields the chunk (AD-8).
 */
export {
  createLeagueGate,
  LeagueMismatchError,
  LeagueRequestRejectedError,
  UnexpectedLeaguesResponseError,
} from './league/league-gate';
export type { LeagueGateOptions } from './league/league-gate';
