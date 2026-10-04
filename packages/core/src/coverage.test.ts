import { WEIGHTS_SCHEMA_VERSION } from '@poe/contracts';
import type { ModifierWeight, TrackedEntry, WeightsFile, WeightsPool } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { poolCoverage } from './coverage.ts';

const tier = (weight: number): ModifierWeight => ({
  sourceModifierId: `m${String(weight)}`,
  modGroup: `g${String(weight)}`,
  itemLevelMin: 1,
  weight,
  weightSource: weight === 0 ? 'not-in-game' : 'published',
  lines: [{ statId: 'explicit.stat_1', ranges: [[1, 2]] }],
});

const pool = (weight: number, poolCoverage: 'complete' | 'partial' = 'complete'): WeightsPool => ({
  poolCoverage,
  entries: [tier(weight)],
});

const weightsOf = (
  bases: Record<string, Record<string, { prefix: WeightsPool; suffix: WeightsPool }>>,
): WeightsFile =>
  ({
    schemaVersion: WEIGHTS_SCHEMA_VERSION,
    gamePatch: '0.5.5',
    producer: { id: 'test', generatedAt: '2026-09-26T10:52:22.504Z' },
    bases,
  }) as WeightsFile;

const crafted = (
  className: string,
  status: 'active' | 'pruned' = 'active',
  categoryId = 'armour.chest',
): TrackedEntry =>
  ({
    kind: 'crafted',
    categoryId,
    className,
    itemLevelMin: 80,
    prefix: { kind: 'valueless', statId: 'explicit.stat_1' },
    suffix: { kind: 'valueless', statId: 'explicit.stat_2' },
    status,
    ...((status === 'pruned') && { prunedReason: 'gone' }),
  }) as TrackedEntry;

const full = { prefix: pool(10), suffix: pool(10) };

describe('poolCoverage', () => {
  it('is the covered share of the rankable classes, with the denominator', () => {
    const weights = weightsOf({ 'armour.chest': { A: full, B: full, C: full } });
    expect(poolCoverage([crafted('A'), crafted('B'), crafted('C'), crafted('D')], weights)).toEqual({
      coverage: 0.75,
      rankableClassCount: 4,
    });
  });

  it('counts a class once however many crafted entries it has', () => {
    const weights = weightsOf({ 'armour.chest': { A: full } });
    expect(poolCoverage([crafted('A'), crafted('A')], weights)).toEqual({
      coverage: 1,
      rankableClassCount: 1,
    });
  });

  it('does not cover a class with a partial slot, which stays in the denominator', () => {
    const weights = weightsOf({
      'armour.chest': { A: full, B: { prefix: pool(10), suffix: pool(10, 'partial') } },
    });
    expect(poolCoverage([crafted('A'), crafted('B')], weights)).toEqual({
      coverage: 0.5,
      rankableClassCount: 2,
    });
  });

  it('does not fall back to a sibling class or category', () => {
    const weights = weightsOf({ 'armour.chest': { B: full }, 'armour.helmet': { A: full } });
    expect(poolCoverage([crafted('A')], weights)).toEqual({ coverage: 0, rankableClassCount: 1 });
  });

  it('does not cover a complete slot whose total weight is 0', () => {
    const weights = weightsOf({
      'armour.chest': { A: { prefix: pool(0), suffix: pool(10) } },
    });
    expect(poolCoverage([crafted('A')], weights)).toEqual({ coverage: 0, rankableClassCount: 1 });
  });

  it('puts a class whose crafted entries are all pruned in neither half', () => {
    const weights = weightsOf({ 'armour.chest': { A: full } });
    expect(poolCoverage([crafted('A'), crafted('B', 'pruned')], weights)).toEqual({
      coverage: 1,
      rankableClassCount: 1,
    });
  });

  it('is undefined when only raw or pruned entries exist', () => {
    const raw = { kind: 'raw', baseTypeId: 'x', itemLevelMin: 1, status: 'active' } as TrackedEntry;
    const weights = weightsOf({ 'armour.chest': { A: full } });
    expect(poolCoverage([raw], weights)).toBeUndefined();
    expect(poolCoverage([raw, crafted('A', 'pruned')], weights)).toBeUndefined();
    expect(poolCoverage([], weights)).toBeUndefined();
  });
});
