import type { HybridLine, ModifierRef, ModifierWeight, WeightsPool } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import {
  affixProbability,
  combinationProbability,
  contains,
  covers,
  eligible,
  lineSet,
  needs,
  statIds,
  untrackable,
  untrackableReason,
} from '../probability.ts';
import { band, isCloseRelative, line, OTHER, pOf, pools, STAT, tier, unresolvedLine } from './test-support.ts';

const THIRD = 'explicit.stat_3';

const lineBand = (valueMin: number, valueMax: number, statId = STAT): HybridLine => ({ statId, valueMin, valueMax });

/** A hybrid reference, built in the test with its lines in the order given. */
const hybrid = (...lines: HybridLine[]): ModifierRef => ({ kind: 'hybrid', lines });

describe('a hybrid reference (§1 Containment, §11, CAP-3)', () => {
  it('gives the hybrid tiers weight sum only when a pure family shares a statId', () => {
    const h1 = tier([line(STAT, [10, 12]), line(OTHER, [4, 6])], 100);
    const h2 = tier([line(OTHER, [7, 9]), line(STAT, [13, 15])], 50);
    const pure1 = tier([line(STAT, [10, 12])], 300);
    const pure2 = tier([line(STAT, [13, 15])], 200);
    const rest = tier([line(THIRD, [1, 2])], 350);
    const classPools = pools([h1, h2, pure1, pure2, rest], []);
    const reference = hybrid(lineBand(10, 15), lineBand(4, 9, OTHER));
    expect(pOf(affixProbability(classPools, 'prefix', reference, { itemLevelMin: 82, modifierLevelMin: 0 }))).toBeCloseTo(150 / 1000, 10);
    // The single-line band on the shared statId still admits both families (§1's existential test).
    expect(pOf(affixProbability(classPools, 'prefix', band(10, 15), { itemLevelMin: 82, modifierLevelMin: 0 }))).toBeCloseTo(650 / 1000, 10);
  });

  it('does not contain a tier whose line set is a superset of the reference statIds', () => {
    const superset = tier([line(STAT, [10, 12]), line(OTHER, [4, 6]), line(THIRD, [1, 2])], 100);
    expect(contains(hybrid(lineBand(10, 12), lineBand(4, 6, OTHER)), superset)).toBe(false);
  });

  it('gives each of two hybrid families in one slot only its own family', () => {
    const ab = tier([line(STAT, [10, 12]), line(OTHER, [4, 6])], 100);
    const ac = tier([line(STAT, [10, 12]), line(THIRD, [1, 2])], 300);
    const rest = tier([line(OTHER, [20, 30])], 600);
    const classPools = pools([ab, ac, rest], []);
    const referenceAB = hybrid(lineBand(10, 12), lineBand(4, 6, OTHER));
    const referenceAC = hybrid(lineBand(10, 12), lineBand(1, 2, THIRD));
    expect(contains(referenceAB, ac)).toBe(false);
    expect(contains(referenceAC, ab)).toBe(false);
    expect(pOf(affixProbability(classPools, 'prefix', referenceAB, { itemLevelMin: 82, modifierLevelMin: 0 }))).toBeCloseTo(100 / 1000, 10);
    expect(pOf(affixProbability(classPools, 'prefix', referenceAC, { itemLevelMin: 82, modifierLevelMin: 0 }))).toBeCloseTo(300 / 1000, 10);
  });

  it('computes the two-order sum by hand for a hybrid prefix and a suffix in its modGroup', () => {
    const h = tier([line(STAT, [10, 12]), line(OTHER, [4, 6])], 100, { modGroup: 'H' });
    const b = tier([line(STAT, [20, 30])], 300, { modGroup: 'B' });
    const c = tier([line(THIRD, [1, 2])], 200, { modGroup: 'H' });
    const d = tier([line(THIRD, [3, 4])], 200, { modGroup: 'D' });
    const tierE = tier([line(THIRD, [5, 9])], 600, { modGroup: 'E' });
    // Prefix first: h → 100 · 200 / 800 = 25.
    // Suffix first: c → 200 · 0 / 300 = 0; d → 200 · 100 / 400 = 50.
    const p = pOf(
      combinationProbability(
        pools([h, b], [c, d, tierE]),
        { itemLevelMin: 82, prefix: hybrid(lineBand(10, 12), lineBand(4, 6, OTHER)), suffix: band(1, 4, THIRD) },
        0,
      ),
    );
    expect(isCloseRelative(p, 75 / 1400)).toBe(true);
    expect(isCloseRelative(p, (100 / 400) * (400 / 1000))).toBe(false);
  });

  it('contains a weight > 0 tier whose null line is an internal engine line in a complete pool', () => {
    const engine = tier([line(STAT, [10, 12]), unresolvedLine(), line(OTHER, [4, 6])], 100);
    expect(lineSet(engine)).toEqual([STAT, OTHER]);
    expect(untrackable(engine, { poolCoverage: 'complete' })).toBe(false);
    expect(contains(hybrid(lineBand(10, 12), lineBand(4, 6, OTHER)), engine)).toBe(true);
  });

  it('never covers a banded weights line with a valueless hybrid line', () => {
    expect(covers({ statId: OTHER }, line(OTHER, [4, 6]))).toBe(false);
    expect(covers({ statId: OTHER }, line(OTHER))).toBe(true);
    const banded = tier([line(STAT, [10, 12]), line(OTHER, [4, 6])], 100);
    expect(contains(hybrid(lineBand(10, 12), { statId: OTHER }), banded)).toBe(false);
  });

  it('never contains a weight-0 hybrid tier whose lines are covered, which stays in W', () => {
    const zero = tier([line(STAT, [10, 12]), line(OTHER, [4, 6])], 0);
    const live = tier([line(STAT, [10, 12]), line(OTHER, [4, 6])], 100);
    const rest = tier([line(THIRD, [1, 2])], 300);
    const reference = hybrid(lineBand(10, 12), lineBand(4, 6, OTHER));
    expect(contains(reference, zero)).toBe(false);
    const classPools = pools([zero, live, rest], []);
    expect(eligible(classPools.prefix, 82, 0)).toContain(zero);
    expect(pOf(affixProbability(classPools, 'prefix', reference, { itemLevelMin: 82, modifierLevelMin: 0 }))).toBe(100 / 400);
  });

  it('applies the null-line rule: untrackable reads the entry and its pool coverage alone', () => {
    const notInGame = { ...tier([line(STAT, [10, 12])], 0), weightSource: 'not-in-game' as const };
    const withNull = tier([line(STAT, [10, 12]), unresolvedLine([1, 2])], 100);
    const plain = tier([line(STAT, [10, 12]), line(OTHER, [4, 6])], 100);
    expect(untrackable(notInGame, { poolCoverage: 'complete' })).toBe(true);
    expect(untrackable(withNull, { poolCoverage: 'partial' })).toBe(true);
    expect(untrackable(withNull, { poolCoverage: 'complete' })).toBe(false);
    expect(untrackable(plain, { poolCoverage: 'partial' })).toBe(false);
  });

  it('names the reason: not-in-game first, then a null line in a partial pool, else undefined', () => {
    const notInGame = { ...tier([line(STAT, [10, 12]), unresolvedLine([1, 2])], 0), weightSource: 'not-in-game' as const };
    const withNull = tier([line(STAT, [10, 12]), unresolvedLine([1, 2])], 100);
    const plain = tier([line(STAT, [10, 12])], 100);
    expect(untrackableReason(notInGame, { poolCoverage: 'partial' })).toBe('not-in-game');
    expect(untrackableReason(notInGame, { poolCoverage: 'complete' })).toBe('not-in-game');
    expect(untrackableReason(withNull, { poolCoverage: 'partial' })).toBe('partial-pool-null-line');
    expect(untrackableReason(withNull, { poolCoverage: 'complete' })).toBeUndefined();
    expect(untrackableReason(plain, { poolCoverage: 'partial' })).toBeUndefined();
  });

  it('sorts lineSet and statIds by code unit', () => {
    expect(lineSet(tier([line(OTHER, [1, 2]), line(STAT, [1, 2])], 1))).toEqual([STAT, OTHER]);
    expect(statIds(hybrid({ statId: OTHER }, { statId: STAT }))).toEqual([STAT, OTHER]);
    expect(statIds(band(1, 2))).toEqual([STAT]);
  });
});

describe('contains with summed statIds (§2.2 contains_S)', () => {
  const summed = new Set([OTHER]);

  it('drops the band test of a hybrid line on a summed statId and keeps the line-set test', () => {
    const entry = tier([line(STAT, [10, 12]), line(OTHER, [40, 60])], 100);
    const reference = hybrid(lineBand(10, 12), lineBand(1, 2, OTHER));
    expect(contains(reference, entry)).toBe(false);
    expect(contains(reference, entry, summed)).toBe(true);
    // The line that is not summed keeps its band test.
    expect(contains(hybrid(lineBand(20, 30), lineBand(1, 2, OTHER)), entry, summed)).toBe(false);
    // The line set still has to match exactly.
    const wider = tier([line(STAT, [10, 12]), line(OTHER, [40, 60]), line(THIRD, [1, 2])], 100);
    expect(contains(reference, wider, summed)).toBe(false);
  });

  it('needs only a line on the summed statId for a single-line reference', () => {
    const entry = tier([line(OTHER, [40, 60])], 100);
    expect(contains(band(1, 2, OTHER), entry)).toBe(false);
    expect(contains(band(1, 2, OTHER), entry, summed)).toBe(true);
    expect(contains(band(1, 2, OTHER), tier([line(STAT, [1, 2])], 100), summed)).toBe(false);
  });

  it('still never contains a weight-0 tier', () => {
    const zero = tier([line(STAT, [10, 12]), line(OTHER, [40, 60])], 0);
    expect(contains(hybrid(lineBand(10, 12), lineBand(40, 60, OTHER)), zero, summed)).toBe(false);
  });
});

describe('needs (§8), over the unscoped pool', () => {
  const low = tier([line(STAT, [10, 20]), line(OTHER)], 100, { itemLevelMin: 30 });
  const high = tier([line(STAT, [21, 30]), line(OTHER)], 100, { itemLevelMin: 80 });
  const pool: WeightsPool = { poolCoverage: 'complete', entries: [low, high] };

  it('is the maximum itemLevelMin when any hybrid line is banded', () => {
    expect(needs(hybrid(lineBand(10, 30), { statId: OTHER }), pool)).toBe(80);
  });

  it('is the minimum itemLevelMin when every hybrid line is valueless', () => {
    const allValueless: WeightsPool = {
      poolCoverage: 'complete',
      entries: [low, high].map((w) => ({ ...w, lines: [line(STAT), line(OTHER)] })),
    };
    expect(needs(hybrid({ statId: STAT }, { statId: OTHER }), allValueless)).toBe(30);
  });

  it('is undefined when nothing is contained, and skips a partial pool’s null-line tier', () => {
    expect(needs(hybrid(lineBand(90, 99), { statId: OTHER }), pool)).toBeUndefined();
    const nullLine = tier([line(STAT, [10, 20]), unresolvedLine()], 100, { itemLevelMin: 30 });
    expect(needs(band(10, 20), { poolCoverage: 'partial', entries: [nullLine] })).toBeUndefined();
  });

  it('never lets a weight-0 or not-in-game tier set the floor', () => {
    const zero = tier([line(STAT, [21, 30]), line(OTHER)], 0, { itemLevelMin: 90 });
    // Weight 100 here, which the weights schema forbids, so only `untrackable` keeps it out.
    const notInGame: ModifierWeight = {
      ...zero,
      sourceModifierId: 'not-in-game',
      itemLevelMin: 95,
      weight: 100,
      weightSource: 'not-in-game',
    };
    expect(needs(hybrid(lineBand(10, 30), { statId: OTHER }), { ...pool, entries: [low, high, zero, notInGame] })).toBe(80);
  });

  it('reads single-line references the same way', () => {
    expect(needs(band(10, 30), pool)).toBe(80);
    expect(needs({ kind: 'valueless', statId: OTHER }, pool)).toBe(30);
  });
});
