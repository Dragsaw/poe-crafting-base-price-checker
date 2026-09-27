import { rank } from '@poe/core';
import { compareCanonicalKeys, type DatasetEntry, type RawTrackedEntry } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { TEST_LEAGUE } from '../test-support/artifact-server';
import { hoursBefore, priced, rawEntry, unpriced } from '../test-support/list-fixtures';
import { tierOf, toDisplayRows } from './display-rows';
import { DEFAULT_THRESHOLD } from './format';
import { isHonestEmpty } from './list-statement';

const NOW = Date.parse('2026-09-26T12:00:00.000Z');

function rowsFor(tracked: readonly RawTrackedEntry[], dataset: readonly DatasetEntry[]): ReturnType<typeof toDisplayRows> {
  const ranking = rank({ tracked, dataset, activeLeague: TEST_LEAGUE, threshold: DEFAULT_THRESHOLD, weightsLoaded: true });
  return toDisplayRows(ranking, dataset, NOW);
}

describe('tierOf', () => {
  it('is 1 for ranks 1–5, 2 for 6–10 and 3 from 11 on', () => {
    expect([1, 5, 6, 10, 11, 20, 21, 40].map(tierOf)).toEqual([1, 1, 2, 2, 3, 3, 3, 3]);
  });
});

describe('toDisplayRows', () => {
  it('numbers the ordering by position and trails the unpriced rows, noListings then notYetSynced', () => {
    const a = rawEntry('Gold Amulet');
    const b = rawEntry('Solar Amulet');
    const tried = rawEntry('Coral Ring');
    const never = rawEntry('Wide Belt');
    const rows = rowsFor(
      [never, tried, b, a],
      [
        priced(a, 0.5, hoursBefore(NOW, 3)),
        priced(b, 1.25, hoursBefore(NOW, 5 * 24 + 4)),
        unpriced(tried, { state: 'no-listings' }, hoursBefore(NOW, 9 * 24 + 2)),
      ],
    );
    expect(rows.map((row) => [row.label, row.numeral, row.tier, row.ev.text, row.age?.word])).toEqual([
      ['Solar Amulet', 1, 1, '1.25', 'priced 5d ago'],
      ['Gold Amulet', 2, 1, '0.50', undefined],
      ['Coral Ring', undefined, 3, 'an open question', 'tried 9d ago'],
      ['Wide Belt', undefined, 3, 'no figure yet', 'never attempted'],
    ]);
    expect(rows.map((row) => row.ev.kind)).toEqual(['figure', 'figure', 'phrase', 'phrase']);
    expect(rows.every((row) => row.unit === 'raw' && row.itemLevel === 82)).toBe(true);
  });

  // Matrix: mixed reset. A league reset mid-refill: some entries already read no-listings.
  it('prints an honest-empty list in canonical key order across both unpriced groups', () => {
    const ring = rawEntry('Coral Ring');
    const amulet = rawEntry('Gold Amulet');
    const belt = rawEntry('Wide Belt');
    // Lowercase-initial: last by code unit, first by locale — pins the comparator.
    const amber = rawEntry('amber Ring');
    const rows = rowsFor(
      [amber, belt, amulet, ring],
      [
        priced(ring, 0.8, hoursBefore(NOW, 30 * 24), 'Standard'),
        unpriced(amulet, { state: 'no-listings' }, hoursBefore(NOW, 2)),
        priced(belt, 1.5, hoursBefore(NOW, 30 * 24), 'Standard'),
        unpriced(amber, { state: 'no-listings' }, hoursBefore(NOW, 2)),
      ],
    );
    expect(rows.map((row) => [row.label, row.numeral, row.ev.text, row.state.state])).toEqual([
      ['Coral Ring', undefined, 'no figure yet', 'not-yet-synced'],
      ['Gold Amulet', undefined, 'no figure yet', 'no-listings'],
      ['Wide Belt', undefined, 'no figure yet', 'not-yet-synced'],
      ['amber Ring', undefined, 'no figure yet', 'no-listings'],
    ]);
    const keys = rows.map((row) => row.key);
    expect(keys).toEqual(keys.toSorted(compareCanonicalKeys));
    expect(rows.every((row) => row.ev.kind === 'phrase' && row.tier === 3)).toBe(true);
  });

  // Matrix: partial refresh. A ranked row prints, so the unpriced groups stay as option a.
  it('keeps the unpriced rows grouped, noListings then notYetSynced, on a partial refresh', () => {
    const solar = rawEntry('Solar Amulet');
    const ring = rawEntry('Coral Ring');
    const amulet = rawEntry('Gold Amulet');
    const belt = rawEntry('Wide Belt');
    const rows = rowsFor(
      [belt, amulet, ring, solar],
      [
        priced(solar, 1.25, hoursBefore(NOW, 1)),
        priced(ring, 0.8, hoursBefore(NOW, 30 * 24), 'Standard'),
        unpriced(amulet, { state: 'no-listings' }, hoursBefore(NOW, 2)),
      ],
    );
    expect(rows.map((row) => [row.label, row.numeral, row.ev.text])).toEqual([
      ['Solar Amulet', 1, '1.25'],
      ['Gold Amulet', undefined, 'an open question'],
      ['Coral Ring', undefined, 'no figure yet'],
      ['Wide Belt', undefined, 'no figure yet'],
    ]);
  });

  // Matrix: nothing clears. No order claim prints, so the groups stay as option a.
  it('keeps the unpriced rows grouped, noListings then notYetSynced, when nothing clears', () => {
    const cheap = rawEntry('Iron Ring');
    const ring = rawEntry('Coral Ring');
    const amulet = rawEntry('Gold Amulet');
    const belt = rawEntry('Wide Belt');
    const dataset = [
      priced(cheap, 0.1, hoursBefore(NOW, 1)),
      priced(ring, 0.8, hoursBefore(NOW, 30 * 24), 'Standard'),
      unpriced(amulet, { state: 'no-listings' }, hoursBefore(NOW, 2)),
    ];
    const ranking = rank({
      tracked: [belt, amulet, ring, cheap],
      dataset,
      activeLeague: TEST_LEAGUE,
      threshold: DEFAULT_THRESHOLD,
      weightsLoaded: true,
    });
    expect(ranking.belowThreshold.length).toBeGreaterThan(0);
    expect(isHonestEmpty(ranking)).toBe(false);
    const rows = toDisplayRows(ranking, dataset, NOW);
    expect(rows.map((row) => [row.label, row.ev.text])).toEqual([
      ['Gold Amulet', 'an open question'],
      ['Coral Ring', 'no figure yet'],
      ['Wide Belt', 'no figure yet'],
    ]);
  });

  it('drops unresolvable and below-threshold entries, and gives a league mismatch its observation age', () => {
    const lost = rawEntry('Lost Ring');
    const cheap = rawEntry('Iron Ring');
    const old = rawEntry('Jade Amulet');
    const rows = rowsFor(
      [lost, cheap, old],
      [
        unpriced(lost, { state: 'unresolvable' }, hoursBefore(NOW, 1)),
        priced(cheap, 0.1, hoursBefore(NOW, 1)),
        priced(old, 3, hoursBefore(NOW, 72), 'Standard'),
      ],
    );
    expect(rows.map((row) => [row.label, row.numeral, row.ev.text, row.age?.word])).toEqual([
      ['Jade Amulet', undefined, 'no figure yet', 'priced 3d ago'],
    ]);
  });

  it('gives ranks 21 and beyond tier 3, and a tiny price < 0.01', () => {
    const entries = Array.from({ length: 25 }, (_, i) => rawEntry(`Base ${String(i).padStart(2, '0')}`));
    const rows = toDisplayRows(
      rank({
        tracked: entries,
        dataset: entries.map((entry, i) => priced(entry, 30 - i, hoursBefore(NOW, 1))),
        activeLeague: TEST_LEAGUE,
        threshold: 0,
        weightsLoaded: true,
      }),
      [],
      NOW,
    );
    expect(rows).toHaveLength(25);
    expect(rows.slice(20).every((row) => row.tier === 3)).toBe(true);
    expect(rows[24]?.numeral).toBe(25);

    const tiny = rawEntry('Tiny');
    const [only] = toDisplayRows(
      rank({ tracked: [tiny], dataset: [priced(tiny, 0.0031, hoursBefore(NOW, 1))], activeLeague: TEST_LEAGUE, threshold: 0, weightsLoaded: true }),
      [],
      NOW,
    );
    expect(only?.ev).toEqual({ kind: 'figure', text: '< 0.01' });
  });
});

describe('the detail each row carries for its expansion', () => {
  it('carries the priced state, status, dataset entry and both exact ages on a ranked row', () => {
    const belt = { ...rawEntry('Wide Belt', 75), status: 'pinned' as const };
    const published = {
      ...priced(belt, 0.8, hoursBefore(NOW, 11), TEST_LEAGUE, { id: 'abc', league: TEST_LEAGUE }),
      lastAttemptedAt: hoursBefore(NOW, 4),
    };
    const [row] = rowsFor([belt], [published]);
    expect(row?.status).toBe('pinned');
    expect(row?.itemLevel).toBe(75);
    expect(row?.entry).toBe(published);
    expect(row?.state).toEqual({ state: 'priced', priceDivine: 0.8, sampleSize: 10, observedAt: hoursBefore(NOW, 11) });
    expect(row?.ages).toEqual({ observed: 'priced 11h ago', attempted: 'tried 4h ago' });
  });

  it('resolves no-listings, never-synced and league-mismatch, keeping the ordering', () => {
    const tried = rawEntry('Coral Ring');
    const never = rawEntry('Wide Belt');
    const old = rawEntry('Jade Amulet');
    const rows = rowsFor(
      [never, tried, old],
      [unpriced(tried, { state: 'no-listings' }, hoursBefore(NOW, 3)), priced(old, 3, hoursBefore(NOW, 72), 'Standard')],
    );
    expect(rows.map((row) => [row.label, row.state, row.ages])).toEqual([
      ['Coral Ring', { state: 'no-listings' }, { observed: undefined, attempted: 'tried 3h ago' }],
      ['Jade Amulet', { state: 'not-yet-synced', reason: 'league-mismatch' }, { observed: undefined, attempted: 'tried 3d ago' }],
      ['Wide Belt', { state: 'not-yet-synced', reason: 'never-synced' }, { observed: undefined, attempted: undefined }],
    ]);
    expect(rows[2]?.entry).toBeUndefined();
    expect(rows.every((row) => row.status === 'active')).toBe(true);
  });
});
