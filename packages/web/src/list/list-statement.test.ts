import { rank } from '@poe/core';
import type { DatasetEntry, RawTrackedEntry } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { TEST_LEAGUE } from '../test-support/artifact-server';
import { NOW } from '../test-support/dom';
import { hoursBefore, priced, rawEntry, unpriced } from '../test-support/list-fixtures';
import { honestEmptyCopy, isHonestEmpty, listStatement, nothingClearsCopy } from './list-statement';

function statementFor(
  tracked: readonly RawTrackedEntry[],
  dataset: readonly DatasetEntry[],
  threshold = 0.25,
): ReturnType<typeof listStatement> {
  return listStatement(rank({ tracked, dataset, activeLeague: TEST_LEAGUE, threshold, weights: null }), threshold, TEST_LEAGUE);
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
    const ranking = rank({ tracked, dataset, activeLeague: TEST_LEAGUE, threshold: 0.25, weights: null });
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
