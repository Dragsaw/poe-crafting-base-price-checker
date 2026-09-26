import { canonicalKey, RankedRowSchema } from '@poe/contracts';
import type {
  DatasetEntry,
  PriceObservation,
  PriceState,
  RankedRow,
  TrackedEntry,
} from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { compareRankedRows, rank } from './rank.ts';
import type { RankInput, Ranking } from './rank.ts';

const LEAGUE = 'Forbidden Rites';
const OLD_LEAGUE = 'Standard Rites';
const THRESHOLD = 0.25;
const ATTEMPTED = '2026-09-26T11:00:00Z';

function raw(baseTypeId: string, status: TrackedEntry['status'] = 'active'): TrackedEntry {
  return status === 'pruned'
    ? { kind: 'raw', baseTypeId, itemLevelMin: 82, status, prunedReason: 'no market' }
    : { kind: 'raw', baseTypeId, itemLevelMin: 82, status };
}

const crafted: TrackedEntry = {
  kind: 'crafted',
  categoryId: 'accessory.amulet',
  className: 'Amulets',
  itemLevelMin: 54,
  prefix: { kind: 'valueless', statId: 'explicit.stat_1' },
  status: 'active',
};

function observation(priceDivine: number, league: string = LEAGUE): PriceObservation {
  return {
    league,
    observedAt: '2026-09-26T10:00:00Z',
    priceDivine,
    sampleSize: 10,
    exchangeObservation: {
      currencyId: 'exalted',
      rate: 0.0042,
      source: 'in-game exchange, by hand',
      league,
      asOf: '2026-09-25T08:00:00Z',
    },
  };
}

const priced = (priceDivine: number, league: string = LEAGUE): PriceState => ({
  state: 'priced',
  observation: observation(priceDivine, league),
});

function published(
  entry: TrackedEntry,
  price: PriceState,
  /** `null` publishes no `lastAttemptedAt`; `undefined` would take the default. */
  lastAttemptedAt: string | null = ATTEMPTED,
): DatasetEntry {
  return lastAttemptedAt === null
    ? { entryKey: canonicalKey(entry), price }
    : { entryKey: canonicalKey(entry), price, lastAttemptedAt };
}

function ranked(input: Partial<RankInput> & Pick<RankInput, 'tracked'>): Ranking {
  return rank({ dataset: [], activeLeague: LEAGUE, threshold: THRESHOLD, ...input });
}

const keysOf = (items: readonly { entryKey: string }[]): string[] => items.map((item) => item.entryKey);

/** Every entry key the ranking mentions, in any group. */
const everyKey = (result: Ranking): string[] => [
  ...keysOf(result.ordering),
  ...keysOf(result.belowThreshold),
  ...keysOf(result.noListings),
  ...keysOf(result.notYetSynced),
  ...keysOf(result.unresolvable),
];

describe('rank: the I/O matrix', () => {
  it('a priced entry that clears the threshold is a row, EV its price, craft cost 0', () => {
    const A = raw('A');
    const result = ranked({ tracked: [A], dataset: [published(A, priced(0.5))] });
    expect(result.ordering).toEqual([
      {
        kind: 'raw',
        entryKey: canonicalKey(A),
        baseTypeId: 'A',
        itemLevelMin: 82,
        status: 'active',
        ev: 0.5,
        craftCost: 0,
        observation: observation(0.5),
        lastAttemptedAt: ATTEMPTED,
      },
    ]);
    expect(result.belowThreshold).toEqual([]);
  });

  it('a priced row whose dataset entry has no lastAttemptedAt carries none', () => {
    const A = raw('A');
    const result = ranked({ tracked: [A], dataset: [published(A, priced(0.5), null)] });
    expect(keysOf(result.ordering)).toEqual([canonicalKey(A)]);
    expect(result.ordering[0]).not.toHaveProperty('lastAttemptedAt');
  });

  it('a price exactly at the threshold survives', () => {
    const A = raw('A');
    const result = ranked({ tracked: [A], dataset: [published(A, priced(0.25))] });
    expect(keysOf(result.ordering)).toEqual([canonicalKey(A)]);
    expect(result.belowThreshold).toEqual([]);
  });

  it('a price below the threshold is in belowThreshold only', () => {
    const A = raw('A');
    const result = ranked({ tracked: [A], dataset: [published(A, priced(0.1))] });
    expect(result.ordering).toEqual([]);
    expect(keysOf(result.belowThreshold)).toEqual([canonicalKey(A)]);
    expect(result.belowThreshold[0]?.ev).toBe(0.1);
    expect(everyKey(result)).toEqual([canonicalKey(A)]);
  });

  it('an observation from another league is not-yet-synced / league-mismatch, never below-threshold', () => {
    const A = raw('A');
    const B = raw('B');
    const result = ranked({
      tracked: [A, B],
      dataset: [published(A, priced(0.5, OLD_LEAGUE)), published(B, priced(0.1, OLD_LEAGUE))],
    });
    expect(result.ordering).toEqual([]);
    expect(result.belowThreshold).toEqual([]);
    expect(result.notYetSynced).toEqual([
      { entry: A, entryKey: canonicalKey(A), lastAttemptedAt: ATTEMPTED, reason: 'league-mismatch' },
      { entry: B, entryKey: canonicalKey(B), lastAttemptedAt: ATTEMPTED, reason: 'league-mismatch' },
    ]);
  });

  it('compares only observation.league against the active league', () => {
    const A = raw('A');
    // The exchange observation's league differs; only the observation's own league counts.
    const price: PriceState = {
      state: 'priced',
      observation: { ...observation(0.5), exchangeObservation: observation(1, OLD_LEAGUE).exchangeObservation },
    };
    const result = ranked({ tracked: [A], dataset: [published(A, price)] });
    expect(keysOf(result.ordering)).toEqual([canonicalKey(A)]);
  });

  it('a tracked entry with no dataset entry is not-yet-synced / never-synced, with no lastAttemptedAt', () => {
    const A = raw('A');
    const result = ranked({ tracked: [A] });
    expect(result.notYetSynced).toEqual([{ entry: A, entryKey: canonicalKey(A), reason: 'never-synced' }]);
    expect(result.notYetSynced[0]).not.toHaveProperty('lastAttemptedAt');
  });

  it('other states go to their own group, the published reason kept', () => {
    const N = raw('N');
    const U = raw('U');
    const X = raw('X');
    const result = ranked({
      tracked: [N, U, X],
      dataset: [
        published(N, { state: 'no-listings' }),
        published(U, { state: 'unresolvable' }, null),
        published(X, { state: 'not-yet-synced', reason: 'no-exchange-rate' }),
      ],
    });
    expect(result.noListings).toEqual([{ entry: N, entryKey: canonicalKey(N), lastAttemptedAt: ATTEMPTED }]);
    expect(result.unresolvable).toEqual([{ entry: U, entryKey: canonicalKey(U) }]);
    expect(result.notYetSynced).toEqual([
      { entry: X, entryKey: canonicalKey(X), lastAttemptedAt: ATTEMPTED, reason: 'no-exchange-rate' },
    ]);
    expect(result.ordering).toEqual([]);
    expect(result.belowThreshold).toEqual([]);
  });

  it('pruned and crafted entries are absent from every group', () => {
    const P = raw('P', 'pruned');
    const result = ranked({
      tracked: [P, crafted],
      dataset: [published(P, priced(0.5)), published(crafted, priced(0.5))],
    });
    expect(everyKey(result)).toEqual([]);
  });

  it('a dataset entry whose key is not tracked is ignored', () => {
    const A = raw('A');
    const result = ranked({ tracked: [], dataset: [published(A, priced(0.5))] });
    expect(everyKey(result)).toEqual([]);
  });

  it('equal EV breaks on the canonical key, stable across input order', () => {
    const A = raw('A');
    const B = raw('B');
    const dataset = [published(B, priced(0.5)), published(A, priced(0.5))];
    expect(keysOf(ranked({ tracked: [B, A], dataset }).ordering)).toEqual([A, B].map(canonicalKey));
    expect(keysOf(ranked({ tracked: [A, B], dataset }).ordering)).toEqual([A, B].map(canonicalKey));
  });

  it('breaks ties on the whole serialised key, not a bare base type id', () => {
    const low: TrackedEntry = { kind: 'raw', baseTypeId: 'A', itemLevelMin: 86, status: 'active' };
    const high: TrackedEntry = { kind: 'raw', baseTypeId: 'A', itemLevelMin: 100, status: 'active' };
    const result = ranked({
      tracked: [low, high],
      dataset: [published(low, priced(0.5)), published(high, priced(0.5))],
    });
    // '["raw","A",100]' < '["raw","A",86]' by code unit.
    expect(keysOf(result.ordering)).toEqual([canonicalKey(high), canonicalKey(low)]);
  });

  it('orders by EV descending before any tie-break', () => {
    const A = raw('A');
    const B = raw('B');
    const C = raw('C', 'pinned');
    const result = ranked({
      tracked: [A, B, C],
      dataset: [published(A, priced(0.3)), published(B, priced(2)), published(C, priced(0.9))],
    });
    expect(keysOf(result.ordering)).toEqual([B, C, A].map(canonicalKey));
    expect(result.ordering[1]?.status).toBe('pinned');
  });

  it('passes a 4dp value on exactly, never re-rounded', () => {
    const A = raw('A');
    const result = ranked({ tracked: [A], dataset: [published(A, priced(0.1235))], threshold: 0.1 });
    expect(result.ordering[0]?.ev).toBe(0.1235);
    expect(result.ordering[0]?.observation.priceDivine).toBe(0.1235);
  });

  it('nothing clears: the ordering is empty and every row is below the threshold', () => {
    const A = raw('A');
    const B = raw('B');
    const result = ranked({
      tracked: [B, A],
      dataset: [published(A, priced(0.2)), published(B, priced(0.01))],
    });
    expect(result.ordering).toEqual([]);
    expect(keysOf(result.belowThreshold)).toEqual([A, B].map(canonicalKey));
  });

  it('every non-ordering group is in canonical key order', () => {
    const entries = ['D', 'B', 'C', 'A'].map((id) => raw(id));
    const result = ranked({
      tracked: entries,
      dataset: entries.map((entry, index) => published(entry, index % 2 === 0 ? priced(0.1) : { state: 'no-listings' })),
    });
    expect(keysOf(result.belowThreshold)).toEqual([canonicalKey(raw('C')), canonicalKey(raw('D'))]);
    expect(keysOf(result.noListings)).toEqual([canonicalKey(raw('A')), canonicalKey(raw('B'))]);

    const mixed = ranked({
      tracked: [raw('Z'), raw('M'), raw('A')],
      dataset: [published(raw('M'), priced(0.5, OLD_LEAGUE))],
    });
    expect(mixed.notYetSynced.map((item) => [item.entry.baseTypeId, item.reason])).toEqual([
      ['A', 'never-synced'],
      ['M', 'league-mismatch'],
      ['Z', 'never-synced'],
    ]);
  });
});

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
      published(entries.unresolvable, { state: 'unresolvable' }, null),
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
  };
}

/** A deterministic permutation, so the test itself uses no randomness. */
function permute<T>(items: readonly T[], seed: number): T[] {
  const copy = [...items];
  let state = seed;
  for (let index = copy.length - 1; index > 0; index -= 1) {
    state = (state * 1103515245 + 12345) % 2147483648;
    const swap = state % (index + 1);
    const held = copy[index] as T;
    copy[index] = copy[swap] as T;
    copy[swap] = held;
  }
  return copy;
}

describe('rank: purity and determinism', () => {
  it('two calls over the same inputs are deep-equal', () => {
    expect(rank(matrixInput())).toEqual(rank(matrixInput()));
  });

  it('shuffled input gives an identical Ranking', () => {
    const input = matrixInput();
    const expected = rank(input);
    for (const seed of [1, 7, 42, 1234, 99991]) {
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
    expect(rows.length).toBe(6);
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
    }).ordering.toSorted(compareRankedRows);
    expect(a?.baseTypeId).toBe('A');
    expect(b?.baseTypeId).toBe('B');
  });
});

describe('rank: the read-time budget (NFR-6)', () => {
  it('ranks 5,000 raw entries in under 100 ms', () => {
    const tracked = Array.from({ length: 5000 }, (_, index) => raw(`Base ${String(index).padStart(4, '0')}`));
    const dataset = tracked.map((entry, index) => published(entry, priced(((index * 37) % 500) / 100 + 0.01)));
    const input: RankInput = { tracked, dataset, activeLeague: LEAGUE, threshold: THRESHOLD };
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
