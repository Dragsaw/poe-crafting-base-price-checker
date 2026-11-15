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

import { lineDigits, nextOnGrid } from './probability/value-grid.ts';

/**
 * The probability term (AD-11, AD-17): no epsilon in edge comparisons (AD-5).
 */

export type Slot = 'prefix' | 'suffix';

const SLOTS: readonly Slot[] = ['prefix', 'suffix'];

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

/** The two affixes of a combination. A `CraftedTrackedEntry` satisfies it. */
export type CombinationInput = Pick<CraftedTrackedEntry, 'prefix' | 'suffix'>;

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

// Keyed by tier identity: `ownInterval` compares each tier's line set once per pool.
const lineSetKeys = new WeakMap<ModifierWeight, string>();

function lineSetKey(entry: ModifierWeight): string {
  let key = lineSetKeys.get(entry);
  if (key === undefined) {
    key = JSON.stringify(lineSet(entry));
    lineSetKeys.set(entry, key);
  }
  return key;
}

// Per pool: its tiers grouped by line set, and each line's own interval once derived.
const ownIntervals = new WeakMap<WeightsPool, { readonly bySet: Map<string, ModifierWeight[]>; readonly own: Map<WeightsLine, Interval> }>();

/** A tier's own interval on one line, over the unscoped slot pool (AD-11). */
export function ownInterval(line: WeightsLine, tier: ModifierWeight, pool: WeightsPool): Interval {
  let memo = ownIntervals.get(pool);
  if (memo === undefined) {
    memo = { bySet: Map.groupBy(pool.entries, (entry) => lineSetKey(entry)), own: new Map() };
    ownIntervals.set(pool, memo);
  }
  let own = memo.own.get(line);
  if (own === undefined) {
    own = deriveOwnInterval(line, tier, memo.bySet.get(lineSetKey(tier)) ?? []);
    memo.own.set(line, own);
  }
  return own;
}

function deriveOwnInterval(line: WeightsLine, tier: ModifierWeight, entries: readonly ModifierWeight[]): Interval {
  const derived = interval(line);
  if (line.statId === null || line.ranges.length === 0) {
    return derived;
  }
  let digits = lineDigits(line);
  let highest = -Infinity;
  for (const other of entries) {
    const theirs = sameLine(line, tier, other);
    if (theirs === undefined) {
      continue;
    }
    digits = Math.max(digits, lineDigits(theirs));
    const span = interval(theirs);
    if (span.min <= derived.min && derived.min <= span.max) {
      highest = Math.max(highest, span.max);
    }
  }
  if (highest === -Infinity) {
    return derived;
  }
  const min = nextOnGrid(highest, digits, line.ranges.length);
  return min > derived.max ? derived : { min, max: derived.max };
}

/** The banded line on `line`'s `statId` of `other`, a tier of the same line set, or `undefined` for the tier itself. */
function sameLine(line: WeightsLine, tier: ModifierWeight, other: ModifierWeight): WeightsLine | undefined {
  if (other === tier) {
    return undefined;
  }
  const theirs = other.lines.find((candidate) => candidate.statId === line.statId);
  return theirs === undefined || theirs.ranges.length === 0 ? undefined : theirs;
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

/** `covers(rl, line)`: a banded `rl` needs the tier's own interval inside the band; `pool` is unscoped (AD-11). */
export function isCovering(rl: ReferenceLine, line: WeightsLine, tier: ModifierWeight, pool: WeightsPool): boolean {
  if (line.statId !== rl.statId) {
    return false;
  }
  if (!('valueMin' in rl)) {
    return line.ranges.length === 0;
  }
  const own = ownInterval(line, tier, pool);
  return own.min >= rl.valueMin && own.max <= rl.valueMax;
}

/** The empty `S`, for a caller with no pair of entries. */
const NO_SUMMED: ReadonlySet<string> = new Set();

function haveSameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

/**
 * Whole-tier containment; `summed` is the summed-statId set `S`. Needs a `complete` pool: else `untrackable`.
 */
export function isContaining(
  reference: ModifierReference,
  entry: ModifierWeight,
  pool: WeightsPool,
  summed: ReadonlySet<string> = NO_SUMMED,
): boolean {
  if (entry.weight === 0) {
    return false;
  }
  const isCoveredBy = (rl: ReferenceLine) =>
    entry.lines.some((line) => (summed.has(rl.statId) ? line.statId === rl.statId : isCovering(rl, line, entry, pool)));
  return reference.kind === 'hybrid' ? haveSameIds(lineSet(entry), statIds(reference)) && reference.lines.every((line) => isCoveredBy(line)) : isCoveredBy(reference);
}

/** The class's two pools by direct lookup `bases[categoryId][className]`, own keys (AD-5). */
export function poolOf(weights: WeightsFile, categoryId: string, className: string): PoolLookup {
  const classes = Object.hasOwn(weights.bases, categoryId) ? weights.bases[categoryId] : undefined;
  const pools = classes !== undefined && Object.hasOwn(classes, className) ? classes[className] : undefined;
  return pools === undefined ? { ok: false, reason: { kind: 'class-absent' } } : { ok: true, pools };
}

/** The scope of one eligible pool: the Crafting Item Level `L` and the recipe's floor (AD-17). */
export interface RecipeScope {
  readonly itemLevel: number;
  readonly modifierLevelMin: number;
}

// Keyed by tier identity: a ranking pass asks for each tier's key once per entry and recipe.
const modifierKeys = new WeakMap<ModifierWeight, string>();

/** The modifier a tier belongs to: its `modGroup` with its line set (AD-17). */
function modifierOf(entry: ModifierWeight): string {
  let key = modifierKeys.get(entry);
  if (key === undefined) {
    key = JSON.stringify([entry.modGroup, lineSet(entry)]);
    modifierKeys.set(entry, key);
  }
  return key;
}

/** One slot's eligible set: the scope, then the recipe floor per modifier (AD-17, FR-26). */
export function eligible(pool: WeightsPool, itemLevel: number, modifierLevelMin: number): readonly ModifierWeight[] {
  const scoped = pool.entries.filter((entry) => entry.itemLevelMin <= itemLevel);
  const top = new Map<string, number>();
  for (const entry of scoped) {
    if (entry.weight === 0) {
      continue;
    }
    const key = modifierOf(entry);
    top.set(key, Math.max(top.get(key) ?? entry.itemLevelMin, entry.itemLevelMin));
  }
  return scoped.filter(
    (entry) => entry.itemLevelMin >= modifierLevelMin || (entry.weight > 0 && entry.itemLevelMin === top.get(modifierOf(entry))),
  );
}

/** Whether a recipe can roll an entry at a scope: `combinationProbability` is defined and above `0`. */
export type RecipeReach = { readonly reached: true } | { readonly reached: false; readonly slots: readonly Slot[] };

/** The reach verdict of one `(entry, recipe, L)` triple (AD-17). */
export function recipeReach(pools: WeightsClassPools, entry: CombinationInput, scope: RecipeScope): RecipeReach {
  const result = combinationProbability(pools, entry, scope);
  if (result.ok) {
    return result.p > 0 ? { reached: true } : { reached: false, slots: SLOTS };
  }
  const empty = SLOTS.filter((slot) => containedIn(entry[slot], eligible(pools[slot], scope.itemLevel, scope.modifierLevelMin), pools[slot]).length === 0);
  // Both contained sets are non-empty only when a first draw exhausts the other slot.
  return { reached: false, slots: empty.length > 0 ? empty : SLOTS.filter((slot) => !(result.reason.kind === 'augment-exhausted' && result.reason.firstDrawSlot === slot)) };
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

/** `C = contained(ref) ∩ E`; `pool` is the unscoped slot pool that `E` is drawn from. */
export function containedIn(
  reference: ModifierReference,
  eligibleSet: readonly ModifierWeight[],
  pool: WeightsPool,
): readonly ModifierWeight[] {
  return eligibleSet.filter((entry) => isContaining(reference, entry, pool));
}

/** `needs(ref)` over the unscoped pool: `undefined`, never `0`, if nothing is contained. */
export function needs(reference: ModifierReference, pool: WeightsPool): number | undefined {
  const tier = containedIn(reference, pool.entries, pool).filter((entry) => !isUntrackable(entry, pool));
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
  { itemLevel, modifierLevelMin }: RecipeScope,
): ProbabilityResult {
  const eligibleSet = eligible(pools[slot], itemLevel, modifierLevelMin);
  const total = totalWeight(eligibleSet);
  return total === 0 ? { ok: false, reason: { kind: 'empty-eligible-pool', slot } } : { ok: true, p: totalWeight(containedIn(reference, eligibleSet, pools[slot])) / total };
}

interface SlotSets {
  readonly slot: Slot;
  readonly eligibleSet: readonly ModifierWeight[];
  readonly contained: readonly ModifierWeight[];
  readonly total: number;
}

/** Whether the first affix `first` excludes `candidate` from the second draw: one `modGroup`, or a blocking tag met (AD-17). */
export function isExcludedBy(candidate: ModifierWeight, first: ModifierWeight): boolean {
  return candidate.modGroup === first.modGroup || candidate.blockedByTags.some((tag) => first.addsTags.includes(tag));
}

/** The second draw: the other slot's eligible `entries` without those `first` excludes (AD-17). */
export function secondDraw(first: ModifierWeight, entries: readonly ModifierWeight[]): readonly ModifierWeight[] {
  return entries.filter((entry) => !isExcludedBy(entry, first));
}

/** Sums of the second draw over `E_X` and `C_X`, computed once per exclusion input of the first affix. */
function exclusionSums(sets: SlotSets): (first: ModifierWeight) => { readonly eligible: number; readonly contained: number } {
  const cache = new Map<string, { readonly eligible: number; readonly contained: number }>();
  return (first) => {
    const key = JSON.stringify([first.modGroup, first.addsTags]);
    const cached = cache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const sums = {
      eligible: totalWeight(secondDraw(first, sets.eligibleSet)),
      contained: totalWeight(secondDraw(first, sets.contained)),
    };
    cache.set(key, sums);
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
    const rest = without(entry);
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
 * `P(prefix ∧ suffix | recipe, L)`: scope, floor, renormalise, exclude, renormalise (AD-17); reasons per slot.
 */
export function combinationProbability(
  pools: WeightsClassPools,
  combination: CombinationInput,
  { itemLevel, modifierLevelMin }: RecipeScope,
): ProbabilityResult {
  const setsOf = (slot: Slot, reference: ModifierReference): SlotSets => {
    const eligibleSet = eligible(pools[slot], itemLevel, modifierLevelMin);
    return { slot, eligibleSet, contained: containedIn(reference, eligibleSet, pools[slot]), total: totalWeight(eligibleSet) };
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
