import type { ModifierWeight, WeightsClassPools } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { foldPair, oldestOf, provenanceOfTier, weakest } from './provenance.ts';

function tier(weightSource: ModifierWeight['weightSource'], itemLevelMin: number, weight = 10): ModifierWeight {
  return {
    sourceModifierId: `m-${weightSource}-${String(itemLevelMin)}`,
    modGroup: `g-${weightSource}-${String(itemLevelMin)}`,
    itemLevelMin,
    weight: weightSource === 'not-in-game' ? 0 : weight,
    weightSource,
    lines: [],
  };
}

function pools(prefix: ModifierWeight[], suffix: ModifierWeight[]): WeightsClassPools {
  return {
    prefix: { poolCoverage: 'complete', entries: prefix },
    suffix: { poolCoverage: 'complete', entries: suffix },
  } as WeightsClassPools;
}

describe('provenance (AD-10)', () => {
  it('maps published and not-in-game to measured and absent weightSource to uniform-prior', () => {
    expect(provenanceOfTier({ weightSource: 'published' })).toBe('measured');
    expect(provenanceOfTier({ weightSource: 'not-in-game' })).toBe('measured');
    expect(provenanceOfTier({ weightSource: 'absent' })).toBe('uniform-prior');
  });

  it('orders absent < uniform-prior < measured', () => {
    expect(weakest('measured', 'uniform-prior')).toBe('uniform-prior');
    expect(weakest('uniform-prior', 'absent')).toBe('absent');
    expect(weakest('measured', 'measured')).toBe('measured');
  });

  it('folds to measured when every eligible tier is published or not-in-game, weight 0 included', () => {
    const p = pools([tier('published', 1), tier('not-in-game', 1)], [tier('published', 1)]);
    expect(foldPair(p, { itemLevelMin: 82 }, 0)).toBe('measured');
  });

  it('folds to uniform-prior when one eligible tier in either slot is invented', () => {
    expect(foldPair(pools([tier('absent', 1)], [tier('published', 1)]), { itemLevelMin: 82 }, 0)).toBe('uniform-prior');
    expect(foldPair(pools([tier('published', 1)], [tier('absent', 1)]), { itemLevelMin: 82 }, 0)).toBe('uniform-prior');
  });

  it('counts a weight-0 absent-source tier as an input', () => {
    expect(foldPair(pools([{ ...tier('absent', 1), weight: 0 }], []), { itemLevelMin: 82 }, 0)).toBe('uniform-prior');
  });

  it('ignores an invented tier below the recipe floor, and one above the entry floor', () => {
    const p = pools([tier('absent', 10), tier('absent', 90), tier('published', 50)], []);
    expect(foldPair(p, { itemLevelMin: 82 }, 20)).toBe('measured');
    expect(foldPair(p, { itemLevelMin: 82 }, 0)).toBe('uniform-prior');
  });

  it('takes the oldest instant, and none for no input', () => {
    expect(oldestOf(['2026-09-26T00:00:00Z', '2026-09-20T00:00:00Z', '2026-09-27T00:00:00Z'])).toBe('2026-09-20T00:00:00Z');
    expect(oldestOf([])).toBeUndefined();
  });
});
