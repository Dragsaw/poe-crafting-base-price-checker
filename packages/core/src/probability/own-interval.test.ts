import { canonicalKey, TRACKED_SCHEMA_VERSION, TrackedFileSchema } from '@poe/contracts';
import type { CraftedTrackedEntry, HybridLine, ModifierReference, ModifierWeight, WeightsPool } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { crossFileChecks, edgeAlignment } from '../cross-file.ts';
import { affixProbability, combinationProbability, containedIn, isContaining, needs, ownInterval, recipeReach } from '../probability.ts';
import { craftedRows, GREATER, poolsFile, priced, published, rankCrafted } from '../rank/test-support.ts';
import { band, line, OTHER, pOf, poolWith, STAT, tier } from './test-support.ts';

const THIRD = 'explicit.stat_3';

const lineBand = (valueMin: number, valueMax: number, statId = STAT): HybridLine => ({ statId, valueMin, valueMax });
const hybridReference = (...lines: HybridLine[]): ModifierReference => ({ kind: 'hybrid', lines });

/** The own interval of a tier's first line in `pool`. */
const ownOf = (entry: ModifierWeight, pool: WeightsPool) => {
  const [first] = entry.lines;
  if (first === undefined) {
    throw new Error('the fixture tier has a line');
  }
  return ownInterval(first, entry, pool);
};

describe('ownInterval (AD-11)', () => {
  it('equals the interval when no tier of the line set overlaps', () => {
    const low = tier([line(STAT, [10, 20])], 100);
    const high = tier([line(STAT, [30, 40])], 100);
    const pool = poolWith(low, high);
    expect(ownOf(low, pool)).toEqual({ min: 10, max: 20 });
    expect(ownOf(high, pool)).toEqual({ min: 30, max: 40 });
  });

  it('keeps the interval when another tier covers the whole of it', () => {
    const wide = tier([line(STAT, [10, 20])], 100);
    const inner = tier([line(STAT, [12, 18])], 100);
    expect(ownOf(inner, poolWith(wide, inner))).toEqual({ min: 12, max: 18 });
  });

  it('begins one grid step above the highest maximum it begins inside, inclusive at both ends', () => {
    const t3 = tier([line(STAT, [10, 20])], 100);
    const t2 = tier([line(STAT, [20, 30])], 100);
    expect(ownOf(t2, poolWith(t3, t2))).toEqual({ min: 21, max: 30 });
    // `wide` begins inside t3 only, as t2 starts above 15; the highest such maximum is 20.
    const wide = tier([line(STAT, [15, 40])], 100);
    expect(ownOf(wide, poolWith(t3, t2, wide))).toEqual({ min: 21, max: 40 });
  });

  it('steps by the finest decimal of the line set, to the literal double', () => {
    const low = tier([line(STAT, [0.5, 1.2])], 100);
    const high = tier([line(STAT, [1, 2])], 100);
    expect(ownOf(high, poolWith(low, high))).toEqual({ min: 1.3, max: 2 });
  });

  it('steps a two-# line by half a unit: the Bows lightning tiers', () => {
    const { t3, t2, t1, pool } = bowsLightning();
    expect(ownOf(t3, pool)).toEqual({ min: 57, max: 80 });
    expect(ownOf(t2, pool)).toEqual({ min: 80.5, max: 103 });
    expect(ownOf(t1, pool)).toEqual({ min: 103.5, max: 123 });
  });

  it('lands on the next grid value above an off-grid maximum', () => {
    // A two-# tier's maximum 56.5 is off the one-# line's integer grid.
    const two = tier([line(STAT, [40, 53], [46, 60])], 100);
    const one = tier([line(STAT, [56, 80])], 100);
    expect(ownOf(one, poolWith(two, one))).toEqual({ min: 57, max: 80 });
  });

  it('keeps the interval of a valueless line', () => {
    const first = tier([line(STAT)], 100);
    const second = tier([line(STAT)], 100);
    expect(ownOf(second, poolWith(first, second))).toEqual({ min: 1, max: 1 });
  });

  it('reads only tiers of the same line set, and every one of them, weight-0 included', () => {
    const hybrid = tier([line(STAT, [10, 20]), line(OTHER, [1, 2])], 100);
    const single = tier([line(STAT, [15, 30])], 100);
    expect(ownOf(single, poolWith(hybrid, single))).toEqual({ min: 15, max: 30 });
    const dead = tier([line(STAT, [10, 20])], 0);
    expect(ownOf(single, poolWith(hybrid, dead, single))).toEqual({ min: 21, max: 30 });
  });
});

describe('containment over the own interval (AD-11)', () => {
  it('contains the tier whose own interval is inside the band, and not the tier below it', () => {
    const { t2, t1, pool } = bowsLightning();
    expect(isContaining(band(103.5, 123), t1, pool)).toBe(true);
    expect(isContaining(band(103.5, 123), t2, pool)).toBe(false);
    expect(isContaining(band(80.5, 103), t2, pool)).toBe(true);
    expect(isContaining(band(80.5, 103), t1, pool)).toBe(false);
  });

  it('contains a hybrid tier only when the line sets are equal and every line is covered on its own interval', () => {
    const h1 = tier([line(STAT, [10, 20]), line(OTHER, [1, 5])], 100);
    const h2 = tier([line(STAT, [18, 30]), line(OTHER, [4, 8])], 100);
    const single = tier([line(STAT, [18, 30])], 100);
    const wider = tier([line(STAT, [18, 30]), line(OTHER, [4, 8]), line(THIRD, [1, 2])], 100);
    const pool = poolWith(h1, h2, single, wider);
    const reference = hybridReference(lineBand(21, 30), lineBand(6, 8, OTHER));
    expect(containedIn(reference, pool.entries, pool)).toEqual([h2]);
    // Covered on STAT only: OTHER's own interval [6, 8] is outside [4, 5].
    expect(isContaining(hybridReference(lineBand(21, 30), lineBand(4, 5, OTHER)), h2, pool)).toBe(false);
  });
});

describe('edge alignment over the own interval (AD-17)', () => {
  const { t2, t1, pool } = bowsLightning();
  const scope = { scoped: pool.entries, pool };

  it.each([
    ['T1 own interval', 103.5, 123],
    ['T1 interval', 101.5, 123],
    ['T2 own interval', 80.5, 103],
    ['T2 and T1 from T2 own minimum', 80.5, 123],
    ['T2 and T1 from T2 interval minimum', 79, 123],
  ])('accepts %s', (_label, min, max) => {
    expect(edgeAlignment('prefix', band(min, max), scope, 82)).toBeUndefined();
  });

  it('rejects a band that contains T1 and clips T2, naming the extremes and the own minimum', () => {
    expect(containedIn(band(90, 123), pool.entries, pool)).toEqual([t1]);
    const detail = edgeAlignment('prefix', band(90, 123), scope, 82);
    expect(detail).toContain(`its edges are not the extremes [101.5, 123] (own minimum 103.5) of the tiers it contains (${t1.sourceModifierId})`);
    expect(containedIn(band(90, 123), pool.entries, pool)).not.toContain(t2);
  });
});

describe('a split pair on the Bows lightning tiers (FR-22)', () => {
  const { t2, t1, pool } = bowsLightning();
  const suffixTier = tier([line(OTHER, [1, 2])], 100);
  const weights = poolsFile(['weapon.bow', 'Bows', [pool.entries, [suffixTier]]]);
  const classPools = weights.bases['weapon.bow']?.Bows;
  const splitEntry = (valueMin: number, valueMax: number, itemLevelMin: number): CraftedTrackedEntry => ({
    kind: 'crafted',
    categoryId: 'weapon.bow',
    className: 'Bows',
    itemLevelMin,
    prefix: band(valueMin, valueMax),
    suffix: band(1, 2, OTHER),
    status: 'active',
  });
  const top = splitEntry(103.5, 123, 81);
  const second = splitEntry(80.5, 103, 75);

  it('loads both entries: their bands do not overlap', () => {
    expect(TrackedFileSchema.safeParse({ schemaVersion: TRACKED_SCHEMA_VERSION, entries: [top, second] }).success).toBe(true);
  });

  it('passes every cross-file check, and each needs its own tier floor', () => {
    expect(crossFileChecks([top, second], weights)).toEqual({ failures: [], unvalidated: [] });
    expect(needs(top.prefix, poolsOf().prefix)).toBe(81);
    expect(needs(second.prefix, poolsOf().prefix)).toBe(75);
  });

  it('reaches both, and at L 82 counts each at its own floor with no tier in both', () => {
    for (const entry of [top, second]) {
      expect(recipeReach(poolsOf(), entry, { itemLevel: 82, modifierLevelMin: GREATER.modifierLevelMin })).toEqual({ reached: true });
    }
    const tracked = [top, second];
    const result = rankCrafted({ tracked, weights, recipes: [GREATER], dataset: tracked.map((entry) => published(entry, priced(30))) });
    const [row] = craftedRows(result.ordering);
    const total = pool.entries.reduce((sum, entry) => sum + entry.weight, 0);
    const probabilities = new Map(row?.summands.map((summand) => [summand.entryKey, summand.probability]));
    expect(probabilities.size).toBe(2);
    // The suffix pool is one tier, so each P is its one prefix tier's share: T1 for `top`, T2 for `second`.
    expect(probabilities.get(canonicalKey(top))).toBeCloseTo(t1.weight / total, 12);
    expect(probabilities.get(canonicalKey(second))).toBeCloseTo(t2.weight / total, 12);
  });

  it('reads the unscoped pool where a recipe floor drops the tier below T2 from the eligible set', () => {
    // At a floor of 70, T4 and T3 leave the eligible set; T2's own interval still starts above T3's maximum.
    const scope = { itemLevel: 82, modifierLevelMin: 70 };
    expect(recipeReach(poolsOf(), second, scope)).toEqual({ reached: true });
    const share = t2.weight / (t2.weight + t1.weight);
    expect(affixProbability(poolsOf(), 'prefix', second.prefix, scope)).toEqual({ ok: true, p: share });
    expect(pOf(combinationProbability(poolsOf(), second, scope))).toBeCloseTo(share, 12);
  });

  function poolsOf() {
    if (classPools === undefined) {
      throw new Error('the fixture holds Bows');
    }
    return classPools;
  }
});

/** The Bows prefix tiers of "Adds # to # Lightning Damage" (two `#`, one modifier), built in the test (NFR-2). */
function bowsLightning() {
  const lightning = { modGroup: 'LightningDamage' };
  const t4 = tier([line(STAT, [1, 6], [85, 107])], 720, { itemLevelMin: 60, ...lightning });
  const t3 = tier([line(STAT, [1, 8], [111, 152])], 480, { itemLevelMin: 65, ...lightning });
  const t2 = tier([line(STAT, [1, 10], [157, 196])], 300, { itemLevelMin: 75, ...lightning });
  const t1 = tier([line(STAT, [1, 12], [202, 234])], 120, { itemLevelMin: 81, ...lightning });
  return { t3, t2, t1, pool: poolWith(t4, t3, t2, t1) };
}
