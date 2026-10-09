import { CORE_PLACEHOLDER } from '@poe/core';

/** Placeholder export; `sync` imports `@poe/contracts` and `@poe/core`, never `@poe/web` (AD-1). */
export const SYNC_PLACEHOLDER = `${CORE_PLACEHOLDER}:sync`;



// The one governed trade request path (FR-20, AD-8): the only exported ways to make a request.
// `HttpPort` is deliberately not re-exported, so a second call site would have to reach for it.
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

// Parser, ledger and pacing functions are deliberately not exported: with them a second call site
// could assemble a parallel pacer on the same budget, which withholding `HttpPort` prevents.
export type { RateLimitSkip, RateLimitSkipReason } from './trade/rate-limit-headers';

// One bounded, resumable, single-instance chunk (FR-19, AD-7); no git write (AD-3).
// A throw still writes the report, with a `run-failure` record (FR-25).
export { DATASET_PATH, PROGRESS_PATH, REPORT_PATH, runChunk, TRACKED_PATH } from './chunk/run-chunk';
/** The one chunk composition `pnpm sync`, `sync:batch` and `sync:dry` share (AD-8, AD-12). */
export { composeChunk } from './compose-chunk';
export type { ComposeChunkPorts, ComposedChunk } from './compose-chunk';
export { buildDatasetFile } from './chunk/publish-dataset';
export type { DatasetInputs } from './chunk/publish-dataset';
export { buildSyncReport, carryRecords } from './chunk/sync-report';
export type { SyncReportFigures, SyncReportInputs } from './chunk/sync-report';

/** Per-source request accounting (AD-12, FR-14); the wrapper adds no request path of its own. */
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

/** The one validate-then-serialise write for every artifact `sync` writes; invalid is refused. */
export { InvalidArtifactError, writeArtifact } from './write-artifact';
export type { ArtifactSchema } from './write-artifact';

// Pinned cap and starvation record (AD-7): the only readers of
// `minChunkSearches`, kept outside `chunk/` so the yardstick can never bound a chunk.
export { checkPinnedCap, PinnedCapExceededError, pinnedStarvationRecord } from './pinned-cap';
export type { PinnedCapExceeded, PinnedCapResult } from './pinned-cap';

/** The pricing step (FR-21, FR-23, AD-16, AD-20): plugs into `runChunk` as its `ChunkStep`. */
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

// The run-start catalogue check (FR-24, AD-9, AD-25): id sets, the pure check, the weights reader.
// `className` is never checked against the catalogue.
export { CATALOGUE_FILTERS_PATH, CATALOGUE_STATS_PATH, loadCatalogueIds } from './catalogue/catalogue-ids';
export type { CatalogueIds } from './catalogue/catalogue-ids';
export { checkCatalogue, markUnresolvable } from './chunk/catalogue-check';
export type { CatalogueCheck } from './chunk/catalogue-check';
export { checkWeightsIds, readWeightsIds, WEIGHTS_PATH, weightsAbsentRecord } from './catalogue/weights-ids';
/** The weights contract this build reads, defined once in `contracts`. */
export { WEIGHTS_SCHEMA_VERSION, INITIAL_SCHEMA_VERSION as SYNC_CONTRACTS_SCHEMA_VERSION } from '@poe/contracts';
export type { WeightsIds } from './catalogue/weights-ids';

/** The run-start cross-file gate (AD-12, AD-17): a failure throws `CrossFileGateError`. */
export { CrossFileGateError, crossFileGate, crossFileGateRecords } from './chunk/cross-file-gate';

/** The run-start league gate (FR-32, AD-19); an unanswered request yields the chunk (AD-8). */
export {
  createLeagueGate,
  LeagueMismatchError,
  LeagueRequestRejectedError,
  UnexpectedLeaguesResponseError,
} from './league/league-gate';
export type { LeagueGateOptions } from './league/league-gate';
