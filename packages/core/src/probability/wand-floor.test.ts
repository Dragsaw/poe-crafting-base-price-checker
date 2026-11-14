import { parseEnvelope, WEIGHTS_SCHEMA_VERSION, WeightsFileSchema } from '@poe/contracts';
import type { ModifierReference, WeightsClassPools } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { CRAFTING_ITEM_LEVELS } from '../crafting-item-level.ts';
import { combinationProbability, eligible, poolOf, recipeReach } from '../probability.ts';

const COLD_DAMAGE = 'explicit.stat_2505884597';
const COLD_SPELL_LEVEL = 'explicit.stat_2254480358';
const PERFECT = 70;
const [LOW, HIGH] = CRAFTING_ITEM_LEVELS;

async function wandPools(): Promise<WeightsClassPools> {
  // A non-literal specifier: the file sits outside this package's `rootDir`.
  const here = (import.meta as { readonly dirname: string }).dirname;
  const data = ((await import(/* @vite-ignore */ `${here}/../../../../test/fixtures/wands-weights.json`)) as { default: unknown }).default;
  const weights = parseEnvelope(WeightsFileSchema, data, WEIGHTS_SCHEMA_VERSION);
  if (!weights.ok) {
    throw new Error('the Wand fixture was refused');
  }
  const lookup = poolOf(weights.value, 'weapon.wand', 'Wands');
  if (!lookup.ok) {
    throw new Error('the Wand fixture has no Wands');
  }
  return lookup.pools;
}

const banded = (statId: string, valueMin: number, valueMax: number): ModifierReference => ({ kind: 'banded', statId, valueMin, valueMax });

describe('the T2 Cold Spell levels entry on a real Wand under perfect (FR-26, AD-17)', () => {
  const entry = { prefix: banded(COLD_DAMAGE, 25, 27), suffix: banded(COLD_SPELL_LEVEL, 4, 4) };

  it('reaches the entry at the lower offered level, with a probability above 0', async () => {
    const pools = await wandPools();
    const scope = { itemLevel: LOW, modifierLevelMin: PERFECT };
    expect(recipeReach(pools, entry, scope)).toEqual({ reached: true });
    const result = combinationProbability(pools, entry, scope);
    expect(result.ok && result.p).toBeGreaterThan(0);
  });

  it('does not reach it at the higher offered level, where T1 rolls and lifts the floor', async () => {
    const pools = await wandPools();
    expect(recipeReach(pools, entry, { itemLevel: HIGH, modifierLevelMin: PERFECT })).toEqual({ reached: false, slots: ['prefix', 'suffix'] });
  });

  it('keeps the T2 suffix tier, at its own weight, in the eligible pool at the lower level only', async () => {
    const pools = await wandPools();
    const t2 = pools.suffix.entries.find((tier) => tier.itemLevelMin === 55 && tier.lines.some((line) => line.statId === COLD_SPELL_LEVEL));
    expect(t2?.weight).toBeGreaterThan(0);
    expect(eligible(pools.suffix, LOW, PERFECT)).toContain(t2);
    expect(eligible(pools.suffix, HIGH, PERFECT)).not.toContain(t2);
  });
});
