import { describe, expect, it } from 'vitest';

import { canonicalKey } from './canonical-key';
import { parseEnvelope, TrackedFileSchema } from './envelopes';
import type { HybridModifierRef, ModifierRef, SingleLineModifierRef } from './modifier-ref';
import {
  NEVER_CO_OCCUR,
  overlap,
  overlapBranches,
  slotOverlap,
  slotOverlapBranch,
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
  it('reaches the coOccur branch above the statId inequality', () => {
    expect(slotOverlapBranch(band('a', 1, 2), band('b', 1, 2), 'suffix', ALWAYS)).toBe('co-occur');
    expect(slotOverlap(band('a', 1, 2), band('b', 1, 2), 'suffix', NEVER_CO_OCCUR)).toBe(false);
  });

  it('never asks coOccur about one statId', () => {
    const asked: string[] = [];
    const spy: CoOccur = (x, y) => {
      asked.push(`${x.statId}/${y.statId}`);
      return true;
    };
    expect(slotOverlap(band('a', 1, 2), band('a', 5, 6), 'prefix', spy)).toBe(false);
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
    ).toEqual({ prefix: 'bands-intersect', suffix: 'both-valueless' });
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
    ...(status === 'pruned' ? { prunedReason: 'no market' } : {}),
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

describe('overlapBranches, who evaluates a pair (§2.1)', () => {
  const hybrid: HybridModifierRef = {
    kind: 'hybrid',
    lines: [
      { statId: 'a', valueMin: 10, valueMax: 19 },
      { statId: 'b', valueMin: 1, valueMax: 2 },
    ],
  };

  it('evaluates no pair in which any of the four references is hybrid', () => {
    const single = { prefix: band('a', 10, 19), suffix: valueless('s') };
    expect(overlapBranches(single, single, ALWAYS)).toBeDefined();
    expect(overlapBranches({ ...single, prefix: hybrid }, single, ALWAYS)).toBeUndefined();
    expect(overlapBranches(single, { ...single, suffix: hybrid }, ALWAYS)).toBeUndefined();
    expect(overlapBranches({ prefix: hybrid, suffix: hybrid }, { prefix: hybrid, suffix: hybrid }, ALWAYS)).toBeUndefined();
    expect(overlap({ ...single, prefix: hybrid }, { ...single, prefix: hybrid }, ALWAYS)).toBe(false);
  });
});
