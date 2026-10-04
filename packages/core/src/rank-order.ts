import { compareCanonicalKeys } from '@poe/contracts';
import type { RankedRow } from '@poe/contracts';

/** Raw before crafted at an equal EV (AD-17). */
const KIND_ORDER: Readonly<Record<RankedRow['kind'], number>> = { raw: 0, crafted: 1 };

/** The serialised key a row breaks ties on: a raw row's canonical key, a crafted row's class key. */
function rowKey(row: RankedRow): string {
  return row.kind === 'raw' ? row.entryKey : row.classKey;
}

/** The tie-break at an equal EV (AD-17): kind first, since the canonical key's own kind tag sorts `crafted` first. */
export function compareRankedRows(left: RankedRow, right: RankedRow): number {
  const byKind = KIND_ORDER[left.kind] - KIND_ORDER[right.kind];
  if (byKind !== 0) {
    return byKind;
  }
  const byKey = compareCanonicalKeys(rowKey(left), rowKey(right));
  return byKey !== 0 || left.kind !== 'crafted' || right.kind !== 'crafted' ? byKey : compareCanonicalKeys(left.recipeId, right.recipeId);
}

/** The one ordering (AD-17, EXPERIENCE.md state 35): EV descending, `null` EV last by gross payout, ties by `compareRankedRows`. */
export function compareOrdering(left: RankedRow, right: RankedRow): number {
  const leftEvent = left.ev;
  const rightEvent = right.ev;
  if ((leftEvent === null) !== (rightEvent === null)) {
    return leftEvent === null ? 1 : -1;
  }
  const leftFigure = leftEvent ?? (left.kind === 'crafted' ? left.grossPayout : 0);
  const rightFigure = rightEvent ?? (right.kind === 'crafted' ? right.grossPayout : 0);
  return leftFigure === rightFigure ? compareRankedRows(left, right) : rightFigure - leftFigure;
}
