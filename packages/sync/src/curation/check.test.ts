import {
  ConfigFileSchema,
  createFakeFilesystemPort,
  trackedEarlierMajorMessage,
  WEIGHTS_SCHEMA_VERSION,
} from '@poe/contracts';
import type { CraftRecipe, ModifierWeight, RecipesFile, WeightsFile, WeightsPool } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import type { CatalogueIds } from '../catalogue/catalogue-ids.ts';
import { DataFileError } from '../load-data-file.ts';
import { checkTracked, loadTrackedCheckInputs } from './check.ts';
import type { TrackedCheckInputs } from './check.ts';
import { crafted, PREFIX_STAT, SUFFIX_STAT, trackedText } from './check.test-support.ts';

const CATALOGUE: CatalogueIds = {
  statIds: new Set([PREFIX_STAT, SUFFIX_STAT]),
  baseTypeIds: new Set(['Gold Amulet', 'Solar Amulet']),
  categoryIds: new Set(['accessory.amulet']),
};

const gold = { kind: 'raw', baseTypeId: 'Gold Amulet', itemLevelMin: 82, status: 'active' };
const solar = { kind: 'raw', baseTypeId: 'Solar Amulet', itemLevelMin: 82, status: 'active' };

const tier = (statId: string, min: number, max: number): ModifierWeight => ({
  sourceModifierId: statId,
  modGroup: statId,
  itemLevelMin: 70,
  weight: 100,
  weightSource: 'published',
  lines: [{ statId, ranges: [[min, max]] }],
});

/** A weights file on which `crafted` passes all six cross-file checks. */
const WEIGHTS: WeightsFile = {
  schemaVersion: WEIGHTS_SCHEMA_VERSION,
  gamePatch: '0.5.5',
  producer: { id: 'test', generatedAt: '2026-09-27T00:00:00Z' },
  bases: {
    'accessory.amulet': {
      Amulets: {
        prefix: { poolCoverage: 'complete', entries: [tier(PREFIX_STAT, 47, 50)] },
        suffix: { poolCoverage: 'complete', entries: [tier(SUFFIX_STAT, 3, 3)] },
      },
    },
  },
};

const PERFECT: CraftRecipe = { id: 'perfect', currencies: [{ currencyId: 'perfect-orb-of-transmutation', quantity: 1 }], modifierLevelMin: 70 };
const RECIPES: RecipesFile = { schemaVersion: '1.0.0', recipes: [PERFECT] };

/** One modGroup at 30 and 75: the perfect floor of 70 keeps only 75, outside the band. */
function floored(statId: string, inBand: [number, number], outside: [number, number]): ModifierWeight[] {
  return [
    { ...tier(statId, ...inBand), sourceModifierId: `${statId}-low`, itemLevelMin: 30 },
    { ...tier(statId, ...outside), sourceModifierId: `${statId}-high`, itemLevelMin: 75 },
  ];
}

/** `WEIGHTS` with the prefix floored out of `crafted`'s band, and `suffix` as given. */
function flooredWeights(suffix?: WeightsPool): WeightsFile {
  const otherSlot = suffix ?? { poolCoverage: 'complete', entries: [tier(SUFFIX_STAT, 3, 3)] };
  const prefix = { poolCoverage: 'complete' as const, entries: floored(PREFIX_STAT, [47, 50], [60, 65]) };
  return { ...WEIGHTS, bases: { 'accessory.amulet': { Amulets: { prefix, suffix: otherSlot } } } };
}

function inputsOf(entries: readonly unknown[], overrides: Partial<TrackedCheckInputs> = {}): TrackedCheckInputs {
  return {
    tracked: trackedText(entries),
    config: {
      ok: true,
      value: ConfigFileSchema.parse({ schemaVersion: '1.0.0', league: 'Test League', minChunkSearches: 2 }),
    },
    catalogue: { ok: true, value: CATALOGUE },
    weights: { ok: true, value: WEIGHTS },
    recipes: { ok: true, value: RECIPES },
    ...overrides,
  };
}

describe('checkTracked', () => {
  it('passes a valid list: every check passed, the cross-file checks included', () => {
    const report = checkTracked(inputsOf([crafted, gold, solar]));

    expect(report).toEqual({
      ok: true,
      checks: [
        { check: 'schema', status: 'passed' },
        { check: 'pinned-cap', status: 'passed' },
        { check: 'catalogue', status: 'passed' },
        { check: 'cross-file', status: 'passed' },
        { check: 'recipe-reach', status: 'passed' },
      ],
      issues: [],
      unvalidated: [],
      unreachable: [],
    });
  });

  it('lists an entry whose band holds only tiers the floor removes as unreachable, and fails', () => {
    const report = checkTracked(inputsOf([gold, crafted], { weights: { ok: true, value: flooredWeights() } }));
    expect(report.ok).toBe(false);
    expect(report.issues).toEqual([]);
    expect(report.checks).toContainEqual({ check: 'recipe-reach', status: 'failed' });
    expect(report.unreachable).toEqual([
      {
        entryKey: expect.stringContaining('"accessory.amulet","Amulets",75') as unknown,
        recipeId: 'perfect',
        slot: 'prefix',
        path: 'entries.1',
      },
    ]);
  });

  it('sorts unreachable rows by key, then recipe, then slot', () => {
    const suffix = { poolCoverage: 'complete' as const, entries: floored(SUFFIX_STAT, [3, 3], [5, 5]) };
    const recipes: RecipesFile = { ...RECIPES, recipes: [PERFECT, { ...PERFECT, id: 'alpha' }] };
    const weights = { ok: true, value: flooredWeights(suffix) } as const;
    const report = checkTracked(inputsOf([crafted], { weights, recipes: { ok: true, value: recipes } }));
    expect(report.unreachable.map((row) => [row.recipeId, row.slot])).toEqual([['alpha', 'prefix'], ['alpha', 'suffix'], ['perfect', 'prefix'], ['perfect', 'suffix']]);
  });

  it('does not reach-check a class with a partial slot', () => {
    const partial = { poolCoverage: 'partial' as const, entries: [tier(SUFFIX_STAT, 3, 3)] };
    const report = checkTracked(inputsOf([crafted], { weights: { ok: true, value: flooredWeights(partial) } }));
    expect(report.ok).toBe(true);
    expect(report.checks).toContainEqual({ check: 'recipe-reach', status: 'passed' });
    expect(report.unreachable).toEqual([]);
  });

  it('skips the reach check without a weights file, and with a refused one', () => {
    const error = new DataFileError('data/weights.json', 'unknown-major', 'schemaVersion 9.0.0 refused');
    for (const weights of [{ ok: true, value: undefined }, { ok: false, error }] as const) {
      const report = checkTracked(inputsOf([crafted], { weights }));
      expect(report.checks).toContainEqual({ check: 'recipe-reach', status: 'skipped' });
      expect(report.unreachable).toEqual([]);
    }
  });

  it('skips the reach check without a recipes file, and fails on a refused one with its message', () => {
    const absent = checkTracked(inputsOf([crafted], { recipes: { ok: true, value: undefined } }));
    expect(absent.ok).toBe(true);
    expect(absent.checks).toContainEqual({ check: 'recipe-reach', status: 'skipped' });
    expect(absent.unreachable).toEqual([]);

    const error = new DataFileError('data/recipes.json', 'invalid', 'invalid: recipes: expected array');
    const refused = checkTracked(inputsOf([crafted], { recipes: { ok: false, error } }));
    expect(refused.ok).toBe(false);
    expect(refused.checks).toContainEqual({ check: 'recipe-reach', status: 'failed' });
    expect(refused.issues).toEqual([{ check: 'recipe-reach', message: error.message }]);
    expect(refused.unreachable).toEqual([]);
  });

  it('loads an absent recipes file as absent and an invalid one as a refusal', async () => {
    const absent = await loadTrackedCheckInputs(createFakeFilesystemPort({}));
    expect(absent.recipes).toEqual({ ok: true, value: undefined });

    const invalid = await loadTrackedCheckInputs(
      createFakeFilesystemPort({ 'data/recipes.json': { contents: JSON.stringify({ schemaVersion: '1.0.0', recipes: 'nope' }) } }),
    );
    expect(invalid.recipes.ok).toBe(false);
    expect(invalid.recipes.ok ? '' : invalid.recipes.error.message).toMatch(/^data\/recipes\.json: invalid/);
  });

  it('reports each cross-file failure as one issue at its entry, naming the check and the key', () => {
    const sentinel = { ...crafted, prefix: { ...crafted.prefix, valueMin: 0, valueMax: 9999 } };
    const report = checkTracked(inputsOf([gold, sentinel]));

    expect(report.ok).toBe(false);
    expect(report.checks).toContainEqual({ check: 'cross-file', status: 'failed' });
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0]).toMatchObject({ check: 'cross-file', path: 'entries.1' });
    expect(report.issues[0]?.message).toContain(`edge-alignment: prefix ${PREFIX_STAT} band [0, 9999] at floor 75`);
    expect(report.issues[0]?.message).toContain('"crafted","accessory.amulet","Amulets",75');
  });

  it('skips the cross-file checks without a weights file, and reports a refused one', () => {
    const absent = checkTracked(inputsOf([crafted], { weights: { ok: true, value: undefined } }));
    expect(absent.ok).toBe(true);
    expect(absent.checks).toContainEqual({ check: 'cross-file', status: 'skipped' });
    expect(absent.issues).toEqual([]);
    expect(absent.unvalidated).toEqual([
      {
        entryKey: expect.stringContaining('"accessory.amulet","Amulets",75') as unknown,
        categoryId: 'accessory.amulet',
        className: 'Amulets',
        reason: 'weights-absent',
        path: 'entries.0',
      },
    ]);

    const error = new DataFileError('data/weights.json', 'unknown-major', 'schemaVersion 9.0.0 refused');
    const refused = checkTracked(inputsOf([crafted], { weights: { ok: false, error } }));
    expect(refused.ok).toBe(false);
    expect(refused.checks).toContainEqual({ check: 'cross-file', status: 'failed' });
    expect(refused.issues).toContainEqual({ check: 'cross-file', message: error.message });
  });

  it('lists each entry of a partial class as unvalidated without failing on it', () => {
    const amulets = WEIGHTS.bases['accessory.amulet']?.Amulets;
    if (amulets === undefined) {
      throw new Error('fixture class missing');
    }
    const partial: WeightsFile = {
      ...WEIGHTS,
      bases: { 'accessory.amulet': { Amulets: { ...amulets, suffix: { ...amulets.suffix, poolCoverage: 'partial' } } } },
    };
    const sentinel = { ...crafted, prefix: { ...crafted.prefix, valueMin: 0, valueMax: 9999 } };
    const report = checkTracked(inputsOf([gold, sentinel], { weights: { ok: true, value: partial } }));

    expect(report.ok).toBe(true);
    expect(report.checks).toContainEqual({ check: 'cross-file', status: 'passed' });
    expect(report.issues).toEqual([]);
    expect(report.unvalidated).toHaveLength(1);
    expect(report.unvalidated[0]).toMatchObject({ reason: 'partial-pool', path: 'entries.1', className: 'Amulets' });
  });

  it('reports a schema issue at its path and skips the checks that need entries', () => {
    const statusless = { kind: 'raw', baseTypeId: 'Gold Amulet', itemLevelMin: 82 };
    const report = checkTracked(inputsOf([crafted, statusless]));

    expect(report.ok).toBe(false);
    expect(report.checks).toEqual([
      { check: 'schema', status: 'failed' },
      { check: 'pinned-cap', status: 'skipped' },
      { check: 'catalogue', status: 'skipped' },
      { check: 'cross-file', status: 'skipped' },
      { check: 'recipe-reach', status: 'skipped' },
    ]);
    expect(report.issues.length).toBeGreaterThan(0);
    for (const issue of report.issues) {
      expect(issue.check).toBe('schema');
      expect(issue.path).toMatch(/^entries\.1/);
    }
  });

  it('reports a repeated canonical key at the repeat, naming the first occurrence', () => {
    const report = checkTracked(inputsOf([gold, solar, { ...gold, status: 'pinned' }]));

    expect(report.ok).toBe(false);
    expect(report.issues).toEqual([
      { check: 'schema', path: 'entries.2', message: expect.stringContaining('repeats entries.0') as unknown },
    ]);
  });

  it('refuses a later unknown major as one schemaVersion issue, with the generic message', () => {
    const report = checkTracked(inputsOf([], { tracked: trackedText([], '3.0.0') }));

    expect(report.ok).toBe(false);
    expect(report.issues).toEqual([
      { check: 'schema', path: 'schemaVersion', message: expect.stringContaining('unknown-major') as unknown },
    ]);
  });

  it('refuses a malformed version with the generic message', () => {
    const report = checkTracked(inputsOf([], { tracked: trackedText([], 'abc') }));

    expect(report.issues).toEqual([
      { check: 'schema', path: 'schemaVersion', message: expect.stringContaining('malformed-version') as unknown },
    ]);
  });

  // Story hybrid-mods 2, I/O matrix "Earlier major": the re-author message.
  it('refuses an earlier 1.x major with the re-author message, naming both affixes and hybrid', () => {
    const report = checkTracked(inputsOf([], { tracked: trackedText([crafted], '1.0.0') }));

    expect(report.ok).toBe(false);
    expect(report.issues).toEqual([
      {
        check: 'schema',
        path: 'schemaVersion',
        message: `data/tracked.json: ${String(trackedEarlierMajorMessage('1.0.0'))}`,
      },
    ]);
    const message = report.issues[0]?.message ?? '';
    for (const part of ['major version changed', 'both a prefix and a suffix', '"hybrid"', 'Re-author']) {
      expect(message).toContain(part);
    }
  });

  // Story hybrid-mods 2, I/O matrix "Missing slot".
  it('reports a crafted entry without a suffix as a schema issue at the suffix path', () => {
    const prefixOnly: Partial<typeof crafted> = { ...crafted };
    delete prefixOnly.suffix;
    const report = checkTracked(inputsOf([prefixOnly]));

    expect(report.ok).toBe(false);
    expect(report.issues).toEqual([{ check: 'schema', path: 'entries.0.suffix', message: expect.any(String) as unknown }]);
  });

  it('reports text that is not JSON', () => {
    const report = checkTracked(inputsOf([], { tracked: '{ not json' }));

    expect(report.issues).toEqual([
      { check: 'schema', message: expect.stringContaining('data/tracked.json: not valid JSON') as unknown },
    ]);
  });

  it('reports a pinned set over the cap (0.5 × minChunkSearches)', () => {
    const report = checkTracked(inputsOf([{ ...gold, status: 'pinned' }, { ...solar, status: 'pinned' }]));

    expect(report.ok).toBe(false);
    expect(report.checks).toContainEqual({ check: 'pinned-cap', status: 'failed' });
    expect(report.checks).toContainEqual({ check: 'catalogue', status: 'passed' });
    expect(report.issues).toEqual([
      { check: 'pinned-cap', message: expect.stringContaining('exceed the cap of 1') as unknown },
    ]);
  });

  it('reports each id absent from the catalogue as one issue at its entry', () => {
    const missing = { ...crafted, categoryId: 'accessory.nope', prefix: { ...crafted.prefix, statId: 'explicit.stat_0' } };
    const report = checkTracked(inputsOf([gold, missing, { ...solar, baseTypeId: 'Nope Amulet' }]));

    expect(report.ok).toBe(false);
    expect(report.checks).toContainEqual({ check: 'catalogue', status: 'failed' });
    expect(report.issues.map((issue) => [issue.check, issue.path])).toEqual([
      ['catalogue', 'entries.1'],
      ['catalogue', 'entries.1'],
      ['catalogue', 'entries.2'],
    ]);
    expect(report.issues[0]?.message).toContain('categoryId accessory.nope');
    expect(report.issues[1]?.message).toContain('statId explicit.stat_0');
    expect(report.issues[2]?.message).toContain('baseTypeId Nope Amulet');
  });

  it('does not check a pruned entry against the catalogue', () => {
    const report = checkTracked(inputsOf([{ ...solar, baseTypeId: 'Nope Amulet', status: 'pruned', prunedReason: 'x' }]));

    expect(report.ok).toBe(true);
  });

  it('reports an absent tracked file, config file and first catalogue file by name', async () => {
    const report = checkTracked(await loadTrackedCheckInputs(createFakeFilesystemPort({})));

    expect(report.ok).toBe(false);
    expect(report.checks).toEqual([
      { check: 'schema', status: 'failed' },
      { check: 'pinned-cap', status: 'failed' },
      { check: 'catalogue', status: 'failed' },
      { check: 'cross-file', status: 'skipped' },
      { check: 'recipe-reach', status: 'skipped' },
    ]);
    expect(report.issues.map((issue) => issue.message)).toEqual([
      'data/tracked.json: the file is absent',
      'data/config.json: the file is absent',
      'data/catalogue/stats.json: the file is absent',
    ]);
  });
});
