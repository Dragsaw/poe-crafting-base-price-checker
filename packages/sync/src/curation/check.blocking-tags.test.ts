import { ConfigFileSchema, WEIGHTS_SCHEMA_VERSION } from '@poe/contracts';
import type { ModifierWeight, RecipesFile, WeightsFile } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { checkTracked } from './check.ts';
import type { TrackedCheckInputs } from './check.ts';
import { crafted, PREFIX_STAT, SUFFIX_STAT, trackedText } from './check.test-support.ts';

const COLD = 'no_cold_spell_mods';
const FIRE = 'no_fire_spell_mods';

const tierOf = (statId: string, ranges: [number, number], extra: Partial<ModifierWeight> = {}): ModifierWeight => ({
  sourceModifierId: `${statId}-${String(extra.itemLevelMin ?? 70)}`,
  modGroup: statId,
  addsTags: [],
  blockedByTags: [],
  itemLevelMin: 70,
  weight: 100,
  weightSource: 'published',
  lines: [{ statId, ranges: [ranges] }],
  ...extra,
});

/** The prefix adds `no_cold` and is blocked by `no_fire`; `blockedSuffix` is the reverse. */
const PREFIX = tierOf(PREFIX_STAT, [47, 50], { addsTags: [COLD], blockedByTags: [FIRE] });
const blockedSuffix = (itemLevelMin: number) => tierOf(SUFFIX_STAT, [3, 3], { itemLevelMin, addsTags: [FIRE], blockedByTags: [COLD] });

function inputsOf(suffix: readonly ModifierWeight[]): TrackedCheckInputs {
  const weights: WeightsFile = {
    schemaVersion: WEIGHTS_SCHEMA_VERSION,
    gamePatch: '0.5.5',
    producer: { id: 'test', generatedAt: '2026-10-24T00:00:00Z' },
    bases: {
      'accessory.amulet': {
        Amulets: {
          prefix: { poolCoverage: 'complete', entries: [PREFIX, tierOf('explicit.prefix_filler', [1, 1], { itemLevelMin: 1 })] },
          suffix: { poolCoverage: 'complete', entries: [...suffix, tierOf('explicit.suffix_filler', [1, 1], { itemLevelMin: 1 })] },
        },
      },
    },
  };
  const recipes: RecipesFile = {
    schemaVersion: '1.0.0',
    recipes: [{ id: 'perfect', currencies: [{ currencyId: 'perfect-orb-of-transmutation', quantity: 1 }], modifierLevelMin: 70 }],
  };
  return {
    tracked: trackedText([crafted]),
    config: { ok: true, value: ConfigFileSchema.parse({ schemaVersion: '1.0.0', league: 'Test League', minChunkSearches: 2 }) },
    catalogue: {
      ok: true,
      value: { statIds: new Set([PREFIX_STAT, SUFFIX_STAT]), baseTypeIds: new Set(), categoryIds: new Set(['accessory.amulet']) },
    },
    weights: { ok: true, value: weights },
    recipes: { ok: true, value: recipes },
  };
}

describe('checkTracked: blocking tags (AD-17)', () => {
  it('fails, so exits non-zero, on a combination blocked in both draw orders, naming the entry', () => {
    const report = checkTracked(inputsOf([blockedSuffix(70)]));

    expect(report.ok).toBe(false);
    expect(report.checks).toContainEqual({ check: 'cross-file', status: 'failed' });
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0]).toMatchObject({ check: 'cross-file', path: 'entries.0' });
    expect(report.issues[0]?.message).toContain('co-rollable-combination: ');
    expect(report.issues[0]?.message).toContain('"crafted","accessory.amulet","Amulets",75');
  });

  it('lists a pair whose recipe floor leaves only blocked tiers under unreachable, on both slots', () => {
    const open = tierOf(SUFFIX_STAT, [3, 3], { itemLevelMin: 30 });
    const report = checkTracked(inputsOf([open, blockedSuffix(75)]));

    expect(report.ok).toBe(false);
    expect(report.checks).toContainEqual({ check: 'cross-file', status: 'passed' });
    expect(report.checks).toContainEqual({ check: 'recipe-reach', status: 'failed' });
    expect(report.unreachable.map((row) => [row.recipeId, row.slot, row.path])).toEqual([
      ['perfect', 'prefix', 'entries.0'],
      ['perfect', 'suffix', 'entries.0'],
    ]);
  });
});
