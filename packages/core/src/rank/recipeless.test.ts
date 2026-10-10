import { canonicalKey, compareCanonicalKeys } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import {
  ABSENT,
  BOWS_POOLS,
  chase,
  craftedRows,
  FILLER,
  NO_RECIPE,
  OLD_LEAGUE,
  PARTIAL,
  poolsFile,
  priced,
  published,
  rankCrafted,
  raw,
  TARGET,
  weightsWith,
} from './test-support.ts';

describe('rank: the recipeless group (state 43)', () => {
  it.each([[[]], [undefined]])(
    'a rankable class with no recipe (%j) is recipeless: no-recipe verdict, one verdict per live entry',
    (recipes) => {
      const target = chase('Bows');
      const filler = chase('Bows', FILLER);
      const pruned = chase('Bows', 'explicit.stat_low', 'pruned');
      const A = raw('A');
      const result = rankCrafted({
        tracked: [filler, pruned, target, A],
        dataset: [published(target, priced(2)), published(filler, { state: 'unresolvable' }), published(A, priced(0.5))],
        recipes,
      });
      expect(result.ordering.map((row) => row.kind)).toEqual(['raw']);
      expect(result.unrankable).toEqual([]);
      expect(result.uncostableRecipes).toEqual([]);
      const combinations = [
        { entryKey: canonicalKey(target), trust: { verdict: 'current', reasons: [] }, priceDivine: 2 },
        { entryKey: canonicalKey(filler), trust: { verdict: 'broken', reasons: [{ kind: 'unresolvable' }] } },
      ];
      expect(result.recipeless).toEqual([
        {
          classKey: '["crafted","weapon.bow","Bows"]',
          categoryId: 'weapon.bow',
          className: 'Bows',
          itemLevelMin: 82,
          trust: NO_RECIPE,
          combinations,
        },
      ]);
    },
  );

  it('orders a class’s combinations priced, then pending, then broken, as a crafted row’s', () => {
    const withPrice = chase('Bows');
    const pending = chase('Bows', 'explicit.stat_low');
    const broken = chase('Bows', FILLER);
    const result = rankCrafted({
      tracked: [withPrice, pending, broken],
      dataset: [published(withPrice, priced(2)), published(broken, { state: 'unresolvable' })],
      recipes: [],
    });
    const byTrust = [withPrice, pending, broken].map((entry) => canonicalKey(entry));
    expect(byTrust.toSorted(compareCanonicalKeys)).toEqual(byTrust.toReversed());
    expect(result.recipeless[0]?.combinations.map((line) => line.entryKey)).toEqual(byTrust);
  });

  it('puts the price on an active-league priced entry only', () => {
    const withPrice = chase('Bows');
    const otherLeague = chase('Bows', 'explicit.stat_low');
    const result = rankCrafted({
      tracked: [withPrice, otherLeague],
      dataset: [published(withPrice, priced(2)), published(otherLeague, priced(3, OLD_LEAGUE))],
      recipes: [],
    });
    const prices = new Map(result.recipeless[0]?.combinations.map((line) => [line.entryKey, line.priceDivine]));
    expect(prices).toEqual(new Map([[canonicalKey(withPrice), 2], [canonicalKey(otherLeague), undefined]]));
  });

  it('orders the group by class key, whatever the Tracked List order', () => {
    const result = rankCrafted({
      tracked: [chase('Bows'), chase('Amulets', TARGET, 'active', 'accessory.amulet')],
      weights: poolsFile(['weapon.bow', 'Bows', BOWS_POOLS], ['accessory.amulet', 'Amulets', BOWS_POOLS]),
      recipes: [],
    });
    expect(result.recipeless.map((item) => item.classKey)).toEqual([
      '["crafted","accessory.amulet","Amulets"]',
      '["crafted","weapon.bow","Bows"]',
    ]);
  });

  it.each([
    ['absent from weights', { weights: undefined }, ABSENT],
    ['partial', { weights: weightsWith(['weapon.bow', 'Bows', 'partial']) }, PARTIAL],
    ['disagreeing', { crossFileFailures: [{ categoryId: 'weapon.bow', className: 'Bows' }] }, 'class disagrees with weights file'],
  ] as const)('with no recipe, a class %s keeps its FR-4 reason and is not recipeless', (_label, override, reason) => {
    const result = rankCrafted({ tracked: [chase('Bows')], recipes: [], ...override });
    expect(result.unrankable).toEqual([{ categoryId: 'weapon.bow', className: 'Bows', reason }]);
    expect(result.recipeless).toEqual([]);
  });

  it('holds no recipeless class while any recipe is published', () => {
    const result = rankCrafted({ tracked: [chase('Bows')] });
    expect(result.recipeless).toEqual([]);
    expect([...craftedRows(result.ordering), ...result.unpricedCrafted].map((row) => row.recipeId)).toEqual(['greater', 'perfect']);
  });
});
