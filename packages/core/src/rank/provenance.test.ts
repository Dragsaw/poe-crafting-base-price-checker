import { RankedRowSchema } from '@poe/contracts';
import type { ModifierWeight, PriceState } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { poolCoverage } from '../coverage.ts';
import {
  chase,
  craftedRows,
  FILLER,
  GREATER,
  observation,
  PARTIAL,
  PERFECT,
  poolsFile,
  priced,
  published,
  rankCrafted,
  RATES,
  SUFFIX_STAT,
  TARGET,
  tierOf,
  weightsWith,
} from './test-support.ts';

const byPair = (a: readonly string[], b: readonly string[]): number => {
  const left = a.join(',');
  const right = b.join(',');
  return Number(left > right) - Number(left < right);
};

const invented = (tier: ModifierWeight): ModifierWeight => ({ ...tier, weightSource: 'absent' });

describe('rank: Provenance and the oldest timestamp (AD-10)', () => {
  const target = chase('Bows');
  const priced1 = [published(target, priced(2))];

  it('labels a pair measured when its eligible sets hold only published or not-in-game tiers', () => {
    const notInGame: ModifierWeight = { ...tierOf('explicit.stat_none', 0, 75), weightSource: 'not-in-game' };
    const weights = poolsFile(['weapon.bow', 'Bows', [[tierOf(TARGET, 10, 75), notInGame], [tierOf(SUFFIX_STAT, 10, 80)]]]);
    const rows = craftedRows(rankCrafted({ tracked: [target], dataset: priced1, weights }).ordering);
    expect(rows.map((row) => row.provenance)).toEqual(['measured', 'measured']);
  });

  it('labels every row of a pair uniform-prior when one tier in either eligible set is invented', () => {
    for (const pools of [
      [[invented(tierOf(TARGET, 10, 75))], [tierOf(SUFFIX_STAT, 10, 80)]],
      [[tierOf(TARGET, 10, 75)], [invented(tierOf(SUFFIX_STAT, 10, 80))]],
    ] as const) {
      const weights = poolsFile(['weapon.bow', 'Bows', pools]);
      const rows = craftedRows(rankCrafted({ tracked: [target], dataset: priced1, weights }).ordering);
      expect(rows.map((row) => row.provenance)).toEqual(['uniform-prior', 'uniform-prior']);
    }
  });

  it('does not count an invented tier the recipe floor removes from its group, and follows the recipe', () => {
    // One group at 50 and 75: the greater floor keeps both, the perfect floor keeps 75 alone.
    const weights = poolsFile([
      'weapon.bow',
      'Bows',
      [[tierOf(TARGET, 10, 75, 'shared'), invented(tierOf(FILLER, 10, 50, 'shared'))], [tierOf(SUFFIX_STAT, 10, 80)]],
    ]);
    const rows = craftedRows(rankCrafted({ tracked: [target], dataset: priced1, weights }).ordering);
    expect(rows.map((row) => [row.recipeId, row.provenance]).toSorted(byPair)).toEqual([
      ['greater', 'uniform-prior'],
      ['perfect', 'measured'],
    ]);
  });

  it('takes asOf from the summands only: the oldest observedAt, never a rate asOf (AD-10)', () => {
    const old: PriceState = {
      state: 'priced',
      observation: { ...observation(2), observedAt: '2026-09-27T00:00:00Z' },
    };
    const rates = RATES.map((rate) => ({ ...rate, asOf: '2026-09-10T00:00:00Z' }));
    const filler = chase('Bows', FILLER);
    const [row] = craftedRows(
      rankCrafted({
        tracked: [target, filler],
        dataset: [published(target, old), published(filler, { state: 'no-listings' }, '2026-09-01T00:00:00Z')],
        recipes: [GREATER],
        currencyRates: rates,
      }).ordering,
    );
    expect(row?.asOf).toBe('2026-09-27T00:00:00Z');
    expect(row).not.toHaveProperty('lastAttemptedAt');
  });

  it('with no summand, sets no asOf and falls back to the oldest lastAttemptedAt among the attempted entries (AD-10)', () => {
    // Canonical key order: filler, low, target. The oldest attempt is keyed last.
    const filler = chase('Bows', FILLER);
    const low = chase('Bows', 'explicit.stat_low');
    const rates = RATES.map((rate) => ({ ...rate, asOf: '2026-09-10T00:00:00Z' }));
    const [tried] = craftedRows(
      rankCrafted({
        tracked: [target, filler, low],
        dataset: [
          published(filler, { state: 'no-listings' }, '2026-09-25T00:00:00Z'),
          published(low, { state: 'no-listings' }, false),
          published(target, { state: 'no-listings' }, '2026-09-20T00:00:00Z'),
        ],
        recipes: [GREATER],
        currencyRates: rates,
      }).ordering,
    );
    expect(tried?.summands).toEqual([]);
    expect(tried).not.toHaveProperty('asOf');
    expect(tried?.lastAttemptedAt).toBe('2026-09-20T00:00:00Z');
    expect(tried !== undefined && RankedRowSchema.parse(tried)).toEqual(tried);
  });

  it('with no summand and no attempted entry, sets neither field: never attempted (AD-10)', () => {
    const [bare] = craftedRows(rankCrafted({ tracked: [target], dataset: [], recipes: [GREATER], currencyRates: RATES }).ordering);
    expect(bare).not.toHaveProperty('asOf');
    expect(bare).not.toHaveProperty('lastAttemptedAt');
    expect(bare !== undefined && RankedRowSchema.parse(bare)).toEqual(bare);
  });

  it('puts absent only on a partial pool class, never on a ranked row', () => {
    const result = rankCrafted({
      tracked: [target],
      dataset: priced1,
      weights: weightsWith(['weapon.bow', 'Bows', 'partial', 'complete']),
    });
    expect(result.ordering).toEqual([]);
    expect(result.unrankable).toEqual([
      { categoryId: 'weapon.bow', className: 'Bows', reason: PARTIAL },
    ]);
  });

  it('reports a complete pool with no entries as one recipe-free unreachable row, never pool partial', () => {
    const weights = poolsFile(['weapon.bow', 'Bows', [[], []]]);
    const result = rankCrafted({ tracked: [target], dataset: priced1, weights, recipes: [GREATER, PERFECT] });
    expect(result.ordering).toEqual([]);
    expect(result.unrankable).toEqual([
      { categoryId: 'weapon.bow', className: 'Bows', reason: 'recipe cannot reach this class' },
    ]);
  });

  it('reports a complete pool of only weight-0 tiers as one recipe-free unreachable row', () => {
    const weights = poolsFile([
      'weapon.bow',
      'Bows',
      [[tierOf(TARGET, 0)], [tierOf(SUFFIX_STAT, 80)]],
    ]);
    const result = rankCrafted({ tracked: [target], dataset: priced1, weights, recipes: [GREATER, PERFECT] });
    expect(result.ordering).toEqual([]);
    expect(result.unrankable).toEqual([
      { categoryId: 'weapon.bow', className: 'Bows', reason: 'recipe cannot reach this class' },
    ]);
  });

  it.each([
    ['empty suffix beside a populated prefix', [[tierOf(TARGET, 5)], []]],
    ['weight-0 suffix beside a populated prefix', [[tierOf(TARGET, 5)], [tierOf(SUFFIX_STAT, 0)]]],
    ['both slots empty', [[], []]],
  ] as const)('reports %s as one recipe-free unreachable row, and poolCoverage agrees', (_label, pools) => {
    const weights = poolsFile(['weapon.bow', 'Bows', pools]);
    const result = rankCrafted({ tracked: [target], dataset: priced1, weights, recipes: [GREATER] });
    expect(result.unrankable).toEqual([
      { categoryId: 'weapon.bow', className: 'Bows', reason: 'recipe cannot reach this class' },
    ]);
    expect(poolCoverage([target], weights)?.coverage).toBe(0);
  });

  it('keeps pool partial when a partial slot sits beside an empty one', () => {
    const weights = poolsFile(['weapon.bow', 'Bows', [[], [tierOf(SUFFIX_STAT, 5)]]]);
    const bow = weights.bases['weapon.bow']?.['Bows'];
    if (bow !== undefined) {
      bow.prefix = { poolCoverage: 'partial', entries: [] };
    }
    const result = rankCrafted({ tracked: [target], dataset: priced1, weights });
    expect(result.unrankable.map((row) => row.reason)).toEqual([PARTIAL]);
  });
});
