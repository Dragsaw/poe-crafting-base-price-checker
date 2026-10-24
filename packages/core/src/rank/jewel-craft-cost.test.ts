import { RankedRowSchema } from '@poe/contracts';
import type { CraftedRankedRow } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import type { Ranking } from '../rank.ts';
import {
  BOWS_POOLS,
  chase,
  craftedRows,
  GREATER,
  GREATER_COST,
  poolsFile,
  priced,
  published,
  rankCrafted,
  RATES,
  TARGET,
} from './test-support.ts';

const jewel = chase('Emerald', TARGET, 'active', 'jewel');
const bows = chase('Bows');
const weights = poolsFile(['weapon.bow', 'Bows', BOWS_POOLS], ['jewel', 'Emerald', BOWS_POOLS]);
const UNCOSTABLE = { kind: 'uncostable', currencyId: 'perfect-orb-of-transmutation' };

const rowOf = (result: Ranking, className: string, recipeId: string): CraftedRankedRow | undefined =>
  craftedRows(result.ordering).find((row) => row.className === className && row.recipeId === recipeId);

describe('rank: a jewel subtracts no Craft Cost (FR-26)', () => {
  it('a costable recipe: the jewel row costs 0 and its EV is its gross payout; the non-jewel row keeps the cost', () => {
    const result = rankCrafted({
      tracked: [jewel, bows],
      dataset: [published(jewel, priced(2)), published(bows, priced(2))],
      weights,
      recipes: [GREATER],
    });
    const emerald = rowOf(result, 'Emerald', 'greater');
    expect(emerald?.craftCost).toBe(0);
    expect(String(emerald?.ev)).toBe(String(emerald?.grossPayout));
    expect(String(emerald?.grossPayout)).toBe(String(0 + 0.1 * 2));
    expect(RankedRowSchema.parse(emerald)).toEqual(emerald);
    const bowsRow = rowOf(result, 'Bows', 'greater');
    expect(bowsRow?.craftCost).toBe(GREATER_COST);
    expect(String(bowsRow?.ev)).toBe(String(0 + 0.1 * 2 - GREATER_COST));
  });

  it('nothing clears: the jewel row ranks at 0 with summands: []', () => {
    const result = rankCrafted({ tracked: [jewel], dataset: [published(jewel, priced(0.1))], weights, recipes: [GREATER] });
    expect(craftedRows(result.ordering).map((row) => [row.ev, row.summands])).toEqual([[0, []]]);
  });

  it('an uncostable recipe: the jewel row stays uncostable, like every crafted row of that recipe', () => {
    const result = rankCrafted({
      tracked: [jewel, bows],
      dataset: [published(jewel, priced(1)), published(bows, priced(1))],
      weights,
      currencyRates: RATES.slice(0, 2),
    });
    for (const className of ['Emerald', 'Bows']) {
      const row = rowOf(result, className, 'perfect');
      expect(row?.craftCost).toEqual(UNCOSTABLE);
      expect(row?.ev).toBeNull();
    }
    expect(result.uncostableRecipes.map((item) => item.recipeId)).toEqual(['perfect']);
    expect(rowOf(result, 'Emerald', 'greater')?.craftCost).toBe(0);
  });
});
