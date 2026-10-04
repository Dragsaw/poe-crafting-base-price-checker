import { rank, type Ranking } from '@poe/core';
import type { CraftedRankedRow, DatasetEntry, RawTrackedEntry } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { TEST_LEAGUE } from '../test-support/artifact-server';
import { NOW } from '../test-support/dom';
import { hoursBefore, priced, rawEntry, unpriced } from '../test-support/list-fixtures';
import { forRecipe } from './active-ranking';
import { honestEmptyCopy, isHonestEmpty, listStatement, nothingClearsCopy, uncostableCopy } from './list-statement';

function statementFor(
  tracked: readonly RawTrackedEntry[],
  dataset: readonly DatasetEntry[],
  threshold = 0.25,
): ReturnType<typeof listStatement> {
  return listStatement(rank({ tracked, dataset, activeLeague: TEST_LEAGUE, threshold, weights: undefined }), threshold, TEST_LEAGUE);
}

const belt = rawEntry('Wide Belt');
const ring = rawEntry('Coral Ring');
const amulet = rawEntry('Gold Amulet');

describe('the copy', () => {
  it('reads as the 2026-09-27 decision wrote it', () => {
    expect(honestEmptyCopy('Forbidden Rites')).toBe(
      'In canonical order, not ranked: no tracked unit has a price from Forbidden Rites yet.',
    );
    expect(honestEmptyCopy('Forbidden Rites', true)).toBe(
      'In canonical order, not ranked: no tracked unit has a price from Forbidden Rites.',
    );
    expect(nothingClearsCopy(3)).toBe('Nothing clears your Payout Threshold of 3.00 Divine.');
    expect(nothingClearsCopy(0.6)).toBe('Nothing clears your Payout Threshold of 0.60 Divine.');
  });
});

describe('listStatement', () => {
  // Matrix: league reset.
  it('is honest-empty when every observation is from another league', () => {
    const statement = statementFor(
      [belt, ring, amulet],
      [
        priced(belt, 1.5, hoursBefore(NOW, 30 * 24), 'Standard'),
        priced(ring, 0.8, hoursBefore(NOW, 30 * 24), 'Standard'),
        priced(amulet, 2, hoursBefore(NOW, 30 * 24), 'Standard'),
      ],
    );
    expect(statement).toEqual({ kind: 'honest-empty', text: honestEmptyCopy(TEST_LEAGUE) });
  });

  it('is honest-empty when nothing was ever synced or nothing has listings', () => {
    expect(statementFor([belt, ring], []).kind).toBe('honest-empty');
    expect(statementFor([belt], [unpriced(belt, { state: 'no-listings' }, hoursBefore(NOW, 1))]).kind).toBe(
      'honest-empty',
    );
  });

  // Matrix: mixed reset.
  it('is honest-empty when no-listings and not-yet-synced rows mix', () => {
    const tracked = [belt, ring, amulet];
    const dataset = [
      priced(belt, 1.5, hoursBefore(NOW, 30 * 24), 'Standard'),
      priced(ring, 0.8, hoursBefore(NOW, 30 * 24), 'Standard'),
      unpriced(amulet, { state: 'no-listings' }, hoursBefore(NOW, 2)),
    ];
    const ranking = rank({ tracked, dataset, activeLeague: TEST_LEAGUE, threshold: 0.25, weights: undefined });
    expect(ranking.noListings).toHaveLength(1);
    expect(ranking.notYetSynced).toHaveLength(2);
    expect(isHonestEmpty(ranking)).toBe(true);
    expect(statementFor(tracked, dataset)).toEqual({ kind: 'honest-empty', text: honestEmptyCopy(TEST_LEAGUE) });
  });

  // Matrix: partial refresh.
  it('makes no statement on a partial refresh', () => {
    const statement = statementFor(
      [belt, ring, amulet],
      [
        priced(belt, 1.5, hoursBefore(NOW, 1)),
        priced(ring, 0.8, hoursBefore(NOW, 30 * 24), 'Standard'),
      ],
    );
    expect(statement).toEqual({ kind: 'none' });
  });

  // Matrix: nothing clears.
  it('is nothing-clears, naming the live threshold at 2dp, when every priced row is below it', () => {
    const dataset = [priced(belt, 1.5, hoursBefore(NOW, 1)), priced(ring, 0.8, hoursBefore(NOW, 1))];
    expect(statementFor([belt, ring, amulet], dataset, 3)).toEqual({
      kind: 'nothing-clears',
      text: 'Nothing clears your Payout Threshold of 3.00 Divine.',
    });
  });

  // Matrix: threshold lowered.
  it('goes away once a row clears the lowered threshold', () => {
    const dataset = [priced(belt, 1.5, hoursBefore(NOW, 1)), priced(ring, 0.8, hoursBefore(NOW, 1))];
    expect(statementFor([belt, ring], dataset, 1.6).kind).toBe('nothing-clears');
    expect(statementFor([belt, ring], dataset, 1.5)).toEqual({ kind: 'none' });
  });

  // Matrix: empty Tracked List.
  it('makes neither statement for an empty Tracked List', () => {
    expect(statementFor([], [])).toEqual({ kind: 'none' });
  });

  // Matrix: only unresolvable.
  it('states honest-empty without "yet" when every entry is unresolvable, since no sync will bring a price', () => {
    expect(statementFor([belt], [unpriced(belt, { state: 'unresolvable' }, hoursBefore(NOW, 1))])).toEqual({
      kind: 'honest-empty',
      text: `In canonical order, not ranked: no tracked unit has a price from ${TEST_LEAGUE}.`,
    });
  });

  // EXPERIENCE.md revision 9: one no-listings or not-yet-synced row keeps "yet".
  it('keeps "yet" when an unresolvable row shares the list with a no-listings or not-yet-synced row', () => {
    const lost = unpriced(belt, { state: 'unresolvable' }, hoursBefore(NOW, 1));
    expect(statementFor([belt, ring], [lost, unpriced(ring, { state: 'no-listings' }, hoursBefore(NOW, 1))])).toEqual({
      kind: 'honest-empty',
      text: honestEmptyCopy(TEST_LEAGUE),
    });
    expect(statementFor([belt, ring], [lost])).toEqual({ kind: 'honest-empty', text: honestEmptyCopy(TEST_LEAGUE) });
  });
});

const craftedRow = (summands: number, recipeId = 'greater'): CraftedRankedRow => ({
  kind: 'crafted',
  classKey: '["crafted","weapon.bow","Bows"]',
  categoryId: 'weapon.bow',
  className: 'Bows',
  itemLevelMin: 82,
  recipeId,
  provenance: 'measured',
  grossPayout: summands,
  craftCost: 0.03,
  ev: summands - 0.03,
  summands: Array.from({ length: summands }, (_, index) => ({
    entryKey: `k${String(index)}`,
    probability: 1,
    priceDivine: 1,
    contribution: 1,
  })),
});

describe('listStatement with crafted rows (Story 3.4)', () => {
  const empty: Ranking = {
    ordering: [],
    belowThreshold: [],
    noListings: [],
    notYetSynced: [],
    unresolvable: [],
    unrankable: [],
    uncostableRecipes: [],
    pricedInLeague: true,
  };
  const greater = { id: 'greater', word: 'greater' };

  it('state 25: no summand on any crafted row and no raw row is nothing-clears, though the ordering holds rows', () => {
    expect(listStatement({ ...empty, ordering: [craftedRow(0)] }, 0.5, TEST_LEAGUE)).toEqual({
      kind: 'nothing-clears',
      text: nothingClearsCopy(0.5),
    });
    expect(listStatement({ ...empty, ordering: [craftedRow(1)] }, 0.5, TEST_LEAGUE)).toEqual({ kind: 'none' });
  });

  it('state 35: an uncostable active recipe with a crafted row names the recipe, and takes precedence over state 25', () => {
    const ranking = { ...empty, ordering: [craftedRow(0)], uncostableRecipes: [{ recipeId: 'greater', currencyId: 'x' }] };
    const active = forRecipe(ranking, greater);
    expect(active.split).toBe(true);
    expect(listStatement(active, 0.5, TEST_LEAGUE)).toEqual({ kind: 'uncostable', text: uncostableCopy('greater') });
    expect(uncostableCopy('greater')).toContain('greater Craft Recipe');
  });

  it('forRecipe keeps raw rows, the active recipe’s pairs, and the class-level and active-pair Unrankables', () => {
    const ranking: Ranking = {
      ...empty,
      ordering: [craftedRow(1, 'perfect'), craftedRow(1, 'greater')],
      unrankable: [
        { categoryId: 'a', className: 'A', reason: 'pool partial' },
        { categoryId: 'b', className: 'B', reason: 'recipe cannot reach this class', recipeId: 'perfect' },
      ],
    };
    const active = forRecipe(ranking, greater);
    expect(active.ordering.map((row) => (row.kind === 'crafted' ? row.recipeId : 'raw'))).toEqual(['greater']);
    expect(active.unrankable.map((item) => item.className)).toEqual(['A']);
    expect(active.split).toBe(false);
    expect(forRecipe(ranking, undefined).ordering).toEqual([]);
  });

  it('state 23: a league reset with a rankable crafted class is honest-empty under a costable recipe, over state 25', () => {
    const reset = forRecipe({ ...empty, pricedInLeague: false, ordering: [craftedRow(0)] }, greater);
    expect(isHonestEmpty(reset)).toBe(true);
    expect(listStatement(reset, 0.5, TEST_LEAGUE)).toEqual({ kind: 'honest-empty', text: honestEmptyCopy(TEST_LEAGUE) });
  });

  it('state 23: a league reset under an uncostable recipe is honest-empty, over state 35, and does not split', () => {
    const reset = forRecipe(
      {
        ...empty,
        pricedInLeague: false,
        // eslint-disable-next-line unicorn/no-null -- boundary: core's crafted ranking row types `ev` as `number | null`, null being not-yet-synced.
        ordering: [{ ...craftedRow(0), craftCost: { kind: 'uncostable', currencyId: 'x' }, ev: null }],
        uncostableRecipes: [{ recipeId: 'greater', currencyId: 'x' }],
      },
      greater,
    );
    expect(reset.uncostable).toBe(true);
    expect(reset.split).toBe(false);
    expect(listStatement(reset, 0.5, TEST_LEAGUE)).toEqual({ kind: 'honest-empty', text: honestEmptyCopy(TEST_LEAGUE) });
  });

  it('is not honest-empty while anything is priced in the league, nor with nothing to show', () => {
    expect(isHonestEmpty({ ...empty, ordering: [craftedRow(0)] })).toBe(false);
    expect(isHonestEmpty({ ...empty, pricedInLeague: false })).toBe(false);
  });
});
