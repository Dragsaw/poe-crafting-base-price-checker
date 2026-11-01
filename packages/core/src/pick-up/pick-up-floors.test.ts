import type { RawTrackedEntry, TrackedEntry } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import type { PickUpEntry } from './pick-up.ts';
import { permute } from '../rank/test-support.ts';
import { B, BOW_CLASS_FLOOR, BOW_RAW_FLOOR, checkRolls, classRow, purposesOf, rawBase, rawRow, unranked, white } from './test-support.ts';

const atFloor = (itemLevelMin: number, status: TrackedEntry['status'] = 'active'): RawTrackedEntry => ({
  ...rawBase(B.baseTypeId, status),
  itemLevelMin,
});

const HIGH_FLOOR = 86;
const ITEM_LEVELS = Array.from({ length: 100 }, (_, index) => index + 1);
const high = atFloor(HIGH_FLOOR);

const bounded = (entry: PickUpEntry, itemLevelMax: number): PickUpEntry => ({ ...entry, itemLevelMax });

/** The entries that name a drop of `rarity` at `itemLevel`, ignoring the unidentified tier. */
const catching = (entries: readonly PickUpEntry[], rarity: PickUpEntry['rarity'], itemLevel: number): PickUpEntry[] =>
  entries.filter(
    (entry) => entry.rarity === rarity && itemLevel >= entry.itemLevelMin && itemLevel <= (entry.itemLevelMax ?? Infinity),
  );

describe('pickUpPurposes: Story 6.4, one base tracked at two floors', () => {
  it('AC 1: each drop of each rarity is named at most once, by the Raw Base with the highest floor it reaches', () => {
    const entries = purposesOf({ ordering: [classRow(2), rawRow(B, 3), rawRow(high, 1)] }, [high, B]);
    expect(entries).toEqual([
      bounded(white('sell-raw', BOW_RAW_FLOOR), HIGH_FLOOR - 1),
      bounded(checkRolls(), HIGH_FLOOR - 1),
      white('craft', HIGH_FLOOR),
      checkRolls(HIGH_FLOOR),
    ]);
    for (const itemLevel of ITEM_LEVELS) {
      expect(catching(entries, 'normal', itemLevel).length).toBeLessThanOrEqual(1);
      expect(catching(entries, 'magic', itemLevel).length).toBeLessThanOrEqual(1);
    }
  });

  it('AC 2: when the higher Raw Base gives no purpose, no entry names a drop at or above its floor', () => {
    const entries = purposesOf({ ordering: [rawRow(B, 3)], belowThreshold: [rawRow(high, 0.1)] }, [B, high]);
    expect(entries).toEqual([bounded(white('sell-raw', BOW_RAW_FLOOR), HIGH_FLOOR - 1)]);
    expect(catching(entries, 'normal', HIGH_FLOOR)).toEqual([]);
  });

  it('AC 2: an unpriced higher Raw Base (FR-9) still bounds the lower one and names no drop of its own', () => {
    const entries = purposesOf({ ordering: [rawRow(B, 3)], noListings: [unranked(high)] }, [B, high]);
    expect(entries).toEqual([bounded(white('sell-raw', BOW_RAW_FLOOR), HIGH_FLOOR - 1)]);
  });

  it('AC 3: a lower craft range that starts at or above the higher floor is empty, so the higher purpose names the drop', () => {
    const mid = atFloor(BOW_CLASS_FLOOR - 2);
    const entries = purposesOf({ ordering: [classRow(2), rawRow(B, 1), rawRow(mid, 3)] }, [B, mid]);
    expect(entries).toEqual([white('sell-raw', BOW_CLASS_FLOOR - 2), checkRolls()]);
    expect(catching(entries, 'normal', BOW_CLASS_FLOOR)).toEqual([white('sell-raw', BOW_CLASS_FLOOR - 2)]);
  });

  it('AC 4: a pruned higher Raw Base leaves the lower one unbounded', () => {
    const ranking = { ordering: [classRow(2), rawRow(B, 3)] };
    expect(purposesOf(ranking, [B, atFloor(HIGH_FLOOR, 'pruned')])).toEqual(purposesOf(ranking, [B]));
  });

  it('three floors: each range ends one below the next floor up, and a magic range that starts above its end is dropped', () => {
    const mid = atFloor(75);
    const entries = purposesOf({ ordering: [classRow(2), rawRow(B, 3), rawRow(mid, 4), rawRow(high, 5)] }, [high, mid, B]);
    expect(entries).toEqual([
      bounded(white('sell-raw', BOW_RAW_FLOOR), 74),
      bounded(white('sell-raw', 75), HIGH_FLOOR - 1),
      bounded(checkRolls(), HIGH_FLOOR - 1),
      white('sell-raw', HIGH_FLOOR),
      checkRolls(HIGH_FLOOR),
    ]);
  });

  it.each([1, 2, 3])('gives an equal list for a permuted Tracked List (seed %d)', (seed) => {
    const mid = atFloor(75);
    const tracked = [high, mid, B];
    const ranking = { ordering: [classRow(2), rawRow(B, 3), rawRow(mid, 1), rawRow(high, 5)] };
    expect(purposesOf(ranking, permute(tracked, seed))).toEqual(purposesOf(ranking, tracked));
  });
});
