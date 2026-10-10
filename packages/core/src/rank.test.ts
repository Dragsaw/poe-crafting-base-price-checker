import { canonicalKey } from '@poe/contracts';
import type { NotYetSyncedReason, PriceState, PriceTrust, RankedRow, RawRankedRow, TrackedEntry } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import type { Ranking } from './rank.ts';
import {
  ATTEMPTED,
  crafted,
  everyKey,
  keysOf,
  NO_RECIPE,
  observation,
  OLD_LEAGUE,
  priced,
  published,
  ranked,
  raw,
} from './rank/test-support.ts';

const pending = (kind: NotYetSyncedReason): PriceTrust => ({ verdict: 'pending', reasons: [{ kind }] });

/** The raw rows of a ranking, narrowed. */
const rawRows = (rows: readonly RankedRow[]): RawRankedRow[] => rows.flatMap((row) => (row.kind === 'raw' ? [row] : []));

describe('rank: the I/O matrix', () => {
  it('a priced entry that clears the threshold is a row, EV its price, craft cost 0', () => {
    const A = raw('A');
    const result = ranked({ tracked: [A], dataset: [published(A, priced(0.5))] });
    expect(result.ordering).toEqual([
      {
        kind: 'raw',
        entryKey: canonicalKey(A),
        baseTypeId: 'A',
        categoryId: 'accessory.amulet',
        className: 'Amulets',
        itemLevelMin: 82,
        status: 'active',
        ev: 0.5,
        craftCost: 0,
        observation: observation(0.5),
        lastAttemptedAt: ATTEMPTED,
        trust: { verdict: 'current', reasons: [] },
      },
    ]);
    expect(result.belowThreshold).toEqual([]);
  });

  it('a priced row whose dataset entry has no lastAttemptedAt carries none', () => {
    const A = raw('A');
    const result = ranked({ tracked: [A], dataset: [published(A, priced(0.5), false)] });
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
    expect(String(result.belowThreshold[0]?.ev)).toBe('0.1');
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
      { entry: A, entryKey: canonicalKey(A), lastAttemptedAt: ATTEMPTED, reason: 'league-mismatch', trust: pending('league-mismatch') },
      { entry: B, entryKey: canonicalKey(B), lastAttemptedAt: ATTEMPTED, reason: 'league-mismatch', trust: pending('league-mismatch') },
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
    expect(result.notYetSynced).toEqual([{ entry: A, entryKey: canonicalKey(A), reason: 'never-synced', trust: pending('never-synced') }]);
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
        published(U, { state: 'unresolvable' }, false),
        published(X, { state: 'not-yet-synced', reason: 'no-exchange-rate' }),
      ],
    });
    expect(result.noListings).toEqual([
      { entry: N, entryKey: canonicalKey(N), lastAttemptedAt: ATTEMPTED, trust: { verdict: 'pending', reasons: [{ kind: 'no-listings', days: 0 }] } },
    ]);
    expect(result.unresolvable).toEqual([
      { entry: U, entryKey: canonicalKey(U), trust: { verdict: 'broken', reasons: [{ kind: 'unresolvable' }] } },
    ]);
    expect(result.notYetSynced).toEqual([
      { entry: X, entryKey: canonicalKey(X), lastAttemptedAt: ATTEMPTED, reason: 'no-exchange-rate', trust: pending('no-exchange-rate') },
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
    expect(result.unrankable).toEqual([]);
    expect(result.recipeless.map((item) => item.trust)).toEqual([NO_RECIPE]);
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
    expect(keysOf(ranked({ tracked: [B, A], dataset }).ordering)).toEqual([A, B].map((entry) => canonicalKey(entry)));
    expect(keysOf(ranked({ tracked: [A, B], dataset }).ordering)).toEqual([A, B].map((entry) => canonicalKey(entry)));
  });

  it('breaks ties on the whole serialised key, not a bare base type id', () => {
    const low: TrackedEntry = { kind: 'raw', baseTypeId: 'A', categoryId: 'accessory.amulet', className: 'Amulets', itemLevelMin: 86, status: 'active' };
    const high: TrackedEntry = { kind: 'raw', baseTypeId: 'A', categoryId: 'accessory.amulet', className: 'Amulets', itemLevelMin: 100, status: 'active' };
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
    expect(keysOf(result.ordering)).toEqual([B, C, A].map((entry) => canonicalKey(entry)));
    expect(rawRows(result.ordering)[1]?.status).toBe('pinned');
  });

  it('passes a 4dp value on exactly, never re-rounded', () => {
    const A = raw('A');
    const result = ranked({ tracked: [A], dataset: [published(A, priced(0.1235))], threshold: 0.1 });
    expect(String(result.ordering[0]?.ev)).toBe('0.1235');
    expect(String(rawRows(result.ordering)[0]?.observation.priceDivine)).toBe('0.1235');
  });

  it('nothing clears: the ordering is empty and every row is below the threshold', () => {
    const A = raw('A');
    const B = raw('B');
    const result = ranked({
      tracked: [B, A],
      dataset: [published(A, priced(0.2)), published(B, priced(0.01))],
    });
    expect(result.ordering).toEqual([]);
    expect(keysOf(result.belowThreshold)).toEqual([A, B].map((entry) => canonicalKey(entry)));
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

describe('rank: the threshold domain', () => {
  it('threshold 0 is valid: a priced entry is in the ordering', () => {
    const A = raw('A');
    const result = ranked({ tracked: [A], dataset: [published(A, priced(0.01))], threshold: 0 });
    expect(keysOf(result.ordering)).toEqual([canonicalKey(A)]);
    expect(result.belowThreshold).toEqual([]);
  });

  it('a NaN threshold throws a RangeError that names the threshold and the value', () => {
    const A = raw('A');
    const call = (): Ranking => ranked({ tracked: [A], dataset: [published(A, priced(0.5))], threshold: NaN });
    expect(call).toThrow(RangeError);
    expect(call).toThrow(/threshold.*NaN/);
  });

  it.each([-0.01, Infinity, -Infinity])(
    'threshold %s throws a RangeError and returns no Ranking',
    (threshold) => {
      const A = raw('A');
      let result: Ranking | undefined;
      expect(() => {
        result = ranked({ tracked: [A], dataset: [published(A, priced(0.5))], threshold });
      }).toThrow(RangeError);
      expect(result).toBeUndefined();
    },
  );

  it('throws even when there is nothing to group', () => {
    expect(() => ranked({ tracked: [], threshold: -1 })).toThrow(RangeError);
  });
});
