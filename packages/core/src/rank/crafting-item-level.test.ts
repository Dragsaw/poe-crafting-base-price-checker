import { canonicalKey, compareCanonicalKeys } from '@poe/contracts';
import type { CraftedRankedRow, TrackedEntry } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import type { CraftingItemLevel } from '../crafting-item-level.ts';
import { combinationProbability, recipeReach } from '../probability.ts';
import {
  chase,
  craftedRows,
  FILLER,
  GREATER,
  poolsFile,
  priced,
  published,
  raw,
  ranked,
  rankCrafted,
  SUFFIX_STAT,
  TARGET,
  tierOf,
} from './test-support.ts';
import type { Pools } from './test-support.ts';

const HIGH = 'explicit.stat_high';
/** A prefix tier at 80 that only an `L` of 82 admits, so the pools at 79 and 82 differ. */
const POOLS: Pools = [
  [tierOf(TARGET, 10), tierOf(FILLER, 10), tierOf(HIGH, 20, 80)],
  [tierOf(SUFFIX_STAT, 10)],
];
const WEIGHTS = poolsFile(['weapon.bow', 'Bows', POOLS]);
const classPools = WEIGHTS.bases['weapon.bow']?.Bows;

const atFloor = (entry: TrackedEntry, itemLevelMin: number): TrackedEntry => ({ ...entry, itemLevelMin });

function rowAt(
  craftingItemLevel: CraftingItemLevel,
  tracked: readonly TrackedEntry[],
  dataset = tracked.map((entry) => published(entry, priced(30))),
  weights = WEIGHTS,
): { readonly ranked?: CraftedRankedRow; readonly unpriced?: CraftedRankedRow } {
  const result = rankCrafted({ tracked, dataset, weights, recipes: [GREATER], craftingItemLevel });
  expect(result.unrankable).toEqual([]);
  return { ranked: craftedRows(result.ordering)[0], unpriced: result.unpricedCrafted[0] };
}

const combinationOf = (row: CraftedRankedRow | undefined, entry: TrackedEntry) =>
  row?.combinations.find((combination) => combination.entryKey === canonicalKey(entry));

const greaterAt = (itemLevel: number) => ({ itemLevel, modifierLevelMin: GREATER.modifierLevelMin });

function probabilityAt(entry: TrackedEntry, itemLevel: number): number {
  if (classPools === undefined || entry.kind !== 'crafted') {
    throw new Error('the fixture is a crafted Bows entry');
  }
  const result = combinationProbability(classPools, entry, greaterAt(itemLevel));
  if (!result.ok) {
    throw new Error(`no probability: ${result.reason.kind}`);
  }
  return result.p;
}

describe('rank: the Crafting Item Level scopes the crafted branch (FR-38, FR-1; AD-17)', () => {
  const low = atFloor(chase('Bows'), 75);
  const top = chase('Bows', FILLER);

  // I/O matrix: "Entry above `L`".
  it('counts only the entries at or below `L`; one above it is listed with no price and no summand', () => {
    const { ranked: row } = rowAt(79, [low, top]);
    expect(row?.summands.map((summand) => summand.entryKey)).toEqual([canonicalKey(low)]);
    expect(row?.summands[0]?.probability).toBe(probabilityAt(low, 79));
    const notCounted = row?.combinations.find((combination) => combination.entryKey === canonicalKey(top));
    expect(notCounted?.trust.verdict).toBe('current');
    expect(notCounted).not.toHaveProperty('priceDivine');
    expect(row?.itemLevelMin).toBe(75);
    expect(rowAt(82, [low, top]).ranked?.summands).toHaveLength(2);
  });

  it('keeps a not-counted entry’s price out of the trust sums', () => {
    const dataset = [published(top, priced(30))];
    expect(rowAt(79, [low, top], dataset).unpriced?.trust).toEqual({ verdict: 'pending', reasons: [{ kind: 'no-prices' }] });
    expect(rowAt(82, [low, top], dataset).ranked?.trust.verdict).toBe('current');
  });

  // I/O matrix: "Nothing counts".
  it('treats a class with no entry at or below `L` as one with no priced Combination, under its own reason', () => {
    const { ranked: row, unpriced } = rowAt(79, [top, chase('Bows')]);
    expect(row).toBeUndefined();
    expect(unpriced?.summands).toEqual([]);
    expect(unpriced?.trust).toEqual({ verdict: 'pending', reasons: [{ kind: 'nothing-counts', itemLevel: 79 }] });
    expect(unpriced?.combinations.every((combination) => !('priceDivine' in combination))).toBe(true);
  });

  // I/O matrix: "Entry above `L` that would exhaust the augment".
  it('skips an entry above `L` before its probability, so its exhausted augment cannot fail the pair', () => {
    const BLOCK = 'explicit.stat_block';
    const exhausting: Pools = [
      [tierOf(TARGET, 10), tierOf(BLOCK, 10, 1, 'shared')],
      [tierOf(SUFFIX_STAT, 10, 1, 'shared'), tierOf(SUFFIX_STAT, 10, 80, 'other')],
    ];
    const blocked = chase('Bows', BLOCK);
    const weights = poolsFile(['weapon.bow', 'Bows', exhausting]);
    const bowPools = weights.bases['weapon.bow']?.Bows;
    if (bowPools === undefined || blocked.kind !== 'crafted') {
      throw new Error('the fixture is a crafted Bows entry');
    }
    expect(combinationProbability(bowPools, blocked, greaterAt(79))).toMatchObject({ ok: false, reason: { kind: 'augment-exhausted' } });
    const { ranked: row } = rowAt(79, [low, blocked], undefined, weights);
    expect(row?.summands.map((summand) => summand.entryKey)).toEqual([canonicalKey(low)]);
  });

  // I/O matrix: "One pool per pair".
  it('scopes every counted entry to `L`, not to its own floor', () => {
    const mid = atFloor(chase('Bows', FILLER), 79);
    const { ranked: row } = rowAt(82, [low, mid]);
    expect(row?.summands.map((summand) => summand.probability)).toEqual([probabilityAt(low, 82), probabilityAt(mid, 82)]);
    expect(probabilityAt(low, 82)).not.toBe(probabilityAt(low, 75));
    expect(probabilityAt(mid, 82)).not.toBe(probabilityAt(mid, 79));
  });

  it('takes the numeric lowest floor for the row’s itemLevelMin, though the canonically first entry is higher (FR-36)', () => {
    const nine = atFloor(chase('Bows'), 9);
    const seventyFive = atFloor(chase('Bows', FILLER), 75);
    // Canonical keys compare floors as text, so "75" sorts before "9".
    expect(compareCanonicalKeys(canonicalKey(seventyFive), canonicalKey(nine))).toBeLessThan(0);
    expect(rowAt(79, [nine, seventyFive]).ranked?.itemLevelMin).toBe(9);
  });

  it('folds the provenance at `L`, not at an entry’s floor (AD-10, AD-17)', () => {
    const prior = { ...tierOf('explicit.stat_prior', 10, 80), weightSource: 'absent' as const };
    const weights = poolsFile(['weapon.bow', 'Bows', [[...POOLS[0], prior], POOLS[1]]]);
    expect(rowAt(79, [low], undefined, weights).ranked?.provenance).toBe('measured');
    expect(rowAt(82, [low], undefined, weights).ranked?.provenance).toBe('uniform-prior');
  });

  it('gives deep-equal results for equal inputs, `craftingItemLevel` included (NFR-3)', () => {
    const input = { tracked: [low, top], dataset: [published(low, priced(30))], weights: WEIGHTS, recipes: [GREATER], craftingItemLevel: 79 } as const;
    expect(rankCrafted(input)).toEqual(rankCrafted(input));
  });
});

describe('rank: a not-counted combination carries its reason (FR-38, FR-26)', () => {
  const low = atFloor(chase('Bows'), 75);
  const top = chase('Bows', FILLER);
  /** Its only prefix tier is at 80, so the recipe cannot reach it at 79 though its floor admits it. */
  const high = atFloor(chase('Bows', HIGH), 75);

  it('marks an entry whose floor is above `L` with that floor', () => {
    expect(combinationOf(rowAt(79, [low, top]).ranked, top)?.notCounted).toEqual({ kind: 'floor', itemLevelMin: 82 });
  });

  it('marks an entry the recipe cannot reach at `L` as unreached, exactly where `recipeReach` is false', () => {
    if (classPools === undefined || high.kind !== 'crafted') {
      throw new Error('the fixture is a crafted Bows entry');
    }
    expect(recipeReach(classPools, high, greaterAt(79)).reached).toBe(false);
    expect(combinationOf(rowAt(79, [low, high]).ranked, high)?.notCounted).toEqual({ kind: 'unreached' });
    expect(recipeReach(classPools, high, greaterAt(82)).reached).toBe(true);
    expect(rowAt(82, [low, high]).ranked?.summands).toHaveLength(2);
  });

  it('gives the floor reason when the floor is above `L` and the recipe cannot reach it either', () => {
    const both = chase('Bows', HIGH);
    expect(combinationOf(rowAt(79, [low, both]).ranked, both)?.notCounted).toEqual({ kind: 'floor', itemLevelMin: 82 });
  });

  it('leaves a counted combination unmarked and sorts the not-counted ones last', () => {
    const cheap = atFloor(chase('Bows', FILLER), 75);
    // `cheap` is pending and `top` is current, so by verdict alone `top` would sort first.
    const dataset = [published(low, priced(30)), published(top, priced(30))];
    const row = rowAt(79, [low, cheap, top], dataset).ranked;
    expect(combinationOf(row, cheap)).not.toHaveProperty('notCounted');
    expect(combinationOf(row, cheap)?.trust.verdict).toBe('pending');
    expect(combinationOf(row, top)?.trust.verdict).toBe('current');
    expect(row?.combinations.map((combination) => [combination.entryKey, combination.notCounted?.kind])).toEqual([
      [canonicalKey(cheap), undefined],
      [canonicalKey(top), 'floor'],
    ]);
  });

  // I/O matrix: "Nothing counts, all broken".
  it('reads nothing-counts, not all-broken, when every entry is broken and none counts', () => {
    const tracked = [top, chase('Bows')];
    const dataset = tracked.map((entry) => published(entry, { state: 'unresolvable' }));
    expect(rowAt(79, tracked, dataset).unpriced?.trust).toEqual({ verdict: 'pending', reasons: [{ kind: 'nothing-counts', itemLevel: 79 }] });
    expect(rowAt(82, tracked, dataset).unpriced?.trust).toEqual({ verdict: 'broken', reasons: [{ kind: 'all-broken' }] });
  });
});

describe('rank: a Raw Base ignores the Crafting Item Level (FR-3, FR-38)', () => {
  // I/O matrix: "Raw Base".
  it('gives an identical row at 79 and 82', () => {
    const base = raw('Gold Amulet');
    const at = (craftingItemLevel: CraftingItemLevel) =>
      ranked({ tracked: [base], dataset: [published(base, priced(1))], craftingItemLevel }).ordering;
    expect(at(79)).toHaveLength(1);
    expect(at(79)).toEqual(at(82));
  });
});
