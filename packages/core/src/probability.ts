import { compareByCodeUnit } from '@poe/contracts';
import type {
  CraftedTrackedEntry,
  HybridLine,
  ModifierRef,
  ModifierWeight,
  SingleLineModifierRef,
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
 * resolves: `contains` calls it, and the edge-alignment check (`cross-file.ts`)
 * calls it too.
 *
 * **Line sets, the null-line rule and containment** are §1's: `lineSet`,
 * `untrackable`, `statIds`, `covers` and `contains` below are the one
 * implementation that §1 has every caller share. A hybrid reference's
 * containment set feeds §11 unchanged; a contained tier counts its whole
 * weight once, and nothing multiplies across a hybrid's lines (AD-17).
 *
 * **Exactness (AD-5, §1).** Edges compare with `>=` and `<=` and exact
 * equality. Two `#` is the most a stat line carries, and the game publishes
 * integer range endpoints, so the sum of two endpoints is exact and halving it
 * is exact in IEEE doubles (IMPLEMENTATION-NOTES.md §1). There is no
 * tolerance, no epsilon and no guard on the division. A three-`#` line is refused by the weights schema and never
 * reaches this module.
 *
 * **A missing figure is a typed reason, never `0`** (§9, §11). An absent
 * class, an empty eligible slot, a reference that contains no eligible tier
 * and an exhausted augment each come back as a `ProbabilityReason`. The tags
 * are machine tags; Story 3.4 maps them.
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
  | { readonly kind: 'empty-contained'; readonly slot: Slot }
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
 * A line's derived interval (§1). Empty `ranges` is a valueless line and reads
 * as `[1, 1]` (§2.3). One pair is the interval itself. Two pairs give the
 * midpoint of each edge — the producer's inference, pending OQ-12; change it
 * here and only here.
 */
export function interval(line: WeightsLine): Interval {
  const [first, second] = line.ranges;
  if (first === undefined) {
    return { min: 1, max: 1 };
  }
  if (second === undefined) {
    return { min: first[0], max: first[1] };
  }
  return { min: (first[0] + second[0]) / 2, max: (first[1] + second[1]) / 2 };
}

/**
 * `untrackable(entry)` (§1 *Line sets and the null-line rule*). It reads the
 * weights file alone: the entry and its own pool's coverage.
 */
export function untrackable(entry: ModifierWeight, pool: Pick<WeightsPool, 'poolCoverage'>): boolean {
  return (
    entry.weightSource === 'not-in-game' ||
    (pool.poolCoverage === 'partial' && entry.lines.some((line) => line.statId === null))
  );
}

/**
 * `lineSet(entry)` (§1): the entry's non-null line `statId`s, sorted by code
 * unit. A `null` line is dropped here; `untrackable` decides what it means.
 */
export function lineSet(entry: ModifierWeight): readonly string[] {
  return entry.lines.flatMap((line) => (line.statId === null ? [] : [line.statId])).sort(compareByCodeUnit);
}

/** `statIds(ref)` (§1): the `statId`s a reference names, sorted by code unit. */
export function statIds(ref: ModifierRef): readonly string[] {
  return ref.kind === 'hybrid' ? ref.lines.map((rl) => rl.statId).sort(compareByCodeUnit) : [ref.statId];
}

/** What `covers` tests a weights line against: a single-line reference, or one line of a hybrid one. */
export type ReferenceLine = SingleLineModifierRef | HybridLine;

/**
 * `covers(rl, line)` (§1). A banded `rl` covers a line of its `statId` whose
 * derived interval sits wholly inside the band; a valueless line derives
 * `[1, 1]` (§2.3). A valueless `rl` covers a line of its `statId` with empty
 * `ranges`. A `null`-`statId` line is never covered.
 */
export function covers(rl: ReferenceLine, line: WeightsLine): boolean {
  if (line.statId !== rl.statId) {
    return false;
  }
  if (!('valueMin' in rl)) {
    return line.ranges.length === 0;
  }
  const derived = interval(line);
  return derived.min >= rl.valueMin && derived.max <= rl.valueMax;
}

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

/**
 * Whole-tier containment (§1 *Containment*). A single-line reference contains
 * an entry when one of its lines is covered. A hybrid reference contains an
 * entry whose `lineSet` equals the reference's `statIds` and whose lines cover
 * every reference line; an entry with a different line set is excluded even
 * when every named line is covered. An entry whose `weight` is `0` is never
 * contained, whatever its `weightSource` or lines (§1). It still enters the
 * denominator, where it adds nothing.
 *
 * **Precondition: the entry's pool is `complete`.** §1 writes `¬untrackable`
 * into containment; this function does not take the pool's coverage. The
 * `not-in-game` half is already `weight > 0`, because the weights schema forces
 * weight 0 on such a tier. The `partial` half never reaches here: a class with a
 * `partial` slot gets no pool check (§1) and no probability (`rank.ts` reports
 * it before it computes one). A new caller with a `partial` pool calls
 * `untrackable` first.
 */
export function contains(ref: ModifierRef, entry: ModifierWeight): boolean {
  if (entry.weight === 0) {
    return false;
  }
  if (ref.kind === 'hybrid') {
    return (
      sameIds(lineSet(entry), statIds(ref)) && ref.lines.every((rl) => entry.lines.some((line) => covers(rl, line)))
    );
  }
  return entry.lines.some((line) => covers(ref, line));
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

/**
 * A pool is empty when its total weight is `0` (IMPLEMENTATION-NOTES.md §3,
 * AD-17): the one definition of "empty" for the coverage figure.
 */
export function isEmptyPool(pool: WeightsPool): boolean {
  return totalWeight(pool.entries) === 0;
}

/** `C = contained(ref) ∩ E` (§11). */
export function containedIn(ref: ModifierRef, eligibleSet: readonly ModifierWeight[]): readonly ModifierWeight[] {
  return eligibleSet.filter((entry) => contains(ref, entry));
}

/**
 * `needs(ref)` (IMPLEMENTATION-NOTES.md §8): the item level a reference
 * requires, over `tier(ref)` — the **unscoped** pool's entries that `contains`
 * admits and that are not `untrackable`. A maximum of `w.itemLevelMin` when
 * the reference names any banded line, a minimum when every line is
 * valueless, and `undefined`, never `0`, when it contains nothing.
 */
export function needs(ref: ModifierRef, pool: WeightsPool): number | undefined {
  const tier = containedIn(ref, pool.entries).filter((entry) => !untrackable(entry, pool));
  if (tier.length === 0) {
    return undefined;
  }
  const levels = tier.map((entry) => entry.itemLevelMin);
  const banded = ref.kind === 'hybrid' ? ref.lines.some((rl) => 'valueMin' in rl) : ref.kind === 'banded';
  return banded ? Math.max(...levels) : Math.min(...levels);
}

/**
 * `P(ref | recipe)` for one slot (§9): the contained eligible weight over the
 * eligible weight, each contained entry counted once. An empty eligible slot
 * (`W = 0`) is `empty-eligible-pool`.
 */
export function affixProbability(
  pools: WeightsClassPools,
  slot: Slot,
  ref: ModifierRef,
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
  // `contains` never admits a weight-0 tier, so every first draw here is positive-weight.
  for (const entry of first.contained) {
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
 * renormalise. Both slots are checked for `empty-eligible-pool` first, then
 * each affix for `empty-contained` (IN §9), then each draw order for
 * `augment-exhausted`.
 */
export function combinationProbability(
  pools: WeightsClassPools,
  combination: CombinationInput,
  modifierLevelMin: number,
): ProbabilityResult {
  const setsOf = (slot: Slot, ref: ModifierRef): SlotSets => {
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
  for (const sets of [prefix, suffix]) {
    if (sets.contained.length === 0) {
      return { ok: false, reason: { kind: 'empty-contained', slot: sets.slot } };
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
