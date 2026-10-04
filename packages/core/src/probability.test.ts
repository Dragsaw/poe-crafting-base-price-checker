import {
  parseEnvelope,
  TRACKED_SCHEMA_VERSION,
  TrackedFileSchema,
  WEIGHTS_SCHEMA_VERSION,
  WeightsFileSchema,
} from '@poe/contracts';
import type {
  HybridLine,
  ModifierRef,
  ModifierWeight,
  WeightsClassPools,
  WeightsFile,
  WeightsLine,
  WeightsPool,
} from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import {
  affixProbability,
  combinationProbability,
  contains,
  covers,
  eligible,
  interval,
  lineSet,
  needs,
  poolOf,
  statIds,
  untrackable,
  untrackableReason,
} from './probability.ts';
import type { ProbabilityResult } from './probability.ts';

const STAT = 'explicit.stat_1';
const OTHER = 'explicit.stat_2';
const THIRD = 'explicit.stat_3';

const nextSerial = ((): (() => number) => {
  let serial = 0;
  return () => {
    serial += 1;
    return serial;
  };
})();

/** One weights tier. Built in the test, never read from a fixture file (NFR-2). */
function tier(
  lines: readonly WeightsLine[],
  weight: number,
  { itemLevelMin = 1, modGroup }: { readonly itemLevelMin?: number; readonly modGroup?: string } = {},
): ModifierWeight {
  const serial = nextSerial();
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

// eslint-disable-next-line unicorn/no-null -- boundary: the weights file schema allows a null `statId` for an unresolved line (WEIGHTS-FILE-SCHEMA).
const unresolvedLine = (...ranges: (readonly [number, number])[]): WeightsLine => line(null, ...ranges);

const band = (valueMin: number, valueMax: number, statId = STAT): ModifierRef => ({
  kind: 'banded',
  statId,
  valueMin,
  valueMax,
});

const lineBand = (valueMin: number, valueMax: number, statId = STAT): HybridLine => ({ statId, valueMin, valueMax });

/** A hybrid reference, built in the test with its lines in the order given. */
const hybrid = (...lines: HybridLine[]): ModifierRef => ({ kind: 'hybrid', lines });

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

function isCloseRelative(actual: number, expected: number): boolean {
  const tolerance = 1e-12;
  return actual === expected || Math.abs(actual - expected) <= tolerance * Math.max(Math.abs(actual), Math.abs(expected));
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
    expect(p).toBeCloseTo(300 / 1000, 10);
  });

  it('contains a valueless line for a valueless ref, and never a banded line of that statId', () => {
    const reference: ModifierRef = { kind: 'valueless', statId: STAT };
    expect(contains(reference, tier([line(STAT)], 1))).toBe(true);
    expect(contains(reference, tier([line(STAT, [1, 2])], 1))).toBe(false);
  });

  it('contains a valueless line for a banded ref whose band holds [1, 1] (§2.3)', () => {
    expect(contains(band(1, 1), tier([line(STAT)], 1))).toBe(true);
    expect(contains(band(0, 10), tier([line(STAT)], 1))).toBe(true);
    expect(contains(band(2, 2), tier([line(STAT)], 1))).toBe(false);
  });

  it('counts a hybrid entry once, however many of its lines match', () => {
    const hybridTier = tier([line(STAT, [10, 12]), line(OTHER, [4, 6])], 100);
    // Two lines of one statId: the schema refuses it, and the weight still counts once.
    const doubled = tier([line(STAT, [10, 12]), line(STAT, [11, 12])], 50);
    const rest = tier([line(STAT, [20, 30])], 850);
    const p = pOf(affixProbability(pools([hybridTier, doubled, rest], []), 'prefix', band(10, 12), 82, 0));
    expect(p).toBeCloseTo(150 / 1000, 10);
  });

  it('never contains a null-statId line, whose entry stays in the denominator', () => {
    const unresolved = tier([unresolvedLine([10, 12])], 500);
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
    const suffixReference = band(1, 2, OTHER);
    expect(
      pOf(combinationProbability(classPools, { itemLevelMin: 82, prefix: band(10, 12), suffix: suffixReference }, 0)),
    ).toBeGreaterThan(0);
    expect(combinationProbability(classPools, { itemLevelMin: 82, prefix: band(10, 12), suffix: suffixReference }, 70)).toEqual({
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
    const tierE = tier([line(OTHER, [5, 9])], 600, { modGroup: 'E' });
    // Prefix first: a → 100 · 200 / 800 = 25. Suffix first: c → 200 · 0 / 300 = 0; d → 200 · 100 / 400 = 50.
    const p = pOf(
      combinationProbability(
        pools([a, b], [c, d, tierE]),
        { itemLevelMin: 82, prefix: band(10, 12), suffix: band(1, 4, OTHER) },
        0,
      ),
    );
    expect(isCloseRelative(p, 75 / 1400)).toBe(true);
    expect(isCloseRelative(p, (100 / 400) * (400 / 1000))).toBe(false);
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
    const here = (import.meta as { readonly dirname: string }).dirname;
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
      if (!isCloseRelative(p, pPrefix * pSuffix)) {
        throw new Error(`${JSON.stringify(entry)}: ${String(p)} != ${String(pPrefix * pSuffix)}`);
      }
    }
  });
});

describe('a hybrid reference (§1 Containment, §11, CAP-3)', () => {
  it('gives the hybrid tiers weight sum only when a pure family shares a statId', () => {
    const h1 = tier([line(STAT, [10, 12]), line(OTHER, [4, 6])], 100);
    const h2 = tier([line(OTHER, [7, 9]), line(STAT, [13, 15])], 50);
    const pure1 = tier([line(STAT, [10, 12])], 300);
    const pure2 = tier([line(STAT, [13, 15])], 200);
    const rest = tier([line(THIRD, [1, 2])], 350);
    const classPools = pools([h1, h2, pure1, pure2, rest], []);
    const reference = hybrid(lineBand(10, 15), lineBand(4, 9, OTHER));
    expect(pOf(affixProbability(classPools, 'prefix', reference, 82, 0))).toBeCloseTo(150 / 1000, 10);
    // The single-line band on the shared statId still admits both families (§1's existential test).
    expect(pOf(affixProbability(classPools, 'prefix', band(10, 15), 82, 0))).toBeCloseTo(650 / 1000, 10);
  });

  it('does not contain a tier whose line set is a superset of the reference statIds', () => {
    const superset = tier([line(STAT, [10, 12]), line(OTHER, [4, 6]), line(THIRD, [1, 2])], 100);
    expect(contains(hybrid(lineBand(10, 12), lineBand(4, 6, OTHER)), superset)).toBe(false);
  });

  it('gives each of two hybrid families in one slot only its own family', () => {
    const ab = tier([line(STAT, [10, 12]), line(OTHER, [4, 6])], 100);
    const ac = tier([line(STAT, [10, 12]), line(THIRD, [1, 2])], 300);
    const rest = tier([line(OTHER, [20, 30])], 600);
    const classPools = pools([ab, ac, rest], []);
    const referenceAB = hybrid(lineBand(10, 12), lineBand(4, 6, OTHER));
    const referenceAC = hybrid(lineBand(10, 12), lineBand(1, 2, THIRD));
    expect(contains(referenceAB, ac)).toBe(false);
    expect(contains(referenceAC, ab)).toBe(false);
    expect(pOf(affixProbability(classPools, 'prefix', referenceAB, 82, 0))).toBeCloseTo(100 / 1000, 10);
    expect(pOf(affixProbability(classPools, 'prefix', referenceAC, 82, 0))).toBeCloseTo(300 / 1000, 10);
  });

  it('computes the two-order sum by hand for a hybrid prefix and a suffix in its modGroup', () => {
    const h = tier([line(STAT, [10, 12]), line(OTHER, [4, 6])], 100, { modGroup: 'H' });
    const b = tier([line(STAT, [20, 30])], 300, { modGroup: 'B' });
    const c = tier([line(THIRD, [1, 2])], 200, { modGroup: 'H' });
    const d = tier([line(THIRD, [3, 4])], 200, { modGroup: 'D' });
    const tierE = tier([line(THIRD, [5, 9])], 600, { modGroup: 'E' });
    // Prefix first: h → 100 · 200 / 800 = 25. Suffix first: c → 200 · 0 / 300 = 0; d → 200 · 100 / 400 = 50.
    const p = pOf(
      combinationProbability(
        pools([h, b], [c, d, tierE]),
        { itemLevelMin: 82, prefix: hybrid(lineBand(10, 12), lineBand(4, 6, OTHER)), suffix: band(1, 4, THIRD) },
        0,
      ),
    );
    expect(isCloseRelative(p, 75 / 1400)).toBe(true);
    expect(isCloseRelative(p, (100 / 400) * (400 / 1000))).toBe(false);
  });

  it('contains a weight > 0 tier whose null line is an internal engine line in a complete pool', () => {
    const engine = tier([line(STAT, [10, 12]), unresolvedLine(), line(OTHER, [4, 6])], 100);
    expect(lineSet(engine)).toEqual([STAT, OTHER]);
    expect(untrackable(engine, { poolCoverage: 'complete' })).toBe(false);
    expect(contains(hybrid(lineBand(10, 12), lineBand(4, 6, OTHER)), engine)).toBe(true);
  });

  it('never covers a banded weights line with a valueless hybrid line', () => {
    expect(covers({ statId: OTHER }, line(OTHER, [4, 6]))).toBe(false);
    expect(covers({ statId: OTHER }, line(OTHER))).toBe(true);
    const banded = tier([line(STAT, [10, 12]), line(OTHER, [4, 6])], 100);
    expect(contains(hybrid(lineBand(10, 12), { statId: OTHER }), banded)).toBe(false);
  });

  it('never contains a weight-0 hybrid tier whose lines are covered, which stays in W', () => {
    const zero = tier([line(STAT, [10, 12]), line(OTHER, [4, 6])], 0);
    const live = tier([line(STAT, [10, 12]), line(OTHER, [4, 6])], 100);
    const rest = tier([line(THIRD, [1, 2])], 300);
    const reference = hybrid(lineBand(10, 12), lineBand(4, 6, OTHER));
    expect(contains(reference, zero)).toBe(false);
    const classPools = pools([zero, live, rest], []);
    expect(eligible(classPools.prefix, 82, 0)).toContain(zero);
    expect(pOf(affixProbability(classPools, 'prefix', reference, 82, 0))).toBe(100 / 400);
  });

  it('applies the null-line rule: untrackable reads the entry and its pool coverage alone', () => {
    const notInGame = { ...tier([line(STAT, [10, 12])], 0), weightSource: 'not-in-game' as const };
    const withNull = tier([line(STAT, [10, 12]), unresolvedLine([1, 2])], 100);
    const plain = tier([line(STAT, [10, 12]), line(OTHER, [4, 6])], 100);
    expect(untrackable(notInGame, { poolCoverage: 'complete' })).toBe(true);
    expect(untrackable(withNull, { poolCoverage: 'partial' })).toBe(true);
    expect(untrackable(withNull, { poolCoverage: 'complete' })).toBe(false);
    expect(untrackable(plain, { poolCoverage: 'partial' })).toBe(false);
  });

  it('names the reason: not-in-game first, then a null line in a partial pool, else undefined', () => {
    const notInGame = { ...tier([line(STAT, [10, 12]), unresolvedLine([1, 2])], 0), weightSource: 'not-in-game' as const };
    const withNull = tier([line(STAT, [10, 12]), unresolvedLine([1, 2])], 100);
    const plain = tier([line(STAT, [10, 12])], 100);
    expect(untrackableReason(notInGame, { poolCoverage: 'partial' })).toBe('not-in-game');
    expect(untrackableReason(notInGame, { poolCoverage: 'complete' })).toBe('not-in-game');
    expect(untrackableReason(withNull, { poolCoverage: 'partial' })).toBe('partial-pool-null-line');
    expect(untrackableReason(withNull, { poolCoverage: 'complete' })).toBeUndefined();
    expect(untrackableReason(plain, { poolCoverage: 'partial' })).toBeUndefined();
  });

  it('sorts lineSet and statIds by code unit', () => {
    expect(lineSet(tier([line(OTHER, [1, 2]), line(STAT, [1, 2])], 1))).toEqual([STAT, OTHER]);
    expect(statIds(hybrid({ statId: OTHER }, { statId: STAT }))).toEqual([STAT, OTHER]);
    expect(statIds(band(1, 2))).toEqual([STAT]);
  });
});

describe('contains with summed statIds (§2.2 contains_S)', () => {
  const summed = new Set([OTHER]);

  it('drops the band test of a hybrid line on a summed statId and keeps the line-set test', () => {
    const entry = tier([line(STAT, [10, 12]), line(OTHER, [40, 60])], 100);
    const reference = hybrid(lineBand(10, 12), lineBand(1, 2, OTHER));
    expect(contains(reference, entry)).toBe(false);
    expect(contains(reference, entry, summed)).toBe(true);
    // The line that is not summed keeps its band test.
    expect(contains(hybrid(lineBand(20, 30), lineBand(1, 2, OTHER)), entry, summed)).toBe(false);
    // The line set still has to match exactly.
    const wider = tier([line(STAT, [10, 12]), line(OTHER, [40, 60]), line(THIRD, [1, 2])], 100);
    expect(contains(reference, wider, summed)).toBe(false);
  });

  it('needs only a line on the summed statId for a single-line reference', () => {
    const entry = tier([line(OTHER, [40, 60])], 100);
    expect(contains(band(1, 2, OTHER), entry)).toBe(false);
    expect(contains(band(1, 2, OTHER), entry, summed)).toBe(true);
    expect(contains(band(1, 2, OTHER), tier([line(STAT, [1, 2])], 100), summed)).toBe(false);
  });

  it('still never contains a weight-0 tier', () => {
    const zero = tier([line(STAT, [10, 12]), line(OTHER, [40, 60])], 0);
    expect(contains(hybrid(lineBand(10, 12), lineBand(40, 60, OTHER)), zero, summed)).toBe(false);
  });
});

describe('needs (§8), over the unscoped pool', () => {
  const low = tier([line(STAT, [10, 20]), line(OTHER)], 100, { itemLevelMin: 30 });
  const high = tier([line(STAT, [21, 30]), line(OTHER)], 100, { itemLevelMin: 80 });
  const pool: WeightsPool = { poolCoverage: 'complete', entries: [low, high] };

  it('is the maximum itemLevelMin when any hybrid line is banded', () => {
    expect(needs(hybrid(lineBand(10, 30), { statId: OTHER }), pool)).toBe(80);
  });

  it('is the minimum itemLevelMin when every hybrid line is valueless', () => {
    const allValueless: WeightsPool = {
      poolCoverage: 'complete',
      entries: [low, high].map((w) => ({ ...w, lines: [line(STAT), line(OTHER)] })),
    };
    expect(needs(hybrid({ statId: STAT }, { statId: OTHER }), allValueless)).toBe(30);
  });

  it('is undefined when nothing is contained, and skips a partial pool’s null-line tier', () => {
    expect(needs(hybrid(lineBand(90, 99), { statId: OTHER }), pool)).toBeUndefined();
    const nullLine = tier([line(STAT, [10, 20]), unresolvedLine()], 100, { itemLevelMin: 30 });
    expect(needs(band(10, 20), { poolCoverage: 'partial', entries: [nullLine] })).toBeUndefined();
  });

  it('never lets a weight-0 or not-in-game tier set the floor', () => {
    const zero = tier([line(STAT, [21, 30]), line(OTHER)], 0, { itemLevelMin: 90 });
    // Weight 100 here, which the weights schema forbids, so only `untrackable` keeps it out.
    const notInGame: ModifierWeight = {
      ...zero,
      sourceModifierId: 'not-in-game',
      itemLevelMin: 95,
      weight: 100,
      weightSource: 'not-in-game',
    };
    expect(needs(hybrid(lineBand(10, 30), { statId: OTHER }), { ...pool, entries: [low, high, zero, notInGame] })).toBe(80);
  });

  it('reads single-line references the same way', () => {
    expect(needs(band(10, 30), pool)).toBe(80);
    expect(needs({ kind: 'valueless', statId: OTHER }, pool)).toBe(30);
  });
});
