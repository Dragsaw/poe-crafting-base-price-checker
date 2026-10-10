import { canonicalKey, compareCanonicalKeys, RankedRowSchema } from '@poe/contracts';
import type { CraftedRankedRow, DatasetEntry, PriceState, TrackedEntry } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import type { Ranking } from '../rank.ts';
import {
  chase,
  craftedRows,
  GREATER,
  keysOf,
  observation,
  OLD_LEAGUE,
  poolsFile,
  priced,
  published,
  rankCrafted,
  ranked,
  raw,
  SUFFIX_STAT,
  tierOf,
} from './test-support.ts';
import type { Pools } from './test-support.ts';

const STATS = ['explicit.stat_s1', 'explicit.stat_s2', 'explicit.stat_s3', 'explicit.stat_s4', 'explicit.stat_s5'] as const;
/** Five prefix tiers of equal weight, so each entry's P is 1 in 5 under GREATER. */
const FIVE_POOLS: Pools = [STATS.map((statId) => tierOf(statId, 10)), [tierOf(SUFFIX_STAT, 10)]];
const [s1, s2, s3, s4, s5] = STATS.map((statId) => chase('Bows', statId)) as [
  TrackedEntry,
  TrackedEntry,
  TrackedEntry,
  TrackedEntry,
  TrackedEntry,
];
const OLD_OBSERVED = '2026-09-22T10:00:00Z';

function oldPrice(priceDivine: number, sampleSize = 10): PriceState {
  return { state: 'priced', observation: { ...observation(priceDivine), observedAt: OLD_OBSERVED, sampleSize } };
}

function rankBows(dataset: readonly DatasetEntry[], threshold = 0.25, isRated = true): Ranking {
  return rankCrafted({
    tracked: [s1, s2, s3, s4, s5],
    dataset,
    threshold,
    weights: poolsFile(['weapon.bow', 'Bows', FIVE_POOLS]),
    recipes: [GREATER],
    ...(!isRated && { currencyRates: [] }),
  });
}

function onlyRow(result: Ranking): CraftedRankedRow {
  const [row] = craftedRows(result.ordering);
  if (row === undefined) {
    throw new Error('no crafted row');
  }
  return row;
}

const key = (entry: TrackedEntry): string => canonicalKey(entry);

describe('rank: price trust on every row, summand and combination', () => {
  it('parses every output row with RankedRowSchema, each carrying a trust', () => {
    const A = raw('A');
    const B = raw('B');
    const result = ranked({
      tracked: [A, B, s1, s2, s3, s4, s5],
      dataset: [
        published(A, oldPrice(0.5, 1)),
        published(B, priced(0.1)),
        published(s1, priced(10)),
        published(s2, priced(0.1)),
        published(s3, { state: 'no-listings' }),
        published(s4, { state: 'unresolvable' }),
      ],
      weights: poolsFile(['weapon.bow', 'Bows', FIVE_POOLS]),
      recipes: [GREATER],
      currencyRates: [],
    });
    for (const row of [...result.ordering, ...result.belowThreshold]) {
      expect(RankedRowSchema.parse(row)).toEqual(row);
      expect(row.trust).toBeDefined();
    }
    const crafted = onlyRow(result);
    expect(crafted.summands.map((summand) => summand.trust.verdict)).toEqual(['current']);
    expect(crafted.combinations.map((combination) => combination.trust.verdict)).toEqual(['current', 'pending', 'pending', 'broken']);
    expect(crafted.trust).toEqual({ verdict: 'pending', reasons: [{ kind: 'uncostable' }] });
  });

  it('a raw row carries its one entry’s verdict, below the threshold too', () => {
    const A = raw('A');
    const B = raw('B');
    const result = ranked({
      tracked: [A, B],
      dataset: [published(A, oldPrice(0.5, 2)), published(B, oldPrice(0.1))],
    });
    expect(result.ordering[0]?.trust).toEqual({
      verdict: 'rough',
      reasons: [
        { kind: 'old', days: 4 },
        { kind: 'thin', listings: 2 },
      ],
    });
    expect(result.belowThreshold[0]?.trust).toEqual({ verdict: 'rough', reasons: [{ kind: 'old', days: 4 }] });
  });

  it('orders the combinations below-threshold, then pending, then broken, then by key', () => {
    const row = onlyRow(
      rankBows([
        published(s1, priced(10)),
        published(s2, priced(0.1)),
        published(s3, { state: 'no-listings' }),
        published(s4, { state: 'unresolvable' }),
      ]),
    );
    expect(keysOf(row.summands)).toEqual([key(s1)]);
    expect(keysOf(row.combinations)).toEqual([key(s2), ...[key(s3), key(s5)].toSorted(compareCanonicalKeys), key(s4)]);
    expect(row.combinations.map((combination) => combination.trust.verdict)).toEqual(['current', 'pending', 'pending', 'broken']);
    expect(row.trust).toEqual({ verdict: 'current', reasons: [] });
  });

  it('puts the active-league price on a below-threshold combination only', () => {
    const row = onlyRow(
      rankBows([
        published(s1, priced(10)),
        published(s2, priced(0.1)),
        published(s3, { state: 'no-listings' }),
        published(s4, { state: 'unresolvable' }),
        published(s5, priced(0.2, OLD_LEAGUE)),
      ]),
    );
    const prices = new Map(row.combinations.map((combination) => [combination.entryKey, combination.priceDivine]));
    expect(prices).toEqual(new Map([[key(s2), 0.1], [key(s3), undefined], [key(s4), undefined], [key(s5), undefined]]));
    expect(row.combinations.filter((combination) => 'priceDivine' in combination).map((combination) => combination.entryKey)).toEqual([key(s2)]);
  });
});

describe('rank: rough entries of a crafted row', () => {
  it('carries a rough summand’s trust, and sorts a rough below-threshold entry ahead of the pending ones', () => {
    const row = onlyRow(rankBows([published(s1, oldPrice(10)), published(s2, oldPrice(0.1, 1)), published(s3, { state: 'no-listings' })]));
    expect(row.summands[0]?.trust).toEqual({ verdict: 'rough', reasons: [{ kind: 'old', days: 4 }] });
    expect(keysOf(row.combinations)).toEqual([key(s2), ...[key(s3), key(s4), key(s5)].toSorted(compareCanonicalKeys)]);
    expect(row.combinations[0]?.trust).toEqual({
      verdict: 'rough',
      reasons: [
        { kind: 'old', days: 4 },
        { kind: 'thin', listings: 1 },
      ],
    });
  });
});

describe('rank: the crafted rules', () => {
  const broken = [s1, s2, s3, s4, s5].map((entry) => published(entry, { state: 'unresolvable' }));

  it('an uncostable recipe is pending uncostable, even when every entry is broken', () => {
    expect(onlyRow(rankBows(broken, 0.25, false)).trust).toEqual({ verdict: 'pending', reasons: [{ kind: 'uncostable' }] });
  });

  it('every entry broken is broken all-broken', () => {
    expect(onlyRow(rankBows(broken)).trust).toEqual({ verdict: 'broken', reasons: [{ kind: 'all-broken' }] });
  });

  it('no priced entry is pending no-prices, whether all pending or pending and broken', () => {
    const noPrices = { verdict: 'pending', reasons: [{ kind: 'no-prices' }] };
    expect(onlyRow(rankBows([])).trust).toEqual(noPrices);
    expect(onlyRow(rankBows([published(s1, { state: 'unresolvable' }), published(s2, priced(1, 'Standard'))])).trust).toEqual(
      noPrices,
    );
  });

  it('the share counts below-threshold entries, so the threshold never moves the verdict', () => {
    // Gross 0.2 × 7 (old) against 0.2 × 3 (current): 70%, the bound.
    const dataset = [published(s1, oldPrice(7)), published(s2, priced(3)), published(s3, { state: 'no-listings' })];
    const rough = { verdict: 'rough', reasons: [{ kind: 'unreliable-share', percent: 70 }] };
    for (const threshold of [0, 0.25, 5, 100]) {
      expect(onlyRow(rankBows(dataset, threshold)).trust).toEqual(rough);
    }
  });

  it('leaves provenance, asOf and the EV arithmetic as they were', () => {
    const dataset = [published(s1, oldPrice(7)), published(s2, priced(3))];
    const row = onlyRow(rankBows(dataset));
    expect(row.provenance).toBe('measured');
    expect(row.asOf).toBe(OLD_OBSERVED);
    expect(row.grossPayout).toBe(row.summands.reduce((sum, summand) => sum + summand.contribution, 0));
    const above = onlyRow(rankBows(dataset, 5));
    expect(above.asOf).toBe(OLD_OBSERVED);
    expect(keysOf(above.summands)).toEqual([key(s1)]);
  });
});

describe('rank: the clock', () => {
  it('refuses an unparseable now', () => {
    expect(() => ranked({ tracked: [], now: 'yesterday' })).toThrow(RangeError);
  });

  it('reads ages against the now it is given', () => {
    const A = raw('A');
    const dataset = [published(A, priced(0.5))];
    expect(ranked({ tracked: [A], dataset }).ordering[0]?.trust.verdict).toBe('current');
    expect(ranked({ tracked: [A], dataset, now: '2026-09-29T10:00:00Z' }).ordering[0]?.trust).toEqual({
      verdict: 'rough',
      reasons: [{ kind: 'old', days: 3 }],
    });
  });
});
