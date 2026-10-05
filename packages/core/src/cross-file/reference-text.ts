import type { ModifierReference, ModifierWeight } from '@poe/contracts';

import type { ReferenceLine, Slot } from '../probability.ts';

function lineText(rl: ReferenceLine): string {
  return 'valueMin' in rl
    ? `${rl.statId} band [${String(rl.valueMin)}, ${String(rl.valueMax)}]`
    : `${rl.statId} valueless`;
}

/** A reference as a payload names it: the slot, then each line's `statId` and band or kind. */
export function formatReference(slot: Slot, reference: ModifierReference): string {
  return reference.kind === 'hybrid' ? `${slot} hybrid (${reference.lines.map((line) => lineText(line)).join(', ')})` : `${slot} ${lineText(reference)}`;
}

/** One line of a reference, as a per-line payload names it (§2.3, §2.4). */
export function formatLine(slot: Slot, reference: ModifierReference, rl: ReferenceLine): string {
  return reference.kind === 'hybrid' ? `${slot} hybrid line ${lineText(rl)}` : `${slot} ${lineText(rl)}`;
}

export function tierIds(entries: readonly ModifierWeight[]): string {
  return entries.map((entry) => entry.sourceModifierId).join(', ');
}

export function setText(ids: readonly string[]): string {
  return `{${ids.join(', ')}}`;
}
