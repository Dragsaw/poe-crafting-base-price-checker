import type { CraftedTrackedEntry, ModifierWeight, Provenance, WeightsClassPools } from '@poe/contracts';

import { eligible } from './probability.ts';

/** Provenance of a crafted `(Item Class, recipe)` pair: order, mapping and inputs are AD-10's. */

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

/** The weakest label over both slots' eligible set; an empty set folds to `measured`. */
export function foldPair(
  pools: WeightsClassPools,
  entry: Pick<CraftedTrackedEntry, 'itemLevelMin'>,
  modifierLevelMin: number,
): RankedProvenance {
  const inputs = [
    ...eligible(pools.prefix, entry.itemLevelMin, modifierLevelMin),
    ...eligible(pools.suffix, entry.itemLevelMin, modifierLevelMin),
  ];
  let label: RankedProvenance = 'measured';
  for (const tier of inputs) {
    label = weakest(label, provenanceOfTier(tier));
  }
  return label;
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
