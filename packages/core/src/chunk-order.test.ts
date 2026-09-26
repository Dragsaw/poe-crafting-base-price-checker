import { canonicalKey } from '@poe/contracts';
import type { TrackedEntry } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { chunkOrder } from './chunk-order.ts';

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

const keysOf = (entries: readonly TrackedEntry[]): string[] => entries.map(canonicalKey);

describe('chunkOrder', () => {
  it('excludes pruned entries and sorts the rest by canonical key', () => {
    const order = chunkOrder([raw('Wide Belt', 'pruned'), raw('Solar'), crafted, raw('Gold')], []);

    // Every crafted key sorts before every raw key; raw keys by code unit.
    expect(keysOf(order.entries)).toEqual(keysOf([crafted, raw('Gold'), raw('Solar')]));
    expect(order.completed).toEqual([]);
    expect(order.newPass).toBe(false);
  });

  it('removes completed entries, so a resumed chunk starts where the last one stopped', () => {
    const tracked = [raw('A'), raw('B'), raw('C')];
    const order = chunkOrder(tracked, [canonicalKey(raw('A'))]);

    expect(keysOf(order.entries)).toEqual(keysOf([raw('B'), raw('C')]));
    expect(order.completed).toEqual([canonicalKey(raw('A'))]);
    expect(order.newPass).toBe(false);
  });

  it('recomputes from the tracked list: a newly added entry joins the order', () => {
    const order = chunkOrder([raw('A'), raw('AA'), raw('B')], [canonicalKey(raw('A'))]);
    expect(keysOf(order.entries)).toEqual(keysOf([raw('AA'), raw('B')]));
  });

  it('starts a new pass once every non-pruned entry is complete', () => {
    const tracked = [raw('A'), raw('B'), raw('Z', 'pruned')];
    const order = chunkOrder(tracked, keysOf([raw('A'), raw('B')]));

    expect(order.newPass).toBe(true);
    expect(order.completed).toEqual([]);
    expect(keysOf(order.entries)).toEqual(keysOf([raw('A'), raw('B')]));
  });

  it('drops a completed key that no longer names a non-pruned entry', () => {
    const order = chunkOrder(
      [raw('A'), raw('B'), raw('C', 'pruned')],
      keysOf([raw('gone'), raw('C'), raw('A')]),
    );
    expect(order.completed).toEqual([canonicalKey(raw('A'))]);
    expect(keysOf(order.entries)).toEqual(keysOf([raw('B')]));
  });

  it('answers an empty order, and no new pass, for an empty or all-pruned list', () => {
    expect(chunkOrder([], [])).toEqual({ entries: [], completed: [], newPass: false });
    expect(chunkOrder([raw('A', 'pruned')], [])).toEqual({
      entries: [],
      completed: [],
      newPass: false,
    });
  });

  it('is independent of input order', () => {
    const forward = chunkOrder([raw('A'), raw('B'), crafted], []);
    const backward = chunkOrder([crafted, raw('B'), raw('A')], []);
    expect(keysOf(forward.entries)).toEqual(keysOf(backward.entries));
  });
});
