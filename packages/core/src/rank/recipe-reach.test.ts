import { canonicalKey } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { chase, craftedRows, FILLER, GREATER, poolsFile, priced, published, rankCrafted, SUFFIX_STAT, TARGET, tierOf } from './test-support.ts';

/** TARGET's tier at 75, its values outside every band these tests use. */
const targetAbove = () => ({ ...tierOf(TARGET, 10, 75, 't'), lines: [{ statId: TARGET, ranges: [[11, 20]] as [number, number][] }] });

describe('rank: the reach verdict per (entry, recipe, L) (AD-17, FR-26)', () => {
  it('an entry the recipe cannot reach is not a summand, and the pair ranks on the reachable entry', () => {
    const target = chase('Bows');
    const filler = chase('Bows', FILLER);
    // TARGET's modifier has a tier at 75 outside the band, so the perfect floor removes the contained tier at 1.
    const weights = poolsFile([
      'weapon.bow',
      'Bows',
      [[tierOf(TARGET, 10, 1, 't'), targetAbove(), tierOf(FILLER, 10, 75)], [tierOf(SUFFIX_STAT, 10, 1)]],
    ]);
    const result = rankCrafted({ tracked: [target, filler], dataset: [published(target, priced(1)), published(filler, priced(2))], weights });
    const rows = craftedRows(result.ordering);
    expect(rows.map((row) => [row.recipeId, row.summands.map((summand) => [summand.entryKey, summand.probability])])).toEqual([
      ['greater', [[canonicalKey(filler), expect.closeTo(10 / 30, 12)], [canonicalKey(target), expect.closeTo(10 / 30, 12)]]],
      ['perfect', [[canonicalKey(filler), expect.closeTo(10 / 20, 12)]]],
    ]);
    const perfect = rows.find((row) => row.recipeId === 'perfect');
    expect(perfect?.combinations).toEqual([{ entryKey: canonicalKey(target), trust: { verdict: 'current', reasons: [] }, notCounted: { kind: 'unreached' } }]);
    expect(perfect?.trust.verdict).toBe('current');
    expect(result.unrankable).toEqual([]);
  });

  it('a pair with nothing counted reads nothing-counts, even when every entry is broken', () => {
    const target = chase('Bows');
    const weights = poolsFile(['weapon.bow', 'Bows', [[tierOf(TARGET, 10, 1, 't'), targetAbove()], [tierOf(SUFFIX_STAT, 10, 1)]]]);
    const result = rankCrafted({ tracked: [target], dataset: [published(target, { state: 'unresolvable' })], weights });
    const perfect = result.unpricedCrafted.find((row) => row.recipeId === 'perfect');
    expect(perfect?.summands).toEqual([]);
    expect(perfect?.trust).toEqual({ verdict: 'pending', reasons: [{ kind: 'nothing-counts', itemLevel: 82 }] });
    expect(perfect?.combinations.map((combination) => combination.entryKey)).toEqual([canonicalKey(target)]);
    expect(result.unrankable).toEqual([]);
  });

  it('an exhausted augment makes the pair unrankable under its own reason, never P = 0', () => {
    // The suffix pool holds only the prefix's own modGroup, so the augment has nothing after it.
    const shared = poolsFile(['weapon.bow', 'Bows', [[tierOf(TARGET, 10, 1, 'shared')], [tierOf(SUFFIX_STAT, 10, 1, 'shared')]]]);
    const result = rankCrafted({ tracked: [chase('Bows')], weights: shared, recipes: [GREATER] });
    expect(craftedRows(result.ordering)).toEqual([]);
    expect(result.unpricedCrafted).toEqual([]);
    expect(result.unrankable).toEqual([{ categoryId: 'weapon.bow', className: 'Bows', reason: 'augment exhausted', recipeId: 'greater' }]);
  });

  it('a slot the scope leaves empty makes the pair unrankable as pool empty, with its recipe id', () => {
    const late = poolsFile(['weapon.bow', 'Bows', [[tierOf(TARGET, 10, 1)], [tierOf(SUFFIX_STAT, 10, 90)]]]);
    const result = rankCrafted({ tracked: [chase('Bows')], weights: late, recipes: [GREATER] });
    expect(craftedRows(result.ordering)).toEqual([]);
    expect(result.unrankable).toEqual([{ categoryId: 'weapon.bow', className: 'Bows', reason: 'pool empty', recipeId: 'greater' }]);
  });
});
