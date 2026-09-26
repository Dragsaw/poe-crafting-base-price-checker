/**
 * `@poe/contracts` — every concept that crosses a package boundary, defined
 * exactly once as a Zod schema with its static type `z.infer`red from it
 * (AD-3), plus the four external effects as `<Thing>Port` interfaces with a
 * pure in-memory fake beside each (AD-1).
 *
 * This package **depends on nothing in this workspace** and must never gain a
 * `workspace:*` dependency. `verbatimModuleSyntax` is on, so every type
 * re-export below is written `export type { … }`.
 */

export {
  checkSchemaVersion,
  INITIAL_SCHEMA_VERSION,
  majorOf,
  SchemaVersionSchema,
  SUPPORTED_SCHEMA_VERSION,
} from './schema-version.ts';
export type {
  SchemaVersion,
  SchemaVersionAccepted,
  SchemaVersionCheck,
  SchemaVersionRefused,
} from './schema-version.ts';

export {
  DivineAmountSchema,
  IsoTimestampSchema,
  ItemLevelSchema,
  LeagueIdSchema,
} from './primitives.ts';
export type { DivineAmount, IsoTimestamp, ItemLevel, LeagueId } from './primitives.ts';

export { BaseTypeIdSchema, BaseTypeSchema } from './base-type.ts';
export type { BaseType, BaseTypeId } from './base-type.ts';

export { CategoryIdSchema, ClassNameSchema, ItemClassSchema } from './item-class.ts';
export type { CategoryId, ClassName, ItemClass } from './item-class.ts';

export {
  AcceptedTierSchema,
  BandedModifierRefSchema,
  ModifierRefSchema,
  StatIdSchema,
  ValuelessModifierRefSchema,
} from './modifier-ref.ts';
export type {
  BandedModifierRef,
  ModifierRef,
  StatId,
  ValuelessModifierRef,
} from './modifier-ref.ts';

/**
 * The two arm schemas are **not** exported. They carry none of the union's
 * `superRefine` rules, so parsing with an arm accepts a crafted entry with no
 * affix and a pruned entry with no reason — the two rows the I/O matrix
 * requires to fail. `TrackedEntrySchema` is the only parse path.
 */
export {
  CurationStatusSchema,
  PrunedReasonSchema,
  TrackedEntrySchema,
} from './tracked-entry.ts';
export type {
  CraftedTrackedEntry,
  CurationStatus,
  RawTrackedEntry,
  TrackedEntry,
} from './tracked-entry.ts';

export {
  canonicalKey,
  canonicalKeyElements,
  compareByCodeUnit,
  compareCanonicalKeys,
  compareTrackedEntries,
  encodeAffix,
} from './canonical-key.ts';
export type { CanonicalAffix, CanonicalKeyElements } from './canonical-key.ts';

export { CraftRecipeSchema } from './craft-recipe.ts';
export type { CraftRecipe } from './craft-recipe.ts';

export { PriceObservationSchema } from './price-observation.ts';
export type { PriceObservation } from './price-observation.ts';

export { CurrencyIdSchema, CurrencyRateSchema } from './currency-rate.ts';
export type { CurrencyId, CurrencyRate } from './currency-rate.ts';

export {
  DatasetEntrySchema,
  NotYetSyncedReasonSchema,
  PriceStateSchema,
} from './dataset.ts';
export type { DatasetEntry, NotYetSyncedReason, PriceState } from './dataset.ts';

export { RankedRowSchema } from './ranked-row.ts';
export type { RankedRow, RawRankedRow } from './ranked-row.ts';

export {
  filterOptionIds,
  FilterCatalogueGroupSchema,
  FilterCatalogueSchema,
  FilterOptionSchema,
  FilterSchema,
  flattenFilterCatalogue,
  flattenItemCatalogue,
  flattenStaticCatalogue,
  flattenStatCatalogue,
  ItemCatalogueEntrySchema,
  ItemCatalogueGroupSchema,
  ItemCatalogueSchema,
  StatCatalogueEntrySchema,
  StatCatalogueGroupSchema,
  StatCatalogueSchema,
  StaticCatalogueEntrySchema,
  StaticCatalogueGroupSchema,
  StaticCatalogueSchema,
  TradeCatalogueSchema,
} from './trade-catalogue.ts';
export type {
  CatalogueFilter,
  FilterCatalogue,
  FilterCatalogueGroup,
  FilterOption,
  ItemCatalogue,
  ItemCatalogueEntry,
  ItemCatalogueGroup,
  StatCatalogue,
  StatCatalogueEntry,
  StatCatalogueGroup,
  StaticCatalogue,
  StaticCatalogueEntry,
  StaticCatalogueGroup,
  TradeCatalogue,
} from './trade-catalogue.ts';

export { LeagueEntrySchema, LeaguesPayloadSchema } from './trade-leagues.ts';
export type { LeagueEntry, LeaguesPayload } from './trade-leagues.ts';

export {
  ChunkRequestSourceSchema,
  CrossFileCheckSchema,
  CrossFileGateFailureRecordSchema,
  LeagueMismatchRecordSchema,
  PinnedStarvationRecordSchema,
  RECORD_SUBJECTS,
  RequestSourceSchema,
  RequestsBySourceSchema,
  RunFailureReasonSchema,
  RunFailureRecordSchema,
  sameRecord,
  StaleLockBrokenRecordSchema,
  SYNC_REPORT_SCHEMA_VERSION,
  SyncRunFiguresSchema,
  SyncRunRecordSchema,
  SyncRunReportSchema,
  UncataloguedWeightsIdRecordSchema,
  UnresolvableRecordSchema,
  WeightsAbsentRecordSchema,
} from './sync-run-report.ts';
export type {
  ChunkRequestSource,
  CrossFileCheck,
  CrossFileGateFailureRecord,
  LeagueMismatchRecord,
  PinnedStarvationRecord,
  RequestSource,
  RunFailureReason,
  RunFailureRecord,
  StaleLockBrokenRecord,
  SyncRunFigures,
  SyncRunRecord,
  SyncRunRecordKind,
  SyncRunReport,
  UncataloguedWeightsIdRecord,
  UnresolvableRecord,
  WeightsAbsentRecord,
} from './sync-run-report.ts';

export { SYNC_PROGRESS_SCHEMA_VERSION, SyncLockSchema, SyncProgressSchema } from './sync-progress.ts';
export type { SyncLock, SyncProgress } from './sync-progress.ts';

export { resolveTrackedListAge, TrackedListAgeSchema } from './tracked-list-age.ts';
export type { TrackedListAge, TrackedListAgeSources } from './tracked-list-age.ts';

export {
  catalogueFileEnvelope,
  CatalogueFiltersFileSchema,
  CatalogueItemsFileSchema,
  CatalogueStaticFileSchema,
  CatalogueStatsFileSchema,
  ConfigFileSchema,
  CurrenciesFileSchema,
  DatasetFileSchema,
  parseEnvelope,
  RecipesFileSchema,
  SyncProgressFileSchema,
  SyncReportFileSchema,
  TrackedFileSchema,
  WeightsFileEnvelopeSchema,
} from './envelopes.ts';
export type {
  CatalogueFiltersFile,
  CatalogueItemsFile,
  CatalogueStaticFile,
  CatalogueStatsFile,
  ConfigFile,
  CurrenciesFile,
  DatasetFile,
  EnvelopeAccepted,
  EnvelopeInvalid,
  EnvelopeIssues,
  EnvelopeResult,
  EnvelopeVersionRefused,
  RecipesFile,
  SyncProgressFile,
  SyncReportFile,
  TrackedFile,
  WeightsFileEnvelope,
} from './envelopes.ts';

export type { HttpPort, HttpRequest, HttpResponse } from './ports/http.ts';
export type { FilesystemPort } from './ports/filesystem.ts';
export type { GitPort } from './ports/git.ts';
export type { ClockPort } from './ports/clock.ts';

export { createFakeHttpPort } from './ports/fakes/http.ts';
export type { FakeHttpPort, HttpFixtures } from './ports/fakes/http.ts';
export { createFakeFilesystemPort } from './ports/fakes/filesystem.ts';
export type { FakeFile, FakeFilesystemPort, FakeFiles } from './ports/fakes/filesystem.ts';
export { createFakeGitPort } from './ports/fakes/git.ts';
export type { FakeCommitDates, FakeGitPort } from './ports/fakes/git.ts';
export { createFakeClockPort } from './ports/fakes/clock.ts';
export type { FakeClockPort } from './ports/fakes/clock.ts';
