import type { RawTrackedEntry, TrackedEntry } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { pickUpPurposes } from './pick-up.ts';
import type { PickUpEntry } from './pick-up.ts';
import type { CraftingItemLevel } from '../crafting-item-level.ts';
import { BOWS_POOLS, chase, FILLER, GREATER, permute, poolsFile, priced, published, rankCrafted, SUFFIX_STAT, TARGET, tierOf } from '../rank/test-support.ts';
import { B, BOW_CLASS_FLOOR, BOW_RAW_FLOOR, checkRolls, classRow, purposesOf, rawBase, rawRow, RECIPE, unranked, white } from './test-support.ts';

const atFloor = (itemLevelMin: number, status: TrackedEntry['status'] = 'active'): RawTrackedEntry => ({
  ...rawBase(B.baseTypeId, status),
  itemLevelMin,
});

const craftedAt75 = (entry: TrackedEntry): TrackedEntry => ({ ...entry, itemLevelMin: 75 });

/** Bows tiers at floor 1 only, so every offered level ranks the class. */
const ALL_LEVELS = poolsFile(['weapon.bow', 'Bows', [[tierOf(TARGET, 10)], [tierOf(SUFFIX_STAT, 10)]]]);

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

  it('AC 3: the lower Raw Base keeps its own floor for craft and check the rolls, bounded below the higher floor (FR-36)', () => {
    const mid = atFloor(BOW_CLASS_FLOOR - 2);
    const entries = purposesOf({ ordering: [classRow(2), rawRow(B, 1), rawRow(mid, 3)] }, [B, mid]);
    expect(entries).toEqual([
      bounded(white('craft', BOW_RAW_FLOOR), BOW_CLASS_FLOOR - 3),
      bounded(checkRolls(), BOW_CLASS_FLOOR - 3),
      white('sell-raw', BOW_CLASS_FLOOR - 2),
      checkRolls(BOW_CLASS_FLOOR - 2),
    ]);
    expect(catching(entries, 'normal', BOW_CLASS_FLOOR)).toEqual([white('sell-raw', BOW_CLASS_FLOOR - 2)]);
  });

  it('AC 4: a pruned higher Raw Base leaves the lower one unbounded', () => {
    const ranking = { ordering: [classRow(2), rawRow(B, 3)] };
    expect(purposesOf(ranking, [B, atFloor(HIGH_FLOOR, 'pruned')])).toEqual(purposesOf(ranking, [B]));
  });

  it('three floors: each range ends one below the next floor up, each at its own Raw Base floor', () => {
    const mid = atFloor(75);
    const entries = purposesOf({ ordering: [classRow(2), rawRow(B, 3), rawRow(mid, 4), rawRow(high, 5)] }, [high, mid, B]);
    expect(entries).toEqual([
      bounded(white('sell-raw', BOW_RAW_FLOOR), 74),
      bounded(checkRolls(), 74),
      bounded(white('sell-raw', 75), HIGH_FLOOR - 1),
      bounded(checkRolls(75), HIGH_FLOOR - 1),
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

describe('pickUpPurposes through rank: per-entry crafted floors (FR-36, FR-38; AD-31)', () => {
  it('a Raw Base at 75 of a class with EV > 0 and crafted floors 75 and 82 is craft and check the rolls at 75', () => {
    const low = craftedAt75(chase('Bows'));
    const top = chase('Bows', FILLER);
    const base = atFloor(75);
    const tracked = [low, top, base];
    const dataset = [published(low, priced(30)), published(top, priced(30)), published(base, priced(1))];
    const ranking = rankCrafted({ tracked, dataset, recipes: [GREATER] });
    expect(pickUpPurposes({ ranking, tracked, recipeId: RECIPE })).toEqual([white('craft', 75), checkRolls(75)]);
  });

  it('a jewel kind with crafted floors 75 and 82 qualifies at 75, the lowest floor', () => {
    const low = craftedAt75(chase('Emerald', TARGET, 'active', 'jewel'));
    const top = chase('Emerald', FILLER, 'active', 'jewel');
    const tracked = [low, top];
    const ranking = rankCrafted({
      tracked,
      dataset: [published(low, priced(30)), published(top, priced(30))],
      weights: poolsFile(['jewel', 'Emerald', BOWS_POOLS]),
      recipes: [GREATER],
    });
    expect(pickUpPurposes({ ranking, tracked, recipeId: RECIPE })).toEqual([
      { baseTypeId: 'Emerald', rarity: 'magic', itemLevelMin: 75, purpose: 'check-rolls' },
    ]);
  });

  it('reads the class EV at the Crafting Item Level (FR-36, FR-38): an entry at 82 gives no craft purpose at 79', () => {
    const top = chase('Bows');
    const base = atFloor(75);
    const tracked = [top, base];
    const dataset = [published(top, priced(30)), published(base, priced(1))];
    const at = (craftingItemLevel: CraftingItemLevel): readonly PickUpEntry[] =>
      pickUpPurposes({ ranking: rankCrafted({ tracked, dataset, weights: ALL_LEVELS, recipes: [GREATER], craftingItemLevel }), tracked, recipeId: RECIPE });
    expect(at(79)).toEqual([white('sell-raw', 75)]);
    expect(at(82)).toEqual([white('craft', 75), checkRolls(75)]);
  });

  it('emits no jewel kind entry when every crafted entry is above the Crafting Item Level', () => {
    const top = chase('Emerald', TARGET, 'active', 'jewel');
    const tracked = [top];
    const weights = poolsFile(['jewel', 'Emerald', [[tierOf(TARGET, 10)], [tierOf(SUFFIX_STAT, 10)]]]);
    const at = (craftingItemLevel: CraftingItemLevel): readonly PickUpEntry[] =>
      pickUpPurposes({
        ranking: rankCrafted({ tracked, dataset: [published(top, priced(30))], weights, recipes: [GREATER], craftingItemLevel }),
        tracked,
        recipeId: RECIPE,
      });
    expect(at(79)).toEqual([]);
    expect(at(82)).toEqual([{ baseTypeId: 'Emerald', rarity: 'magic', itemLevelMin: 82, purpose: 'check-rolls' }]);
  });
});
