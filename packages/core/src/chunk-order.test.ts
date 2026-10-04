import { canonicalKey } from '@poe/contracts';
import type { DatasetEntry, PriceState, TrackedEntry } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { chunkOrder, pinnedToKeep } from './chunk-order.ts';
import type { ChunkOrderInput } from './chunk-order.ts';

const NOW = '2026-09-26T12:00:00.000Z';
const HOURS_AGO = (hours: number): string =>
  new Date(Date.parse(NOW) - hours * 60 * 60 * 1000).toISOString();

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
  suffix: { kind: 'valueless', statId: 'explicit.stat_2' },
  status: 'active',
};

const NO_LISTINGS: PriceState = { state: 'no-listings' };

function published(
  entry: TrackedEntry,
  lastAttemptedAt: string | undefined,
  price: PriceState = NO_LISTINGS,
): DatasetEntry {
  return lastAttemptedAt === undefined
    ? { entryKey: canonicalKey(entry), price }
    : { entryKey: canonicalKey(entry), price, lastAttemptedAt };
}

const UNRESOLVABLE: PriceState = { state: 'unresolvable' };

const keysOf = (entries: readonly TrackedEntry[]): string[] => entries.map(canonicalKey);

function order(input: Partial<ChunkOrderInput> & Pick<ChunkOrderInput, 'tracked'>) {
  return chunkOrder({ dataset: [], completed: [], now: NOW, ...input });
}

describe('chunkOrder: rows', () => {
  it('row order: pinned, then active, then due unresolvable; pruned never', () => {
    const P = raw('P', 'pinned');
    const A = raw('A');
    const U = raw('U');
    const X = raw('X', 'pruned');
    const result = order({
      tracked: [X, U, A, P],
      dataset: [published(U, HOURS_AGO(30), UNRESOLVABLE), published(X, undefined)],
    });

    expect(keysOf(result.pinned)).toEqual(keysOf([P]));
    expect(keysOf(result.rotation)).toEqual(keysOf([A, U]));
    expect([...result.pinned, ...result.rotation].map(canonicalKey)).not.toContain(canonicalKey(X));
  });

  it('never attempted sorts before any attempted entry', () => {
    const A1 = raw('A1');
    const A2 = raw('A2');
    const result = order({ tracked: [A1, A2], dataset: [published(A1, HOURS_AGO(100))] });
    // A1 sorts first by key; the missing timestamp still puts A2 ahead.
    expect(keysOf(result.rotation)).toEqual(keysOf([A2, A1]));
  });

  it('oldest lastAttemptedAt first, compared as instants rather than strings', () => {
    const A = raw('A');
    const B = raw('B');
    // As strings "…00.500Z" sorts before "…00Z"; as instants it is half a second later.
    const result = order({
      tracked: [A, B],
      dataset: [published(A, '2026-09-26T11:00:00.500Z'), published(B, '2026-09-26T11:00:00Z')],
    });
    expect(keysOf(result.rotation)).toEqual(keysOf([B, A]));
  });

  it('orders pinned oldest-first too', () => {
    const P1 = raw('P1', 'pinned');
    const P2 = raw('P2', 'pinned');
    const P3 = raw('P3', 'pinned');
    const result = order({
      tracked: [P1, P2, P3],
      dataset: [published(P1, HOURS_AGO(1)), published(P2, HOURS_AGO(5))],
    });
    expect(keysOf(result.pinned)).toEqual(keysOf([P3, P2, P1]));
  });

  it('cold start: with no dataset, canonical-key order within each row', () => {
    const result = order({
      tracked: [raw('Solar'), raw('Z', 'pinned'), crafted, raw('Gold'), raw('Y', 'pinned')],
    });
    // Every crafted key sorts before every raw key; raw keys by code unit.
    expect(keysOf(result.rotation)).toEqual(keysOf([crafted, raw('Gold'), raw('Solar')]));
    expect(keysOf(result.pinned)).toEqual(keysOf([raw('Y', 'pinned'), raw('Z', 'pinned')]));
  });

  it('never keys on the not-yet-synced state', () => {
    const A = raw('A');
    const B = raw('B');
    const result = order({
      tracked: [A, B],
      dataset: [
        published(A, HOURS_AGO(1), { state: 'not-yet-synced', reason: 'no-exchange-rate' }),
        published(B, HOURS_AGO(2)),
      ],
    });
    expect(keysOf(result.rotation)).toEqual(keysOf([B, A]));
  });
});

describe('chunkOrder: the unresolvable row', () => {
  const U = raw('U');

  it('retry bound: attempted 23 h ago is excluded, exactly 24 h ago is included', () => {
    expect(order({ tracked: [U], dataset: [published(U, HOURS_AGO(23), UNRESOLVABLE)] }).rotation).toEqual(
      [],
    );
    expect(
      keysOf(order({ tracked: [U], dataset: [published(U, HOURS_AGO(24), UNRESOLVABLE)] }).rotation),
    ).toEqual(keysOf([U]));
  });

  it('an unresolvable entry never attempted is due', () => {
    expect(keysOf(order({ tracked: [U], dataset: [published(U, undefined, UNRESOLVABLE)] }).rotation)).toEqual(
      keysOf([U]),
    );
  });

  it('active + unresolvable attempted 1 h ago is selected in neither row 2 nor row 3', () => {
    const result = order({ tracked: [U], dataset: [published(U, HOURS_AGO(1), UNRESOLVABLE)] });
    expect(result.pinned).toEqual([]);
    expect(result.rotation).toEqual([]);
  });

  it('pinned + unresolvable: not selected at 1 h, row 3 at 25 h, never row 1', () => {
    const P = raw('P', 'pinned');
    const A = raw('A');

    const early = order({ tracked: [P, A], dataset: [published(P, HOURS_AGO(1), UNRESOLVABLE)] });
    expect(early.pinned).toEqual([]);
    expect(keysOf(early.rotation)).toEqual(keysOf([A]));

    const late = order({
      tracked: [P, A],
      dataset: [published(P, HOURS_AGO(25), UNRESOLVABLE), published(A, HOURS_AGO(30))],
    });
    expect(late.pinned).toEqual([]);
    // Row 3 follows row 2, even though P is not older.
    expect(keysOf(late.rotation)).toEqual(keysOf([A, P]));
  });

  it('recovered: a state no longer unresolvable rejoins row 2 with no wait', () => {
    const result = order({ tracked: [U], dataset: [published(U, HOURS_AGO(1), { state: 'no-listings' })] });
    expect(keysOf(result.rotation)).toEqual(keysOf([U]));
  });
});

describe('chunkOrder: the pass', () => {
  const A = raw('A');
  const B = raw('B');
  const C = raw('C');
  const P = raw('P', 'pinned');

  it('removes completed rotation entries, so a resumed chunk starts where the last stopped', () => {
    const result = order({ tracked: [A, B, C], completed: [canonicalKey(A)] });
    expect(keysOf(result.rotation)).toEqual(keysOf([B, C]));
    expect(result.completed).toEqual([canonicalKey(A)]);
    expect(result.newPass).toBe(false);
  });

  it('pinned every chunk: a pinned key in progress stays in row 1 and is dropped from completed', () => {
    const result = order({ tracked: [P, A], completed: keysOf([P]) });
    expect(keysOf(result.pinned)).toEqual(keysOf([P]));
    expect(result.completed).toEqual([]);
  });

  it('starts a new pass once every due row 2–3 entry is complete; pinned play no part', () => {
    const result = order({ tracked: [P, A, B, raw('Z', 'pruned')], completed: keysOf([A, B]) });
    expect(result.newPass).toBe(true);
    expect(result.completed).toEqual([]);
    expect(keysOf(result.rotation)).toEqual(keysOf([A, B]));
    expect(keysOf(result.pinned)).toEqual(keysOf([P]));
  });

  it('an undue unresolvable entry does not hold the pass open', () => {
    const U = raw('U');
    const result = order({
      tracked: [A, U],
      dataset: [published(U, HOURS_AGO(1), UNRESOLVABLE)],
      completed: keysOf([A]),
    });
    expect(result.newPass).toBe(true);
    expect(keysOf(result.rotation)).toEqual(keysOf([A]));
  });

  it('a completed unresolvable key stays in force while it is not yet due again', () => {
    const U = raw('U');
    const result = order({
      tracked: [A, U],
      dataset: [published(U, HOURS_AGO(1), UNRESOLVABLE)],
      completed: keysOf([U]),
    });
    expect(result.newPass).toBe(false);
    expect(result.completed).toEqual(keysOf([U]));
    expect(keysOf(result.rotation)).toEqual(keysOf([A]));
  });

  it('drops a completed key that no longer names a rotation entry', () => {
    const result = order({
      tracked: [A, B, raw('C', 'pruned')],
      completed: keysOf([raw('gone'), raw('C'), A]),
    });
    expect(result.completed).toEqual([canonicalKey(A)]);
    expect(keysOf(result.rotation)).toEqual(keysOf([B]));
  });

  it('answers an empty order, and no new pass, for an empty or all-pruned list', () => {
    const empty = { pinned: [], rotation: [], completed: [], newPass: false };
    expect(order({ tracked: [] })).toEqual(empty);
    expect(order({ tracked: [raw('A', 'pruned')] })).toEqual(empty);
  });
});

describe('chunkOrder: determinism', () => {
  it('same inputs twice, and shuffled input order, give an identical order', () => {
    const tracked = [raw('A'), raw('B'), crafted, raw('P', 'pinned'), raw('Q', 'pinned'), raw('U')];
    const dataset = [
      published(raw('B'), HOURS_AGO(3)),
      published(raw('A'), HOURS_AGO(3)),
      published(raw('Q', 'pinned'), HOURS_AGO(2)),
      published(raw('U'), HOURS_AGO(48), UNRESOLVABLE),
    ];
    const completed = keysOf([raw('B')]);

    const forward = order({ tracked, dataset, completed });
    const again = order({ tracked, dataset, completed });
    const shuffled = order({
      tracked: tracked.toReversed(),
      dataset: dataset.toReversed(),
      completed: completed.toReversed(),
    });

    expect(again).toEqual(forward);
    expect(shuffled).toEqual(forward);
    expect(keysOf(forward.pinned)).toEqual(keysOf([raw('P', 'pinned'), raw('Q', 'pinned')]));
    expect(keysOf(forward.rotation)).toEqual(keysOf([crafted, raw('A'), raw('U')]));
  });
});

describe('pinnedToKeep', () => {
  it('keeps every pinned entry when the allowance covers them plus one rotation search', () => {
    expect(pinnedToKeep(2, 3, true)).toBe(2);
    expect(pinnedToKeep(2, 10, true)).toBe(2);
  });

  it('truncates to max(R − 1, 0) when R < P + 1 and the rotation is waiting', () => {
    expect(pinnedToKeep(2, 2, true)).toBe(1);
    expect(pinnedToKeep(2, 1, true)).toBe(0);
    expect(pinnedToKeep(2, 0, true)).toBe(0);
  });

  it('never truncates when nothing waits in rows 2–3', () => {
    expect(pinnedToKeep(2, 1, false)).toBe(2);
    expect(pinnedToKeep(2, 0, false)).toBe(2);
  });
});

describe('chunkOrder: the stale-pinned rule (pinnedMaxAgeMs)', () => {
  const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

  it('keeps only stale pinned entries, oldest first, then the rotation', () => {
    const fresh = raw('Fresh', 'pinned');
    const old = raw('Old', 'pinned');
    const older = raw('Older', 'pinned');
    const never = raw('Never', 'pinned');
    const A = raw('A');
    const result = order({
      tracked: [fresh, old, older, never, A],
      dataset: [
        published(fresh, HOURS_AGO(1)),
        published(old, HOURS_AGO(5)),
        published(older, HOURS_AGO(9)),
        published(A, HOURS_AGO(2)),
      ],
      pinnedMaxAgeMs: FOUR_HOURS_MS,
    });

    expect(keysOf(result.pinned)).toEqual(keysOf([never, older, old]));
    expect(keysOf(result.rotation)).toEqual(keysOf([A]));
  });

  it('treats an entry exactly at the maximum age as fresh', () => {
    const P = raw('P', 'pinned');
    const result = order({
      tracked: [P],
      dataset: [published(P, HOURS_AGO(4))],
      pinnedMaxAgeMs: FOUR_HOURS_MS,
    });

    expect(result.pinned).toEqual([]);
  });

  it('keeps every pinned entry when no maximum age is given', () => {
    const P = raw('P', 'pinned');
    const result = order({ tracked: [P], dataset: [published(P, HOURS_AGO(1))] });

    expect(keysOf(result.pinned)).toEqual(keysOf([P]));
  });
});
