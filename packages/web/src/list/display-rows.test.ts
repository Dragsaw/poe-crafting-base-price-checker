import { rank } from '@poe/core';
import { compareCanonicalKeys, type DatasetEntry, type RawTrackedEntry } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { DEFAULT_THRESHOLD } from '../shared/product';
import { TEST_LEAGUE } from '../test-support/artifact-server';
import { NOW, NOW_ISO } from '../test-support/dom';
import { hoursBefore, priced, rawEntry, unpriced } from '../test-support/list-fixtures';
import { tierOf, toDisplayRows, type DisplayRow, type ListRow } from './display-rows';
import { isHonestEmpty } from './list-statement';

/** The EV cell as a test reads it: the figure text, or `missing` where `—` prints beside a mark. */
function printedValue(row: ListRow): string {
  return row.ev.kind === 'figure' ? row.ev.text : 'missing';
}

/** A raw-only list, narrowed to Raw Base rows. */
function rowsFor(tracked: readonly RawTrackedEntry[], dataset: readonly DatasetEntry[]): DisplayRow[] {
  const ranking = rank({ tracked, dataset, activeLeague: TEST_LEAGUE, now: NOW_ISO, threshold: DEFAULT_THRESHOLD, weights: undefined });
  return toDisplayRows(ranking, dataset, NOW).flatMap((row) => (row.unit === 'raw' ? [row] : []));
}

describe('tierOf', () => {
  it('is 1 for ranks 1–5, 2 for 6–10 and 3 from 11 on', () => {
    expect([1, 5, 6, 10, 11, 20, 21, 40].map((position) => tierOf(position))).toEqual([1, 1, 2, 2, 3, 3, 3, 3]);
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
    expect(rows.map((row) => [row.label, row.numeral, row.tier, printedValue(row)])).toEqual([
      ['Solar Amulet', 1, 1, '1.25'],
      ['Gold Amulet', 2, 1, '0.50'],
      ['Coral Ring', undefined, 3, 'missing'],
      ['Wide Belt', undefined, 3, 'missing'],
    ]);
    expect(rows.map((row) => row.ev.kind)).toEqual(['figure', 'figure', 'missing', 'missing']);
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
        priced(ring, 0.8, hoursBefore(NOW, 30 * 24), { league: 'Standard' }),
        unpriced(amulet, { state: 'no-listings' }, hoursBefore(NOW, 2)),
        priced(belt, 1.5, hoursBefore(NOW, 30 * 24), { league: 'Standard' }),
        unpriced(amber, { state: 'no-listings' }, hoursBefore(NOW, 2)),
      ],
    );
    expect(rows.map((row) => [row.label, row.numeral, printedValue(row), row.state.state])).toEqual([
      ['Coral Ring', undefined, 'missing', 'not-yet-synced'],
      ['Gold Amulet', undefined, 'missing', 'no-listings'],
      ['Wide Belt', undefined, 'missing', 'not-yet-synced'],
      ['amber Ring', undefined, 'missing', 'no-listings'],
    ]);
    const keys = rows.map((row) => row.key);
    expect(keys).toEqual(keys.toSorted(compareCanonicalKeys));
    expect(rows.every((row) => row.ev.kind === 'missing' && row.tier === 3)).toBe(true);
  });

  // Matrix: mixed reset with an unresolvable row. State 23's missing EV holds whatever the Price State.
  it('folds the unresolvable rows into the honest-empty canonical sequence, each EV missing (—)', () => {
    const ring = rawEntry('Coral Ring');
    const amulet = rawEntry('Gold Amulet');
    const lost = rawEntry('Lost Ring');
    const rows = rowsFor(
      [lost, amulet, ring],
      [
        priced(ring, 0.8, hoursBefore(NOW, 30 * 24), { league: 'Standard' }),
        unpriced(amulet, { state: 'no-listings' }, hoursBefore(NOW, 2)),
        unpriced(lost, { state: 'unresolvable' }, hoursBefore(NOW, 1)),
      ],
    );
    expect(rows.map((row) => [row.label, row.numeral, printedValue(row), row.state.state])).toEqual([
      ['Coral Ring', undefined, 'missing', 'not-yet-synced'],
      ['Gold Amulet', undefined, 'missing', 'no-listings'],
      ['Lost Ring', undefined, 'missing', 'unresolvable'],
    ]);
    const keys = rows.map((row) => row.key);
    expect(keys).toEqual(keys.toSorted(compareCanonicalKeys));
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
        priced(ring, 0.8, hoursBefore(NOW, 30 * 24), { league: 'Standard' }),
        unpriced(amulet, { state: 'no-listings' }, hoursBefore(NOW, 2)),
      ],
    );
    expect(rows.map((row) => [row.label, row.numeral, printedValue(row)])).toEqual([
      ['Solar Amulet', 1, '1.25'],
      ['Gold Amulet', undefined, 'missing'],
      ['Coral Ring', undefined, 'missing'],
      ['Wide Belt', undefined, 'missing'],
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
      priced(ring, 0.8, hoursBefore(NOW, 30 * 24), { league: 'Standard' }),
      unpriced(amulet, { state: 'no-listings' }, hoursBefore(NOW, 2)),
    ];
    const ranking = rank({
      tracked: [belt, amulet, ring, cheap],
      dataset,
      activeLeague: TEST_LEAGUE,
      now: NOW_ISO,
      threshold: DEFAULT_THRESHOLD,
      weights: undefined,
    });
    expect(ranking.belowThreshold.length).toBeGreaterThan(0);
    expect(isHonestEmpty(ranking)).toBe(false);
    const rows = toDisplayRows(ranking, dataset, NOW);
    expect(rows.map((row) => [row.label, printedValue(row)])).toEqual([
      ['Gold Amulet', 'missing'],
      ['Coral Ring', 'missing'],
      ['Wide Belt', 'missing'],
    ]);
  });

  it('trails the unresolvable rows last, in canonical key order, after noListings and notYetSynced', () => {
    const a = rawEntry('Gold Amulet');
    const tried = rawEntry('Coral Ring');
    const never = rawEntry('Wide Belt');
    const lost = rawEntry('Lost Ring');
    const gone = rawEntry('Broken Ring');
    const rows = rowsFor(
      [lost, never, a, gone, tried],
      [
        unpriced(lost, { state: 'unresolvable' }, hoursBefore(NOW, 1)),
        priced(a, 0.5, hoursBefore(NOW, 3)),
        unpriced(gone, { state: 'unresolvable' }, hoursBefore(NOW, 3 * 24 + 1)),
        unpriced(tried, { state: 'no-listings' }, hoursBefore(NOW, 2)),
      ],
    );
    expect(rows.map((row) => [row.label, row.numeral, row.tier, printedValue(row), row.state.state])).toEqual([
      ['Gold Amulet', 1, 1, '0.50', 'priced'],
      ['Coral Ring', undefined, 3, 'missing', 'no-listings'],
      ['Wide Belt', undefined, 3, 'missing', 'not-yet-synced'],
      ['Broken Ring', undefined, 3, 'missing', 'unresolvable'],
      ['Lost Ring', undefined, 3, 'missing', 'unresolvable'],
    ]);
    expect(rows[4]?.ages).toEqual({ observed: undefined, attempted: 'tried 1h ago' });
  });

  it('drops below-threshold entries, and gives a league mismatch its attempted age', () => {
    const cheap = rawEntry('Iron Ring');
    const old = rawEntry('Jade Amulet');
    const rows = rowsFor(
      [cheap, old],
      [priced(cheap, 0.1, hoursBefore(NOW, 1)), priced(old, 3, hoursBefore(NOW, 72), { league: 'Standard' })],
    );
    expect(rows.map((row) => [row.label, row.numeral, printedValue(row), row.ages.attempted])).toEqual([
      ['Jade Amulet', undefined, 'missing', 'tried 3d ago'],
    ]);
  });

  it('gives ranks 21 and beyond tier 3, and a tiny price < 0.01', () => {
    const entries = Array.from({ length: 25 }, (_, index) => rawEntry(`Base ${String(index).padStart(2, '0')}`));
    const rows = toDisplayRows(
      rank({
        tracked: entries,
        dataset: entries.map((entry, index) => priced(entry, 30 - index, hoursBefore(NOW, 1))),
        activeLeague: TEST_LEAGUE,
        now: NOW_ISO,
        threshold: 0,
        weights: undefined,
      }),
      [],
      NOW,
    );
    expect(rows).toHaveLength(25);
    expect(rows.slice(20).every((row) => row.tier === 3)).toBe(true);
    expect(rows[24]?.numeral).toBe(25);

    const tiny = rawEntry('Tiny');
    const [only] = toDisplayRows(
      rank({ tracked: [tiny], dataset: [priced(tiny, 0.0031, hoursBefore(NOW, 1))], activeLeague: TEST_LEAGUE, now: NOW_ISO, threshold: 0, weights: undefined }),
      [],
      NOW,
    );
    expect(only?.ev).toEqual({ kind: 'figure', text: '< 0.01', negative: false });
  });
});

describe('the detail each row carries for its expansion', () => {
  it('carries the priced state, status, dataset entry and both exact ages on a ranked row', () => {
    const belt = { ...rawEntry('Wide Belt', 75), status: 'pinned' as const };
    const published = {
      ...priced(belt, 0.8, hoursBefore(NOW, 11), { search: { id: 'abc', league: TEST_LEAGUE } }),
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
      [unpriced(tried, { state: 'no-listings' }, hoursBefore(NOW, 3)), priced(old, 3, hoursBefore(NOW, 72), { league: 'Standard' })],
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

describe('the summands in web', () => {
  const sources = import.meta.glob<string>(['../**/*.{ts,tsx}', '!../**/*.test.{ts,tsx}', '!../test-support/**'], {
    query: '?raw',
    import: 'default',
    eager: true,
  });

  it('only slices core’s summands to three and reads their keys: no reorder, no term computed', () => {
    const uses = Object.entries(sources).flatMap(([path, text]) =>
      Array.from(text.matchAll(/\bsummands\b[^\n]*/g), (match) => `${path}: ${match[0]}`),
    );
    expect(uses.length).toBeGreaterThan(0);
    // Each code use of `summands` in web source, verbatim. Prose in comments starts with no `.` or `(`.
    const allowed = new Set([
      './display-rows.ts: summands.map((summand) => summand.entryKey));',
      './display-rows.ts: summands.slice(0, CHASE_CELLS).map((summand) => text(summand.entryKey)),',
      './display-rows.ts: summands.map((summand) => summand.entryKey), ...rest].flatMap((entryKey) => combination(entryKey)),',
      // State 25 reads whether any summand survives (Story 3.4).
      './list-statement.ts: summands.length > 0);',
    ]);
    const code = uses.filter((use) => /: summands[.)]/.test(use));
    expect(code.length).toBeGreaterThan(0);
    expect(code.filter((use) => !allowed.has(use))).toEqual([]);
    for (const [path, text] of Object.entries(sources)) {
      expect(text, path).not.toMatch(/\.(contribution|probability|grossPayout)\b/);
    }
  });
});
