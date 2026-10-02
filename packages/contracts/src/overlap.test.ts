import { describe, expect, it } from 'vitest';

import { canonicalKey } from './canonical-key';
import { parseEnvelope, TrackedFileSchema } from './envelopes';
import type { ModifierRef } from './modifier-ref';
import {
  NEVER_CO_OCCUR,
  overlap,
  overlapBranches,
  slotOverlap,
  slotOverlapBranch,
  type CoOccur,
} from './overlap';
import { INITIAL_SCHEMA_VERSION } from './schema-version';

const band = (statId: string, valueMin: number, valueMax: number): ModifierRef => ({
  kind: 'banded',
  statId,
  valueMin,
  valueMax,
});
const valueless = (statId: string): ModifierRef => ({ kind: 'valueless', statId });

const ALWAYS: CoOccur = () => true;

describe('slotOverlap, in §2.1 branch order', () => {
  it('overlaps when either side is absent', () => {
    expect(slotOverlapBranch(undefined, band('a', 1, 2), 'prefix', NEVER_CO_OCCUR)).toBe('absent');
    expect(slotOverlapBranch(band('a', 1, 2), undefined, 'prefix', NEVER_CO_OCCUR)).toBe('absent');
  });

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

describe('overlap, the four consequences', () => {
  it('1: adjacent tiers of one statId in one slot are disjoint; intersecting bands overlap', () => {
    const suffix = band('s', 1, 2);
    expect(overlap({ prefix: band('a', 10, 19), suffix }, { prefix: band('a', 20, 29), suffix }, NEVER_CO_OCCUR)).toBe(
      false,
    );
    expect(overlap({ prefix: band('a', 10, 21), suffix }, { prefix: band('a', 20, 29), suffix }, NEVER_CO_OCCUR)).toBe(
      true,
    );
  });

  it('2: a partial-affix entry subsumes a fuller entry', () => {
    expect(overlap({ prefix: band('a', 10, 19) }, { prefix: band('a', 10, 19), suffix: band('s', 1, 2) }, NEVER_CO_OCCUR)).toBe(
      true,
    );
  });

  it('3: the conjunction covers both slots', () => {
    expect(
      overlap(
        { prefix: band('a', 10, 19), suffix: band('s', 1, 2) },
        { prefix: band('a', 10, 19), suffix: band('t', 1, 2) },
        NEVER_CO_OCCUR,
      ),
    ).toBe(false);
  });

  it('4: a prefix-only entry and a suffix-only entry overlap', () => {
    expect(overlapBranches({ prefix: band('a', 10, 19) }, { suffix: band('s', 1, 2) }, NEVER_CO_OCCUR)).toEqual({
      prefix: 'absent',
      suffix: 'absent',
    });
  });
});

describe('TrackedFileSchema within-file overlap (FR-16, AD-17)', () => {
  const crafted = (
    affixes: { prefix?: ModifierRef; suffix?: ModifierRef },
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
    parseEnvelope(TrackedFileSchema, { schemaVersion: INITIAL_SCHEMA_VERSION, entries });
  const issuesOf = (entries: readonly unknown[]) => {
    const result = parse(entries);
    if (result.ok || result.reason !== 'invalid') {
      throw new Error(`expected an invalid refusal, got ${JSON.stringify(result)}`);
    }
    return result.issues;
  };

  it('refuses intersecting bands, naming both keys and the slots, at the later index', () => {
    const first = crafted({ prefix: band('a', 43, 60) });
    const second = crafted({ prefix: band('a', 56, 80) });
    const issues = issuesOf([first, second]);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.path).toEqual(['entries', 1]);
    expect(issues[0]?.message).toContain(canonicalKey(first));
    expect(issues[0]?.message).toContain(canonicalKey(second));
    expect(issues[0]?.message).toContain('prefix (bands intersect)');
    expect(issues[0]?.message).toContain('suffix (absent on one entry)');
  });

  it('refuses two valueless references on one statId', () => {
    const issues = issuesOf([
      crafted({ prefix: valueless('a'), suffix: band('s', 1, 2) }),
      crafted({ prefix: valueless('a'), suffix: band('s', 2, 3) }),
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toContain('prefix (both valueless)');
  });

  it('refuses a prefix-only entry beside a suffix-only entry', () => {
    const issues = issuesOf([crafted({ prefix: band('a', 1, 2) }), crafted({ suffix: band('s', 1, 2) })]);
    expect(issues).toHaveLength(1);
  });

  it('loads adjacent tiers of one statId', () => {
    expect(parse([crafted({ prefix: band('a', 10, 19) }), crafted({ prefix: band('a', 20, 29) })]).ok).toBe(true);
  });

  it('loads distinct statIds in one slot, since coOccur is the cross-file half', () => {
    expect(parse([crafted({ prefix: band('a', 1, 2) }), crafted({ prefix: band('b', 1, 2) })]).ok).toBe(true);
  });

  it('exempts pruned entries and separates classes', () => {
    expect(parse([crafted({ prefix: band('a', 1, 2) }), crafted({ suffix: band('s', 1, 2) }, 'pruned')]).ok).toBe(true);
    expect(
      parse([crafted({ prefix: band('a', 1, 2) }), { ...crafted({ suffix: band('s', 1, 2) }), className: 'Other' }]).ok,
    ).toBe(true);
  });
});
