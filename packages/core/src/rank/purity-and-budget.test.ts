import { canonicalKey, RankedRowSchema } from '@poe/contracts';
import type { RankedRow } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { compareRankedRows, rank } from '../rank.ts';
import type { RankInput, Ranking } from '../rank.ts';
import { crafted, keysOf, LEAGUE, OLD_LEAGUE, permute, priced, published, raw, THRESHOLD, WEIGHTS } from './test-support.ts';

/** A mixed input covering every matrix row. */
function matrixInput(): RankInput {
  const entries = {
    clears: raw('Clears'),
    atThreshold: raw('AtThreshold', 'pinned'),
    below: raw('Below'),
    oldLeague: raw('OldLeague'),
    neverSynced: raw('NeverSynced'),
    noListings: raw('NoListings'),
    unresolvable: raw('Unresolvable'),
    noRate: raw('NoRate'),
    pruned: raw('Pruned', 'pruned'),
    tieA: raw('TieA'),
    tieB: raw('TieB'),
    fourDp: raw('FourDp'),
  };
  return {
    tracked: [...Object.values(entries), crafted],
    dataset: [
      published(entries.clears, priced(0.5)),
      published(entries.atThreshold, priced(0.25)),
      published(entries.below, priced(0.1)),
      published(entries.oldLeague, priced(0.5, OLD_LEAGUE)),
      published(entries.noListings, { state: 'no-listings' }),
      published(entries.unresolvable, { state: 'unresolvable' }, false),
      published(entries.noRate, { state: 'not-yet-synced', reason: 'no-exchange-rate' }),
      published(entries.pruned, priced(0.5)),
      published(entries.tieA, priced(0.5)),
      published(entries.tieB, priced(0.5)),
      published(entries.fourDp, priced(0.1235)),
      published(crafted, priced(1)),
      published(raw('Untracked'), priced(9)),
    ],
    activeLeague: LEAGUE,
    threshold: THRESHOLD,
    weights: WEIGHTS,
  };
}

describe('rank: purity and determinism', () => {
  it('two calls over the same inputs are deep-equal', () => {
    expect(rank(matrixInput())).toEqual(rank(matrixInput()));
  });

  it('shuffled input gives an identical Ranking', () => {
    const input = matrixInput();
    const expected = rank(input);
    for (const seed of [1, 7, 42, 1234, 99_991]) {
      const shuffled: RankInput = {
        ...input,
        tracked: permute(input.tracked, seed),
        dataset: permute(input.dataset, seed + 1),
      };
      expect(rank(shuffled)).toEqual(expected);
    }
  });

  it('does not throw on any matrix input, and every row parses with RankedRowSchema', () => {
    const input = matrixInput();
    let result: Ranking | undefined;
    expect(() => {
      result = rank(input);
    }).not.toThrow();
    const rows: RankedRow[] = [...(result?.ordering ?? []), ...(result?.belowThreshold ?? [])];
    expect(rows).toHaveLength(6);
    for (const row of rows) {
      expect(RankedRowSchema.parse(row)).toEqual(row);
    }
    expect(keysOf(result?.ordering ?? [])).toEqual(
      ['Clears', 'TieA', 'TieB', 'AtThreshold'].map((id) => canonicalKey(raw(id))),
    );
  });
});

describe('compareRankedRows', () => {
  it('compares the canonical key within the raw kind and ignores EV', () => {
    const [a, b] = rank({
      tracked: [raw('A'), raw('B')],
      dataset: [published(raw('A'), priced(0.3)), published(raw('B'), priced(3))],
      activeLeague: LEAGUE,
      threshold: THRESHOLD,
      weights: WEIGHTS,
    }).ordering.toSorted(compareRankedRows).flatMap((row) => (row.kind === 'raw' ? [row] : []));
    expect(a?.baseTypeId).toBe('A');
    expect(b?.baseTypeId).toBe('B');
  });
});

describe('rank: the read-time budget (NFR-6)', () => {
  it('ranks 5,000 raw entries in under 100 ms', () => {
    const tracked = Array.from({ length: 5000 }, (_, index) => raw(`Base ${String(index).padStart(4, '0')}`));
    const dataset = tracked.map((entry, index) => published(entry, priced(((index * 37) % 500) / 100 + 0.01)));
    const input: RankInput = { tracked, dataset, activeLeague: LEAGUE, threshold: THRESHOLD, weights: WEIGHTS };
    const result = rank(input); // warm up
    const samples: number[] = [];
    for (let run = 0; run < 5; run += 1) {
      const started = Date.now();
      rank(input);
      samples.push(Date.now() - started);
    }
    expect(result.ordering.length + result.belowThreshold.length).toBe(5000);
    // The fastest of five runs, so one noisy sample on a loaded runner does not fail the budget.
    expect(Math.min(...samples)).toBeLessThan(100);
  });
});
