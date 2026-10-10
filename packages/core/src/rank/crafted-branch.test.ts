import {
  canonicalKey,
  DatasetFileSchema,
  parseEnvelope,
  RankedRowSchema,
  RecipesFileSchema,
  TRACKED_SCHEMA_VERSION,
  TrackedFileSchema,
  WEIGHTS_SCHEMA_VERSION,
  WeightsFileSchema,
} from '@poe/contracts';
import type { DatasetEntry } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { rank } from '../rank.ts';
import type { RankInput } from '../rank.ts';
import {
  ABSENT,
  BOWS_POOLS,
  chase,
  craftedRows,
  divineRecipe,
  everyKey,
  FILLER,
  GREATER,
  GREATER_COST,
  LEAGUE,
  NOW,
  OLD_LEAGUE,
  PERFECT,
  PERFECT_COST,
  permute,
  poolsFile,
  priced,
  published,
  rankCrafted,
  RATES,
  rateOf,
  raw,
  SUFFIX_STAT,
  TARGET,
  THRESHOLD,
  tierOf,
} from './test-support.ts';
import type { Pools } from './test-support.ts';

describe('rank: the crafted branch (AD-17, AD-20)', () => {
  it('happy path: EV = Σ P·price − cost, two summands ordered by contribution', () => {
    const target = chase('Bows');
    const filler = chase('Bows', FILLER);
    const result = rankCrafted({
      tracked: [target, filler],
      dataset: [published(target, priced(2)), published(filler, priced(4))],
      recipes: [GREATER],
    });
    const [row] = craftedRows(result.ordering);
    expect(row).toMatchObject({
      kind: 'crafted',
      classKey: '["crafted","weapon.bow","Bows"]',
      categoryId: 'weapon.bow',
      className: 'Bows',
      itemLevelMin: 82,
      recipeId: 'greater',
      craftCost: GREATER_COST,
    });
    expect(row?.summands.map((summand) => summand.entryKey)).toEqual([canonicalKey(filler), canonicalKey(target)]);
    expect(row?.summands.map((summand) => summand.probability)).toEqual([0.1, 0.1]);
    expect(row?.summands.map((summand) => summand.contribution)).toEqual([0.1 * 4, 0.1 * 2]);
    expect(String(row?.grossPayout)).toBe(String(0 + 0.1 * 4 + 0.1 * 2));
    expect(String(row?.ev)).toBe(String(0 + 0.1 * 4 + 0.1 * 2 - GREATER_COST));
    expect(RankedRowSchema.parse(row)).toEqual(row);
  });

  it('tests the threshold against the gross price, not the price less the cost', () => {
    const target = chase('Bows');
    // price ≥ T > price − cost: 0.26 ≥ 0.25 > 0.26 − 0.03.
    const result = rankCrafted({ tracked: [target], dataset: [published(target, priced(0.26))], recipes: [GREATER] });
    expect(craftedRows(result.ordering)[0]?.summands).toHaveLength(1);
  });

  it('sums nothing for an unpriced, league-mismatched, below-threshold or pruned entry', () => {
    const target = chase('Bows');
    const filler = chase('Bows', FILLER);
    const low = chase('Bows', 'explicit.stat_low');
    const pruned = chase('Bows', SUFFIX_STAT, 'pruned');
    const result = rankCrafted({
      tracked: [target, filler, low, pruned],
      dataset: [
        published(target, { state: 'no-listings' }),
        published(filler, priced(5, OLD_LEAGUE)),
        published(low, priced(0.1)),
        published(pruned, priced(9)),
      ],
      recipes: [GREATER],
    });
    const [row] = craftedRows(result.ordering);
    expect(row?.summands).toEqual([]);
    expect(String(row?.ev)).toBe(String(-GREATER_COST));
    // Crafted entries never enter the raw groups.
    expect(everyKey(result)).toEqual([row?.classKey]);
  });

  it('nothing clears: every pair still ranks, at −craftCost, with summands: []', () => {
    const target = chase('Bows');
    const result = rankCrafted({ tracked: [target], dataset: [published(target, priced(0.1))] });
    expect(craftedRows(result.ordering).map((row) => [row.recipeId, row.ev, row.summands])).toEqual([
      ['greater', -GREATER_COST, []],
      ['perfect', -PERFECT_COST, []],
    ]);
  });

  it('a recipe floor that removes the contained tier makes that pair unrankable, and the other recipe ranks (state 36)', () => {
    const target = chase('Bows');
    const lowOnly = poolsFile(['weapon.bow', 'Bows', [[tierOf(TARGET, 10, 1, 'g'), tierOf(FILLER, 10, 75, 'g')], [tierOf(SUFFIX_STAT, 10, 1)]]]);
    const result = rankCrafted({ tracked: [target], dataset: [published(target, priced(1))], weights: lowOnly });
    expect(craftedRows(result.ordering).map((row) => row.recipeId)).toEqual(['greater']);
    expect(result.unrankable).toEqual([
      { categoryId: 'weapon.bow', className: 'Bows', reason: 'recipe cannot reach this class', recipeId: 'perfect' },
    ]);
  });

  it('an exhausted augment makes the pair unrankable, never P = 0', () => {
    // The suffix pool holds only the prefix's own modGroup, so the augment has nothing after it.
    const shared = poolsFile([
      'weapon.bow',
      'Bows',
      [[tierOf(TARGET, 10, 1, 'shared')], [tierOf(SUFFIX_STAT, 10, 1, 'shared')]],
    ]);
    const result = rankCrafted({ tracked: [chase('Bows')], weights: shared, recipes: [GREATER] });
    expect(craftedRows(result.ordering)).toEqual([]);
    expect(result.unrankable.map((item) => [item.reason, item.recipeId])).toEqual([
      ['recipe cannot reach this class', 'greater'],
    ]);
  });

  it('a class-level reason holds under every recipe, with no recipe id and no crafted row', () => {
    const result = rankCrafted({ tracked: [chase('Bows')], weights: undefined });
    expect(craftedRows(result.ordering)).toEqual([]);
    expect(result.unrankable).toEqual([{ categoryId: 'weapon.bow', className: 'Bows', reason: ABSENT }]);
  });

  it('pricedInLeague: false after a league reset, though every crafted pair still ranks, costable or not', () => {
    const target = chase('Bows');
    const A = raw('A');
    const reset = rankCrafted({
      tracked: [target, A],
      dataset: [published(target, priced(1, OLD_LEAGUE)), published(A, priced(0.5, OLD_LEAGUE))],
      currencyRates: RATES.slice(0, 2),
    });
    expect(reset.pricedInLeague).toBe(false);
    const resetRows = craftedRows(reset.ordering);
    expect(resetRows.map((row) => row.recipeId)).toEqual(['greater', 'perfect']);
    expect(String(resetRows[0]?.ev)).toBe(String(-GREATER_COST));
    expect(resetRows[1]?.ev).toBeNull();
    expect(reset.uncostableRecipes.map((item) => item.recipeId)).toEqual(['perfect']);
  });

  it('pricedInLeague: true for any non-pruned active-league price, raw or crafted, above or below the threshold', () => {
    const target = chase('Bows');
    const prunedTarget = chase('Bows', FILLER, 'pruned');
    const A = raw('A');
    const isPricedIn = (dataset: readonly DatasetEntry[]): boolean =>
      rankCrafted({ tracked: [target, prunedTarget, A], dataset }).pricedInLeague;
    expect(isPricedIn([published(target, priced(0.01))])).toBe(true);
    expect(isPricedIn([published(A, priced(0.01))])).toBe(true);
    expect(isPricedIn([published(prunedTarget, priced(5))])).toBe(false);
    expect(isPricedIn([published(target, { state: 'no-listings' })])).toBe(false);
  });

  it('a currency without a rate, or with another league’s rate, makes the recipe uncostable, never 0', () => {
    const target = chase('Bows');
    const rates = [...RATES.slice(0, 2), rateOf('perfect-orb-of-transmutation', 0.1, OLD_LEAGUE)];
    const A = raw('A');
    const result = rankCrafted({
      tracked: [target, A],
      dataset: [published(target, priced(1)), published(A, priced(0.3))],
      currencyRates: rates,
    });
    expect(result.uncostableRecipes).toEqual([{ recipeId: 'perfect', currencyId: 'perfect-orb-of-transmutation' }]);
    const perfect = craftedRows(result.ordering).find((row) => row.recipeId === 'perfect');
    expect(perfect?.craftCost).toEqual({ kind: 'uncostable', currencyId: 'perfect-orb-of-transmutation' });
    expect(perfect?.ev).toBeNull();
    expect(perfect?.grossPayout).toBe(0.5);
    expect(RankedRowSchema.parse(perfect)).toEqual(perfect);
    // The uncostable pair is still ranked, after every comparable row.
    expect(result.ordering.at(-1)).toBe(perfect);
    expect(result.ordering.map((row) => row.kind)).toEqual(['raw', 'crafted', 'crafted']);
  });

  it('orders an uncostable recipe’s pairs among themselves by gross payout', () => {
    const bows = chase('Bows');
    const staves = chase('Staves', TARGET, 'active', 'weapon.staff');
    const result = rankCrafted({
      tracked: [bows, staves],
      dataset: [published(bows, priced(1)), published(staves, priced(3))],
      weights: poolsFile(['weapon.bow', 'Bows', BOWS_POOLS], ['weapon.staff', 'Staves', BOWS_POOLS]),
      recipes: [GREATER],
      currencyRates: [],
    });
    const rows = craftedRows(result.ordering);
    expect(rows.map((row) => [row.className, row.grossPayout])).toEqual([
      ['Staves', 0 + 0.1 * 3],
      ['Bows', 0 + 0.1 * 1],
    ]);
    expect(rows[0]?.ev).toBeNull();
    expect(rows[1]?.ev).toBeNull();
  });

  it('ties break raw first, then the serialised key, then the recipe id', () => {
    const bows = chase('Bows');
    const amulets = chase('Amulets', TARGET, 'active', 'accessory.amulet');
    const A = raw('A');
    const result = rank({
      tracked: [bows, amulets, A],
      // 0.1 × 10 − 0.5 = 0.5, the raw row's EV, under both recipes.
      dataset: [published(A, priced(0.5)), published(bows, priced(10)), published(amulets, priced(10))],
      activeLeague: LEAGUE,
      threshold: THRESHOLD,
      now: NOW,
      weights: poolsFile(['weapon.bow', 'Bows', BOWS_POOLS], ['accessory.amulet', 'Amulets', BOWS_POOLS]),
      recipes: [divineRecipe('zeta'), divineRecipe('alpha')],
      currencyRates: [rateOf('divine', 0.5)],
    });
    expect(result.ordering.map((row) => row.ev)).toEqual([0.5, 0.5, 0.5, 0.5, 0.5]);
    expect(result.ordering.map((row) => (row.kind === 'raw' ? row.baseTypeId : `${row.className}/${row.recipeId}`))).toEqual(
      ['A', 'Amulets/alpha', 'Amulets/zeta', 'Bows/alpha', 'Bows/zeta'],
    );
  });

  it('two recipes over one Tracked List give orderings that differ by more than a constant offset', () => {
    // Bows: P = 0.1 at floor 0 and 0.5 at floor 70. Staves: P = 0.5 at floor 0, and at floor 70 its
    // reference contains no eligible tier: its group's top tier is FILLER's.
    const staves: Pools = [[tierOf(TARGET, 50, 1, 'staves'), tierOf(FILLER, 50, 75, 'staves')], [tierOf(SUFFIX_STAT, 10, 80)]];
    const bows = chase('Bows');
    const stavesEntry = chase('Staves', TARGET, 'active', 'weapon.staff');
    const result = rankCrafted({
      tracked: [bows, stavesEntry],
      dataset: [published(bows, priced(1)), published(stavesEntry, priced(1))],
      weights: poolsFile(['weapon.bow', 'Bows', BOWS_POOLS], ['weapon.staff', 'Staves', staves]),
    });
    const orderOf = (recipeId: string): string[] =>
      craftedRows(result.ordering)
        .filter((row) => row.recipeId === recipeId)
        .map((row) => row.className);
    expect(orderOf('greater')).toEqual(['Staves', 'Bows']);
    expect(orderOf('perfect')).toEqual(['Bows']);
    expect(result.unrankable).toContainEqual({
      categoryId: 'weapon.staff',
      className: 'Staves',
      reason: 'recipe cannot reach this class',
      recipeId: 'perfect',
    });
  });

  it('is identical under a shuffled Tracked List, dataset and rate set', () => {
    const target = chase('Bows');
    const filler = chase('Bows', FILLER);
    const input: RankInput = {
      tracked: [target, filler, raw('A'), chase('Bows', 'explicit.stat_low')],
      dataset: [published(target, priced(2)), published(filler, priced(4)), published(raw('A'), priced(1))],
      activeLeague: LEAGUE,
      threshold: THRESHOLD,
      now: NOW,
      weights: poolsFile(['weapon.bow', 'Bows', BOWS_POOLS]),
      recipes: [GREATER, PERFECT],
      currencyRates: RATES,
    };
    const expected = rank(input);
    for (const seed of [1, 7, 42]) {
      expect(
        rank({
          ...input,
          tracked: permute(input.tracked, seed),
          dataset: permute(input.dataset, seed + 1),
          currencyRates: permute(RATES, seed + 2),
        }),
      ).toEqual(expected);
    }
  });

  it('a threshold change re-ranks the committed cross product in under 100 ms (NFR-6)', async () => {
    // A non-literal specifier: the files sit outside this package's `rootDir`.
    const here = (import.meta as { readonly dirname: string }).dirname;
    const load = async (name: string): Promise<unknown> =>
      ((await import(/* @vite-ignore */ `${here}/../../../../test/fixtures/frozen-data/${name}`)) as { default: unknown }).default;
    const tracked = parseEnvelope(TrackedFileSchema, await load('tracked.json'), TRACKED_SCHEMA_VERSION);
    const weights = parseEnvelope(WeightsFileSchema, await load('weights.json'), WEIGHTS_SCHEMA_VERSION);
    const dataset = parseEnvelope(DatasetFileSchema, await load('dataset.json'));
    const recipes = parseEnvelope(RecipesFileSchema, await load('recipes.json'));
    if (!tracked.ok || !weights.ok || !dataset.ok || !recipes.ok) {
      throw new Error('a committed data file was refused');
    }
    const input: RankInput = {
      tracked: tracked.value.entries,
      dataset: dataset.value.entries,
      activeLeague: dataset.value.league,
      threshold: THRESHOLD,
      now: NOW,
      weights: weights.value,
      recipes: recipes.value.recipes,
      currencyRates: dataset.value.currencyRates,
    };
    expect(recipes.value.recipes).toHaveLength(2);
    expect(craftedRows(rank(input).ordering).length).toBeGreaterThan(0); // and warm up
    const samples: number[] = [];
    for (let run = 0; run < 5; run += 1) {
      const started = Date.now();
      rank({ ...input, threshold: 0.05 * run });
      samples.push(Date.now() - started);
    }
    // The fastest of five runs, so one noisy sample on a loaded runner does not fail the budget.
    expect(Math.min(...samples)).toBeLessThan(100);
  });
});
