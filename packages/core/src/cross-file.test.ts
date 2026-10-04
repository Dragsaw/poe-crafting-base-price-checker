import { canonicalKey } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { edgeAlignment, emptyContainment } from './cross-file.ts';
import { band, bows, checksOf, entry, failuresOf, line, OTHER, pools, STAT, T7, T8, tier, valueless } from './cross-file/test-support.ts';

describe('edge alignment (§2.4)', () => {
  const scoped = [T7(), T8()];

  it('counts a valueless line as [1, 1] in the extremes (§2.3)', () => {
    expect(edgeAlignment('prefix', band(1, 2), [tier([line(STAT)]), tier([line(STAT, [2, 2])])], 82)).toBeUndefined();
    expect(edgeAlignment('prefix', band(0, 1), [tier([line(STAT)])], 82)).toContain('extremes [1, 1]');
  });

  it.each([
    ['43.0–56.5', 43, 56.5],
    ['56.0–80.0', 56, 80],
    ['43.0–80.0', 43, 80],
  ])('accepts %s over T7 and T8', (_label, min, max) => {
    expect(edgeAlignment('prefix', band(min, max), scoped, 82)).toBeUndefined();
    expect(failuresOf([entry({ prefix: band(min, max) })], bows(pools(scoped)))).toEqual([]);
  });

  it.each([
    ['43.0–60.0, clipped', 43, 60],
    ['0–9999, sentinel', 0, 9999],
  ])('rejects %s', (_label, min, max) => {
    const tracked = entry({ prefix: band(min, max) });
    const [failure, ...rest] = failuresOf([tracked], bows(pools(scoped)));
    expect(rest).toEqual([]);
    expect(failure?.check).toBe('edge-alignment');
    expect(failure?.entryKey).toBe(canonicalKey(tracked));
    expect(failure?.detail).toContain('prefix');
    expect(failure?.detail).toContain(STAT);
    expect(failure?.detail).toContain('floor 82');
  });

  it('ignores a contained hybrid entry’s foreign statId line', () => {
    const hybrid = tier([line(STAT, [43, 56.5]), line(OTHER, [1, 500])]);
    expect(edgeAlignment('prefix', band(43, 56.5), [hybrid], 82)).toBeUndefined();
  });

  it('fails at the floor when a band aligns only above it', () => {
    const tracked = entry({ prefix: band(43, 80) }, { itemLevelMin: 70 });
    // At 70, T8 (75) leaves the scope, so the band's ceiling is past T7's.
    expect(checksOf([tracked], bows(pools(scoped)))).toEqual([['edge-alignment', canonicalKey(tracked)]]);
    expect(checksOf([{ ...tracked, itemLevelMin: 82 }], bows(pools(scoped)))).toEqual([]);
  });

  it('skips a valueless reference', () => {
    expect(edgeAlignment('prefix', valueless(), [tier([line(STAT)])], 82)).toBeUndefined();
  });
});

describe('empty containment set (§2.5)', () => {
  it('fails when no scoped entry contains the reference, naming the ref, the floor and the absence, and no file', () => {
    const tracked = entry({ prefix: band(12, 15) });
    const [failure, ...rest] = failuresOf([tracked], bows(pools([tier([line(STAT, [5, 15])])])));
    expect(rest).toEqual([]);
    expect(failure?.check).toBe('empty-containment-set');
    expect(failure?.detail).toContain(`prefix ${STAT} band [12, 15]`);
    expect(failure?.detail).toContain('floor 82');
    expect(failure?.detail).toContain('no scoped entry contains it');
    expect(failure?.detail).not.toMatch(/\.json|weights file|tracked list/i);
  });

  it('fails when only weight-0 tiers match, never P = 0', () => {
    const scoped = [tier([line(STAT, [43, 56.5])], { weight: 0 })];
    expect(emptyContainment('prefix', band(43, 56.5), scoped, 82)).toContain('no scoped entry contains it');
  });

  it('fails a tier that sits above the floor', () => {
    const scoped = [tier([line(STAT, [43, 56.5])], { itemLevelMin: 83 })];
    expect(checksOf([entry({ prefix: band(43, 56.5) })], bows(pools(scoped)))[0]?.[0]).toBe('empty-containment-set');
  });
});

describe('kind agreement (§2.3), universal', () => {
  it('fails a valueless reference when any scoped line on its statId is banded', () => {
    const scoped = [tier([line(STAT)], { itemLevelMin: 55 }), tier([line(STAT, [2, 2])], { itemLevelMin: 82 })];
    const tracked = entry({ prefix: valueless() });
    const failures = failuresOf([tracked], bows(pools(scoped)));
    expect(failures.map((failure) => failure.check)).toEqual(['kind-agreement']);
    expect(failures[0]?.detail).toContain('1 scoped line on that statId is banded');
  });

  it('passes a banded reference beside a valueless line, which reads as [1, 1]', () => {
    const scoped = [tier([line(STAT, [43, 56.5])]), tier([line(STAT)])];
    expect(checksOf([entry({ prefix: band(43, 56.5) })], bows(pools(scoped)))).toEqual([]);
  });

  it('passes a banded [1, 1] reference on a mixed-kind statId: it contains and aligns on the valueless tier', () => {
    const scoped = [tier([line(STAT)], { itemLevelMin: 55 }), tier([line(STAT, [2, 2])], { itemLevelMin: 82 })];
    expect(checksOf([entry({ prefix: band(1, 1) })], bows(pools(scoped)))).toEqual([]);
  });

  it('still fails a valueless reference beside one banded line, however many valueless lines agree', () => {
    const scoped = [tier([line(STAT)]), tier([line(STAT)]), tier([line(STAT, [2, 2])])];
    expect(checksOf([entry({ prefix: valueless() })], bows(pools(scoped)))[0]?.[0]).toBe('kind-agreement');
  });

  it('ignores a disagreeing line above the floor or at weight 0', () => {
    const scoped = [
      tier([line(STAT)]),
      tier([line(STAT, [2, 2])], { itemLevelMin: 90 }),
      tier([line(STAT, [3, 3])], { weight: 0 }),
    ];
    expect(checksOf([entry({ prefix: valueless() })], bows(pools(scoped)))).toEqual([]);
  });
});

describe('single-line pairs (§2.1 consequence 3)', () => {
  const hybrid = tier([line(STAT, [10, 20]), line(OTHER, [5, 6])]);
  const first = entry({ prefix: band(10, 20) });
  const second = entry({ prefix: band(5, 6, OTHER) });

  it('reports no co-occur for two statIds one tier holds; line-set completeness fails each band instead', () => {
    const failures = failuresOf([first, second], bows(pools([hybrid])));
    expect(failures.map((failure) => failure.check)).toEqual(['line-set-completeness', 'line-set-completeness']);
    expect(new Set(failures.map((failure) => failure.entryKey))).toEqual(
      new Set([canonicalKey(first), canonicalKey(second)]),
    );
    for (const failure of failures) {
      expect(failure.detail).toContain('band reaches into a hybrid tier');
      expect(failure.detail).toContain(hybrid.sourceModifierId);
    }
  });

  it('passes when no scoped entry carries both', () => {
    const apart = [tier([line(STAT, [10, 20])]), tier([line(OTHER, [5, 6])])];
    expect(checksOf([first, second], bows(pools(apart)))).toEqual([]);
  });
});
