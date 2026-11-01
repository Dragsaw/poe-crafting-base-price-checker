import type { RawTrackedEntry, TrackedEntry } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { classKeyOf } from '../crafted-classes.ts';
import type { Ranking, RecipelessClass } from '../rank.ts';
import { pickUpPurposes } from './pick-up.ts';
import type { PickUpEntry } from './pick-up.ts';
import {
  BOWS_POOLS,
  chase,
  GREATER,
  permute,
  poolsFile,
  priced,
  published,
  rankCrafted,
  RATES,
} from '../rank/test-support.ts';
import { ACTIVE, B, BOW_CLASS_FLOOR, BOW_RAW_FLOOR, checkRolls, classRow, EMPTY, purposesOf, rankingOf, rawBase, rawRow, RECIPE, UNCOSTABLE, unranked, white } from './test-support.ts';
import type { Recipe } from './test-support.ts';

const RECIPELESS: RecipelessClass = {
  classKey: classKeyOf('weapon.bow', 'Bows'),
  categoryId: 'weapon.bow',
  className: 'Bows',
  itemLevelMin: BOW_CLASS_FLOOR,
  trust: { verdict: 'pending', reasons: [{ kind: 'no-recipe' }] },
  combinations: [],
};

/** Each FR-36 cause of no EV, as the ranking shows it, with the recipe id passed. */
const NO_EV_CAUSES: readonly (readonly [string, Partial<Ranking>, Recipe])[] = [
  ['Unrankable (FR-4)', { unrankable: [{ categoryId: 'weapon.bow', className: 'Bows', reason: 'pool partial' }] }, ACTIVE],
  ['no priced Combination (FR-9)', { unpricedCrafted: [classRow(2)] }, ACTIVE],
  ['uncostable recipe (state 35)', { ordering: [classRow(UNCOSTABLE)] }, ACTIVE],
  ['no published recipe (state 43)', { recipeless: [RECIPELESS] }, { id: undefined }],
];

describe('pickUpPurposes: AC 1, one entry per named drop under the active recipe', () => {
  it('reads EV(C) only from the active recipe’s row', () => {
    const ranking = { ordering: [classRow(5, { recipeId: 'perfect' }), classRow(2), rawRow(B, 3)] };
    expect(purposesOf(ranking)).toEqual([white('sell-raw', BOW_RAW_FLOOR), checkRolls()]);
    expect(purposesOf(ranking, [B], { id: 'perfect' })).toEqual([white('craft', BOW_CLASS_FLOOR), checkRolls()]);
  });

  it('returns [] when no base qualifies', () => {
    expect(pickUpPurposes({ ranking: EMPTY, tracked: [], recipeId: RECIPE })).toEqual([]);
  });

  it('takes the threshold through `rank`: B moves from sell raw to craft as the threshold rises past its price', () => {
    const bowChase = chase('Bows');
    const bow: RawTrackedEntry = { ...rawBase('Dualstring Bow'), itemLevelMin: 82 };
    const tracked = [bowChase, bow];
    const dataset = [published(bowChase, priced(30)), published(bow, priced(5))];
    const at = (threshold: number): readonly PickUpEntry[] =>
      pickUpPurposes({ ranking: rankCrafted({ tracked, dataset, threshold }), tracked, recipeId: RECIPE });

    expect(at(0.25)).toEqual([white('sell-raw', 82), checkRolls(82)]);
    expect(at(10)).toEqual([white('craft', 82), checkRolls(82)]);
  });
});

describe('pickUpPurposes: AC 2, craft or sell raw against EV(C)', () => {
  it('raw value below EV(C) is craft', () => {
    expect(purposesOf({ ordering: [classRow(2), rawRow(B, 1)] })).toEqual([white('craft', BOW_CLASS_FLOOR), checkRolls()]);
  });

  it('raw value equal to EV(C) is sell raw', () => {
    expect(purposesOf({ ordering: [classRow(2), rawRow(B, 2)] })).toEqual([white('sell-raw', BOW_RAW_FLOOR), checkRolls()]);
  });

  it('raw value above EV(C) is sell raw', () => {
    expect(purposesOf({ ordering: [classRow(2), rawRow(B, 3)] })).toEqual([white('sell-raw', BOW_RAW_FLOOR), checkRolls()]);
  });

  it('a base below the threshold has raw value 0, so it is craft', () => {
    expect(purposesOf({ ordering: [classRow(2)], belowThreshold: [rawRow(B, 0.1)] })).toEqual([
      white('craft', BOW_CLASS_FLOOR),
      checkRolls(),
    ]);
  });
});

describe('pickUpPurposes: AC 3, item-level floors', () => {
  it('sell raw takes the Raw Base’s own floor; craft and check the rolls also reach the class floor', () => {
    expect(purposesOf({ ordering: [classRow(2), rawRow(B, 3)] })[0]?.itemLevelMin).toBe(BOW_RAW_FLOOR);
    expect(purposesOf({ ordering: [classRow(2), rawRow(B, 1)] }).map((entry) => entry.itemLevelMin)).toEqual([
      BOW_CLASS_FLOOR,
      BOW_CLASS_FLOOR,
    ]);
  });

  it('a Raw Base floor above the class floor wins for craft and check the rolls', () => {
    const high: RawTrackedEntry = { ...B, itemLevelMin: 86 };
    expect(purposesOf({ ordering: [classRow(2)] }, [high])).toEqual([white('craft', 86), checkRolls(86)]);
  });
});

describe('pickUpPurposes: AC 4, check the rolls', () => {
  it('a magic Raw Base of a class with EV > 0 is check the rolls at unidentified tier 4 or better', () => {
    expect(purposesOf({ ordering: [classRow(2), rawRow(B, 3)] })).toContainEqual(checkRolls());
  });

  it('a jewel kind with EV > 0 is one magic check-the-rolls entry: derived base type, class floor, no tier, no white entry', () => {
    const jewel = classRow(1.5, { categoryId: 'jewel', className: 'Time-Lost_Diamond', itemLevelMin: 75 });
    expect(purposesOf({ ordering: [jewel] }, [])).toEqual([
      { baseTypeId: 'Time-Lost Diamond', rarity: 'magic', itemLevelMin: 75, purpose: 'check-rolls' },
    ]);
  });

  it.each([
    ['EV 0', { ordering: [classRow(0, { categoryId: 'jewel', className: 'Emerald' })] }],
    ['EV below 0', { ordering: [classRow(-1, { categoryId: 'jewel', className: 'Emerald' })] }],
    ['uncostable', { ordering: [classRow(UNCOSTABLE, { categoryId: 'jewel', className: 'Emerald' })] }],
    ['no priced Combination', { unpricedCrafted: [classRow(2, { categoryId: 'jewel', className: 'Emerald' })] }],
  ] as const)('a jewel kind with %s has no entry', (_cause, ranking) => {
    expect(purposesOf(ranking, [])).toEqual([]);
  });

  it('through `rank`: a jewel kind whose derived base type is not in the catalogue is unresolvable, so it has no entry', () => {
    const diamond = chase('Time-Lost_Diamond', undefined, 'active', 'jewel');
    const weights = poolsFile(['jewel', 'Time-Lost_Diamond', BOWS_POOLS]);
    const run = (price: Parameters<typeof published>[1]): readonly PickUpEntry[] => {
      const ranking = rankCrafted({ tracked: [diamond], dataset: [published(diamond, price)], weights, recipes: [GREATER], currencyRates: RATES });
      return pickUpPurposes({ ranking, tracked: [diamond], recipeId: RECIPE });
    };

    expect(run({ state: 'unresolvable' })).toEqual([]);
    expect(run(priced(30))).toEqual([{ baseTypeId: 'Time-Lost Diamond', rarity: 'magic', itemLevelMin: 82, purpose: 'check-rolls' }]);
  });
});

describe('pickUpPurposes: AC 5, a class with no EV', () => {
  it.each(NO_EV_CAUSES)('%s: a priced Raw Base is sell raw only', (_cause, ranking, recipe) => {
    const parts = { ...ranking, ordering: [...(ranking.ordering ?? []), rawRow(B, 3)] };
    expect(purposesOf(parts, [B], recipe)).toEqual([white('sell-raw', BOW_RAW_FLOOR)]);
  });

  it.each(NO_EV_CAUSES)('%s: a Raw Base with raw value 0 has no entry', (_cause, ranking, recipe) => {
    expect(purposesOf({ ...ranking, belowThreshold: [rawRow(B, 0.1)] }, [B], recipe)).toEqual([]);
  });

  it.each(NO_EV_CAUSES)('%s: an unpriced Raw Base has no entry', (_cause, ranking, recipe) => {
    const notYetSynced = [{ ...unranked(B), reason: 'never-synced' as const }];
    expect(purposesOf({ ...ranking, notYetSynced }, [B], recipe)).toEqual([]);
  });

  it('a recipe id that names no row gives no EV', () => {
    expect(purposesOf({ ordering: [classRow(2), rawRow(B, 3)] }, [B], { id: 'perfect' })).toEqual([white('sell-raw', BOW_RAW_FLOOR)]);
  });
});

describe('pickUpPurposes: AC 6, EV(C) of 0 or below', () => {
  it.each([0, -0.5])('EV %d: a priced Raw Base is sell raw only, with no craft and no check the rolls', (expectedValue) => {
    expect(purposesOf({ ordering: [classRow(expectedValue), rawRow(B, 3)] })).toEqual([white('sell-raw', BOW_RAW_FLOOR)]);
  });

  it.each([
    ['below the threshold', { belowThreshold: [rawRow(B, 0.1)] }],
    ['with no listings', { noListings: [unranked(B)] }],
  ] as const)('a Raw Base %s has no entry', (_case, parts) => {
    expect(purposesOf({ ...parts, ordering: [classRow(0)] })).toEqual([]);
  });

  it('does not apply the threshold again: a priced row in `ordering` keeps its price', () => {
    expect(purposesOf({ ordering: [classRow(-1), rawRow(B, 0.01)] })).toEqual([white('sell-raw', BOW_RAW_FLOOR)]);
  });
});

describe('pickUpPurposes: AC 7, a Raw Base with no price', () => {
  it.each([
    ['no listings', { noListings: [unranked(B)] }],
    ['not yet synced', { notYetSynced: [{ ...unranked(B), reason: 'never-synced' as const }] }],
    ['unresolvable', { unresolvable: [unranked(B)] }],
    ['in no group', {}],
  ] as const)('%s, EV(C) > 0: craft, and check the rolls; never sell raw', (_case, parts) => {
    expect(purposesOf({ ...parts, ordering: [classRow(2)] })).toEqual([white('craft', BOW_CLASS_FLOOR), checkRolls()]);
  });
});

describe('pickUpPurposes: AC 8, a pruned Raw Base', () => {
  it('has no entry', () => {
    expect(purposesOf({ ordering: [classRow(2)] }, [rawBase('Dualstring Bow', 'pruned')])).toEqual([]);
  });

  it('a pinned Raw Base gets the same entries as an active one', () => {
    const ranking = { ordering: [classRow(2), rawRow(B, 1)] };
    expect(purposesOf(ranking, [rawBase('Dualstring Bow', 'pinned')])).toEqual(purposesOf(ranking, [B]));
    expect(purposesOf(ranking, [rawBase('Dualstring Bow', 'pinned')])).toEqual([white('craft', BOW_CLASS_FLOOR), checkRolls()]);
  });
});

describe('pickUpPurposes: AC 9, no price on an entry, and a deterministic order', () => {
  const A = rawBase('Advanced Bow');
  const Z = rawBase('Zealot Bow');
  // Differs from A only by case: code-unit order puts it after Z, locale order next to A.
  const lowerA = rawBase('advanced Bow');
  const ring: RawTrackedEntry = { kind: 'raw', baseTypeId: 'Iron Ring', categoryId: 'accessory.ring', className: 'Rings', itemLevelMin: 1, status: 'active' };
  const tracked: readonly TrackedEntry[] = [Z, lowerA, ring, chase('Bows'), B, A];
  const ranking = rankingOf({
    ordering: [
      classRow(2),
      classRow(1, { categoryId: 'jewel', className: 'Emerald', itemLevelMin: 60 }),
      rawRow(Z, 3),
      rawRow(lowerA, 3),
      rawRow(ring, 4),
    ],
    noListings: [unranked(A)],
  });

  it('carries only the entry fields, never a Combination, a modifier, a price, an EV or a trust verdict', () => {
    const allowed = new Set(['baseTypeId', 'rarity', 'itemLevelMin', 'itemLevelMax', 'unidentifiedTierMin', 'purpose']);
    const entries = pickUpPurposes({ ranking, tracked, recipeId: RECIPE });
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.flatMap((entry) => Object.keys(entry).filter((key) => !allowed.has(key)))).toEqual([]);
  });

  it('orders by canonical key under code-unit comparison, normal before magic', () => {
    const entries = pickUpPurposes({ ranking, tracked, recipeId: RECIPE });
    expect(entries.map((entry) => [entry.baseTypeId, entry.rarity])).toEqual([
      ['Emerald', 'magic'],
      ['Advanced Bow', 'normal'],
      ['Advanced Bow', 'magic'],
      ['Dualstring Bow', 'normal'],
      ['Dualstring Bow', 'magic'],
      ['Iron Ring', 'normal'],
      ['Zealot Bow', 'normal'],
      ['Zealot Bow', 'magic'],
      ['advanced Bow', 'normal'],
      ['advanced Bow', 'magic'],
    ]);
  });

  it.each([1, 2, 3])('gives an equal list for a permuted Tracked List (seed %d)', (seed) => {
    const once = pickUpPurposes({ ranking, tracked, recipeId: RECIPE });
    expect(pickUpPurposes({ ranking, tracked: permute(tracked, seed), recipeId: RECIPE })).toEqual(once);
  });
});
