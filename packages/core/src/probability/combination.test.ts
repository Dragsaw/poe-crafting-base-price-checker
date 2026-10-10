import {
  parseEnvelope,
  TRACKED_SCHEMA_VERSION,
  TrackedFileSchema,
  WEIGHTS_SCHEMA_VERSION,
  WeightsFileSchema,
} from '@poe/contracts';
import type { ModifierReference } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { affixProbability, combinationProbability, eligible, poolOf } from '../probability.ts';
import { band, isCloseRelative, line, OTHER, pOf, pools, STAT, tier } from './test-support.ts';

describe('combinationProbability', () => {
  it('gives empty-contained, never 0, when the floor removes the contained tier from its group', () => {
    const low = tier([line(STAT, [10, 12])], 100, { itemLevelMin: 20, modGroup: 'g' });
    const high = tier([line(STAT, [20, 30])], 300, { itemLevelMin: 70, modGroup: 'g' });
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
    // Prefix first: a → 100 · 200 / 800 = 25.
    // Suffix first: c → 200 · 0 / 300 = 0; d → 200 · 100 / 400 = 50.
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
    const suffix: ModifierReference = { kind: 'valueless', statId: OTHER };
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
      ((await import(/* @vite-ignore */ `${here}/../../../../test/fixtures/frozen-data/${name}`)) as { default: unknown }).default;
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
      const pPrefix = pOf(affixProbability(lookup.pools, 'prefix', entry.prefix, { itemLevelMin: entry.itemLevelMin, modifierLevelMin: 0 }));
      const pSuffix = pOf(affixProbability(lookup.pools, 'suffix', entry.suffix, { itemLevelMin: entry.itemLevelMin, modifierLevelMin: 0 }));
      const p = pOf(combinationProbability(lookup.pools, entry, 0));
      if (!isCloseRelative(p, pPrefix * pSuffix)) {
        throw new Error(`${JSON.stringify(entry)}: ${String(p)} != ${String(pPrefix * pSuffix)}`);
      }
    }
  });
});
