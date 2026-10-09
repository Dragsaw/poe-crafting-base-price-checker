import { compareByCodeUnit } from '@poe/contracts';
import type {
  CraftedTrackedEntry,
  HybridLine,
  ModifierReference,
  ModifierWeight,
  SingleLineModifierReference,
  WeightsClassPools,
  WeightsFile,
  WeightsLine,
  WeightsPool,
} from '@poe/contracts';

/**
 * The probability term (AD-11, AD-17): no epsilon in edge comparisons (AD-5).
 */

export type Slot = 'prefix' | 'suffix';

/** The one filter-comparable interval of a banded line. */
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
 * A line's derived interval: two pairs give each edge's midpoint, pending OQ-12.
 */
export function interval(line: WeightsLine): Interval {
  const [first, second] = line.ranges;
  if (first === undefined) {
    return { min: 1, max: 1 };
  }
  return second === undefined ? { min: first[0], max: first[1] } : { min: (first[0] + second[0]) / 2, max: (first[1] + second[1]) / 2 };
}

/** `untrackable(entry)`: reads the weights file alone. */
export function isUntrackable(entry: ModifierWeight, pool: Pick<WeightsPool, 'poolCoverage'>): boolean {
  return untrackableReason(entry, pool) !== undefined;
}

/** Why `untrackable` holds: `undefined` for a trackable entry. */
export type UntrackableReason = 'not-in-game' | 'partial-pool-null-line';

/** The null-line rule's verdict and reason, shared by `core`, the sync gate, `tracked:lookup`. */
export function untrackableReason(
  entry: ModifierWeight,
  pool: Pick<WeightsPool, 'poolCoverage'>,
): UntrackableReason | undefined {
  if (entry.weightSource === 'not-in-game') {
    return 'not-in-game';
  }
  return pool.poolCoverage === 'partial' && entry.lines.some((line) => line.statId === null) ? 'partial-pool-null-line' : undefined;
}

/** `lineSet(entry)`: the non-null `statId`s by code unit; `untrackable` decides `null`. */
export function lineSet(entry: ModifierWeight): readonly string[] {
  return entry.lines.flatMap((line) => line.statId ?? []).toSorted(compareByCodeUnit);
}

/** `statIds(ref)`: the `statId`s a reference names, sorted by code unit. */
export function statIds(reference: ModifierReference): readonly string[] {
  return reference.kind === 'hybrid' ? reference.lines.map((rl) => rl.statId).toSorted(compareByCodeUnit) : [reference.statId];
}

/** What `covers` tests a weights line against: a single-line reference, or one line of a hybrid one. */
export type ReferenceLine = SingleLineModifierReference | HybridLine;

/** `covers(rl, line)`: a banded `rl` needs the derived interval inside the band. */
export function isCovering(rl: ReferenceLine, line: WeightsLine): boolean {
  if (line.statId !== rl.statId) {
    return false;
  }
  if (!('valueMin' in rl)) {
    return line.ranges.length === 0;
  }
  const derived = interval(line);
  return derived.min >= rl.valueMin && derived.max <= rl.valueMax;
}

/** The empty `S`, for a caller with no pair of entries. */
const NO_SUMMED: ReadonlySet<string> = new Set();

function haveSameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

/**
 * Whole-tier containment; `summed` is the summed-statId set `S`. Needs a `complete` pool: else `untrackable`.
 */
export function isContaining(reference: ModifierReference, entry: ModifierWeight, summed: ReadonlySet<string> = NO_SUMMED): boolean {
  if (entry.weight === 0) {
    return false;
  }
  const isCoveredBy = (rl: ReferenceLine) =>
    entry.lines.some((line) => (summed.has(rl.statId) ? line.statId === rl.statId : isCovering(rl, line)));
  return reference.kind === 'hybrid' ? haveSameIds(lineSet(entry), statIds(reference)) && reference.lines.every((line) => isCoveredBy(line)) : isCoveredBy(reference);
}

/** The class's two pools by direct lookup `bases[categoryId][className]`, own keys (AD-5). */
export function poolOf(weights: WeightsFile, categoryId: string, className: string): PoolLookup {
  const classes = Object.hasOwn(weights.bases, categoryId) ? weights.bases[categoryId] : undefined;
  const pools = classes !== undefined && Object.hasOwn(classes, className) ? classes[className] : undefined;
  return pools === undefined ? { ok: false, reason: { kind: 'class-absent' } } : { ok: true, pools };
}

/** One slot's eligible set: `modifierLevelMin <= w.itemLevelMin <= itemLevelMin`, one axis. */
export function eligible(
  pool: WeightsPool,
  itemLevelMin: number,
  modifierLevelMin: number,
): readonly ModifierWeight[] {
  return pool.entries.filter((w) => canRecipeRoll(w.itemLevelMin, modifierLevelMin) && w.itemLevelMin <= itemLevelMin);
}

/** The recipe-floor half of `eligible`: whether a recipe can roll a tier at all. */
export function canRecipeRoll(tierItemLevelMin: number, modifierLevelMin: number): boolean {
  return tierItemLevelMin >= modifierLevelMin;
}

function totalWeight(entries: readonly ModifierWeight[]): number {
  let total = 0;
  for (const entry of entries) {
    total += entry.weight;
  }
  return total;
}

/** A pool is empty when its total weight is `0`: the one definition for coverage (AD-17). */
export function isEmptyPool(pool: WeightsPool): boolean {
  return totalWeight(pool.entries) === 0;
}

/** `C = contained(ref) ∩ E`. */
export function containedIn(reference: ModifierReference, eligibleSet: readonly ModifierWeight[]): readonly ModifierWeight[] {
  return eligibleSet.filter((entry) => isContaining(reference, entry));
}

/** `needs(ref)` over the unscoped pool: `undefined`, never `0`, if nothing is contained. */
export function needs(reference: ModifierReference, pool: WeightsPool): number | undefined {
  const tier = containedIn(reference, pool.entries).filter((entry) => !isUntrackable(entry, pool));
  if (tier.length === 0) {
    return undefined;
  }
  const levels = tier.map((entry) => entry.itemLevelMin);
  const isBanded = reference.kind === 'hybrid' ? reference.lines.some((rl) => 'valueMin' in rl) : reference.kind === 'banded';
  return isBanded ? Math.max(...levels) : Math.min(...levels);
}

/** `P(ref | recipe)` for one slot; an empty eligible slot is `empty-eligible-pool`. */
export function affixProbability(
  pools: WeightsClassPools,
  slot: Slot,
  reference: ModifierReference,
  { itemLevelMin, modifierLevelMin }: { readonly itemLevelMin: number; readonly modifierLevelMin: number },
): ProbabilityResult {
  const eligibleSet = eligible(pools[slot], itemLevelMin, modifierLevelMin);
  const total = totalWeight(eligibleSet);
  return total === 0 ? { ok: false, reason: { kind: 'empty-eligible-pool', slot } } : { ok: true, p: totalWeight(containedIn(reference, eligibleSet)) / total };
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
 * One draw order's numerator; a first draw leaving the other slot nothing is exhausted.
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
 * `P(prefix ∧ suffix | recipe)`: scope, truncate, exclude, renormalise; reasons per slot.
 */
export function combinationProbability(
  pools: WeightsClassPools,
  combination: CombinationInput,
  modifierLevelMin: number,
): ProbabilityResult {
  const setsOf = (slot: Slot, reference: ModifierReference): SlotSets => {
    const eligibleSet = eligible(pools[slot], combination.itemLevelMin, modifierLevelMin);
    return { slot, eligibleSet, contained: containedIn(reference, eligibleSet), total: totalWeight(eligibleSet) };
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
  return suffixFirst.ok ? { ok: true, p: (prefixFirst.sum + suffixFirst.sum) / (prefix.total + suffix.total) } : suffixFirst;
}
