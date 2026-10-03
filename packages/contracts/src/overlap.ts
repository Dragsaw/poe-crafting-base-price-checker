import type { ModifierRef } from './modifier-ref.ts';

/**
 * The overlap predicate (AD-17, IMPLEMENTATION-NOTES.md §2.1), defined once.
 *
 * Two crafted entries overlap when one item can satisfy both, so the item is
 * counted twice. The predicate is a conjunction over the two slots, and each
 * slot runs §2.1's branches **in order**:
 *
 * ```
 * slotOverlap(x, y) =  true              if x.statId != y.statId ∧ coOccur(x, y)
 *                      false             if x.statId != y.statId
 *                      true              if both are valueless
 *                      bands intersect   otherwise
 * ```
 *
 * The `coOccur` branch sits above the `statId` inequality, or it is
 * unreachable. `coOccur` is injected, because it needs the weights file:
 * `TrackedFileSchema` calls this with `NEVER_CO_OCCUR` and refuses the file on
 * a hit (AD-3), and `core`'s `co-occur` check calls it with the real pool read
 * (§2.2) and reports only the overlaps that the within-file call does not.
 *
 * One `banded` and one `valueless` reference on one `statId` have no two
 * bands to intersect, so the last branch is `false` for them. The kind
 * disagreement itself is kind agreement's concern (§2.3), not overlap's.
 */

export type OverlapSlot = 'prefix' | 'suffix';

export const OVERLAP_SLOTS: readonly OverlapSlot[] = ['prefix', 'suffix'];

/** The two affixes the predicate reads. A crafted tracked entry satisfies it. */
export interface OverlapAffixes {
  readonly prefix: ModifierRef;
  readonly suffix: ModifierRef;
}

/** Whether one scoped entry of the slot's pool contains both references (§2.2). */
export type CoOccur = (x: ModifierRef, y: ModifierRef, slot: OverlapSlot) => boolean;

/** The within-file `coOccur`: the tracked list alone cannot see a pool. */
export const NEVER_CO_OCCUR: CoOccur = () => false;

/** Which §2.1 branch made a slot overlap. */
export type SlotOverlapBranch = 'co-occur' | 'both-valueless' | 'bands-intersect';

/** The branch that made the slot overlap, or `undefined` when the slot does not overlap. */
export function slotOverlapBranch(
  x: ModifierRef,
  y: ModifierRef,
  slot: OverlapSlot,
  coOccur: CoOccur,
): SlotOverlapBranch | undefined {
  if (x.statId !== y.statId && coOccur(x, y, slot)) {
    return 'co-occur';
  }
  if (x.statId !== y.statId) {
    return undefined;
  }
  if (x.kind === 'valueless' && y.kind === 'valueless') {
    return 'both-valueless';
  }
  if (x.kind === 'banded' && y.kind === 'banded') {
    return x.valueMin <= y.valueMax && y.valueMin <= x.valueMax ? 'bands-intersect' : undefined;
  }
  return undefined;
}

export function slotOverlap(
  x: ModifierRef,
  y: ModifierRef,
  slot: OverlapSlot,
  coOccur: CoOccur,
): boolean {
  return slotOverlapBranch(x, y, slot, coOccur) !== undefined;
}

/** `overlap(a, b) ⇔ slotOverlap(a.prefix, b.prefix) ∧ slotOverlap(a.suffix, b.suffix)`. */
export function overlap(a: OverlapAffixes, b: OverlapAffixes, coOccur: CoOccur): boolean {
  return OVERLAP_SLOTS.every((slot) => slotOverlap(a[slot], b[slot], slot, coOccur));
}

/**
 * Each slot's branch when the two entries overlap, or `undefined` when they
 * do not. A payload names the slots from it.
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
  'co-occur': 'the two statIds co-occur on one scoped entry',
  'both-valueless': 'both valueless',
  'bands-intersect': 'bands intersect',
};

/** `prefix (bands intersect), suffix (both valueless)`: the slots a payload names. */
export function describeOverlap(branches: Readonly<Record<OverlapSlot, SlotOverlapBranch>>): string {
  return OVERLAP_SLOTS.map((slot) => `${slot} (${BRANCH_WORDS[branches[slot]]})`).join(', ');
}
