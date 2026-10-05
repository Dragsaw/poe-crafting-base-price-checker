import { describe, expect, it } from 'vitest';

import { canonicalKey } from '../canonical-key';
import type { HybridModifierReference } from '../modifier-reference';
import { describeOverlap, CAN_NEVER_CO_OCCUR, areOverlapping, overlapBranches, slotOverlapBranch, summedInterval, summedStatIds } from '../overlap';
import type { CoOccur } from '../overlap';
import { ALWAYS, band, parse, valueless } from './test-support';

const lines = (...entries: HybridModifierReference['lines']): HybridModifierReference => ({ kind: 'hybrid', lines: entries });

describe('summed statIds (§2.1 summed(e), sum(e, s))', () => {
  const RARITY = 'explicit.stat_3917489142';

  it('names the statIds both slots name, pure line or hybrid line, either side', () => {
    expect([...summedStatIds({ prefix: band(RARITY, 16, 19), suffix: band(RARITY, 15, 18) })]).toEqual([RARITY]);
    expect([
      ...summedStatIds({
        prefix: lines({ statId: 'a', valueMin: 1, valueMax: 2 }, { statId: 'b', valueMin: 3, valueMax: 4 }),
        suffix: band('b', 5, 6),
      }),
    ]).toEqual(['b']);
    expect([
      ...summedStatIds({
        prefix: band('b', 5, 6),
        suffix: lines({ statId: 'b', valueMin: 3, valueMax: 4 }, { statId: 'c', valueMin: 1, valueMax: 2 }),
      }),
    ]).toEqual(['b']);
    expect([...summedStatIds({ prefix: band('a', 1, 2), suffix: band('b', 1, 2) })]).toEqual([]);
  });

  it('sums the mins and the maxes by plain addition, never rounded', () => {
    expect(summedInterval({ prefix: band(RARITY, 16, 19), suffix: band(RARITY, 15, 18) }, RARITY)).toEqual({
      min: 31,
      max: 37,
    });
    expect(summedInterval({ prefix: band('a', 0.1, 43.5), suffix: band('a', 0.2, 56.5) }, 'a')).toEqual({
      min: 0.1 + 0.2,
      max: 100,
    });
  });

  it('has no sum with a valueless operand, or a statId one slot does not name', () => {
    expect(summedInterval({ prefix: valueless('a'), suffix: band('a', 1, 2) }, 'a')).toBeUndefined();
    expect(summedInterval({ prefix: band('a', 1, 2), suffix: lines({ statId: 'a' }, { statId: 'b' }) }, 'a')).toBeUndefined();
    expect(summedInterval({ prefix: band('a', 1, 2), suffix: band('b', 1, 2) }, 'a')).toBeUndefined();
  });
});

const hybridOnA = (aMin: number, aMax: number): HybridModifierReference => ({
  kind: 'hybrid',
  lines: [
    { statId: 'a', valueMin: aMin, valueMax: aMax },
    { statId: 'b', valueMin: 1, valueMax: 2 },
  ],
});

describe('overlap with summed statIds (§2.1 S)', () => {
  const RARITY = 'explicit.stat_3917489142';
  const rarity = (prefixMin: number, prefixMax: number, suffixMin: number, suffixMax: number) => ({
    prefix: band(RARITY, prefixMin, prefixMax),
    suffix: band(RARITY, suffixMin, suffixMax),
  });

  it('gives the summed branch to a slot whose reference names nothing outside S', () => {
    const summed = new Set(['a']);
    expect(slotOverlapBranch(band('a', 1, 2), band('a', 50, 60), { slot: 'prefix', coOccur: CAN_NEVER_CO_OCCUR, summed })).toBe('summed');
    const hybrid: HybridModifierReference = {
      kind: 'hybrid',
      lines: [
        { statId: 'a', valueMin: 1, valueMax: 2 },
        { statId: 'b', valueMin: 1, valueMax: 2 },
      ],
    };
    expect(slotOverlapBranch(hybrid, band('a', 50, 60), { slot: 'prefix', coOccur: CAN_NEVER_CO_OCCUR, summed })).toBe('summed');
  });

  it('compares shared statIds outside S only, and passes S to coOccur', () => {
    const asked: string[][] = [];
    const spy: CoOccur = (_x, _y, _slot, summed) => {
      asked.push([...summed]);
      return true;
    };
    // Disjoint bands on a summed line do not stop the slot; the line outside S decides.
    expect(slotOverlapBranch(hybridOnA(1, 2), hybridOnA(50, 60), { slot: 'suffix', coOccur: spy, summed: new Set(['a']) })).toBe('co-occur');
    expect(asked).toEqual([['a']]);
    expect(slotOverlapBranch(hybridOnA(1, 2), hybridOnA(50, 60), { slot: 'suffix', coOccur: spy })).toBeUndefined();
  });

  it('overlaps two rarity entries whose per-slot bands are disjoint but whose sums intersect', () => {
    const branches = overlapBranches(rarity(16, 19, 15, 18), rarity(12, 15, 21, 24), CAN_NEVER_CO_OCCUR);
    expect(branches).toEqual({
      prefix: 'summed',
      suffix: 'summed',
      sums: [{ statId: RARITY, a: { min: 31, max: 37 }, b: { min: 33, max: 39 } }],
    });
    if (branches === undefined) {
      throw new Error('expected an overlap');
    }
    expect(describeOverlap(branches)).toBe(
      `prefix (names only summed statIds), suffix (names only summed statIds); sum ${RARITY} [31, 37] and [33, 39] intersect`,
    );
  });

  it('does not overlap two rarity entries whose sums are disjoint, though per-slot bands intersect', () => {
    expect(areOverlapping(rarity(16, 19, 15, 18), rarity(16, 19, 6, 10), CAN_NEVER_CO_OCCUR)).toBe(false);
    expect(areOverlapping(rarity(16, 19, 15, 18), rarity(16, 19, 11, 14), CAN_NEVER_CO_OCCUR)).toBe(true);
  });

  it('compares a statId per slot when only one entry sums it', () => {
    const summing = {
      prefix: band('s', 16, 19),
      suffix: lines({ statId: 's', valueMin: 15, valueMax: 18 }, { statId: 't', valueMin: 1, valueMax: 5 }),
    };
    expect(overlapBranches(summing, { prefix: band('s', 17, 20), suffix: band('t', 2, 3) }, ALWAYS)).toEqual({
      prefix: 'bands-intersect',
      suffix: 'co-occur',
      sums: [],
    });
    expect(areOverlapping(summing, { prefix: band('s', 20, 25), suffix: band('t', 2, 3) }, ALWAYS)).toBe(false);
  });

  it('never overlaps on a sum with a valueless operand, which the schema refuses', () => {
    const valuelessSum = { prefix: valueless('s'), suffix: band('s', 1, 2) };
    expect(areOverlapping(valuelessSum, valuelessSum, CAN_NEVER_CO_OCCUR)).toBe(false);
  });
});

describe('TrackedFileSchema within-file overlap of summed statIds', () => {
  const RARITY = 'explicit.stat_3917489142';
  const amulet = (prefixMin: number, prefixMax: number, suffixMin: number, suffixMax: number) => ({
    kind: 'crafted' as const,
    categoryId: 'accessory.amulet',
    className: 'Amulets',
    itemLevelMin: 82,
    prefix: band(RARITY, prefixMin, prefixMax),
    suffix: band(RARITY, suffixMin, suffixMax),
    status: 'active' as const,
  });

  it('refuses intersecting sums, naming both keys, the slots and the summed statId with both intervals', () => {
    const first = amulet(16, 19, 15, 18);
    const second = amulet(12, 15, 21, 24);
    const result = parse([first, second]);
    if (result.ok || result.reason !== 'invalid') {
      throw new Error(`expected an invalid refusal, got ${JSON.stringify(result)}`);
    }
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.path).toEqual(['entries', 1]);
    expect(result.issues[0]?.message).toContain(canonicalKey(first));
    expect(result.issues[0]?.message).toContain(canonicalKey(second));
    expect(result.issues[0]?.message).toContain('prefix (names only summed statIds), suffix (names only summed statIds)');
    expect(result.issues[0]?.message).toContain(`sum ${RARITY} [31, 37] and [33, 39] intersect`);
  });

  it('loads disjoint sums', () => {
    expect(parse([amulet(16, 19, 15, 18), amulet(12, 15, 6, 10)]).ok).toBe(true);
  });
});
