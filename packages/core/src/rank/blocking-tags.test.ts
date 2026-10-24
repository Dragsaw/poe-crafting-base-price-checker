import { describe, expect, it } from 'vitest';

import { RECIPE_UNREACHABLE } from '../rank.ts';
import { chase, craftedRows, FILLER, poolsFile, priced, published, rankCrafted, SUFFIX_STAT, TARGET, tierOf } from './test-support.ts';

describe('rank: a tag-blocked combination (AD-17 reach rule)', () => {
  it('makes the pair unrankable under a recipe whose floor leaves only blocked pairs, never P = 0', () => {
    const target = chase('Bows');
    const prefix = { ...tierOf(TARGET, 10, 75), addsTags: ['no_cold_spell_mods'], blockedByTags: ['no_fire_spell_mods'] };
    const blocked = { ...tierOf(SUFFIX_STAT, 10, 75, 's'), addsTags: ['no_fire_spell_mods'], blockedByTags: ['no_cold_spell_mods'] };
    const weights = poolsFile([
      'weapon.bow',
      'Bows',
      [
        [prefix, tierOf(FILLER, 10)],
        [tierOf(SUFFIX_STAT, 10, 1, 's'), blocked, tierOf('explicit.stat_other_suffix', 10)],
      ],
    ]);
    const result = rankCrafted({ tracked: [target], dataset: [published(target, priced(1))], weights });
    expect(craftedRows(result.ordering).map((row) => row.recipeId)).toEqual(['greater']);
    expect(result.unrankable).toEqual([
      { categoryId: 'weapon.bow', className: 'Bows', reason: RECIPE_UNREACHABLE, recipeId: 'perfect' },
    ]);
  });
});
