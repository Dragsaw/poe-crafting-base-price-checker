import { describe, expect, it } from 'vitest';

import {
  canonicalKey,
  canonicalKeyElements,
  compareByCodeUnit,
  compareCanonicalKeys,
  compareTrackedEntries,
  encodeAffix,
} from './canonical-key';
import type { TrackedEntry } from './tracked-entry';

const crafted: TrackedEntry = {
  kind: 'crafted',
  categoryId: 'weapon.bow',
  className: 'Bows',
  itemLevelMin: 79,
  prefix: { kind: 'banded', statId: 'explicit.stat_1', valueMin: 43, valueMax: 56.5 },
  suffix: { kind: 'valueless', statId: 'explicit.stat_2' },
  status: 'active',
};

const raw: TrackedEntry = {
  kind: 'raw',
  baseTypeId: 'Advanced Dualstring Bow',
  itemLevelMin: 79,
  status: 'active',
};

describe('canonicalKeyElements', () => {
  it('puts the kind first and then the declared field order (§4.1)', () => {
    expect(canonicalKeyElements(crafted)).toEqual([
      'crafted',
      'weapon.bow',
      'Bows',
      79,
      ['explicit.stat_1', 43, 56.5],
      ['explicit.stat_2', null, null],
    ]);
    expect(canonicalKeyElements(raw)).toEqual(['raw', 'Advanced Dualstring Bow', 79]);
  });

  it('never carries the other arm’s fields as a null placeholder', () => {
    expect(canonicalKeyElements(raw)).toHaveLength(3);
    expect(canonicalKeyElements(crafted)).toHaveLength(6);
  });

  it('leaves acceptedTier out of the key entirely', () => {
    const labelled: TrackedEntry = {
      ...(crafted as Extract<TrackedEntry, { kind: 'crafted' }>),
      prefix: { kind: 'banded', statId: 'explicit.stat_1', valueMin: 43, valueMax: 56.5, acceptedTier: 'T7' },
    };
    expect(canonicalKey(labelled)).toBe(canonicalKey(crafted));
  });
});

describe('encodeAffix', () => {
  it('encodes an affix in exactly three elements', () => {
    expect(encodeAffix({ kind: 'valueless', statId: 's' })).toEqual(['s', null, null]);
    expect(encodeAffix({ kind: 'banded', statId: 's', valueMin: 1, valueMax: 2 })).toEqual([
      's',
      1,
      2,
    ]);
  });
});

describe('the banded and valueless affix forms', () => {
  it('keeps a banded and a valueless affix on one statId apart, and never encodes null', () => {
    const banded: TrackedEntry = {
      ...(crafted as Extract<TrackedEntry, { kind: 'crafted' }>),
      prefix: { kind: 'banded', statId: 'explicit.stat_1', valueMin: 1, valueMax: 1 },
    };
    const valueless: TrackedEntry = {
      ...(crafted as Extract<TrackedEntry, { kind: 'crafted' }>),
      prefix: { kind: 'valueless', statId: 'explicit.stat_1' },
    };

    const elements = canonicalKeyElements(valueless);
    expect(elements[4]).toEqual(['explicit.stat_1', null, null]);
    expect(elements.slice(4)).not.toContain(null);
    expect(canonicalKey(banded)).not.toBe(canonicalKey(valueless));
  });
});

describe('the two key spaces', () => {
  // I/O matrix: "Key space collision".
  // The two entries share an `itemLevelMin`; the unit field cannot be shared,
  // because a `baseTypeId` is never a `categoryId` (AD-5).
  it('keeps a crafted and an otherwise-alike raw entry apart on the leading kind tag', () => {
    expect(canonicalKey(crafted)).not.toBe(canonicalKey(raw));
    expect(canonicalKey(crafted).startsWith('["crafted"')).toBe(true);
    expect(canonicalKey(raw).startsWith('["raw"')).toBe(true);
  });

  it('sorts every crafted key before every raw key', () => {
    const keys = [canonicalKey(raw), canonicalKey(crafted)].sort(compareCanonicalKeys);
    expect(keys[0]).toBe(canonicalKey(crafted));
    expect(compareTrackedEntries(crafted, raw)).toBeLessThan(0);
  });
});

describe('compareByCodeUnit', () => {
  // I/O matrix: "Key ordering".
  it('sorts by code unit, not by locale collation', () => {
    expect(['a', 'B'].sort(compareByCodeUnit)).toEqual(['B', 'a']);
    expect('B'.localeCompare('a')).toBeGreaterThan(0);

    expect(['é', 'z'].sort(compareByCodeUnit)).toEqual(['z', 'é']);
    expect('é'.localeCompare('z')).toBeLessThan(0);
  });

  it('orders by code point, which is UTF-8 byte order and not UTF-16 order', () => {
    const astral = '\u{1F600}';
    const bmp = String.fromCodePoint(0xfffd);
    expect(compareByCodeUnit(bmp, astral)).toBeLessThan(0);
    expect(bmp < astral).toBe(false);
  });

  it('orders a prefix before the string that extends it', () => {
    expect(compareByCodeUnit('ab', 'abc')).toBeLessThan(0);
    expect(compareByCodeUnit('abc', 'ab')).toBeGreaterThan(0);
    expect(compareByCodeUnit('abc', 'abc')).toBe(0);
  });
});
