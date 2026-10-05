import { describe, expect, it } from 'vitest';

import * as contracts from './index';

/** The barrel is what other packages import, so assert its surface rather than the modules behind it. */
describe('the contracts barrel', () => {
  it('exports one schema per named concept', () => {
    for (const name of [
      'BaseTypeSchema',
      'ItemClassSchema',
      'ModifierRefSchema',
      'TrackedEntrySchema',
      'PriceObservationSchema',
      'CurrencyRateSchema',
      'TradeCatalogueSchema',
      'LeaguesPayloadSchema',
      'SyncRunReportSchema',
      'RunFailureRecordSchema',
      'LeagueMismatchRecordSchema',
      'WeightsAbsentRecordSchema',
      'UncataloguedWeightsIdRecordSchema',
      'DatasetEntrySchema',
      'SchemaVersionSchema',
      'TrackedListAgeSchema',
      'SyncLockSchema',
      'SyncProgressSchema',
      'CraftRecipeSchema',
      'RankedRowSchema',
    ] as const) {
      expect(contracts[name], `${name} is not re-exported from the barrel`).toBeDefined();
    }
  });

  it('exports every file envelope and the one load path', () => {
    for (const name of [
      'TrackedFileSchema',
      'CurrenciesFileSchema',
      'ConfigFileSchema',
      'SyncReportFileSchema',
      'SyncProgressFileSchema',
      'DatasetFileSchema',
      'CatalogueItemsFileSchema',
      'CatalogueStatsFileSchema',
      'CatalogueStaticFileSchema',
      'CatalogueFiltersFileSchema',
      'RecipesFileSchema',
      'WeightsFileSchema',
      'parseEnvelope',
    ] as const) {
      expect(contracts[name], `${name} is not re-exported from the barrel`).toBeDefined();
    }
  });

  it('exports record identity and the per-file schema versions', () => {
    expect(contracts.isSameRecord).toBeTypeOf('function');
    expect(contracts.RECORD_SUBJECTS).toBeDefined();
    expect(contracts.ChunkRequestSourceSchema).toBeDefined();
    expect(contracts.SYNC_REPORT_SCHEMA_VERSION).toBe('1.2.0');
    expect(contracts.SYNC_PROGRESS_SCHEMA_VERSION).toBe('1.2.0');
    expect(contracts.TRACKED_SCHEMA_VERSION).toBe('2.0.0');
    expect(contracts.SUPPORTED_SCHEMA_VERSION).toBe('1.0.0');
    expect(contracts.trackedEarlierMajorMessage).toBeTypeOf('function');
  });

  it('exports a fake for each of the four ports', () => {
    expect(contracts.createFakeHttpPort).toBeTypeOf('function');
    expect(contracts.createFakeFilesystemPort).toBeTypeOf('function');
    expect(contracts.createFakeGitPort).toBeTypeOf('function');
    expect(contracts.createFakeClockPort).toBeTypeOf('function');
  });

  it('exports the canonical key and its comparator', () => {
    expect(contracts.canonicalKey).toBeTypeOf('function');
    expect(contracts.compareCanonicalKeys).toBeTypeOf('function');
  });

  it('no longer carries the Story 1.1 placeholder', () => {
    expect('CONTRACTS_PLACEHOLDER' in contracts).toBe(false);
  });
});
