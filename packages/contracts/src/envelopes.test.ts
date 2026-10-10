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
      categoryId: 'weapon.bow',
      className: 'Bows',
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
    const result = parseEnvelope(TrackedFileSchema, { ...trackedFile, schemaVersion: '4.0.0' }, TRACKED_SCHEMA_VERSION);
    expect(result).toEqual({
      ok: false,
      reason: 'unknown-major',
      expected: TRACKED_SCHEMA_VERSION,
      found: '4.0.0',
    });
  });

  // Story 4.8, I/O matrix "2.x tracked file": a raw entry now names its class.
  it('refuses a tracked file at the earlier 2.x major as unknown-major, never a throw', () => {
    const result = parseEnvelope(TrackedFileSchema, { ...trackedFile, schemaVersion: '2.0.0' }, TRACKED_SCHEMA_VERSION);
    expect(result).toEqual({
      ok: false,
      reason: 'unknown-major',
      expected: TRACKED_SCHEMA_VERSION,
      found: '2.0.0',
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
        schemaVersion: '4.0.0',
        entries: 'not even an array',
      },
      TRACKED_SCHEMA_VERSION,
    );
    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toBe('unknown-major');
  });

  // I/O matrix: "Known major, newer minor".
  it('accepts a newer minor under a known major', () => {
    const result = parseEnvelope(TrackedFileSchema, { ...trackedFile, schemaVersion: '3.4.0' }, TRACKED_SCHEMA_VERSION);
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.entries).toHaveLength(1);
  });

  it('reports a shape failure as invalid, with the issues', () => {
    const result = parseEnvelope(TrackedFileSchema, { ...trackedFile, entries: [{ kind: 'raw' }] }, TRACKED_SCHEMA_VERSION);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toBe('invalid');
    expect(!result.ok && result.reason === 'invalid' && result.issues.length > 0).toBe(true);
  });

  it('reports a malformed version apart from an unknown major', () => {
    const result = parseEnvelope(TrackedFileSchema, { ...trackedFile, schemaVersion: 'one' }, TRACKED_SCHEMA_VERSION);
    expect(!result.ok && result.reason).toBe('malformed-version');
  });

  it('reports a file with no version field as invalid rather than guessing', () => {
    const result = parseEnvelope(TrackedFileSchema, { entries: [] });
    expect(!result.ok && result.reason).toBe('invalid');
  });
});

function trackedFileOf(entries: readonly unknown[]) {
  return { schemaVersion: TRACKED_SCHEMA_VERSION, entries };
}

function trackedIssuesOf(entries: readonly unknown[]) {
  const result = parseEnvelope(TrackedFileSchema, trackedFileOf(entries), TRACKED_SCHEMA_VERSION);
  expect(result.ok).toBe(false);
  if (result.ok || result.reason !== 'invalid') {
    throw new Error(`expected an invalid refusal, got ${JSON.stringify(result)}`);
  }
  return result.issues;
}

describe('TrackedFileSchema canonical-key uniqueness (L-A1)', () => {
  const rawTwin = {
    kind: 'raw',
    baseTypeId: 'Advanced Dualstring Bow',
    categoryId: 'weapon.bow',
    className: 'Bows',
    itemLevelMin: 82,
    status: 'active',
  } as const;
  const rawKey = canonicalKey(rawTwin);

  // I/O matrix: "Distinct keys".
  it('accepts two entries on one base with different itemLevelMin', () => {
    const result = parseEnvelope(
      TrackedFileSchema,
      trackedFileOf([rawTwin, { ...rawTwin, itemLevelMin: 84 }]),
      TRACKED_SCHEMA_VERSION,
    );
    expect(result.ok).toBe(true);
  });

  // I/O matrix: "Exact twin".
  it('refuses an exact twin with one issue at the repeat, naming the key and the first index', () => {
    const issues = trackedIssuesOf([rawTwin, rawTwin]);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.path).toEqual(['entries', 1]);
    expect(issues[0]?.message).toContain(rawKey);
    expect(issues[0]?.message).toContain('entries.0');
  });

  // I/O matrix: "Status twin".
  it('refuses one key held active and pinned', () => {
    const issues = trackedIssuesOf([rawTwin, { ...rawTwin, status: 'pinned' }]);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.path).toEqual(['entries', 1]);
  });

  // I/O matrix: "Pruned twin".
  it('refuses one key held active and pruned', () => {
    const issues = trackedIssuesOf([rawTwin, { ...rawTwin, status: 'pruned', prunedReason: 'too slow' }]);
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
    const issues = trackedIssuesOf([
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
    const issues = trackedIssuesOf([rawTwin, other, rawTwin, rawTwin]);
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
    expect(parseEnvelope(TrackedFileSchema, trackedFileOf([]), TRACKED_SCHEMA_VERSION).ok).toBe(true);
  });
});
