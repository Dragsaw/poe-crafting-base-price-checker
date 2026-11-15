import { linesOf } from '@poe/contracts';
import type { ModifierReference, ModifierWeight, WeightsLine } from '@poe/contracts';

import type { ReferenceLine, Slot } from '../probability.ts';
import { formatLine } from './reference-text.ts';
import type { SlotScope } from './slot-scope.ts';

/** `disagrees(rl, line)`: a valueless reference line beside a banded line, same `statId`. */
function isDisagreeing(rl: ReferenceLine, line: WeightsLine): boolean {
  return line.statId === rl.statId && !('valueMin' in rl) && line.ranges.length > 0;
}

/** Per line: the detail when a valueless reference line meets a banded scoped line. */
export function kindAgreement(
  slot: Slot,
  reference: ModifierReference,
  { scoped }: SlotScope,
  level: number,
): string | undefined {
  const parts: string[] = [];
  for (const rl of linesOf(reference)) {
    const found = disagreementsOn(rl, scoped);
    if (found === undefined) {
      continue;
    }
    const { count, first } = found;
    parts.push(
      `${formatLine(slot, reference, rl)} at item level ${String(level)}: ${String(count)} scoped ${count === 1 ? 'line' : 'lines'} on that statId ${count === 1 ? 'is' : 'are'} banded (e.g. ${first.sourceModifierId})`,
    );
  }
  return parts.length === 0 ? undefined : parts.join('; ');
}

/** How many positive-weight scoped lines disagree with `rl`, and the first tier, or `undefined`. */
function disagreementsOn(
  rl: ReferenceLine,
  scoped: readonly ModifierWeight[],
): { readonly count: number; readonly first: ModifierWeight } | undefined {
  let count = 0;
  let first: ModifierWeight | undefined;
  for (const entry of scoped) {
    if (entry.weight === 0) {
      continue;
    }
    const here = entry.lines.filter((line) => isDisagreeing(rl, line)).length;
    if (here === 0) {
      continue;
    }
    count += here;
    first ??= entry;
  }
  return first === undefined ? undefined : { count, first };
}
