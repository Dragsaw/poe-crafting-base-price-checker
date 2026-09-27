import { describe, expect, it } from 'vitest';

import { canonicalKey } from './canonical-key';
import {
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
    SyncProgressFileSchema,
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

describe('TrackedFileSchema canonical-key uniqueness (L-A1)', () => {
  const rawTwin = {
    kind: 'raw',
    baseTypeId: 'Advanced Dualstring Bow',
    itemLevelMin: 82,
    status: 'active',
  } as const;
  const rawKey = canonicalKey(rawTwin);

  function fileOf(entries: readonly unknown[]) {
    return { schemaVersion: INITIAL_SCHEMA_VERSION, entries };
  }

  function issuesOf(entries: readonly unknown[]) {
    const result = parseEnvelope(TrackedFileSchema, fileOf(entries));
    expect(result.ok).toBe(false);
    if (result.ok || result.reason !== 'invalid') {
      throw new Error(`expected an invalid refusal, got ${JSON.stringify(result)}`);
    }
    return result.issues;
  }

  // I/O matrix: "Distinct keys".
  it('accepts two entries on one base with different itemLevelMin', () => {
    const result = parseEnvelope(TrackedFileSchema, fileOf([rawTwin, { ...rawTwin, itemLevelMin: 84 }]));
    expect(result.ok).toBe(true);
  });

  // I/O matrix: "Exact twin".
  it('refuses an exact twin with one issue at the repeat, naming the key and the first index', () => {
    const issues = issuesOf([rawTwin, rawTwin]);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.path).toEqual(['entries', 1]);
    expect(issues[0]?.message).toContain(rawKey);
    expect(issues[0]?.message).toContain('entries.0');
  });

  // I/O matrix: "Status twin".
  it('refuses one key held active and pinned', () => {
    const issues = issuesOf([rawTwin, { ...rawTwin, status: 'pinned' }]);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.path).toEqual(['entries', 1]);
  });

  // I/O matrix: "Pruned twin".
  it('refuses one key held active and pruned', () => {
    const issues = issuesOf([rawTwin, { ...rawTwin, status: 'pruned', prunedReason: 'too slow' }]);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.path).toEqual(['entries', 1]);
  });

  // I/O matrix: "Tier-only difference".
  it('refuses two crafted entries that differ only in acceptedTier (AD-5)', () => {
    const crafted = {
      kind: 'crafted',
      categoryId: 'weapon.bow',
      className: 'Bows',
      itemLevelMin: 79,
      prefix: { kind: 'banded', statId: 'explicit.stat_1', valueMin: 43, valueMax: 56.5, acceptedTier: 'T7' },
      status: 'active',
    } as const;
    const issues = issuesOf([
      crafted,
      { ...crafted, prefix: { ...crafted.prefix, acceptedTier: 'T6' } },
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.path).toEqual(['entries', 1]);
    expect(issues[0]?.message).toContain(canonicalKey(crafted));
  });

  // I/O matrix: "Triplet".
  it('reports each repeat of a key at its own index, each naming the first occurrence', () => {
    const other = { ...rawTwin, itemLevelMin: 84 };
    const issues = issuesOf([rawTwin, other, rawTwin, rawTwin]);
    expect(issues.map((issue) => issue.path)).toEqual([
      ['entries', 2],
      ['entries', 3],
    ]);
    for (const issue of issues) {
      expect(issue.message).toContain(rawKey);
      expect(issue.message).toContain('entries.0');
    }
  });

  // I/O matrix: "Empty list".
  it('accepts an empty list', () => {
    expect(parseEnvelope(TrackedFileSchema, fileOf([])).ok).toBe(true);
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

  describe('DatasetFileSchema entryKey uniqueness', () => {
    const key = '["raw","Advanced Dualstring Bow",82]';
    const neverSynced = {
      entryKey: key,
      price: { state: 'not-yet-synced', reason: 'never-synced' },
    } as const;

    function fileOf(entries: readonly unknown[]) {
      return {
        schemaVersion: INITIAL_SCHEMA_VERSION,
        league: 'Forbidden Rites',
        generatedAt: '2026-09-20T09:02:00Z',
        entries,
        currencyRates: [],
      };
    }

    function issuesOf(entries: readonly unknown[]) {
      const result = parseEnvelope(DatasetFileSchema, fileOf(entries));
      if (result.ok || result.reason !== 'invalid') {
        throw new Error(`expected an invalid refusal, got ${JSON.stringify(result)}`);
      }
      return result.issues;
    }

    // I/O matrix: "Distinct keys".
    it('accepts two entries with different entryKeys', () => {
      const result = parseEnvelope(
        DatasetFileSchema,
        fileOf([neverSynced, { ...neverSynced, entryKey: '["raw","Advanced Dualstring Bow",84]' }]),
      );
      expect(result.ok).toBe(true);
    });

    // I/O matrix: "Exact twin".
    it('refuses an exact twin with one issue at the repeat, naming the key and the first index', () => {
      const issues = issuesOf([neverSynced, neverSynced]);
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
      const issues = issuesOf([priced, { entryKey: key, price: { state: 'no-listings' } }]);
      expect(issues).toHaveLength(1);
      expect(issues[0]?.path).toEqual(['entries', 1]);
    });

    // I/O matrix: "Triplet".
    it('reports each repeat of a key at its own index, each naming the first occurrence', () => {
      const other = { ...neverSynced, entryKey: '["raw","Advanced Dualstring Bow",84]' };
      const issues = issuesOf([neverSynced, other, neverSynced, neverSynced]);
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
      expect(parseEnvelope(DatasetFileSchema, fileOf([])).ok).toBe(true);
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

describe('RecipesFileSchema', () => {
  const recipe = {
    id: 'greater',
    currencies: [{ currencyId: 'greater-transmute', quantity: 1 }],
    modifierLevelMin: 0,
  } as const;

  function fileOf(recipes: readonly unknown[]) {
    return { schemaVersion: INITIAL_SCHEMA_VERSION, recipes };
  }

  it('parses a versioned file of recipes', () => {
    const result = parseEnvelope(RecipesFileSchema, fileOf([recipe, { ...recipe, id: 'perfect' }]));
    expect(result.ok).toBe(true);
    expect(result.ok === true && result.value.recipes).toHaveLength(2);
  });

  it('declares schemaVersion and refuses a file with none', () => {
    expect(Object.keys(RecipesFileSchema.shape)).toContain('schemaVersion');
    expect(RecipesFileSchema.safeParse({ recipes: [] }).success).toBe(false);
  });

  it('refuses a repeated id with one issue at the repeat, naming the id and the first index', () => {
    const result = parseEnvelope(RecipesFileSchema, fileOf([recipe, { ...recipe, modifierLevelMin: 5 }]));
    if (result.ok || result.reason !== 'invalid') {
      throw new Error(`expected an invalid refusal, got ${JSON.stringify(result)}`);
    }
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.path).toEqual(['recipes', 1]);
    expect(result.issues[0]?.message).toContain('greater');
    expect(result.issues[0]?.message).toContain('recipes.0');
  });

  it('accepts an empty list', () => {
    expect(parseEnvelope(RecipesFileSchema, fileOf([])).ok).toBe(true);
  });
});

describe('WeightsFileEnvelopeSchema', () => {
  const header = {
    schemaVersion: '6.0.0',
    gamePatch: '0.5.5',
    producer: { id: 'poe-mod-weights-producer', version: '6.0.0', generatedAt: '2026-09-26T10:52:22.504Z' },
  };

  it('reads the version and the header, and passes every other key through untouched', () => {
    const file = { ...header, bases: { anything: [1, 'untyped'] } };
    const result = parseEnvelope(WeightsFileEnvelopeSchema, file, '6.0.0');
    expect(result).toEqual({ ok: true, value: file });
  });

  it('refuses any major but the expected one', () => {
    const result = parseEnvelope(WeightsFileEnvelopeSchema, { ...header, schemaVersion: '5.2.0' }, '6.0.0');
    expect(result).toEqual({ ok: false, reason: 'unknown-major', expected: '6.0.0', found: '5.2.0' });
  });

  it('refuses a file with no version', () => {
    expect(parseEnvelope(WeightsFileEnvelopeSchema, { bases: {} }, '6.0.0').ok).toBe(false);
  });

  it('refuses a missing or empty gamePatch', () => {
    const noPatch: Partial<typeof header> = { ...header };
    delete noPatch.gamePatch;
    expect(parseEnvelope(WeightsFileEnvelopeSchema, noPatch, '6.0.0').ok).toBe(false);
    expect(parseEnvelope(WeightsFileEnvelopeSchema, { ...header, gamePatch: '' }, '6.0.0').ok).toBe(false);
  });

  it('refuses a producer block without an id or a UTC generatedAt', () => {
    const { producer } = header;
    for (const bad of [
      { ...producer, id: '' },
      { version: '6.0.0', generatedAt: producer.generatedAt },
      { ...producer, generatedAt: '2026-09-26' },
      { ...producer, generatedAt: '2026-09-26T10:52:22+02:00' },
    ]) {
      expect(parseEnvelope(WeightsFileEnvelopeSchema, { ...header, producer: bad }, '6.0.0').ok).toBe(false);
    }
  });

  it('does not type bases', () => {
    expect(parseEnvelope(WeightsFileEnvelopeSchema, header, '6.0.0').ok).toBe(true);
    expect(Object.keys(WeightsFileEnvelopeSchema.shape)).toEqual(['schemaVersion', 'producer', 'gamePatch']);
  });
});
