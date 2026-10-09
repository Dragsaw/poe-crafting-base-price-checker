import { WEIGHTS_SCHEMA_VERSION } from '@poe/contracts';
import type { ModifierReference, WeightsFile } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { affixProbability, combinationProbability, isContaining, eligible, interval, poolOf } from './probability.ts';
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

describe('eligible', () => {
  const low = tier([line(STAT, [1, 2])], 10, { itemLevelMin: 10 });
  const mid = tier([line(STAT, [3, 4])], 10, { itemLevelMin: 44 });
  const floor = tier([line(STAT, [5, 6])], 10, { itemLevelMin: 65 });
  const high = tier([line(STAT, [7, 8])], 10, { itemLevelMin: 70 });
  const pool = { poolCoverage: 'complete' as const, entries: [low, mid, floor, high] };

  it('keeps tiers with modifierLevelMin <= w.itemLevelMin <= entry.itemLevelMin', () => {
    expect(eligible(pool, 65, 44)).toEqual([mid, floor]);
  });

  it('removes nothing beyond the scope at modifierLevelMin 0', () => {
    expect(eligible(pool, 65, 0)).toEqual([low, mid, floor]);
  });

  it('gives empty-eligible-pool, never 0, for a recipe floor above the entry floor', () => {
    const classPools = pools(pool.entries, pool.entries);
    expect(affixProbability(classPools, 'suffix', band(1, 8), { itemLevelMin: 65, modifierLevelMin: 70 })).toEqual({
      ok: false,
      reason: { kind: 'empty-eligible-pool', slot: 'suffix' },
    });
    expect(combinationProbability(classPools, { itemLevelMin: 65, prefix: band(1, 8), suffix: band(1, 8) }, 70)).toEqual({
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
