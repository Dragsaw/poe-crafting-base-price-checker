import {
  parseEnvelope,
  TRACKED_SCHEMA_VERSION,
  TrackedFileSchema,
  WEIGHTS_SCHEMA_VERSION,
  WeightsFileSchema,
} from '@poe/contracts';
import type { ModifierRef, ModifierWeight, WeightsClassPools, WeightsFile, WeightsLine } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import {
  affixProbability,
  combinationProbability,
  contains,
  eligible,
  interval,
  poolOf,
} from './probability.ts';
import type { ProbabilityResult } from './probability.ts';

const STAT = 'explicit.stat_1';
const OTHER = 'explicit.stat_2';

let serial = 0;

/** One weights tier. Built in the test, never read from a fixture file (NFR-2). */
function tier(
  lines: readonly WeightsLine[],
  weight: number,
  { itemLevelMin = 1, modGroup }: { readonly itemLevelMin?: number; readonly modGroup?: string } = {},
): ModifierWeight {
  serial += 1;
  return {
    sourceModifierId: `m${String(serial)}`,
    modGroup: modGroup ?? `g${String(serial)}`,
    itemLevelMin,
    weight,
    weightSource: 'published',
    lines: [...lines],
  };
}

const line = (statId: string | null, ...ranges: (readonly [number, number])[]): WeightsLine => ({
  statId,
  ranges: ranges.map(([min, max]) => [min, max] as [number, number]),
});

const band = (valueMin: number, valueMax: number, statId = STAT): ModifierRef => ({
  kind: 'banded',
  statId,
  valueMin,
  valueMax,
});

function pools(prefix: readonly ModifierWeight[], suffix: readonly ModifierWeight[]): WeightsClassPools {
  return {
    prefix: { poolCoverage: 'complete', entries: [...prefix] },
    suffix: { poolCoverage: 'complete', entries: [...suffix] },
  };
}

function pOf(result: ProbabilityResult): number {
  if (!result.ok) {
    throw new Error(`expected a probability, got ${JSON.stringify(result.reason)}`);
  }
  return result.p;
}

function closeRelative(actual: number, expected: number, tolerance = 1e-12): boolean {
  if (actual === expected) {
    return true;
  }
  return Math.abs(actual - expected) <= tolerance * Math.max(Math.abs(actual), Math.abs(expected));
}

describe('interval (§1)', () => {
  it('derives [1, 1] for a valueless line, the pair for one #, and edge midpoints for two #', () => {
    expect(interval(line(STAT))).toEqual({ min: 1, max: 1 });
    expect(interval(line(STAT, [30, 33]))).toEqual({ min: 30, max: 33 });
    expect(interval(line(STAT, [34, 44], [52, 69]))).toEqual({ min: 43, max: 56.5 });
  });
});

describe('contains (§1)', () => {
  it('contains a tier whose derived interval sits exactly on the band edges', () => {
    expect(contains(band(47, 50), tier([line(STAT, [47, 50])], 100))).toBe(true);
  });

  it('does not contain a clipped tier, which stays in the denominator', () => {
    const clipped = tier([line(STAT, [45, 50])], 100);
    const inside = tier([line(STAT, [51, 55])], 300);
    expect(contains(band(47, 50), clipped)).toBe(false);
    const p = pOf(affixProbability(pools([clipped, inside], [tier([line(OTHER)], 1)]), 'prefix', band(47, 55), 82, 0));
    expect(p).toBe(300 / 400);
  });

  it('carries the weight of each whole tier in a run of adjacent tiers', () => {
    const t7 = tier([line(STAT, [34, 44], [52, 69])], 200);
    const t8 = tier([line(STAT, [56, 80])], 100);
    const outside = tier([line(STAT, [81, 90])], 700);
    const p = pOf(affixProbability(pools([t7, t8, outside], []), 'prefix', band(43, 80), 82, 0));
    expect(p).toBe(300 / 1000);
  });

  it('contains a valueless line for a valueless ref, and never a banded line of that statId', () => {
    const ref: ModifierRef = { kind: 'valueless', statId: STAT };
    expect(contains(ref, tier([line(STAT)], 1))).toBe(true);
    expect(contains(ref, tier([line(STAT, [1, 2])], 1))).toBe(false);
  });

  it('contains a valueless line for a banded ref whose band holds [1, 1] (§2.3)', () => {
    expect(contains(band(1, 1), tier([line(STAT)], 1))).toBe(true);
    expect(contains(band(0, 10), tier([line(STAT)], 1))).toBe(true);
    expect(contains(band(2, 2), tier([line(STAT)], 1))).toBe(false);
  });

  it('counts a hybrid entry once, however many of its lines match', () => {
    const hybrid = tier([line(STAT, [10, 12]), line(OTHER, [4, 6])], 100);
    // Two lines of one statId: the schema refuses it, and the weight still counts once.
    const doubled = tier([line(STAT, [10, 12]), line(STAT, [11, 12])], 50);
    const rest = tier([line(STAT, [20, 30])], 850);
    const p = pOf(affixProbability(pools([hybrid, doubled, rest], []), 'prefix', band(10, 12), 82, 0));
    expect(p).toBe(150 / 1000);
  });

  it('never contains a null-statId line, whose entry stays in the denominator', () => {
    const unresolved = tier([line(null, [10, 12])], 500);
    const hit = tier([line(STAT, [10, 12])], 500);
    expect(contains(band(10, 12), unresolved)).toBe(false);
    expect(pOf(affixProbability(pools([unresolved, hit], []), 'prefix', band(10, 12), 82, 0))).toBe(0.5);
  });

  it('never contains a weight-0 tier, not-in-game or published, whatever its lines carry', () => {
    const notInGame = { ...tier([line(STAT, [10, 12])], 0), weightSource: 'not-in-game' as const };
    const published = tier([line(STAT, [10, 12])], 0);
    expect(contains(band(10, 12), notInGame)).toBe(false);
    expect(contains(band(10, 12), published)).toBe(false);
    expect(contains({ kind: 'valueless', statId: STAT }, tier([line(STAT)], 0))).toBe(false);
  });

  it('gives an empty containment set, not a weight-0 one, for a band that covers only weight-0 tiers', () => {
    const zero = { ...tier([line(STAT, [10, 12])], 0), weightSource: 'not-in-game' as const };
    const other = tier([line(STAT, [20, 30])], 100);
    expect([zero, other].filter((entry) => contains(band(10, 12), entry))).toEqual([]);
  });
});

describe('poolOf', () => {
  const weights = {
    schemaVersion: WEIGHTS_SCHEMA_VERSION,
    gamePatch: '0.5.5',
    producer: { id: 'test', generatedAt: '2026-09-26T10:52:22.504Z' },
    bases: { 'armour.chest': { Body_Armours_dex: pools([], []) } },
  } as WeightsFile;

  it('looks the class up directly', () => {
    expect(poolOf(weights, 'armour.chest', 'Body_Armours_dex').ok).toBe(true);
  });

  it('gives class-absent for a missing class, with no sibling fallback and own keys only', () => {
    for (const [categoryId, className] of [
      ['armour.chest', 'Body_Armours_int'],
      ['armour.boots', 'Body_Armours_dex'],
      ['armour.chest', 'constructor'],
      ['toString', 'Body_Armours_dex'],
    ] as const) {
      expect(poolOf(weights, categoryId, className)).toEqual({ ok: false, reason: { kind: 'class-absent' } });
    }
  });
});

describe('eligible (§9)', () => {
  const low = tier([line(STAT, [1, 2])], 10, { itemLevelMin: 10 });
  const mid = tier([line(STAT, [3, 4])], 10, { itemLevelMin: 44 });
  const floor = tier([line(STAT, [5, 6])], 10, { itemLevelMin: 65 });
  const high = tier([line(STAT, [7, 8])], 10, { itemLevelMin: 70 });
  const pool = { poolCoverage: 'complete' as const, entries: [low, mid, floor, high] };

  it('keeps tiers with modifierLevelMin <= w.itemLevelMin <= entry.itemLevelMin', () => {
    expect(eligible(pool, 65, 44)).toEqual([mid, floor]);
  });

  it('removes nothing beyond the scope at modifierLevelMin 0', () => {
    expect(eligible(pool, 65, 0)).toEqual([low, mid, floor]);
  });

  it('gives empty-eligible-pool, never 0, for a recipe floor above the entry floor', () => {
    const classPools = pools(pool.entries, pool.entries);
    expect(affixProbability(classPools, 'suffix', band(1, 8), 65, 70)).toEqual({
      ok: false,
      reason: { kind: 'empty-eligible-pool', slot: 'suffix' },
    });
    expect(combinationProbability(classPools, { itemLevelMin: 65, prefix: band(1, 8), suffix: band(1, 8) }, 70)).toEqual({
      ok: false,
      reason: { kind: 'empty-eligible-pool', slot: 'prefix' },
    });
  });

  it('gives empty-eligible-pool, never 0, for a slot of only weight-0 tiers (W = 0)', () => {
    const zeroA = { ...tier([line(STAT, [1, 2])], 0), weightSource: 'not-in-game' as const };
    const zeroB = { ...tier([line(STAT, [3, 4])], 0), weightSource: 'not-in-game' as const };
    const live = tier([line(OTHER, [1, 2])], 100);
    const classPools = pools([zeroA, zeroB], [live]);
    expect(affixProbability(classPools, 'prefix', band(1, 4), 82, 0)).toEqual({
      ok: false,
      reason: { kind: 'empty-eligible-pool', slot: 'prefix' },
    });
    expect(combinationProbability(classPools, { itemLevelMin: 82, prefix: band(1, 4), suffix: band(1, 2, OTHER) }, 0)).toEqual({
      ok: false,
      reason: { kind: 'empty-eligible-pool', slot: 'prefix' },
    });
  });
});

describe('combinationProbability (§11)', () => {
  it('gives empty-contained, never 0, when the floor leaves a declared affix no contained tier (§9)', () => {
    const low = tier([line(STAT, [10, 12])], 100, { itemLevelMin: 20 });
    const high = tier([line(STAT, [20, 30])], 300, { itemLevelMin: 70 });
    const suffix = tier([line(OTHER, [1, 2])], 100, { itemLevelMin: 70 });
    const classPools = pools([low, high], [suffix]);
    const suffixRef = band(1, 2, OTHER);
    expect(
      pOf(combinationProbability(classPools, { itemLevelMin: 82, prefix: band(10, 12), suffix: suffixRef }, 0)),
    ).toBeGreaterThan(0);
    expect(combinationProbability(classPools, { itemLevelMin: 82, prefix: band(10, 12), suffix: suffixRef }, 70)).toEqual({
      ok: false,
      reason: { kind: 'empty-contained', slot: 'prefix' },
    });
    expect(
      combinationProbability(classPools, { itemLevelMin: 82, prefix: band(20, 30), suffix: band(5, 9, OTHER) }, 70),
    ).toEqual({ ok: false, reason: { kind: 'empty-contained', slot: 'suffix' } });
  });

  it('computes the two-order sum by hand for a modGroup in both slots', () => {
    const a = tier([line(STAT, [10, 12])], 100, { modGroup: 'A' });
    const b = tier([line(STAT, [20, 30])], 300, { modGroup: 'B' });
    const c = tier([line(OTHER, [1, 2])], 200, { modGroup: 'A' });
    const d = tier([line(OTHER, [3, 4])], 200, { modGroup: 'D' });
    const e = tier([line(OTHER, [5, 9])], 600, { modGroup: 'E' });
    // Prefix first: a → 100 · 200 / 800 = 25. Suffix first: c → 200 · 0 / 300 = 0; d → 200 · 100 / 400 = 50.
    const p = pOf(
      combinationProbability(
        pools([a, b], [c, d, e]),
        { itemLevelMin: 82, prefix: band(10, 12), suffix: band(1, 4, OTHER) },
        0,
      ),
    );
    expect(closeRelative(p, 75 / 1400)).toBe(true);
    expect(closeRelative(p, (100 / 400) * (400 / 1000))).toBe(false);
  });

  it('gives augment-exhausted, not 0, when a first draw empties the other slot', () => {
    const a = tier([line(STAT, [10, 12])], 100, { modGroup: 'A' });
    const c = tier([line(OTHER, [1, 2])], 200, { modGroup: 'A' });
    expect(
      combinationProbability(pools([a], [c]), { itemLevelMin: 82, prefix: band(10, 12), suffix: band(1, 2, OTHER) }, 0),
    ).toEqual({ ok: false, reason: { kind: 'augment-exhausted', firstDrawSlot: 'prefix', modGroup: 'A' } });
  });

  it('gives empty-eligible-pool for the suffix when only the suffix slot is empty', () => {
    const a = tier([line(STAT, [10, 12])], 100);
    const late = tier([line(OTHER, [1, 2])], 100, { itemLevelMin: 90 });
    expect(
      combinationProbability(pools([a], [late]), { itemLevelMin: 82, prefix: band(10, 12), suffix: band(1, 2, OTHER) }, 0),
    ).toEqual({
      ok: false,
      reason: { kind: 'empty-eligible-pool', slot: 'suffix' },
    });
  });

  it('gives augment-exhausted for a suffix first draw that empties the prefix slot', () => {
    const a = tier([line(STAT, [10, 12])], 100, { modGroup: 'A' });
    const c = tier([line(OTHER, [1, 2])], 200, { modGroup: 'A' });
    const d = tier([line(OTHER, [3, 4])], 200, { modGroup: 'D' });
    expect(
      combinationProbability(pools([a], [c, d]), { itemLevelMin: 82, prefix: band(10, 12), suffix: band(1, 2, OTHER) }, 0),
    ).toEqual({ ok: false, reason: { kind: 'augment-exhausted', firstDrawSlot: 'suffix', modGroup: 'A' } });
  });

  it('gives the same P with and without acceptedTier', () => {
    const classPools = pools([tier([line(STAT, [10, 12])], 100), tier([line(STAT, [20, 30])], 300)], [tier([line(OTHER)], 5)]);
    const suffix: ModifierRef = { kind: 'valueless', statId: OTHER };
    const plain = combinationProbability(classPools, { itemLevelMin: 82, prefix: band(10, 12), suffix }, 0);
    const labelled = combinationProbability(
      classPools,
      { itemLevelMin: 82, prefix: { ...band(10, 12), acceptedTier: 'T1' }, suffix },
      0,
    );
    expect(labelled).toEqual(plain);
  });

  it('equals P(p) × P(s) to 1e-12 on every non-pruned crafted entry of the committed files', async () => {
    // A non-literal specifier: the files sit outside this package's `rootDir`.
    const here = (import.meta as ImportMeta & { readonly dirname: string }).dirname;
    const load = async (name: string): Promise<unknown> =>
      ((await import(/* @vite-ignore */ `${here}/../../../test/fixtures/frozen-data/${name}`)) as { default: unknown }).default;
    const tracked = parseEnvelope(TrackedFileSchema, await load('tracked.json'), TRACKED_SCHEMA_VERSION);
    const weights = parseEnvelope(WeightsFileSchema, await load('weights.json'), WEIGHTS_SCHEMA_VERSION);
    if (!tracked.ok || !weights.ok) {
      throw new Error('a committed data file was refused');
    }
    const crafted = tracked.value.entries.flatMap((entry) =>
      entry.kind === 'crafted' && entry.status !== 'pruned' ? [entry] : [],
    );
    expect(crafted.length).toBeGreaterThan(0);
    for (const entry of crafted) {
      const lookup = poolOf(weights.value, entry.categoryId, entry.className);
      if (!lookup.ok) {
        throw new Error(`class absent: ${entry.categoryId}/${entry.className}`);
      }
      const prefixGroups = new Set(eligible(lookup.pools.prefix, entry.itemLevelMin, 0).map((w) => w.modGroup));
      const shared = eligible(lookup.pools.suffix, entry.itemLevelMin, 0).filter((w) => prefixGroups.has(w.modGroup));
      if (shared.length > 0) {
        throw new Error(
          `precondition failed: no modGroup spans both eligible slots, but ${entry.categoryId}/${entry.className} shares ${shared[0]?.modGroup ?? ''}; the product check does not apply`,
        );
      }
      const pPrefix = pOf(affixProbability(lookup.pools, 'prefix', entry.prefix, entry.itemLevelMin, 0));
      const pSuffix = pOf(affixProbability(lookup.pools, 'suffix', entry.suffix, entry.itemLevelMin, 0));
      const p = pOf(combinationProbability(lookup.pools, entry, 0));
      if (!closeRelative(p, pPrefix * pSuffix)) {
        throw new Error(`${JSON.stringify(entry)}: ${String(p)} != ${String(pPrefix * pSuffix)}`);
      }
    }
  });
});
