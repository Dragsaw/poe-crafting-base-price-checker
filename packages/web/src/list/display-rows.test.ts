import { rank } from '@poe/core';
import type { DatasetEntry, RawTrackedEntry } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { TEST_LEAGUE } from '../test-support/artifact-server';
import { hoursBefore, priced, rawEntry, unpriced } from '../test-support/list-fixtures';
import { tierOf, toDisplayRows } from './display-rows';
import { DEFAULT_THRESHOLD } from './format';

const NOW = Date.parse('2026-09-26T12:00:00.000Z');

function rowsFor(tracked: readonly RawTrackedEntry[], dataset: readonly DatasetEntry[]): ReturnType<typeof toDisplayRows> {
  const ranking = rank({ tracked, dataset, activeLeague: TEST_LEAGUE, threshold: DEFAULT_THRESHOLD });
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
      }),
      [],
      NOW,
    );
    expect(rows).toHaveLength(25);
    expect(rows.slice(20).every((row) => row.tier === 3)).toBe(true);
    expect(rows[24]?.numeral).toBe(25);

    const tiny = rawEntry('Tiny');
    const [only] = toDisplayRows(
      rank({ tracked: [tiny], dataset: [priced(tiny, 0.0031, hoursBefore(NOW, 1))], activeLeague: TEST_LEAGUE, threshold: 0 }),
      [],
      NOW,
    );
    expect(only?.ev).toEqual({ kind: 'figure', text: '< 0.01' });
  });
});
