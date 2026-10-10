import { WEIGHTS_SCHEMA_VERSION } from '@poe/contracts';
import type { ModifierReference, WeightsFile } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { affixProbability, combinationProbability, eligible, floored, interval, isContaining, poolOf, recipeReach } from './probability.ts';
import { band, line, OTHER, pOf, pools, STAT, tier, unresolvedLine } from './probability/test-support.ts';

describe('interval', () => {
  it('derives [1, 1] for a valueless line, the pair for one #, and edge midpoints for two #', () => {
    expect(interval(line(STAT))).toEqual({ min: 1, max: 1 });
    expect(interval(line(STAT, [30, 33]))).toEqual({ min: 30, max: 33 });
    expect(interval(line(STAT, [34, 44], [52, 69]))).toEqual({ min: 43, max: 56.5 });
  });
});

describe('contains', () => {
  it('contains a tier whose derived interval sits exactly on the band edges', () => {
    expect(isContaining(band(47, 50), tier([line(STAT, [47, 50])], 100))).toBe(true);
  });

  it('does not contain a clipped tier, which stays in the denominator', () => {
    const clipped = tier([line(STAT, [45, 50])], 100);
    const inside = tier([line(STAT, [51, 55])], 300);
    expect(isContaining(band(47, 50), clipped)).toBe(false);
    const p = pOf(affixProbability(pools([clipped, inside], [tier([line(OTHER)], 1)]), 'prefix', band(47, 55), { itemLevelMin: 82, modifierLevelMin: 0 }));
    expect(p).toBe(300 / 400);
  });

  it('carries the weight of each whole tier in a run of adjacent tiers', () => {
    const t7 = tier([line(STAT, [34, 44], [52, 69])], 200);
    const t8 = tier([line(STAT, [56, 80])], 100);
    const outside = tier([line(STAT, [81, 90])], 700);
    const p = pOf(affixProbability(pools([t7, t8, outside], []), 'prefix', band(43, 80), { itemLevelMin: 82, modifierLevelMin: 0 }));
    expect(p).toBeCloseTo(300 / 1000, 10);
  });

  it('contains a valueless line for a valueless ref, and never a banded line of that statId', () => {
    const reference: ModifierReference = { kind: 'valueless', statId: STAT };
    expect(isContaining(reference, tier([line(STAT)], 1))).toBe(true);
    expect(isContaining(reference, tier([line(STAT, [1, 2])], 1))).toBe(false);
  });

  it('contains a valueless line for a banded ref whose band holds [1, 1]', () => {
    expect(isContaining(band(1, 1), tier([line(STAT)], 1))).toBe(true);
    expect(isContaining(band(0, 10), tier([line(STAT)], 1))).toBe(true);
    expect(isContaining(band(2, 2), tier([line(STAT)], 1))).toBe(false);
  });

  it('counts a hybrid entry once, however many of its lines match', () => {
    const hybridTier = tier([line(STAT, [10, 12]), line(OTHER, [4, 6])], 100);
    // Two lines of one statId: the schema refuses it, and the weight still counts once.
    const doubled = tier([line(STAT, [10, 12]), line(STAT, [11, 12])], 50);
    const rest = tier([line(STAT, [20, 30])], 850);
    const p = pOf(affixProbability(pools([hybridTier, doubled, rest], []), 'prefix', band(10, 12), { itemLevelMin: 82, modifierLevelMin: 0 }));
    expect(p).toBeCloseTo(150 / 1000, 10);
  });

  it('never contains a null-statId line, whose entry stays in the denominator', () => {
    const unresolved = tier([unresolvedLine([10, 12])], 500);
    const hit = tier([line(STAT, [10, 12])], 500);
    expect(isContaining(band(10, 12), unresolved)).toBe(false);
    expect(pOf(affixProbability(pools([unresolved, hit], []), 'prefix', band(10, 12), { itemLevelMin: 82, modifierLevelMin: 0 }))).toBe(0.5);
  });

  it('never contains a weight-0 tier, not-in-game or published, whatever its lines carry', () => {
    const notInGame = { ...tier([line(STAT, [10, 12])], 0), weightSource: 'not-in-game' as const };
    const published = tier([line(STAT, [10, 12])], 0);
    expect(isContaining(band(10, 12), notInGame)).toBe(false);
    expect(isContaining(band(10, 12), published)).toBe(false);
    expect(isContaining({ kind: 'valueless', statId: STAT }, tier([line(STAT)], 0))).toBe(false);
  });

  it('gives an empty containment set, not a weight-0 one, for a band that covers only weight-0 tiers', () => {
    const zero = { ...tier([line(STAT, [10, 12])], 0), weightSource: 'not-in-game' as const };
    const other = tier([line(STAT, [20, 30])], 100);
    expect([zero, other].filter((entry) => isContaining(band(10, 12), entry))).toEqual([]);
  });
});

describe('poolOf', () => {
  const weights: WeightsFile = {
    schemaVersion: WEIGHTS_SCHEMA_VERSION,
    gamePatch: '0.5.5',
    producer: { id: 'test', generatedAt: '2026-09-26T10:52:22.504Z' },
    bases: { 'armour.chest': { Body_Armours_dex: pools([], []) } },
  };

  it('looks the class up directly', () => {
    expect(poolOf(weights, 'armour.chest', 'Body_Armours_dex').ok).toBe(true);
  });

  it('gives class-absent for a missing class, with no sibling fallback and own keys only', () => {
    for (const [categoryId, className] of [
      ['armour.chest', 'Body_Armours_int'],
      ['armour.boots', 'Body_Armours_dex'],
      ['armour.chest', 'constructor'],
      ['toString', 'Body_Armours_dex'],
    ] as const) {
      expect(poolOf(weights, categoryId, className)).toEqual({ ok: false, reason: { kind: 'class-absent' } });
    }
  });
});

/** A tier of `group` at `itemLevelMin`, its one line valued at that level. */
const at = (itemLevelMin: number, group: string, weight = 10) =>
  tier([line(STAT, [itemLevelMin, itemLevelMin])], weight, { itemLevelMin, modGroup: group });

describe('floored', () => {

  it('drops the tiers of a group below the floor when the group has a tier at or above it', () => {
    const tiers = [at(30, 'a'), at(60, 'a'), at(75, 'a')];
    expect(floored({ poolCoverage: 'complete', entries: tiers }, 70)).toEqual([tiers[2]]);
  });

  it('keeps the top tier alone, at its own weight, of a group whose top tier is below the floor', () => {
    const tiers = [at(10, 'b', 300), at(40, 'b', 50)];
    expect(floored({ poolCoverage: 'complete', entries: tiers }, 70)).toEqual([tiers[1]]);
  });

  it('keeps every tier tied at the top, and never reads a weight-0 tier as the top', () => {
    const tied = [at(20, 'c'), at(40, 'c'), at(40, 'c')];
    expect(floored({ poolCoverage: 'complete', entries: tied }, 70)).toEqual([tied[1], tied[2]]);
    const live = at(40, 'd');
    const zero = { ...at(60, 'd', 0), weightSource: 'not-in-game' as const };
    expect(floored({ poolCoverage: 'complete', entries: [live, zero] }, 70)).toContain(live);
  });

  it('keys groups by modGroup alone: a hybrid group sharing a statId is its own group', () => {
    const pure = [at(30, 'pure'), at(75, 'pure')];
    const hybrid = tier([line(STAT, [30, 30]), line(OTHER, [1, 2])], 10, { itemLevelMin: 30, modGroup: 'hybrid' });
    expect(floored({ poolCoverage: 'complete', entries: [...pure, hybrid] }, 70)).toEqual([pure[1], hybrid]);
  });

  it('removes nothing at modifierLevelMin 0', () => {
    const tiers = [at(10, 'a'), at(44, 'a'), at(10, 'b')];
    expect(floored({ poolCoverage: 'complete', entries: tiers }, 0)).toEqual(tiers);
  });
});

describe('eligible', () => {

  it('takes the top from the unscoped pool: a group whose top is above the item level contributes nothing', () => {
    const tiers = [at(20, 'c'), at(85, 'c')];
    expect(eligible({ poolCoverage: 'complete', entries: tiers }, 82, 70)).toEqual([]);
  });

  it('gives the item-level scope alone at modifierLevelMin 0', () => {
    const tiers = [at(10, 'a'), at(44, 'a'), at(70, 'b'), at(85, 'b')];
    expect(eligible({ poolCoverage: 'complete', entries: tiers }, 65, 0)).toEqual(tiers.slice(0, 2));
  });

  it('gives empty-eligible-pool, never 0, when the floor and the scope leave a slot nothing', () => {
    const classPools = pools([at(10, 'a'), at(70, 'a')], [at(10, 'b'), at(70, 'b')]);
    expect(affixProbability(classPools, 'suffix', band(1, 80), { itemLevelMin: 65, modifierLevelMin: 70 })).toEqual({
      ok: false,
      reason: { kind: 'empty-eligible-pool', slot: 'suffix' },
    });
    expect(combinationProbability(classPools, { itemLevelMin: 65, prefix: band(1, 80), suffix: band(1, 80) }, 70)).toEqual({
      ok: false,
      reason: { kind: 'empty-eligible-pool', slot: 'prefix' },
    });
  });

  it('gives empty-eligible-pool, never 0, for a slot of only weight-0 tiers (W = 0)', () => {
    const zeroA = { ...tier([line(STAT, [1, 2])], 0), weightSource: 'not-in-game' as const };
    const zeroB = { ...tier([line(STAT, [3, 4])], 0), weightSource: 'not-in-game' as const };
    const live = tier([line(OTHER, [1, 2])], 100);
    const classPools = pools([zeroA, zeroB], [live]);
    expect(affixProbability(classPools, 'prefix', band(1, 4), { itemLevelMin: 82, modifierLevelMin: 0 })).toEqual({
      ok: false,
      reason: { kind: 'empty-eligible-pool', slot: 'prefix' },
    });
    expect(combinationProbability(classPools, { itemLevelMin: 82, prefix: band(1, 4), suffix: band(1, 2, OTHER) }, 0)).toEqual({
      ok: false,
      reason: { kind: 'empty-eligible-pool', slot: 'prefix' },
    });
  });
});

describe('the recipe floor per modifier group under a perfect recipe (AD-17)', () => {
  // Group a: 30, 60, 75 keeps 75. Group b: 10, 40 keeps 40. Group c: 20, 85 keeps 85, out of scope at 82.
  const a = [30, 60, 75].map((level, index) => tier([line(STAT, [10 + index, 10 + index])], level === 75 ? 200 : 100, { itemLevelMin: level, modGroup: 'a' }));
  const b10 = tier([line(STAT, [1, 2])], 300, { itemLevelMin: 10, modGroup: 'b' });
  const b40 = tier([line(STAT, [3, 4])], 50, { itemLevelMin: 40, modGroup: 'b' });
  const c = [20, 85].map((level) => tier([line(STAT, [20, 21])], level === 85 ? 500 : 400, { itemLevelMin: level, modGroup: 'c' }));
  const d = tier([line(OTHER, [1, 2])], 100, { itemLevelMin: 80, modGroup: 'd' });
  const groupE = tier([line(OTHER, [5, 6])], 300, { itemLevelMin: 72, modGroup: 'e' });
  const classPools = pools([...a, b10, b40, ...c], [d, groupE]);
  const entry = { itemLevelMin: 82, prefix: band(3, 4), suffix: band(1, 2, OTHER) };

  it('keeps 75 of a, 40 of b at its own weight, and nothing of c', () => {
    expect(eligible(classPools.prefix, 82, 70)).toEqual([a[2], b40]);
  });

  it('gives P by hand: (50 × 100/400 + 100 × 50/250) / (250 + 400)', () => {
    expect(pOf(combinationProbability(classPools, entry, 70))).toBeCloseTo((50 * (100 / 400) + 100 * (50 / 250)) / 650, 12);
  });

  it('reaches the entry, and not one whose band holds only tiers the floor removes', () => {
    expect(recipeReach(classPools, entry, 70)).toEqual({ reached: true });
    expect(recipeReach(classPools, { ...entry, prefix: band(1, 2) }, 70)).toEqual({ reached: false, slots: ['prefix'] });
    expect(recipeReach(classPools, { ...entry, prefix: band(1, 2) }, 0)).toEqual({ reached: true });
  });
});
