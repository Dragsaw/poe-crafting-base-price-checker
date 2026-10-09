import { compareByCodeUnit } from './canonical-key.ts';
import type { HybridLine, ModifierReference, SingleLineModifierReference } from './modifier-reference.ts';

/** The overlap predicate (AD-17); `coOccur` is injected, it needs the weights. */

export type OverlapSlot = 'prefix' | 'suffix';

export const OVERLAP_SLOTS: readonly OverlapSlot[] = ['prefix', 'suffix'];

/** The two affixes the predicate reads. A crafted tracked entry satisfies it. */
export interface OverlapAffixes {
  readonly prefix: ModifierReference;
  readonly suffix: ModifierReference;
}

/** `coOccur(x, y, S)`: one scoped pool entry holds both references; `summed` lines count. */
export type CoOccur = (x: ModifierReference, y: ModifierReference, slot: OverlapSlot, summed: ReadonlySet<string>) => boolean;

/** The within-file `coOccur`: the tracked list alone cannot see a pool. */
export const CAN_NEVER_CO_OCCUR: CoOccur = () => false;

/** Which branch made a slot overlap; `summed`: a reference names no `statId` outside `S`. */
export type SlotOverlapBranch = 'summed' | 'co-occur' | 'both-valueless' | 'bands-intersect';

/** One line a reference names: the reference itself when single-line, one of its lines when hybrid. */
export type NamedLine = SingleLineModifierReference | HybridLine;

/** The lines a reference names: `[ref]` when single-line, `ref.lines` when hybrid. */
export function linesOf(reference: ModifierReference): readonly NamedLine[] {
  return reference.kind === 'hybrid' ? reference.lines : [reference];
}

/** `statIds(ref)`, local because `contracts` cannot import `core`. */
function statIdsOf(reference: ModifierReference): readonly string[] {
  return linesOf(reference).map((line) => line.statId);
}

function lineOn(reference: ModifierReference, statId: string): NamedLine | undefined {
  return linesOf(reference).find((line) => line.statId === statId);
}

const NO_SUMMED: ReadonlySet<string> = new Set();

/** `summed(e)`: the `statId`s both slots of one entry name, in prefix line order. */
export function summedStatIds(affixes: OverlapAffixes): ReadonlySet<string> {
  const suffix = new Set(statIdsOf(affixes.suffix));
  return new Set(statIdsOf(affixes.prefix).filter((statId) => suffix.has(statId)));
}

/** A summed `statId`'s interval, `[min, max]`. */
export interface SummedInterval {
  readonly min: number;
  readonly max: number;
}

/** `sum(e, s)`: plain addition, never rounded (AD-16); `undefined` without a line. */
export function summedInterval(affixes: OverlapAffixes, statId: string): SummedInterval | undefined {
  const prefix = lineOn(affixes.prefix, statId);
  const suffix = lineOn(affixes.suffix, statId);
  return prefix === undefined || suffix === undefined || !('valueMin' in prefix) || !('valueMin' in suffix) ? undefined : { min: prefix.valueMin + suffix.valueMin, max: prefix.valueMax + suffix.valueMax };
}

/** `linesIntersect(x, y, S)` over the shared `statId`s outside `S`, which the caller found non-empty. */
function areLinesIntersecting(x: ModifierReference, y: ModifierReference, shared: readonly string[]): boolean {
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

/** The branch that made the slot overlap, or `undefined`; `coOccur` only for hybrids. */
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
  if (shared.length === 0 || !areLinesIntersecting(x, y, shared)) {
    return undefined;
  }
  if (x.kind !== 'hybrid' && y.kind !== 'hybrid') {
    return x.kind === 'valueless' ? 'both-valueless' : 'bands-intersect';
  }
  return coOccur(x, y, slot, summed) ? 'co-occur' : undefined;
}

export function isSlotOverlapping(x: ModifierReference, y: ModifierReference, options: SlotOverlapOptions): boolean {
  return slotOverlapBranch(x, y, options) !== undefined;
}

/** `overlap(a, b)`: both slots overlap outside `S`, and every sum in `S` intersects. */
export function areOverlapping(a: OverlapAffixes, b: OverlapAffixes, isCoOccurring: CoOccur): boolean {
  return overlapBranches(a, b, isCoOccurring) !== undefined;
}

/** A pair is `core`'s when either entry names a `hybrid`, else `contracts`'s. */
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

/** Each slot's branch and summed interval pair when the entries overlap; `S` is computed here. */
export function overlapBranches(a: OverlapAffixes, b: OverlapAffixes, isCoOccurring: CoOccur): OverlapBranches | undefined {
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
  const prefix = slotOverlapBranch(a.prefix, b.prefix, { slot: 'prefix', coOccur: isCoOccurring, summed });
  if (prefix === undefined) {
    return undefined;
  }
  const suffix = slotOverlapBranch(a.suffix, b.suffix, { slot: 'suffix', coOccur: isCoOccurring, summed });
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

/** The slots and sums a payload names, e.g. `sum explicit.stat_X [31, 37] and [33, 39]`. */
export function describeOverlap(branches: OverlapBranches): string {
  const slots = OVERLAP_SLOTS.map((slot) => `${slot} (${BRANCH_WORDS[branches[slot]]})`).join(', ');
  const sums = branches.sums.map(
    (sum) => `sum ${sum.statId} ${intervalText(sum.a)} and ${intervalText(sum.b)} intersect`,
  );
  return [slots, ...sums].join('; ');
}
