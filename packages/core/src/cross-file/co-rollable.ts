import type { ModifierReference, ModifierWeight } from '@poe/contracts';

import { containedIn, isExcludedBy } from '../probability.ts';
import type { Slot } from '../probability.ts';
import { formatReference } from './reference-text.ts';

/** Why `first`, drawn first, keeps `candidate` out of the second draw. */
function blockText(candidate: ModifierWeight, first: ModifierWeight): string {
  if (candidate.modGroup === first.modGroup) {
    return `shared modGroup ${first.modGroup}`;
  }
  const met = candidate.blockedByTags.filter((tag) => first.addsTags.includes(tag));
  return `${candidate.sourceModifierId} blockedByTags meets ${first.sourceModifierId} addsTags on ${met.join(', ')}`;
}

/**
 * The detail when no contained prefix tier and suffix tier can be on one item in either draw
 * order, never `P = 0`. An empty containment set is that check's failure, so this passes it.
 */
export function coRollable(
  references: Readonly<Record<Slot, ModifierReference>>,
  scoped: Readonly<Record<Slot, readonly ModifierWeight[]>>,
  floor: number,
): string | undefined {
  const prefixes = containedIn(references.prefix, scoped.prefix);
  const suffixes = containedIn(references.suffix, scoped.suffix);
  const [prefix] = prefixes;
  const [suffix] = suffixes;
  if (prefix === undefined || suffix === undefined) {
    return undefined;
  }
  const isOpen = prefixes.some((left) => suffixes.some((right) => !isExcludedBy(right, left) || !isExcludedBy(left, right)));
  return isOpen
    ? undefined
    : `${formatReference('prefix', references.prefix)} and ${formatReference('suffix', references.suffix)} at floor ${String(floor)}: ` +
        `no contained tiers can be on one item in either draw order; e.g. ${prefix.sourceModifierId} and ${suffix.sourceModifierId}: ` +
        `prefix first, ${blockText(suffix, prefix)}; suffix first, ${blockText(prefix, suffix)}`;
}
