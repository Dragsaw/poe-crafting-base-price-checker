import { describe, expect, it } from 'vitest';

import {
  CatalogueItemsFileSchema,
  CatalogueStatsFileSchema,
  CurrenciesFileSchema,
  DatasetFileSchema,
  parseEnvelope,
  SyncReportFileSchema,
} from '../envelopes';
import { INITIAL_SCHEMA_VERSION } from '../schema-version';

function syncFileOf(entries: readonly unknown[]) {
  return {
    schemaVersion: INITIAL_SCHEMA_VERSION,
    league: 'Forbidden Rites',
    generatedAt: '2026-09-20T09:02:00Z',
    entries,
    currencyRates: [],
  };
}

function syncIssuesOf(entries: readonly unknown[]) {
  const result = parseEnvelope(DatasetFileSchema, syncFileOf(entries));
  if (result.ok || result.reason !== 'invalid') {
    throw new Error(`expected an invalid refusal, got ${JSON.stringify(result)}`);
  }
  return result.issues;
}

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

  describe('DatasetFileSchema entryKey uniqueness', () => {
    const key = '["raw","Advanced Dualstring Bow",82]';
    const neverSynced = {
      entryKey: key,
      price: { state: 'not-yet-synced', reason: 'never-synced' },
    } as const;

    // I/O matrix: "Distinct keys".
    it('accepts two entries with different entryKeys', () => {
      const result = parseEnvelope(
        DatasetFileSchema,
        syncFileOf([neverSynced, { ...neverSynced, entryKey: '["raw","Advanced Dualstring Bow",84]' }]),
      );
      expect(result.ok).toBe(true);
    });

    // I/O matrix: "Exact twin".
    it('refuses an exact twin with one issue at the repeat, naming the key and the first index', () => {
      const issues = syncIssuesOf([neverSynced, neverSynced]);
      expect(issues).toHaveLength(1);
      expect(issues[0]?.path).toEqual(['entries', 1]);
      expect(issues[0]?.message).toContain(key);
      expect(issues[0]?.message).toContain('entries.0');
    });

    // I/O matrix: "State twin".
    it('refuses one key held priced and no-listings', () => {
      const priced = {
        entryKey: key,
        price: {
          state: 'priced',
          observation: {
            league: 'Forbidden Rites',
            observedAt: '2026-09-20T09:30:00Z',
            priceDivine: 12.5,
            sampleSize: 10,
            exchangeObservation: {
              currencyId: 'exalted',
              rate: 0.0042,
              source: 'by hand',
              league: 'Forbidden Rites',
              asOf: '2026-09-19T08:00:00Z',
            },
          },
        },
        lastAttemptedAt: '2026-09-20T09:30:00Z',
        lastSearchId: 'aBcDeF',
        lastSearchLeague: 'Forbidden Rites',
      };
      const issues = syncIssuesOf([priced, { entryKey: key, price: { state: 'no-listings' } }]);
      expect(issues).toHaveLength(1);
      expect(issues[0]?.path).toEqual(['entries', 1]);
    });

    // I/O matrix: "Triplet".
    it('reports each repeat of a key at its own index, each naming the first occurrence', () => {
      const other = { ...neverSynced, entryKey: '["raw","Advanced Dualstring Bow",84]' };
      const issues = syncIssuesOf([neverSynced, other, neverSynced, neverSynced]);
      expect(issues.map((issue) => issue.path)).toEqual([
        ['entries', 2],
        ['entries', 3],
      ]);
      for (const issue of issues) {
        expect(issue.message).toContain(key);
        expect(issue.message).toContain('entries.0');
      }
    });

    // I/O matrix: "Empty list".
    it('accepts an empty list', () => {
      expect(parseEnvelope(DatasetFileSchema, syncFileOf([])).ok).toBe(true);
    });
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
        },
        notReachedCount: 41,
      },
      records: [
        { kind: 'stale-lock-broken', pid: 4242, startedAt: '2026-09-20T01:00:00Z' },
      ],
    };
    // A 1.1.0 figure with no session-probe key reads it as 0 (§13.7).
    expect(SyncReportFileSchema.parse(file)).toEqual({
      ...file,
      figures: { ...file.figures, requestsBySource: { ...file.figures.requestsBySource, 'session-probe': 0 } },
    });

    // An incomplete per-source accounting must not reach disk (AD-12, FR-14).
    expect(
      SyncReportFileSchema.safeParse({
        ...file,
        figures: { requestsBySource: { 'tracked-list': 8 }, notReachedCount: 41 },
      }).success,
    ).toBe(false);
  });
});
