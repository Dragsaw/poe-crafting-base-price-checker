import type { CraftedTrackedEntry, ModifierWeight, Provenance, WeightsClassPools } from '@poe/contracts';

import { eligible } from './probability.ts';

/**
 * Provenance of a crafted `(Item Class, recipe)` pair (AD-10, IMPLEMENTATION-NOTES.md
 * §9). Pure (AD-1).
 *
 * The order is `absent` < `uniform-prior` < `measured`. A tier maps by its
 * `weightSource` and nothing else: `published` and `not-in-game` are `measured`,
 * `absent` is `uniform-prior`. The inputs of a pair are exactly the entries the
 * probability formula sums: the recipe's eligible set over both slots. A tier
 * below the recipe floor is not an input. A weight-0 tier in that set is an
 * input like any other.
 */

/** The labels a ranked row can carry: never `absent`. */
type RankedProvenance = Exclude<Provenance, 'absent'>;

const STRENGTH: Readonly<Record<Provenance, number>> = { absent: 0, 'uniform-prior': 1, measured: 2 };

/** The weaker of two labels. */
export function weakest<T extends Provenance>(left: T, right: T): T {
  return STRENGTH[left] <= STRENGTH[right] ? left : right;
}

/** The label of one tier, from its `weightSource` (AD-10). A tier never maps to `absent`: that label comes only from a `partial` pool. */
export function provenanceOfTier(tier: Pick<ModifierWeight, 'weightSource'>): RankedProvenance {
  return tier.weightSource === 'absent' ? 'uniform-prior' : 'measured';
}

/**
 * The weakest label over the recipe's eligible set of both slots. An empty set
 * folds to `measured`: it holds no invented weight.
 */
export function foldPair(
  pools: WeightsClassPools,
  entry: Pick<CraftedTrackedEntry, 'itemLevelMin'>,
  modifierLevelMin: number,
): RankedProvenance {
  const inputs = [
    ...eligible(pools.prefix, entry.itemLevelMin, modifierLevelMin),
    ...eligible(pools.suffix, entry.itemLevelMin, modifierLevelMin),
  ];
  return inputs.reduce<RankedProvenance>((label, tier) => weakest(label, provenanceOfTier(tier)), 'measured');
}

/** The oldest of the given ISO timestamps, or `undefined` when there are none. */
export function oldestOf(timestamps: readonly string[]): string | undefined {
  let oldest: string | undefined;
  for (const stamp of timestamps) {
    if (oldest === undefined || Date.parse(stamp) < Date.parse(oldest)) {
      oldest = stamp;
    }
  }
  return oldest;
}
