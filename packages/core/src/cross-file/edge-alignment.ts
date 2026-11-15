import { linesOf } from '@poe/contracts';
import type { ModifierReference, ModifierWeight, WeightsPool } from '@poe/contracts';

import { containedIn, interval, ownInterval } from '../probability.ts';
import type { Slot } from '../probability.ts';
import { formatLine, tierIds } from './reference-text.ts';
import type { SlotScope } from './slot-scope.ts';

/** Per banded line: the detail when its edges are not the extremes of the contained lines; the lower edge may be an own minimum (AD-17). */
export function edgeAlignment(slot: Slot, reference: ModifierReference, { scoped, pool }: SlotScope, floor: number): string | undefined {
  const contained = containedIn(reference, scoped, pool);
  if (contained.length === 0) {
    return undefined;
  }
  const parts: string[] = [];
  for (const rl of linesOf(reference)) {
    if (!('valueMin' in rl)) {
      continue;
    }
    const { min, ownMin, max } = extremesOn(rl.statId, contained, pool);
    if ((rl.valueMin === min || rl.valueMin === ownMin) && rl.valueMax === max) {
      continue;
    }
    parts.push(
      `${formatLine(slot, reference, rl)} at floor ${String(floor)}: its edges are not the extremes [${String(min)}, ${String(max)}] (own minimum ${String(ownMin)}) of the tiers it contains (${tierIds(contained)})`,
    );
  }
  return parts.length === 0 ? undefined : parts.join('; ');
}

/** The lowest interval and own minimum, and the highest maximum, among the contained entries' lines on one `statId`. */
function extremesOn(
  statId: string,
  contained: readonly ModifierWeight[],
  pool: WeightsPool,
): { readonly min: number; readonly ownMin: number; readonly max: number } {
  let min = Infinity;
  let ownMin = Infinity;
  let max = -Infinity;
  for (const entry of contained) {
    for (const line of entry.lines) {
      if (line.statId !== statId) {
        continue;
      }
      const derived = interval(line);
      min = Math.min(min, derived.min);
      ownMin = Math.min(ownMin, ownInterval(line, entry, pool).min);
      max = Math.max(max, derived.max);
    }
  }
  return { min, ownMin, max };
}
