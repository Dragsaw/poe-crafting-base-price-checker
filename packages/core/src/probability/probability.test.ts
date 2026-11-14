import { WEIGHTS_SCHEMA_VERSION } from '@poe/contracts';
import type { ModifierReference, ModifierWeight, WeightsFile, WeightsPool } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { affixProbability, combinationProbability, eligible, interval, isContaining, poolOf, recipeReach } from '../probability.ts';
import { band, line, OTHER, pOf, pools, STAT, tier, unresolvedLine } from './test-support.ts';

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
    const p = pOf(affixProbability(pools([clipped, inside], [tier([line(OTHER)], 1)]), 'prefix', band(47, 55), { itemLevel: 82, modifierLevelMin: 0 }));
    expect(p).toBe(300 / 400);
  });

  it('carries the weight of each whole tier in a run of adjacent tiers', () => {
    const t7 = tier([line(STAT, [34, 44], [52, 69])], 200);
    const t8 = tier([line(STAT, [56, 80])], 100);
    const outside = tier([line(STAT, [81, 90])], 700);
    const p = pOf(affixProbability(pools([t7, t8, outside], []), 'prefix', band(43, 80), { itemLevel: 82, modifierLevelMin: 0 }));
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
    const p = pOf(affixProbability(pools([hybridTier, doubled, rest], []), 'prefix', band(10, 12), { itemLevel: 82, modifierLevelMin: 0 }));
    expect(p).toBeCloseTo(150 / 1000, 10);
  });

  it('never contains a null-statId line, whose entry stays in the denominator', () => {
    const unresolved = tier([unresolvedLine([10, 12])], 500);
    const hit = tier([line(STAT, [10, 12])], 500);
    expect(isContaining(band(10, 12), unresolved)).toBe(false);
    expect(pOf(affixProbability(pools([unresolved, hit], []), 'prefix', band(10, 12), { itemLevel: 82, modifierLevelMin: 0 }))).toBe(0.5);
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

/** A tier of `group` at `itemLevelMin`, its one line on `statId` valued at that level. */
const at = (itemLevelMin: number, group: string, weight = 10, statId = STAT) =>
  tier([line(statId, [itemLevelMin, itemLevelMin])], weight, { itemLevelMin, modGroup: group });

const COLD = 'explicit.stat_cold';
const FIRE = 'explicit.stat_fire';
const GEM_LEVEL = 'IncreaseSocketedGemLevel';
const poolOfTiers = (entries: readonly ModifierWeight[]): WeightsPool => ({ poolCoverage: 'complete', entries: [...entries] });

describe('eligible: the scope, then the recipe floor per modifier (AD-17)', () => {
  it('drops the tiers below the floor of a modifier with a tier at or above it', () => {
    const tiers = [at(40, 'a'), at(75, 'a')];
    expect(eligible(poolOfTiers(tiers), 82, 70)).toEqual([tiers[1]]);
  });

  it('keeps the highest scoped tier, at its own weight, when every scoped tier is below the floor', () => {
    const tiers = [at(55, 'a'), at(81, 'a')];
    expect(eligible(poolOfTiers(tiers), 79, 70)).toEqual([tiers[0]]);
  });

  it('keeps that highest tier alone when several scoped tiers are below the floor', () => {
    const tiers = [at(40, 'a', 300), at(55, 'a', 50)];
    expect(eligible(poolOfTiers(tiers), 79, 70)).toEqual([tiers[1]]);
  });

  it('scopes before the floor: a top tier above the level is out, and the best tier at or below it stays', () => {
    const tiers = [at(60, 'a'), at(80, 'a')];
    expect(eligible(poolOfTiers(tiers), 79, 44)).toEqual([tiers[0]]);
    expect(eligible(poolOfTiers(tiers), 79, 70)).toEqual([tiers[0]]);
  });

  it('floors two modifiers of one modGroup apart', () => {
    const cold = [at(55, GEM_LEVEL, 10, COLD), at(81, GEM_LEVEL, 10, COLD)];
    const fire = [at(55, GEM_LEVEL, 10, FIRE), at(75, GEM_LEVEL, 10, FIRE)];
    expect(eligible(poolOfTiers([...cold, ...fire]), 79, 70)).toEqual([cold[0], fire[1]]);
  });

  it('floors a hybrid tier and a pure tier apart when they share a modGroup and a statId', () => {
    const pure = [at(30, 'shared'), at(75, 'shared')];
    const hybrid = tier([line(STAT, [30, 30]), line(OTHER, [1, 2])], 10, { itemLevelMin: 30, modGroup: 'shared' });
    expect(eligible(poolOfTiers([...pure, hybrid]), 82, 70)).toEqual([pure[1], hybrid]);
  });

  it('keeps every tier tied at the top, and never reads a weight-0 tier as the top', () => {
    const tied = [at(20, 'c'), at(40, 'c'), at(40, 'c')];
    expect(eligible(poolOfTiers(tied), 82, 70)).toEqual([tied[1], tied[2]]);
    const live = at(40, 'd');
    const zero = { ...at(60, 'd', 0), weightSource: 'not-in-game' as const };
    expect(eligible(poolOfTiers([live, zero]), 82, 70)).toEqual([live]);
  });

  it('gives the scoped pool, unchanged, at modifierLevelMin 0', () => {
    const tiers = [at(10, 'a'), at(44, 'a'), at(70, 'b'), at(85, 'b')];
    expect(eligible(poolOfTiers(tiers), 65, 0)).toEqual(tiers.slice(0, 2));
    expect(eligible(poolOfTiers(tiers), 82, 0)).toEqual(tiers.slice(0, 3));
  });

  it('gives empty-eligible-pool, never 0, when the scope leaves a slot nothing', () => {
    const classPools = pools([at(10, 'a'), at(70, 'a')], [at(70, 'b'), at(75, 'b')]);
    const scope = { itemLevel: 65, modifierLevelMin: 70 };
    expect(affixProbability(classPools, 'suffix', band(1, 80), scope)).toEqual({
      ok: false,
      reason: { kind: 'empty-eligible-pool', slot: 'suffix' },
    });
    expect(combinationProbability(classPools, { prefix: band(1, 80), suffix: band(1, 80) }, scope)).toEqual({
      ok: false,
      reason: { kind: 'empty-eligible-pool', slot: 'suffix' },
    });
  });

  it('gives empty-eligible-pool, never 0, for a slot of only weight-0 tiers (W = 0)', () => {
    const zeroA = { ...tier([line(STAT, [1, 2])], 0), weightSource: 'not-in-game' as const };
    const zeroB = { ...tier([line(STAT, [3, 4])], 0), weightSource: 'not-in-game' as const };
    const live = tier([line(OTHER, [1, 2])], 100);
    const classPools = pools([zeroA, zeroB], [live]);
    const scope = { itemLevel: 82, modifierLevelMin: 0 };
    expect(affixProbability(classPools, 'prefix', band(1, 4), scope)).toEqual({
      ok: false,
      reason: { kind: 'empty-eligible-pool', slot: 'prefix' },
    });
    expect(combinationProbability(classPools, { prefix: band(1, 4), suffix: band(1, 2, OTHER) }, scope)).toEqual({
      ok: false,
      reason: { kind: 'empty-eligible-pool', slot: 'prefix' },
    });
  });
});

describe('the four modifier shapes under a perfect recipe at L 79 (AD-17)', () => {
  const B = 'explicit.stat_b';
  const C = 'explicit.stat_c';
  // Prefix: a keeps 75; b (55, 81) keeps 55; c (60, 80) keeps 60. Suffix: Cold keeps 55, Fire keeps 75.
  const prefix = [at(40, 'a', 100), at(75, 'a', 200), at(55, 'b', 300, B), at(81, 'b', 100, B), at(60, 'c', 400, C), at(80, 'c', 50, C)];
  const suffix = [at(55, GEM_LEVEL, 100, COLD), at(81, GEM_LEVEL, 20, COLD), at(55, GEM_LEVEL, 100, FIRE), at(75, GEM_LEVEL, 50, FIRE), at(72, 'e', 150, OTHER)];
  const classPools = pools(prefix, suffix);
  const perfect = { itemLevel: 79, modifierLevelMin: 70 };

  it('gives each slot the survivors of the per-modifier rule', () => {
    expect(eligible(classPools.prefix, 79, 70)).toEqual([prefix[1], prefix[2], prefix[4]]);
    expect(eligible(classPools.suffix, 79, 70)).toEqual([suffix[0], suffix[3], suffix[4]]);
  });

  it('gives P by hand: (300 × 100/300 + 100 × 300/900) / (900 + 300)', () => {
    const entry = { prefix: band(55, 55, B), suffix: band(55, 55, COLD) };
    expect(pOf(combinationProbability(classPools, entry, perfect))).toBeCloseTo((300 * (100 / 300) + 100 * (300 / 900)) / 1200, 12);
    expect(recipeReach(classPools, entry, perfect)).toEqual({ reached: true });
  });

  it('gives P by hand for the top-above-level shape and the floored-apart modifier', () => {
    const entry = { prefix: band(60, 60, C), suffix: band(75, 75, FIRE) };
    expect(pOf(combinationProbability(classPools, entry, perfect))).toBeCloseTo((400 * (50 / 300) + 50 * (400 / 900)) / 1200, 12);
  });

  it('does not reach a tier that the floor removes, and reaches it at modifierLevelMin 0', () => {
    const entry = { prefix: band(40, 40), suffix: band(72, 72, OTHER) };
    expect(recipeReach(classPools, entry, perfect)).toEqual({ reached: false, slots: ['prefix'] });
    expect(combinationProbability(classPools, entry, perfect)).toEqual({ ok: false, reason: { kind: 'empty-contained', slot: 'prefix' } });
    expect(recipeReach(classPools, entry, { itemLevel: 79, modifierLevelMin: 0 })).toEqual({ reached: true });
  });

  it('does not reach a pair whose first draw exhausts the other slot', () => {
    const shared = tier([line(OTHER, [1, 2])], 100, { itemLevelMin: 75, modGroup: 'shared' });
    const sharedPools = pools([at(75, 'shared'), at(75, 'filler')], [shared]);
    const exhausted = { prefix: band(75, 75), suffix: band(1, 2, OTHER) };
    expect(recipeReach(sharedPools, exhausted, perfect)).toEqual({ reached: false, slots: ['suffix'] });
    expect(combinationProbability(sharedPools, exhausted, perfect)).toMatchObject({ ok: false, reason: { kind: 'augment-exhausted' } });
  });
});
