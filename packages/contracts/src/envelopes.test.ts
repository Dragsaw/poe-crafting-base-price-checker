import { describe, expect, it } from 'vitest';

import {
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
import { INITIAL_SCHEMA_VERSION } from './schema-version';
import { without } from './test-support';

const trackedFile = {
  schemaVersion: INITIAL_SCHEMA_VERSION,
  entries: [
    {
      kind: 'raw',
      baseTypeId: 'Advanced Dualstring Bow',
      itemLevelMin: 82,
      status: 'active',
    },
  ],
};

describe('every file envelope carries schemaVersion', () => {
  const envelopes: { readonly shape: Record<string, unknown> }[] = [
    TrackedFileSchema,
    CurrenciesFileSchema,
    ConfigFileSchema,
    DatasetFileSchema,
    SyncReportFileSchema,
    CatalogueItemsFileSchema,
    CatalogueStatsFileSchema,
    CatalogueStaticFileSchema,
    CatalogueFiltersFileSchema,
  ];

  it('declares the field on each', () => {
    for (const envelope of envelopes) {
      expect(Object.keys(envelope.shape)).toContain('schemaVersion');
    }
  });

  it('refuses a file with no version at all', () => {
    expect(TrackedFileSchema.safeParse(without(trackedFile, 'schemaVersion')).success).toBe(false);
  });
});

describe('ConfigFileSchema', () => {
  it('carries the active league, minChunkSearches and schemaVersion — and nothing else', () => {
    const config = {
      schemaVersion: INITIAL_SCHEMA_VERSION,
      league: 'Forbidden Rites',
      minChunkSearches: 8,
    };
    expect(ConfigFileSchema.parse(config)).toEqual(config);
    expect(ConfigFileSchema.safeParse({ ...config, freshnessCutoffHours: 48 }).success).toBe(false);
  });
});

describe('parseEnvelope', () => {
  // I/O matrix: "Unknown major".
  it('refuses an unknown major with a typed result naming both versions', () => {
    const result = parseEnvelope(TrackedFileSchema, { ...trackedFile, schemaVersion: '2.0.0' });
    expect(result).toEqual({
      ok: false,
      reason: 'unknown-major',
      expected: INITIAL_SCHEMA_VERSION,
      found: '2.0.0',
    });
  });

  it('refuses an unknown major before it parses the body, not after', () => {
    const result = parseEnvelope(TrackedFileSchema, {
      schemaVersion: '2.0.0',
      entries: 'not even an array',
    });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toBe('unknown-major');
  });

  // I/O matrix: "Known major, newer minor".
  it('accepts a newer minor under a known major', () => {
    const result = parseEnvelope(TrackedFileSchema, { ...trackedFile, schemaVersion: '1.4.0' });
    expect(result.ok).toBe(true);
    expect(result.ok === true && result.value.entries).toHaveLength(1);
  });

  it('reports a shape failure as invalid, with the issues', () => {
    const result = parseEnvelope(TrackedFileSchema, { ...trackedFile, entries: [{ kind: 'raw' }] });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toBe('invalid');
    expect(result.ok === false && result.reason === 'invalid' && result.issues.length).toBeGreaterThan(0);
  });

  it('reports a malformed version apart from an unknown major', () => {
    const result = parseEnvelope(TrackedFileSchema, { ...trackedFile, schemaVersion: 'one' });
    expect(result.ok === false && result.reason).toBe('malformed-version');
  });

  it('reports a file with no version field as invalid rather than guessing', () => {
    const result = parseEnvelope(TrackedFileSchema, { entries: [] });
    expect(result.ok === false && result.reason).toBe('invalid');
  });
});

describe('the sync-owned envelopes', () => {
  it('parses a dataset file carrying its entries and the current rate set', () => {
    const dataset = {
      schemaVersion: INITIAL_SCHEMA_VERSION,
      league: 'Forbidden Rites',
      generatedAt: '2026-09-20T09:02:00Z',
      entries: [
        {
          entryKey: '["raw","Advanced Dualstring Bow",82]',
          price: { state: 'not-yet-synced', reason: 'never-synced' },
        },
      ],
      currencyRates: [
        {
          currencyId: 'divine',
          rate: 1,
          source: 'written by sync',
          league: 'Forbidden Rites',
          asOf: '2026-09-20T09:02:00Z',
        },
      ],
    };
    expect(DatasetFileSchema.parse(dataset)).toEqual(dataset);
  });

  it('parses a catalogue file as the captured response plus a version', () => {
    const file = {
      schemaVersion: INITIAL_SCHEMA_VERSION,
      result: [{ id: 'jewel', label: 'Jewels', entries: [{ type: 'Sapphire' }] }],
    };
    expect(CatalogueItemsFileSchema.parse(file)).toEqual(file);
  });

  it('binds the stats catalogue envelope to the stats body, not to an unchecked array', () => {
    const file = {
      schemaVersion: INITIAL_SCHEMA_VERSION,
      result: [
        { id: 'explicit', label: 'Explicit', entries: [{ id: 'explicit.stat_1', text: '# to Life' }] },
      ],
    };
    expect(CatalogueStatsFileSchema.parse(file)).toEqual(file);

    // A flat list is the shape a consumer would assume; the envelope must refuse it.
    expect(
      CatalogueStatsFileSchema.safeParse({
        schemaVersion: INITIAL_SCHEMA_VERSION,
        result: [{ id: 'explicit.stat_1', text: '# to Life' }],
      }).success,
    ).toBe(false);
  });

  it('binds the currencies envelope to CurrencyRate', () => {
    const file = {
      schemaVersion: INITIAL_SCHEMA_VERSION,
      rates: [
        {
          currencyId: 'exalted',
          rate: 0.0042,
          source: 'by hand',
          league: 'Forbidden Rites',
          asOf: '2026-09-19T08:00:00Z',
        },
      ],
    };
    expect(CurrenciesFileSchema.parse(file)).toEqual(file);

    // A rate with no league of its own is the defect AD-20 exists to prevent.
    expect(
      CurrenciesFileSchema.safeParse({
        schemaVersion: INITIAL_SCHEMA_VERSION,
        rates: [{ currencyId: 'exalted', rate: 0.0042, source: 'by hand' }],
      }).success,
    ).toBe(false);
  });

  it('binds the sync-report envelope to SyncRunReport', () => {
    const file = {
      schemaVersion: INITIAL_SCHEMA_VERSION,
      runStartedAt: '2026-09-20T09:00:00Z',
      figures: {
        requestsBySource: {
          'tracked-list': 8,
          'league-validation': 1,
          'catalogue-refresh': 0,
        },
        notReachedCount: 41,
      },
      records: [
        { kind: 'stale-lock-broken', pid: 4242, startedAt: '2026-09-20T01:00:00Z' },
      ],
    };
    expect(SyncReportFileSchema.parse(file)).toEqual(file);

    // An incomplete per-source accounting must not reach disk (AD-12, FR-14).
    expect(
      SyncReportFileSchema.safeParse({
        ...file,
        figures: { requestsBySource: { 'tracked-list': 8 }, notReachedCount: 41 },
      }).success,
    ).toBe(false);
  });
});
