import { ConfigFileSchema, WEIGHTS_SCHEMA_VERSION } from '@poe/contracts';
import type { CraftRecipe, ModifierWeight, RecipesFile, WeightsFile } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { checkTracked } from './check.ts';
import type { TrackedCheckInputs } from './check.ts';
import { crafted, PREFIX_STAT, SUFFIX_STAT, trackedText } from './check.test-support.ts';

const tierOf = (statId: string, ranges: [number, number], itemLevelMin: number): ModifierWeight => ({
  sourceModifierId: `${statId}-${String(itemLevelMin)}`,
  modGroup: statId,
  addsTags: [],
  blockedByTags: [],
  itemLevelMin,
  weight: 100,
  weightSource: 'published',
  lines: [{ statId, ranges: [ranges] }],
});

const PERFECT: CraftRecipe = { id: 'perfect', currencies: [{ currencyId: 'perfect-orb-of-transmutation', quantity: 1 }], modifierLevelMin: 70 };

/** `crafted`'s prefix band holds the tier at 30; the modifier's tier outside the band sits at `aboveAt`. */
function inputsOf(aboveAt: number, recipes: readonly CraftRecipe[]): TrackedCheckInputs {
  const weights: WeightsFile = {
    schemaVersion: WEIGHTS_SCHEMA_VERSION,
    gamePatch: '0.5.5',
    producer: { id: 'test', generatedAt: '2026-11-14T00:00:00Z' },
    bases: {
      'accessory.amulet': {
        Amulets: {
          prefix: { poolCoverage: 'complete', entries: [tierOf(PREFIX_STAT, [47, 50], 30), tierOf(PREFIX_STAT, [60, 65], aboveAt)] },
          suffix: { poolCoverage: 'complete', entries: [tierOf(SUFFIX_STAT, [3, 3], 70)] },
        },
      },
    },
  };
  const recipesFile: RecipesFile = { schemaVersion: '1.0.0', recipes: [...recipes] };
  return {
    tracked: trackedText([crafted]),
    config: { ok: true, value: ConfigFileSchema.parse({ schemaVersion: '1.0.0', league: 'Test League', minChunkSearches: 2 }) },
    catalogue: {
      ok: true,
      value: { statIds: new Set([PREFIX_STAT, SUFFIX_STAT]), baseTypeIds: new Set(), categoryIds: new Set(['accessory.amulet']) },
    },
    weights: { ok: true, value: weights },
    recipes: { ok: true, value: recipesFile },
  };
}

describe('checkTracked: reach under any recipe at any offered level (AD-17, FR-38)', () => {
  it('lists an entry that no recipe reaches at 79 or 82', () => {
    const report = checkTracked(inputsOf(75, [PERFECT]));
    expect(report.ok).toBe(false);
    expect(report.unreachable.map((row) => row.path)).toEqual(['entries.0']);
  });

  it('does not list an entry that the recipe reaches at 79 only', () => {
    // At 79 the tier at 80 is out of scope, so the in-band tier is the modifier's highest and survives.
    const report = checkTracked(inputsOf(80, [PERFECT]));
    expect(report.ok).toBe(true);
    expect(report.unreachable).toEqual([]);
  });

  it('does not list an entry that another recipe reaches', () => {
    const report = checkTracked(inputsOf(75, [PERFECT, { ...PERFECT, id: 'plain', modifierLevelMin: 0 }]));
    expect(report.unreachable).toEqual([]);
  });

  it('does not flag every entry when the recipes file lists no recipe', () => {
    const report = checkTracked(inputsOf(75, []));
    expect(report.unreachable).toEqual([]);
    expect(report.checks).toContainEqual({ check: 'recipe-reach', status: 'skipped' });
  });
});
