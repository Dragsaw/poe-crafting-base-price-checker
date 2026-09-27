import { rank } from '@poe/core';
import type { DatasetEntry, RawTrackedEntry } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { TEST_LEAGUE } from '../test-support/artifact-server';
import { hoursBefore, priced, rawEntry, unpriced } from '../test-support/list-fixtures';
import { honestEmptyCopy, listStatement, nothingClearsCopy } from './list-statement';

const NOW = Date.parse('2026-09-26T12:00:00.000Z');

function statementFor(
  tracked: readonly RawTrackedEntry[],
  dataset: readonly DatasetEntry[],
  threshold = 0.25,
): ReturnType<typeof listStatement> {
  return listStatement(rank({ tracked, dataset, activeLeague: TEST_LEAGUE, threshold, weightsLoaded: true }), threshold, TEST_LEAGUE);
}

const belt = rawEntry('Wide Belt');
const ring = rawEntry('Coral Ring');
const amulet = rawEntry('Gold Amulet');

describe('the copy', () => {
  it('reads as the 2026-09-27 decision wrote it', () => {
    expect(honestEmptyCopy('Forbidden Rites')).toBe(
      'In canonical order, not ranked: no tracked unit has a price from Forbidden Rites yet.',
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

  it('makes neither statement when every entry is unresolvable, since the list has no row', () => {
    expect(statementFor([belt], [unpriced(belt, { state: 'unresolvable' }, hoursBefore(NOW, 1))])).toEqual({
      kind: 'none',
    });
  });
});
