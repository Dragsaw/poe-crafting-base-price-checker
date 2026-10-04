import { compareByCodeUnit } from './canonical-key.ts';
import type { HybridLine, ModifierRef as ModifierReference, SingleLineModifierRef as SingleLineModifierReference } from './modifier-ref.ts';

/**
 * The overlap predicate (AD-17, IMPLEMENTATION-NOTES.md §2.1), defined once.
 *
 * Two crafted entries overlap when one item can satisfy both, so the item is
 * counted twice. The predicate is a conjunction over the two slots and over
 * `S`, the summed `statId`s that both entries share. Each slot runs §2.1's
 * `slotOverlap` branches in order on its `statId`s outside `S`. Each `statId`
 * in `S` is compared once, as the §5.5 sum of the two slots' lines, and never
 * per slot. An entry that names a `statId` in one slot only is compared per
 * slot.
 *
 * `summedStatIds` is §2.1's `summed(e)`, the one definition: the schema's
 * within-file rules, `core`'s `co-occur` check and `sync`'s search body all
 * read it. `summedInterval` is §2.1's `sum(e, s)`, plain addition and never
 * rounded (AD-16).
 *
 * `coOccur` (§2.2) is injected, because it needs the weights file, and it takes
 * `S`. Only a slot with a `hybrid` reference reads it. `TrackedFileSchema`
 * evaluates only pairs whose four references are single-line, so it never
 * reads `coOccur` and passes `CAN_NEVER_CO_OCCUR`; `core`'s `co-occur` check
 * evaluates every pair with a hybrid reference and passes the real pool read
 * (§2.1, *Who evaluates a pair*).
 *
 * One `banded` and one `valueless` line on one `statId` have no two bands to
 * intersect, so they do not intersect. The kind disagreement itself is kind
 * agreement's concern (§2.3), not overlap's. A sum with a `valueless` operand
 * has no edges, so it never intersects; the schema refuses it (§2.3).
 */

export type OverlapSlot = 'prefix' | 'suffix';

export const OVERLAP_SLOTS: readonly OverlapSlot[] = ['prefix', 'suffix'];

/** The two affixes the predicate reads. A crafted tracked entry satisfies it. */
export interface OverlapAffixes {
  readonly prefix: ModifierReference;
  readonly suffix: ModifierReference;
}

/**
 * `coOccur(x, y, S)` (§2.2): whether one scoped entry of the slot's pool
 * contains both references, with a reference line on a `statId` in `summed`
 * read as covered.
 */
export type CoOccur = (x: ModifierReference, y: ModifierReference, slot: OverlapSlot, summed: ReadonlySet<string>) => boolean;

/** The within-file `coOccur`: the tracked list alone cannot see a pool. */
export const CAN_NEVER_CO_OCCUR: CoOccur = () => false;

/**
 * Which §2.1 branch made a slot overlap. `summed` is the first branch: one
 * reference names no `statId` outside `S`, so the sums alone judge the slot.
 */
export type SlotOverlapBranch = 'summed' | 'co-occur' | 'both-valueless' | 'bands-intersect';

/** One line a reference names: the reference itself when single-line, one of its lines when hybrid. */
export type NamedLine = SingleLineModifierReference | HybridLine;

/** The lines a reference names: `[ref]` when single-line, `ref.lines` when hybrid. */
export function linesOf(reference: ModifierReference): readonly NamedLine[] {
  return reference.kind === 'hybrid' ? reference.lines : [reference];
}

/**
 * `statIds(ref)` (§1), local because `contracts` cannot import `core`. Order
 * does not matter to its callers here.
 */
function statIdsOf(reference: ModifierReference): readonly string[] {
  return linesOf(reference).map((line) => line.statId);
}

function lineOn(reference: ModifierReference, statId: string): NamedLine | undefined {
  return linesOf(reference).find((line) => line.statId === statId);
}

const NO_SUMMED: ReadonlySet<string> = new Set();

/**
 * `summed(e)` (§2.1): the `statId`s that the prefix and the suffix reference
 * of one entry both name, pure line or hybrid line, either side. In prefix
 * line order, which the schema sorted by `statId`.
 */
export function summedStatIds(affixes: OverlapAffixes): ReadonlySet<string> {
  const suffix = new Set(statIdsOf(affixes.suffix));
  return new Set(statIdsOf(affixes.prefix).filter((statId) => suffix.has(statId)));
}

/** A summed `statId`'s interval, `[min, max]`. */
export interface SummedInterval {
  readonly min: number;
  readonly max: number;
}

/**
 * `sum(e, s)` (§2.1, §5.5): the sum of the two slots' mins and the sum of
 * their maxes, by plain addition and never rounded (AD-16). `undefined` when
 * either slot names no line on `s`, or either line is valueless, because such
 * an operand has no edge to add (§2.3).
 */
export function summedInterval(affixes: OverlapAffixes, statId: string): SummedInterval | undefined {
  const prefix = lineOn(affixes.prefix, statId);
  const suffix = lineOn(affixes.suffix, statId);
  return prefix === undefined || suffix === undefined || !('valueMin' in prefix) || !('valueMin' in suffix) ? undefined : { min: prefix.valueMin + suffix.valueMin, max: prefix.valueMax + suffix.valueMax };
}

/** `linesIntersect(x, y, S)` (§2.1) over the shared `statId`s outside `S`, which the caller found non-empty. */
function linesIntersect(x: ModifierReference, y: ModifierReference, shared: readonly string[]): boolean {
  return shared.every((statId) => {
    const left = lineOn(x, statId);
    const right = lineOn(y, statId);
    if (left === undefined || right === undefined) {
      return false;
    }
    const isLeftBanded = 'valueMin' in left;
    const isRightBanded = 'valueMin' in right;
    return (
      (!isLeftBanded && !isRightBanded) ||
      (isLeftBanded && isRightBanded && left.valueMin <= right.valueMax && right.valueMin <= left.valueMax)
    );
  });
}

export interface SlotOverlapOptions {
  readonly slot: OverlapSlot;
  readonly coOccur: CoOccur;
  readonly summed?: ReadonlySet<string>;
}

/**
 * The branch that made the slot overlap, or `undefined` when the slot does
 * not overlap (§2.1 `slotOverlap(x, y, S)`, branches in order). A reference
 * that names nothing outside `S` gives `summed`. No shared `statId` outside
 * `S` is `undefined`. Two single-line references give `both-valueless` or
 * `bands-intersect`. A slot with a `hybrid` reference gives `co-occur`, and
 * only then is `coOccur` read. `summed` is empty where the caller has no pair
 * of entries.
 */
export function slotOverlapBranch(
  x: ModifierReference,
  y: ModifierReference,
  { slot, coOccur, summed = NO_SUMMED }: SlotOverlapOptions,
): SlotOverlapBranch | undefined {
  const outside = (reference: ModifierReference) => statIdsOf(reference).filter((statId) => !summed.has(statId));
  const ours = outside(x);
  const theirs = new Set(outside(y));
  if (ours.length === 0 || theirs.size === 0) {
    return 'summed';
  }
  const shared = ours.filter((statId) => theirs.has(statId));
  if (shared.length === 0 || !linesIntersect(x, y, shared)) {
    return undefined;
  }
  if (x.kind !== 'hybrid' && y.kind !== 'hybrid') {
    return x.kind === 'valueless' ? 'both-valueless' : 'bands-intersect';
  }
  return coOccur(x, y, slot, summed) ? 'co-occur' : undefined;
}

export function slotOverlap(x: ModifierReference, y: ModifierReference, options: SlotOverlapOptions): boolean {
  return slotOverlapBranch(x, y, options) !== undefined;
}

/** `overlap(a, b)` (§2.1): both slots overlap outside `S`, and every sum in `S` intersects. */
export function overlap(a: OverlapAffixes, b: OverlapAffixes, coOccur: CoOccur): boolean {
  return overlapBranches(a, b, coOccur) !== undefined;
}

/**
 * Whether either affix is a `hybrid` reference. A pair is `core`'s when either
 * entry names one, and `contracts`'s otherwise (§2.1, *Who evaluates a pair*).
 */
export function hasHybridAffix(affixes: OverlapAffixes): boolean {
  return affixes.prefix.kind === 'hybrid' || affixes.suffix.kind === 'hybrid';
}

/** One summed `statId` in `S` whose two entries' intervals intersect. */
export interface SummedOverlap {
  readonly statId: string;
  readonly a: SummedInterval;
  readonly b: SummedInterval;
}

/** What a payload names when two entries overlap: each slot's branch and each intersecting sum. */
export interface OverlapBranches {
  readonly prefix: SlotOverlapBranch;
  readonly suffix: SlotOverlapBranch;
  /** Every `statId` in `S`, by code unit, with both intervals. Empty when `S` is. */
  readonly sums: readonly SummedOverlap[];
}

/**
 * Each slot's branch and each summed `statId`'s two intervals when the two
 * entries overlap, or `undefined` when they do not. `S` is computed here, so a
 * caller passes the two entries alone. A payload names the slots and the sums
 * from it. Every pair is evaluated; the caller picks its pairs by
 * `hasHybridAffix`.
 */
export function overlapBranches(a: OverlapAffixes, b: OverlapAffixes, coOccur: CoOccur): OverlapBranches | undefined {
  const theirs = summedStatIds(b);
  const summed = new Set([...summedStatIds(a)].filter((statId) => theirs.has(statId)).toSorted(compareByCodeUnit));
  const sums: SummedOverlap[] = [];
  for (const statId of summed) {
    const left = summedInterval(a, statId);
    const right = summedInterval(b, statId);
    if (left === undefined || right === undefined || left.min > right.max || right.min > left.max) {
      return undefined;
    }
    sums.push({ statId, a: left, b: right });
  }
  const prefix = slotOverlapBranch(a.prefix, b.prefix, { slot: 'prefix', coOccur, summed });
  if (prefix === undefined) {
    return undefined;
  }
  const suffix = slotOverlapBranch(a.suffix, b.suffix, { slot: 'suffix', coOccur, summed });
  return suffix === undefined ? undefined : { prefix, suffix, sums };
}

const BRANCH_WORDS: Readonly<Record<SlotOverlapBranch, string>> = {
  summed: 'names only summed statIds',
  'co-occur': 'shared lines intersect and one scoped tier contains both',
  'both-valueless': 'both valueless',
  'bands-intersect': 'bands intersect',
};

function intervalText(interval: SummedInterval): string {
  return `[${String(interval.min)}, ${String(interval.max)}]`;
}

/**
 * `prefix (bands intersect), suffix (names only summed statIds); sum
 * explicit.stat_X [31, 37] and [33, 39] intersect`: the slots and the sums a
 * payload names.
 */
export function describeOverlap(branches: OverlapBranches): string {
  const slots = OVERLAP_SLOTS.map((slot) => `${slot} (${BRANCH_WORDS[branches[slot]]})`).join(', ');
  const sums = branches.sums.map(
    (sum) => `sum ${sum.statId} ${intervalText(sum.a)} and ${intervalText(sum.b)} intersect`,
  );
  return [slots, ...sums].join('; ');
}
