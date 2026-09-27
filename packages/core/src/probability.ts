import type {
  CraftedTrackedEntry,
  ModifierRef,
  ModifierWeight,
  WeightsClassPools,
  WeightsFile,
  WeightsLine,
  WeightsPool,
} from '@poe/contracts';

/**
 * The probability term (AD-11, AD-17, IMPLEMENTATION-NOTES.md §1, §9, §11).
 *
 * Pure (AD-1). This is the one definition of a tier's interval, of
 * containment, of the eligible set and of `P(combination)`. Every caller that
 * needs one of these calls this module; nothing else re-derives them.
 *
 * **The two-`#` rule is the producer's inference, pending OQ-12** (§1). A line
 * with two range pairs derives the midpoint of each edge. `interval` is the
 * one place that division happens and the one place to change when OQ-12
 * resolves: `contains` calls it, and the edge-alignment check (Story 3.3) calls
 * it too.
 *
 * **Exactness (AD-5, §1).** Edges compare with `>=` and `<=` and exact
 * equality. Two `#` is the most a stat line carries, and the game publishes
 * integer range endpoints, so the sum of two endpoints is exact and halving it
 * is exact in IEEE doubles (IMPLEMENTATION-NOTES.md §1). There is no
 * tolerance, no epsilon and no guard on the division. A three-`#` line is refused by the weights schema and never
 * reaches this module.
 *
 * **A missing figure is a typed reason, never `0`** (§9, §11). An absent
 * class, an empty eligible slot and an exhausted augment each come back as a
 * `ProbabilityReason`. The tags are machine tags; Story 3.4 maps them.
 *
 * **Trust surface (AD-5, §8).** The entry's `itemLevelMin` is declared in
 * `data/tracked.json`, and no component derives it. This module scopes the
 * pool at the declared floor as given. A floor declared lower than §8 derives
 * fails a cross-file check at load; a floor declared **higher** passes every
 * mechanical check in the system, widens the scoped pool, inflates every
 * denominator and moves the ranking with nothing reported. A clean result here
 * does not confirm that the floor is the one §8 derives.
 *
 * `acceptedTier` is a display label and is never read here (AD-5).
 */

export type Slot = 'prefix' | 'suffix';

/** The one filter-comparable interval of a banded line (§1). */
export interface Interval {
  readonly min: number;
  readonly max: number;
}

export type ProbabilityReason =
  | { readonly kind: 'class-absent' }
  | { readonly kind: 'empty-eligible-pool'; readonly slot: Slot }
  | { readonly kind: 'augment-exhausted'; readonly firstDrawSlot: Slot; readonly modGroup: string };

export type ProbabilityResult =
  | { readonly ok: true; readonly p: number }
  | { readonly ok: false; readonly reason: ProbabilityReason };

export type PoolLookup =
  | { readonly ok: true; readonly pools: WeightsClassPools }
  | { readonly ok: false; readonly reason: { readonly kind: 'class-absent' } };

/** The affixes and the floor that scope a combination. A `CraftedTrackedEntry` satisfies it. */
export type CombinationInput = Pick<CraftedTrackedEntry, 'itemLevelMin' | 'prefix' | 'suffix'>;

/**
 * A line's derived interval (§1). Empty `ranges` is a valueless line and has
 * none. One pair is the interval itself. Two pairs give the midpoint of each
 * edge — the producer's inference, pending OQ-12; change it here and only here.
 */
export function interval(line: WeightsLine): Interval | undefined {
  const [first, second] = line.ranges;
  if (first === undefined) {
    return undefined;
  }
  if (second === undefined) {
    return { min: first[0], max: first[1] };
  }
  return { min: (first[0] + second[0]) / 2, max: (first[1] + second[1]) / 2 };
}

/**
 * Whole-tier containment (§1). A `banded` reference contains an entry when one
 * of its lines carries the reference's `statId` and a derived interval wholly
 * inside the band. A `valueless` reference contains an entry when one of its
 * lines carries the `statId` with empty `ranges`. A `null`-`statId` line never
 * matches. An entry whose `weight` is `0` is never contained, whatever its
 * `weightSource` or lines (§1). It still enters the denominator,
 * where it adds nothing.
 */
export function contains(ref: ModifierRef, entry: ModifierWeight): boolean {
  if (entry.weight === 0) {
    return false;
  }
  return entry.lines.some((line) => {
    if (line.statId !== ref.statId) {
      return false;
    }
    const derived = interval(line);
    if (ref.kind === 'valueless') {
      return derived === undefined;
    }
    return derived !== undefined && derived.min >= ref.valueMin && derived.max <= ref.valueMax;
  });
}

/**
 * The class's two pools, by direct lookup at `bases[categoryId][className]`,
 * own keys only (AD-5, AD-17). A missing class is never looked for among its
 * siblings.
 */
export function poolOf(weights: WeightsFile, categoryId: string, className: string): PoolLookup {
  const classes = Object.hasOwn(weights.bases, categoryId) ? weights.bases[categoryId] : undefined;
  const pools = classes !== undefined && Object.hasOwn(classes, className) ? classes[className] : undefined;
  if (pools === undefined) {
    return { ok: false, reason: { kind: 'class-absent' } };
  }
  return { ok: true, pools };
}

/**
 * The eligible set of one slot (§9): scope to the entry's floor, then
 * truncate at the recipe's floor, on one axis —
 * `modifierLevelMin <= w.itemLevelMin <= itemLevelMin`. A `modifierLevelMin`
 * of `0` runs the same predicate and removes nothing.
 */
export function eligible(
  pool: WeightsPool,
  itemLevelMin: number,
  modifierLevelMin: number,
): readonly ModifierWeight[] {
  return pool.entries.filter((w) => w.itemLevelMin >= modifierLevelMin && w.itemLevelMin <= itemLevelMin);
}

function totalWeight(entries: readonly ModifierWeight[]): number {
  let total = 0;
  for (const entry of entries) {
    total += entry.weight;
  }
  return total;
}

/** `C = contained(ref) ∩ E`; an absent affix contains its whole eligible set (§11). */
function containedIn(ref: ModifierRef | undefined, eligibleSet: readonly ModifierWeight[]): readonly ModifierWeight[] {
  return ref === undefined ? eligibleSet : eligibleSet.filter((entry) => contains(ref, entry));
}

/**
 * `P(ref | recipe)` for one slot (§9): the contained eligible weight over the
 * eligible weight, each contained entry counted once. An absent affix is
 * `P = 1`. An empty eligible slot (`W = 0`) is `empty-eligible-pool`.
 */
export function affixProbability(
  pools: WeightsClassPools,
  slot: Slot,
  ref: ModifierRef | undefined,
  itemLevelMin: number,
  modifierLevelMin: number,
): ProbabilityResult {
  const eligibleSet = eligible(pools[slot], itemLevelMin, modifierLevelMin);
  const total = totalWeight(eligibleSet);
  if (total === 0) {
    return { ok: false, reason: { kind: 'empty-eligible-pool', slot } };
  }
  return { ok: true, p: totalWeight(containedIn(ref, eligibleSet)) / total };
}

interface SlotSets {
  readonly slot: Slot;
  readonly eligibleSet: readonly ModifierWeight[];
  readonly contained: readonly ModifierWeight[];
  readonly total: number;
}

/** Sums of `E_X ∖ G` and `C_X ∖ G`, computed once per `modGroup`. */
function exclusionSums(sets: SlotSets): (group: string) => { readonly eligible: number; readonly contained: number } {
  const cache = new Map<string, { readonly eligible: number; readonly contained: number }>();
  return (group) => {
    const cached = cache.get(group);
    if (cached !== undefined) {
      return cached;
    }
    const sums = {
      eligible: totalWeight(sets.eligibleSet.filter((entry) => entry.modGroup !== group)),
      contained: totalWeight(sets.contained.filter((entry) => entry.modGroup !== group)),
    };
    cache.set(group, sums);
    return sums;
  };
}

/**
 * One draw order's numerator: `Σ_{e ∈ C_first} e.w · ΣC_second∖g(e) / W_second∖g(e)`.
 * A positive-weight first draw that leaves the other slot nothing is
 * `augment-exhausted`.
 */
function orderedTerm(
  first: SlotSets,
  second: SlotSets,
): { readonly ok: true; readonly sum: number } | { readonly ok: false; readonly reason: ProbabilityReason } {
  const without = exclusionSums(second);
  let sum = 0;
  for (const entry of first.contained) {
    if (entry.weight === 0) {
      continue;
    }
    const rest = without(entry.modGroup);
    if (rest.eligible === 0) {
      return {
        ok: false,
        reason: { kind: 'augment-exhausted', firstDrawSlot: first.slot, modGroup: entry.modGroup },
      };
    }
    sum += (entry.weight * rest.contained) / rest.eligible;
  }
  return { ok: true, sum };
}

/**
 * `P(prefix ∧ suffix | recipe)` (§11): the transmute draws from both slots
 * combined by weight, and the augment draws from the other slot with the first
 * affix's `modGroup` removed. The order is scope, truncate, exclude,
 * renormalise. An absent affix contains its whole eligible set, so the one
 * formula covers it. Both slots are checked for `empty-eligible-pool` first,
 * then each draw order for `augment-exhausted`.
 */
export function combinationProbability(
  pools: WeightsClassPools,
  combination: CombinationInput,
  modifierLevelMin: number,
): ProbabilityResult {
  const setsOf = (slot: Slot, ref: ModifierRef | undefined): SlotSets => {
    const eligibleSet = eligible(pools[slot], combination.itemLevelMin, modifierLevelMin);
    return { slot, eligibleSet, contained: containedIn(ref, eligibleSet), total: totalWeight(eligibleSet) };
  };
  const prefix = setsOf('prefix', combination.prefix);
  const suffix = setsOf('suffix', combination.suffix);
  for (const sets of [prefix, suffix]) {
    if (sets.total === 0) {
      return { ok: false, reason: { kind: 'empty-eligible-pool', slot: sets.slot } };
    }
  }
  const prefixFirst = orderedTerm(prefix, suffix);
  if (!prefixFirst.ok) {
    return prefixFirst;
  }
  const suffixFirst = orderedTerm(suffix, prefix);
  if (!suffixFirst.ok) {
    return suffixFirst;
  }
  return { ok: true, p: (prefixFirst.sum + suffixFirst.sum) / (prefix.total + suffix.total) };
}
