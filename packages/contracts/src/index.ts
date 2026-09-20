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
} from './schema-version';
export type {
  SchemaVersion,
  SchemaVersionAccepted,
  SchemaVersionCheck,
  SchemaVersionRefused,
} from './schema-version';

export {
  DivineAmountSchema,
  IsoTimestampSchema,
  ItemLevelSchema,
  LeagueIdSchema,
} from './primitives';
export type { DivineAmount, IsoTimestamp, ItemLevel, LeagueId } from './primitives';

export { BaseTypeIdSchema, BaseTypeSchema } from './base-type';
export type { BaseType, BaseTypeId } from './base-type';

export { CategoryIdSchema, ClassNameSchema, ItemClassSchema } from './item-class';
export type { CategoryId, ClassName, ItemClass } from './item-class';

export {
  AcceptedTierSchema,
  BandedModifierRefSchema,
  ModifierRefSchema,
  StatIdSchema,
  ValuelessModifierRefSchema,
} from './modifier-ref';
export type {
  BandedModifierRef,
  ModifierRef,
  StatId,
  ValuelessModifierRef,
} from './modifier-ref';

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
} from './tracked-entry';
export type {
  CraftedTrackedEntry,
  CurationStatus,
  RawTrackedEntry,
  TrackedEntry,
} from './tracked-entry';

export {
  canonicalKey,
  canonicalKeyElements,
  compareByCodeUnit,
  compareCanonicalKeys,
  compareTrackedEntries,
  encodeAffix,
} from './canonical-key';
export type { CanonicalAffix, CanonicalKeyElements } from './canonical-key';

export { PriceObservationSchema } from './price-observation';
export type { PriceObservation } from './price-observation';

export { CurrencyIdSchema, CurrencyRateSchema } from './currency-rate';
export type { CurrencyId, CurrencyRate } from './currency-rate';

export {
  DatasetEntrySchema,
  NotYetSyncedReasonSchema,
  PriceStateSchema,
} from './dataset';
export type { DatasetEntry, NotYetSyncedReason, PriceState } from './dataset';

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
} from './trade-catalogue';
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
} from './trade-catalogue';

export {
  CrossFileCheckSchema,
  CrossFileGateFailureRecordSchema,
  PinnedStarvationRecordSchema,
  RequestSourceSchema,
  RequestsBySourceSchema,
  StaleLockBrokenRecordSchema,
  SyncRunFiguresSchema,
  SyncRunRecordSchema,
  SyncRunReportSchema,
  UnresolvableRecordSchema,
} from './sync-run-report';
export type {
  CrossFileCheck,
  CrossFileGateFailureRecord,
  PinnedStarvationRecord,
  RequestSource,
  StaleLockBrokenRecord,
  SyncRunFigures,
  SyncRunRecord,
  SyncRunReport,
  UnresolvableRecord,
} from './sync-run-report';

export { resolveTrackedListAge, TrackedListAgeSchema } from './tracked-list-age';
export type { TrackedListAge, TrackedListAgeSources } from './tracked-list-age';

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
  SyncReportFileSchema,
  TrackedFileSchema,
} from './envelopes';
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
  SyncReportFile,
  TrackedFile,
} from './envelopes';

export type { HttpPort, HttpRequest, HttpResponse } from './ports/http';
export type { FilesystemPort } from './ports/filesystem';
export type { GitPort } from './ports/git';
export type { ClockPort } from './ports/clock';

export { createFakeHttpPort } from './ports/fakes/http';
export type { FakeHttpPort, HttpFixtures } from './ports/fakes/http';
export { createFakeFilesystemPort } from './ports/fakes/filesystem';
export type { FakeFile, FakeFilesystemPort, FakeFiles } from './ports/fakes/filesystem';
export { createFakeGitPort } from './ports/fakes/git';
export type { FakeCommitDates, FakeGitPort } from './ports/fakes/git';
export { createFakeClockPort } from './ports/fakes/clock';
export type { FakeClockPort } from './ports/fakes/clock';
