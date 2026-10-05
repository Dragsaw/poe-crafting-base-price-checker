import { linesOf } from '@poe/contracts';
import type { ModifierReference, ModifierWeight } from '@poe/contracts';

import { containedIn, interval } from '../probability.ts';
import type { Slot } from '../probability.ts';
import { formatLine, tierIds } from './reference-text.ts';

/** §2.4, per banded line: the detail when its edges are not the extremes of the contained lines. */
export function edgeAlignment(
  slot: Slot,
  reference: ModifierReference,
  scoped: readonly ModifierWeight[],
  floor: number,
): string | undefined {
  const contained = containedIn(reference, scoped);
  if (contained.length === 0) {
    return undefined;
  }
  const parts: string[] = [];
  for (const rl of linesOf(reference)) {
    if (!('valueMin' in rl)) {
      continue;
    }
    const { min, max } = extremesOn(rl.statId, contained);
    if (rl.valueMin === min && rl.valueMax === max) {
      continue;
    }
    parts.push(
      `${formatLine(slot, reference, rl)} at floor ${String(floor)}: its edges are not the extremes [${String(min)}, ${String(max)}] of the tiers it contains (${tierIds(contained)})`,
    );
  }
  return parts.length === 0 ? undefined : parts.join('; ');
}

/** The lowest and highest interval edge among the contained entries' lines on one `statId`. */
function extremesOn(statId: string, contained: readonly ModifierWeight[]): { readonly min: number; readonly max: number } {
  let min = Infinity;
  let max = -Infinity;
  const lines = contained.flatMap((entry) => entry.lines);
  for (const line of lines) {
    if (line.statId !== statId) {
      continue;
    }
    const derived = interval(line);
    min = Math.min(min, derived.min);
    max = Math.max(max, derived.max);
  }
  return { min, max };
}
