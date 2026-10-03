import type { ModifierRef } from './modifier-ref.ts';

/**
 * The overlap predicate (AD-17, IMPLEMENTATION-NOTES.md §2.1), defined once.
 *
 * Two crafted entries overlap when one item can satisfy both, so the item is
 * counted twice. The predicate is a conjunction over the two slots, and each
 * slot runs §2.1's `slotOverlap` branches in order. This module evaluates them
 * with no summed `statId` (`S = ∅`), so §2.1's first branch never fires and
 * two references that share no `statId` never overlap in one slot.
 *
 * `coOccur` (§2.2) is injected, because it needs the weights file. Only a slot
 * with a `hybrid` reference reads it. `TrackedFileSchema` evaluates only pairs
 * whose four references are single-line, so it never reads `coOccur` and
 * passes `NEVER_CO_OCCUR`; `core`'s `co-occur` check evaluates every pair with
 * a hybrid reference and passes the real pool read (§2.1, *Who evaluates a
 * pair*).
 *
 * One `banded` and one `valueless` line on one `statId` have no two bands to
 * intersect, so they do not intersect. The kind disagreement itself is kind
 * agreement's concern (§2.3), not overlap's.
 */

export type OverlapSlot = 'prefix' | 'suffix';

export const OVERLAP_SLOTS: readonly OverlapSlot[] = ['prefix', 'suffix'];

/** The two affixes the predicate reads. A crafted tracked entry satisfies it. */
export interface OverlapAffixes {
  readonly prefix: ModifierRef;
  readonly suffix: ModifierRef;
}

/** `coOccur(x, y)` (§2.2): whether one scoped entry of the slot's pool contains both references. */
export type CoOccur = (x: ModifierRef, y: ModifierRef, slot: OverlapSlot) => boolean;

/** The within-file `coOccur`: the tracked list alone cannot see a pool. */
export const NEVER_CO_OCCUR: CoOccur = () => false;

/** Which §2.1 branch made a slot overlap. */
export type SlotOverlapBranch = 'co-occur' | 'both-valueless' | 'bands-intersect';

/** One line a reference names: the reference itself when single-line, one of its lines when hybrid. */
type NamedLine =
  | { readonly statId: string; readonly valueMin: number; readonly valueMax: number }
  | { readonly statId: string };

function linesOf(ref: ModifierRef): readonly NamedLine[] {
  return ref.kind === 'hybrid' ? ref.lines : [ref];
}

/**
 * `statIds(ref)` (§1), local because `contracts` cannot import `core`. Order
 * does not matter to its callers here.
 */
function statIdsOf(ref: ModifierRef): readonly string[] {
  return linesOf(ref).map((line) => line.statId);
}

function lineOn(ref: ModifierRef, statId: string): NamedLine | undefined {
  return linesOf(ref).find((line) => line.statId === statId);
}

/** `linesIntersect(x, y, ∅)` (§2.1) over the shared `statId`s, which the caller found non-empty. */
function linesIntersect(x: ModifierRef, y: ModifierRef, shared: readonly string[]): boolean {
  return shared.every((statId) => {
    const left = lineOn(x, statId);
    const right = lineOn(y, statId);
    if (left === undefined || right === undefined) {
      return false;
    }
    const leftBanded = 'valueMin' in left;
    const rightBanded = 'valueMin' in right;
    if (!leftBanded && !rightBanded) {
      return true;
    }
    if (leftBanded && rightBanded) {
      return left.valueMin <= right.valueMax && right.valueMin <= left.valueMax;
    }
    return false;
  });
}

/**
 * The branch that made the slot overlap, or `undefined` when the slot does
 * not overlap (§2.1 `slotOverlap` with `S = ∅`). No shared `statId` is
 * `undefined`. Two single-line references give `both-valueless` or
 * `bands-intersect`. A slot with a `hybrid` reference gives `co-occur`, and
 * only then is `coOccur` read.
 */
export function slotOverlapBranch(
  x: ModifierRef,
  y: ModifierRef,
  slot: OverlapSlot,
  coOccur: CoOccur,
): SlotOverlapBranch | undefined {
  const theirs = new Set(statIdsOf(y));
  const shared = statIdsOf(x).filter((statId) => theirs.has(statId));
  if (shared.length === 0 || !linesIntersect(x, y, shared)) {
    return undefined;
  }
  if (x.kind !== 'hybrid' && y.kind !== 'hybrid') {
    return x.kind === 'valueless' ? 'both-valueless' : 'bands-intersect';
  }
  return coOccur(x, y, slot) ? 'co-occur' : undefined;
}

export function slotOverlap(x: ModifierRef, y: ModifierRef, slot: OverlapSlot, coOccur: CoOccur): boolean {
  return slotOverlapBranch(x, y, slot, coOccur) !== undefined;
}

/** `overlap(a, b) ⇔ slotOverlap(a.prefix, b.prefix) ∧ slotOverlap(a.suffix, b.suffix)`. */
export function overlap(a: OverlapAffixes, b: OverlapAffixes, coOccur: CoOccur): boolean {
  return overlapBranches(a, b, coOccur) !== undefined;
}

/**
 * Whether either affix is a `hybrid` reference. A pair is `core`'s when either
 * entry names one, and `contracts`'s otherwise (§2.1, *Who evaluates a pair*).
 */
export function namesHybrid(affixes: OverlapAffixes): boolean {
  return affixes.prefix.kind === 'hybrid' || affixes.suffix.kind === 'hybrid';
}

/**
 * Each slot's branch when the two entries overlap, or `undefined` when they
 * do not. A payload names the slots from it. Every pair is evaluated; the
 * caller picks its pairs by `namesHybrid`.
 */
export function overlapBranches(
  a: OverlapAffixes,
  b: OverlapAffixes,
  coOccur: CoOccur,
): Readonly<Record<OverlapSlot, SlotOverlapBranch>> | undefined {
  const prefix = slotOverlapBranch(a.prefix, b.prefix, 'prefix', coOccur);
  if (prefix === undefined) {
    return undefined;
  }
  const suffix = slotOverlapBranch(a.suffix, b.suffix, 'suffix', coOccur);
  if (suffix === undefined) {
    return undefined;
  }
  return { prefix, suffix };
}

const BRANCH_WORDS: Readonly<Record<SlotOverlapBranch, string>> = {
  'co-occur': 'shared lines intersect and one scoped tier contains both',
  'both-valueless': 'both valueless',
  'bands-intersect': 'bands intersect',
};

/** `prefix (bands intersect), suffix (both valueless)`: the slots a payload names. */
export function describeOverlap(branches: Readonly<Record<OverlapSlot, SlotOverlapBranch>>): string {
  return OVERLAP_SLOTS.map((slot) => `${slot} (${BRANCH_WORDS[branches[slot]]})`).join(', ');
}
