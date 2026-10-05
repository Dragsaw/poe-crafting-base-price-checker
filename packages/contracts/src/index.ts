/** `@poe/contracts`: Zod schemas and `z.infer` types (AD-3), `<Thing>Port` interfaces (AD-1). */

export {
  checkSchemaVersion,
  INITIAL_SCHEMA_VERSION,
  majorOf,
  SchemaVersionSchema,
  SUPPORTED_SCHEMA_VERSION,
  TRACKED_SCHEMA_VERSION,
  trackedEarlierMajorMessage,
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

export { DEFENCE_OF_LETTER, defenceLettersOf } from './class-name.ts';
export type { DefenceLetter } from './class-name.ts';

export {
  AcceptedTierSchema,
  BandedHybridLineSchema,
  BandedModifierRefSchema,
  HybridLineSchema,
  HybridModifierRefSchema,
  ModifierRefSchema,
  StatIdSchema,
  ValuelessHybridLineSchema,
  ValuelessModifierRefSchema,
} from './modifier-ref.ts';
export type {
  BandedHybridLine,
  BandedModifierRef,
  HybridLine,
  HybridModifierRef,
  ModifierRef,
  SingleLineModifierRef,
  StatId,
  ValuelessHybridLine,
  ValuelessModifierRef,
} from './modifier-ref.ts';

/** Arm schemas stay unexported: they lack the union's `superRefine` rules. */
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
export type { CanonicalAffix, CanonicalKeyElements, CanonicalLine } from './canonical-key.ts';

export {
  describeOverlap,
  linesOf,
  hasHybridAffix,
  CAN_NEVER_CO_OCCUR,
  overlap,
  OVERLAP_SLOTS,
  overlapBranches,
  slotOverlap,
  slotOverlapBranch,
  summedInterval,
  summedStatIds,
} from './overlap.ts';
export type {
  CoOccur,
  NamedLine,
  OverlapAffixes,
  OverlapBranches,
  OverlapSlot,
  SlotOverlapBranch,
  SummedInterval,
  SummedOverlap,
} from './overlap.ts';

export { CraftRecipeSchema, RECIPE_GRADES, recipeWord, REGULAR_RECIPE_WORD } from './craft-recipe.ts';
export type { CraftRecipe, RecipeGrade, RecipeWord } from './craft-recipe.ts';

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

export {
  CraftedRankedRowSchema,
  CraftedSummandSchema,
  ProvenanceSchema,
  RankedRowSchema,
  RawRankedRowSchema,
  UncostableSchema,
} from './ranked-row.ts';
export type { CraftedRankedRow, CraftedSummand, Provenance, RankedRow, RawRankedRow, Uncostable } from './ranked-row.ts';

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
  isSameRecord,
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
} from './envelopes.ts';

export {
  ModifierWeightSchema,
  WEIGHTS_SCHEMA_VERSION,
  WeightsClassPoolsSchema,
  WeightsFileSchema,
  WeightsLineSchema,
  WeightsPoolSchema,
} from './weights-file.ts';
export type {
  ModifierWeight,
  WeightsClassPools,
  WeightsFile,
  WeightsLine,
  WeightsPool,
} from './weights-file.ts';

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
