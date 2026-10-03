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
} from './envelopes';
import { INITIAL_SCHEMA_VERSION, TRACKED_SCHEMA_VERSION } from './schema-version';
import { without } from './test-support';

const trackedFile = {
  schemaVersion: TRACKED_SCHEMA_VERSION,
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
    const result = parseEnvelope(TrackedFileSchema, { ...trackedFile, schemaVersion: '3.0.0' }, TRACKED_SCHEMA_VERSION);
    expect(result).toEqual({
      ok: false,
      reason: 'unknown-major',
      expected: TRACKED_SCHEMA_VERSION,
      found: '3.0.0',
    });
  });

  // Story hybrid-mods 2: the tracked schema's 2.0.0 major refuses a 1.x file.
  it('refuses a tracked file at the earlier 1.x major', () => {
    const result = parseEnvelope(TrackedFileSchema, { ...trackedFile, schemaVersion: '1.0.0' }, TRACKED_SCHEMA_VERSION);
    expect(result).toEqual({
      ok: false,
      reason: 'unknown-major',
      expected: TRACKED_SCHEMA_VERSION,
      found: '1.0.0',
    });
  });

  it('refuses an unknown major before it parses the body, not after', () => {
    const result = parseEnvelope(
      TrackedFileSchema,
      {
        schemaVersion: '3.0.0',
        entries: 'not even an array',
      },
      TRACKED_SCHEMA_VERSION,
    );
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toBe('unknown-major');
  });

  // I/O matrix: "Known major, newer minor".
  it('accepts a newer minor under a known major', () => {
    const result = parseEnvelope(TrackedFileSchema, { ...trackedFile, schemaVersion: '2.4.0' }, TRACKED_SCHEMA_VERSION);
    expect(result.ok).toBe(true);
    expect(result.ok === true && result.value.entries).toHaveLength(1);
  });

  it('reports a shape failure as invalid, with the issues', () => {
    const result = parseEnvelope(TrackedFileSchema, { ...trackedFile, entries: [{ kind: 'raw' }] }, TRACKED_SCHEMA_VERSION);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toBe('invalid');
    expect(result.ok === false && result.reason === 'invalid' && result.issues.length).toBeGreaterThan(0);
  });

  it('reports a malformed version apart from an unknown major', () => {
    const result = parseEnvelope(TrackedFileSchema, { ...trackedFile, schemaVersion: 'one' }, TRACKED_SCHEMA_VERSION);
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
    return { schemaVersion: TRACKED_SCHEMA_VERSION, entries };
  }

  function issuesOf(entries: readonly unknown[]) {
    const result = parseEnvelope(TrackedFileSchema, fileOf(entries), TRACKED_SCHEMA_VERSION);
    expect(result.ok).toBe(false);
    if (result.ok || result.reason !== 'invalid') {
      throw new Error(`expected an invalid refusal, got ${JSON.stringify(result)}`);
    }
    return result.issues;
  }

  // I/O matrix: "Distinct keys".
  it('accepts two entries on one base with different itemLevelMin', () => {
    const result = parseEnvelope(
      TrackedFileSchema,
      fileOf([rawTwin, { ...rawTwin, itemLevelMin: 84 }]),
      TRACKED_SCHEMA_VERSION,
    );
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
      suffix: { kind: 'valueless', statId: 'explicit.stat_2' },
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
    expect(parseEnvelope(TrackedFileSchema, fileOf([]), TRACKED_SCHEMA_VERSION).ok).toBe(true);
  });
});

describe('TrackedFileSchema shared floor (AD-17, FR-22)', () => {
  const amulet = (itemLevelMin: number, statId: string, status = 'active') => ({
    kind: 'crafted',
    categoryId: 'accessory.amulet',
    className: 'Amulets',
    itemLevelMin,
    prefix: { kind: 'valueless', statId },
    suffix: { kind: 'valueless', statId: 'explicit.suffix' },
    status,
    ...(status === 'pruned' ? { prunedReason: 'no market' } : {}),
  });

  const parse = (entries: readonly unknown[]) =>
    parseEnvelope(TrackedFileSchema, { schemaVersion: TRACKED_SCHEMA_VERSION, entries }, TRACKED_SCHEMA_VERSION);

  // I/O matrix: "Shared floor".
  it('refuses two non-pruned crafted entries on one class at 82 and 75, with the issue at the second', () => {
    const result = parse([amulet(82, 'explicit.a'), amulet(75, 'explicit.b')]);
    if (result.ok || result.reason !== 'invalid') {
      throw new Error(`expected an invalid refusal, got ${JSON.stringify(result)}`);
    }
    expect(result.issues).toHaveLength(1);
    const [issue] = result.issues;
    expect(issue?.path).toEqual(['entries', 1, 'itemLevelMin']);
    expect(issue?.message).toContain('accessory.amulet/Amulets');
    expect(issue?.message).toContain('82');
    expect(issue?.message).toContain('75');
    expect(issue?.message).toContain('entries.0');
  });

  it('reports one issue per breaching entry', () => {
    const result = parse([amulet(82, 'explicit.a'), amulet(75, 'explicit.b'), amulet(70, 'explicit.c')]);
    if (result.ok || result.reason !== 'invalid') {
      throw new Error(`expected an invalid refusal, got ${JSON.stringify(result)}`);
    }
    expect(result.issues.map((issue) => issue.path)).toEqual([
      ['entries', 1, 'itemLevelMin'],
      ['entries', 2, 'itemLevelMin'],
    ]);
  });

  // I/O matrix: "Shared floor, exempt".
  it('loads a pruned entry at 75 beside 82', () => {
    expect(parse([amulet(82, 'explicit.a'), amulet(75, 'explicit.b', 'pruned')]).ok).toBe(true);
  });

  it('never lets a pruned entry set the class floor', () => {
    expect(
      parse([amulet(75, 'explicit.a', 'pruned'), amulet(82, 'explicit.b'), amulet(82, 'explicit.c')]).ok,
    ).toBe(true);
  });

  it('loads a raw entry at 75 beside a crafted entry at 82', () => {
    const raw = { kind: 'raw', baseTypeId: 'Gold Amulet', itemLevelMin: 75, status: 'active' };
    expect(parse([amulet(82, 'explicit.a'), raw]).ok).toBe(true);
  });

  it('keeps separate floors for separate classes', () => {
    expect(parse([amulet(82, 'explicit.a'), { ...amulet(1, 'explicit.b'), className: 'Rings' }]).ok).toBe(true);
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

describe('RecipesFileSchema', () => {
  const recipe = {
    id: 'greater',
    currencies: [{ currencyId: 'greater-transmute', quantity: 1 }],
    modifierLevelMin: 0,
  } as const;

  function fileOf(recipes: readonly unknown[]) {
    return { schemaVersion: INITIAL_SCHEMA_VERSION, recipes };
  }

  const perfect = {
    id: 'perfect',
    currencies: [{ currencyId: 'perfect-transmute', quantity: 1 }],
    modifierLevelMin: 70,
  } as const;

  function issuesOf(recipes: readonly unknown[]) {
    const result = parseEnvelope(RecipesFileSchema, fileOf(recipes));
    if (result.ok || result.reason !== 'invalid') {
      throw new Error(`expected an invalid refusal, got ${JSON.stringify(result)}`);
    }
    return result.issues;
  }

  it('parses a versioned file of recipes', () => {
    const result = parseEnvelope(RecipesFileSchema, fileOf([recipe, perfect]));
    expect(result.ok).toBe(true);
    expect(result.ok === true && result.value.recipes).toHaveLength(2);
  });

  it('accepts one regular recipe beside graded ones', () => {
    const regular = { id: 'regular', currencies: [{ currencyId: 'orb-of-transmutation', quantity: 1 }], modifierLevelMin: 0 };
    expect(parseEnvelope(RecipesFileSchema, fileOf([recipe, perfect, regular])).ok).toBe(true);
  });

  it('refuses a recipe that mixes grades, with one issue at its index naming it', () => {
    const mixed = {
      id: 'mixed',
      currencies: [
        { currencyId: 'greater-transmute', quantity: 1 },
        { currencyId: 'perfect-augment', quantity: 1 },
      ],
      modifierLevelMin: 44,
    };
    const issues = issuesOf([perfect, mixed]);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.path).toEqual(['recipes', 1]);
    expect(issues[0]?.message).toContain('mixed');
    expect(issuesOf([{ ...mixed, currencies: [mixed.currencies[0], { currencyId: 'exalted', quantity: 1 }] }])).toHaveLength(1);
  });

  it('refuses two recipes that derive one word, naming the word and the first recipe', () => {
    const issues = issuesOf([recipe, perfect, { ...recipe, id: 'greater-too' }]);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.path).toEqual(['recipes', 2]);
    expect(issues[0]?.message).toContain('greater');
    expect(issues[0]?.message).toContain('recipes.0');
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

describe('TrackedFileSchema, hybrid references (CAP-1)', () => {
  const hybridPrefix = (min: number, max: number) => ({
    kind: 'hybrid',
    lines: [
      { statId: 'explicit.stat_691932474', valueMin: min, valueMax: max },
      { statId: 'explicit.stat_1509134228', valueMin: 25, valueMax: 34 },
    ],
  });
  const crafted = (prefix: unknown) => ({
    kind: 'crafted',
    categoryId: 'weapon.bow',
    className: 'Bows',
    itemLevelMin: 82,
    prefix,
    suffix: { kind: 'valueless', statId: 'explicit.stat_2' },
    status: 'active',
  });
  const parse = (entries: readonly unknown[]) =>
    parseEnvelope(TrackedFileSchema, { schemaVersion: TRACKED_SCHEMA_VERSION, entries }, TRACKED_SCHEMA_VERSION);

  it('parses an entry whose prefix is the Bows phys%+accuracy hybrid', () => {
    expect(parse([crafted(hybridPrefix(16, 20))]).ok).toBe(true);
  });

  it('does not evaluate the within-file overlap of a pair with a hybrid reference', () => {
    // The two hybrids' bands intersect on every line; core evaluates the pair (§2.1).
    expect(parse([crafted(hybridPrefix(16, 20)), crafted(hybridPrefix(18, 22))]).ok).toBe(true);
    expect(
      parse([
        crafted(hybridPrefix(16, 20)),
        crafted({ kind: 'banded', statId: 'explicit.stat_691932474', valueMin: 16, valueMax: 20 }),
      ]).ok,
    ).toBe(true);
  });
});
