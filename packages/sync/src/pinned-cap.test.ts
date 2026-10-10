import { PinnedStarvationRecordSchema } from '@poe/contracts';
import type { TrackedEntry } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { checkPinnedCap, PinnedCapExceededError, pinnedStarvationRecord } from './pinned-cap.ts';

function raw(baseTypeId: string, status: TrackedEntry['status']): TrackedEntry {
  return status === 'pruned'
    ? { kind: 'raw', baseTypeId, categoryId: 'accessory.amulet', className: 'Amulets', itemLevelMin: 82, status, prunedReason: 'no market' }
    : { kind: 'raw', baseTypeId, categoryId: 'accessory.amulet', className: 'Amulets', itemLevelMin: 82, status };
}

const threePinned = [
  raw('P1', 'pinned'),
  raw('P2', 'pinned'),
  raw('P3', 'pinned'),
  raw('A', 'active'),
  raw('X', 'pruned'),
];

describe('checkPinnedCap', () => {
  it('3 pinned against minChunkSearches 5: a typed error naming 3 and 2.5', () => {
    const result = checkPinnedCap(threePinned, { minChunkSearches: 5 });
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        kind: 'pinned-cap-exceeded',
        pinnedCount: 3,
        pinnedLimit: 2.5,
        minChunkSearches: 5,
      }) as unknown,
    });
    if (result.ok) {
      return;
    }

    expect(result.error.message).toContain('3');
    expect(result.error.message).toContain('2.5');
  });

  it('passes at the boundary: count(pinned) equal to 0.5 × minChunkSearches', () => {
    expect(checkPinnedCap(threePinned, { minChunkSearches: 6 })).toEqual({ ok: true });
  });

  it('counts pinned only, not active or pruned', () => {
    expect(checkPinnedCap([raw('A', 'active'), raw('B', 'active')], { minChunkSearches: 1 })).toEqual({
      ok: true,
    });
  });
});

describe('pinnedStarvationRecord', () => {
  it('adds the declared yardstick and passes PinnedStarvationRecordSchema', () => {
    const record = pinnedStarvationRecord(
      { discoveredAllowance: 3, pinnedCount: 3, pinnedRefreshed: 2, activeRefreshed: 1 },
      { minChunkSearches: 8 },
    );
    expect(record).toEqual({
      kind: 'pinned-starvation',
      discoveredAllowance: 3,
      declaredMinChunkSearches: 8,
      pinnedCount: 3,
      pinnedRefreshed: 2,
      activeRefreshed: 1,
    });
    expect(PinnedStarvationRecordSchema.parse(record)).toEqual(record);
  });
});

describe('PinnedCapExceededError', () => {
  it('carries the result as its payload and its message, naming data/tracked.json', () => {
    const result = checkPinnedCap(threePinned, { minChunkSearches: 5 });
    if (result.ok) {
      throw new Error('expected an excess');
    }
    const error = new PinnedCapExceededError(result.error);

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('PinnedCapExceededError');
    expect(error.message).toBe(result.error.message);
    expect(error.message).toContain('data/tracked.json');
    expect(error.exceeded).toBe(result.error);
  });
});
