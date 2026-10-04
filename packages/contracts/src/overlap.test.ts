import { describe, expect, it } from 'vitest';

import { canonicalKey } from './canonical-key';
import { parseEnvelope, TrackedFileSchema } from './envelopes';
import type { HybridModifierRef, ModifierRef, SingleLineModifierRef } from './modifier-ref';
import {
  describeOverlap,
  namesHybrid,
  NEVER_CO_OCCUR,
  overlap,
  overlapBranches,
  slotOverlap,
  slotOverlapBranch,
  summedInterval,
  summedStatIds,
  type CoOccur,
} from './overlap';
import { TRACKED_SCHEMA_VERSION } from './schema-version';

const band = (statId: string, valueMin: number, valueMax: number): SingleLineModifierRef => ({
  kind: 'banded',
  statId,
  valueMin,
  valueMax,
});
const valueless = (statId: string): SingleLineModifierRef => ({ kind: 'valueless', statId });

const ALWAYS: CoOccur = () => true;

describe('slotOverlap, in §2.1 branch order', () => {
  it('never overlaps two references that share no statId, whatever coOccur says (§2.1 consequence 3)', () => {
    expect(slotOverlapBranch(band('a', 1, 2), band('b', 1, 2), 'suffix', ALWAYS)).toBeUndefined();
    expect(slotOverlap(band('a', 1, 2), band('b', 1, 2), 'suffix', NEVER_CO_OCCUR)).toBe(false);
  });

  it('never asks coOccur about two single-line references', () => {
    const asked: string[] = [];
    const spy: CoOccur = () => {
      asked.push('asked');
      return true;
    };
    expect(slotOverlap(band('a', 1, 2), band('a', 5, 6), 'prefix', spy)).toBe(false);
    expect(slotOverlapBranch(band('a', 1, 2), band('a', 2, 6), 'prefix', spy)).toBe('bands-intersect');
    expect(slotOverlapBranch(band('a', 1, 2), band('b', 1, 2), 'prefix', spy)).toBeUndefined();
    expect(asked).toEqual([]);
  });

  it('overlaps two valueless references on one statId', () => {
    expect(slotOverlapBranch(valueless('a'), valueless('a'), 'prefix', NEVER_CO_OCCUR)).toBe('both-valueless');
  });

  it('overlaps intersecting bands, including a shared edge, and not disjoint ones', () => {
    expect(slotOverlapBranch(band('a', 43, 56.5), band('a', 56, 80), 'prefix', NEVER_CO_OCCUR)).toBe(
      'bands-intersect',
    );
    expect(slotOverlap(band('a', 10, 20), band('a', 20, 30), 'prefix', NEVER_CO_OCCUR)).toBe(true);
    expect(slotOverlap(band('a', 10, 19), band('a', 20, 29), 'prefix', NEVER_CO_OCCUR)).toBe(false);
  });

  it('does not overlap a band and a valueless reference on one statId', () => {
    expect(slotOverlap(band('a', 1, 2), valueless('a'), 'prefix', NEVER_CO_OCCUR)).toBe(false);
  });
});

describe('overlap, the consequences', () => {
  it('adjacent tiers of one statId in one slot are disjoint; intersecting bands overlap', () => {
    const suffix = band('s', 1, 2);
    expect(overlap({ prefix: band('a', 10, 19), suffix }, { prefix: band('a', 20, 29), suffix }, NEVER_CO_OCCUR)).toBe(
      false,
    );
    expect(overlap({ prefix: band('a', 10, 21), suffix }, { prefix: band('a', 20, 29), suffix }, NEVER_CO_OCCUR)).toBe(
      true,
    );
  });

  it('the conjunction covers both slots', () => {
    expect(
      overlap(
        { prefix: band('a', 10, 19), suffix: band('s', 1, 2) },
        { prefix: band('a', 10, 19), suffix: band('t', 1, 2) },
        NEVER_CO_OCCUR,
      ),
    ).toBe(false);
  });

  it('names the branch of each slot when two entries overlap', () => {
    expect(
      overlapBranches(
        { prefix: band('a', 10, 19), suffix: valueless('s') },
        { prefix: band('a', 15, 25), suffix: valueless('s') },
        NEVER_CO_OCCUR,
      ),
    ).toEqual({ prefix: 'bands-intersect', suffix: 'both-valueless', sums: [] });
  });
});

describe('TrackedFileSchema within-file overlap (FR-16, AD-17)', () => {
  const S = valueless('s');
  const crafted = (
    affixes: { prefix: ModifierRef; suffix: ModifierRef },
    status: 'active' | 'pruned' = 'active',
  ) => ({
    kind: 'crafted' as const,
    categoryId: 'weapon.bow',
    className: 'Bows',
    itemLevelMin: 82,
    ...affixes,
    status,
    ...((status === 'pruned') && { prunedReason: 'no market' }),
  });
  const parse = (entries: readonly unknown[]) =>
    parseEnvelope(TrackedFileSchema, { schemaVersion: TRACKED_SCHEMA_VERSION, entries }, TRACKED_SCHEMA_VERSION);
  const issuesOf = (entries: readonly unknown[]) => {
    const result = parse(entries);
    if (result.ok || result.reason !== 'invalid') {
      throw new Error(`expected an invalid refusal, got ${JSON.stringify(result)}`);
    }
    return result.issues;
  };

  it('refuses intersecting bands, naming both keys and the slots, at the later index', () => {
    const first = crafted({ prefix: band('a', 43, 60), suffix: S });
    const second = crafted({ prefix: band('a', 56, 80), suffix: S });
    const issues = issuesOf([first, second]);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.path).toEqual(['entries', 1]);
    expect(issues[0]?.message).toContain(canonicalKey(first));
    expect(issues[0]?.message).toContain(canonicalKey(second));
    expect(issues[0]?.message).toContain('prefix (bands intersect)');
    expect(issues[0]?.message).toContain('suffix (both valueless)');
  });

  it('refuses two valueless references on one statId', () => {
    const issues = issuesOf([
      crafted({ prefix: valueless('a'), suffix: band('s', 1, 2) }),
      crafted({ prefix: valueless('a'), suffix: band('s', 2, 3) }),
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toContain('prefix (both valueless)');
  });

  it('loads adjacent tiers of one statId', () => {
    expect(
      parse([crafted({ prefix: band('a', 10, 19), suffix: S }), crafted({ prefix: band('a', 20, 29), suffix: S })]).ok,
    ).toBe(true);
  });

  it('loads distinct statIds in one slot, since coOccur is the cross-file half', () => {
    expect(
      parse([crafted({ prefix: band('a', 1, 2), suffix: S }), crafted({ prefix: band('b', 1, 2), suffix: S })]).ok,
    ).toBe(true);
  });

  it('exempts pruned entries and separates classes', () => {
    expect(
      parse([crafted({ prefix: band('a', 1, 2), suffix: S }), crafted({ prefix: band('a', 1, 3), suffix: S }, 'pruned')]).ok,
    ).toBe(true);
    expect(
      parse([
        crafted({ prefix: band('a', 1, 2), suffix: S }),
        { ...crafted({ prefix: band('a', 1, 3), suffix: S }), className: 'Other' },
      ]).ok,
    ).toBe(true);
  });
});

describe('slotOverlap with a hybrid reference and no summed statId (§2.1)', () => {
  const hybrid = (
    aMin: number,
    aMax: number,
    b: HybridModifierRef['lines'][number] = { statId: 'b', valueMin: 1, valueMax: 2 },
  ): HybridModifierRef => ({
    kind: 'hybrid',
    lines: [{ statId: 'a', valueMin: aMin, valueMax: aMax }, b],
  });

  it('overlaps a single-line reference on a shared line whose bands intersect, when coOccur holds', () => {
    expect(slotOverlapBranch(hybrid(10, 19), band('a', 15, 25), 'prefix', ALWAYS)).toBe('co-occur');
    expect(slotOverlapBranch(band('a', 15, 25), hybrid(10, 19), 'prefix', ALWAYS)).toBe('co-occur');
    expect(slotOverlap(hybrid(10, 19), band('a', 15, 25), 'prefix', NEVER_CO_OCCUR)).toBe(false);
  });

  it('does not ask coOccur when no shared line intersects, or no statId is shared', () => {
    const asked: string[] = [];
    const spy: CoOccur = (x, y, slot) => {
      asked.push(`${x.kind}/${y.kind}/${slot}`);
      return true;
    };
    expect(slotOverlap(hybrid(10, 19), band('a', 20, 25), 'prefix', spy)).toBe(false);
    expect(slotOverlap(hybrid(10, 19), band('c', 10, 19), 'prefix', spy)).toBe(false);
    expect(slotOverlap(hybrid(10, 19), valueless('a'), 'prefix', spy)).toBe(false);
    expect(asked).toEqual([]);
    expect(slotOverlap(hybrid(10, 19), band('a', 19, 25), 'suffix', spy)).toBe(true);
    expect(asked).toEqual(['hybrid/banded/suffix']);
  });

  it('overlaps two hybrids only when every shared line intersects and coOccur holds', () => {
    expect(slotOverlapBranch(hybrid(10, 19), hybrid(15, 25), 'prefix', ALWAYS)).toBe('co-occur');
    expect(slotOverlap(hybrid(10, 19), hybrid(20, 25), 'prefix', ALWAYS)).toBe(false);
    expect(slotOverlap(hybrid(10, 19), hybrid(10, 19, { statId: 'b', valueMin: 3, valueMax: 4 }), 'prefix', ALWAYS)).toBe(
      false,
    );
    expect(slotOverlap(hybrid(10, 19, { statId: 'b' }), hybrid(10, 19, { statId: 'b' }), 'prefix', ALWAYS)).toBe(true);
    expect(slotOverlap(hybrid(10, 19), hybrid(15, 25), 'prefix', NEVER_CO_OCCUR)).toBe(false);
  });

  it('overlapBranches evaluates a pair with a hybrid reference, and namesHybrid picks it out', () => {
    const single = { prefix: band('a', 10, 19), suffix: valueless('s') };
    const withHybrid = { ...single, prefix: hybrid(10, 19) };
    expect(overlapBranches(withHybrid, single, ALWAYS)).toEqual({ prefix: 'co-occur', suffix: 'both-valueless', sums: [] });
    expect(overlapBranches(withHybrid, single, NEVER_CO_OCCUR)).toBeUndefined();
    expect(namesHybrid(single)).toBe(false);
    expect(namesHybrid(withHybrid)).toBe(true);
    expect(namesHybrid({ ...single, suffix: hybrid(1, 2) })).toBe(true);
  });
});

describe('summed statIds (§2.1 summed(e), sum(e, s))', () => {
  const RARITY = 'explicit.stat_3917489142';
  const lines = (...entries: HybridModifierRef['lines']): HybridModifierRef => ({ kind: 'hybrid', lines: entries });

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

describe('overlap with summed statIds (§2.1 S)', () => {
  const RARITY = 'explicit.stat_3917489142';
  const lines = (...entries: HybridModifierRef['lines']): HybridModifierRef => ({ kind: 'hybrid', lines: entries });
  const rarity = (prefixMin: number, prefixMax: number, suffixMin: number, suffixMax: number) => ({
    prefix: band(RARITY, prefixMin, prefixMax),
    suffix: band(RARITY, suffixMin, suffixMax),
  });

  it('gives the summed branch to a slot whose reference names nothing outside S', () => {
    const summed = new Set(['a']);
    expect(slotOverlapBranch(band('a', 1, 2), band('a', 50, 60), 'prefix', NEVER_CO_OCCUR, summed)).toBe('summed');
    const hybrid: HybridModifierRef = {
      kind: 'hybrid',
      lines: [
        { statId: 'a', valueMin: 1, valueMax: 2 },
        { statId: 'b', valueMin: 1, valueMax: 2 },
      ],
    };
    expect(slotOverlapBranch(hybrid, band('a', 50, 60), 'prefix', NEVER_CO_OCCUR, summed)).toBe('summed');
  });

  it('compares shared statIds outside S only, and passes S to coOccur', () => {
    const asked: string[][] = [];
    const spy: CoOccur = (_x, _y, _slot, summed) => {
      asked.push([...summed]);
      return true;
    };
    const hybrid = (aMin: number, aMax: number): HybridModifierRef => ({
      kind: 'hybrid',
      lines: [
        { statId: 'a', valueMin: aMin, valueMax: aMax },
        { statId: 'b', valueMin: 1, valueMax: 2 },
      ],
    });
    // Disjoint bands on a summed line do not stop the slot; the line outside S decides.
    expect(slotOverlapBranch(hybrid(1, 2), hybrid(50, 60), 'suffix', spy, new Set(['a']))).toBe('co-occur');
    expect(asked).toEqual([['a']]);
    expect(slotOverlapBranch(hybrid(1, 2), hybrid(50, 60), 'suffix', spy)).toBeUndefined();
  });

  it('overlaps two rarity entries whose per-slot bands are disjoint but whose sums intersect', () => {
    const branches = overlapBranches(rarity(16, 19, 15, 18), rarity(12, 15, 21, 24), NEVER_CO_OCCUR);
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
    expect(overlap(rarity(16, 19, 15, 18), rarity(16, 19, 6, 10), NEVER_CO_OCCUR)).toBe(false);
    expect(overlap(rarity(16, 19, 15, 18), rarity(16, 19, 11, 14), NEVER_CO_OCCUR)).toBe(true);
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
    expect(overlap(summing, { prefix: band('s', 20, 25), suffix: band('t', 2, 3) }, ALWAYS)).toBe(false);
  });

  it('never overlaps on a sum with a valueless operand, which the schema refuses', () => {
    const valuelessSum = { prefix: valueless('s'), suffix: band('s', 1, 2) };
    expect(overlap(valuelessSum, valuelessSum, NEVER_CO_OCCUR)).toBe(false);
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
  const parse = (entries: readonly unknown[]) =>
    parseEnvelope(TrackedFileSchema, { schemaVersion: TRACKED_SCHEMA_VERSION, entries }, TRACKED_SCHEMA_VERSION);

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
