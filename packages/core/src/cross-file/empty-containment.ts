import { linesOf } from '@poe/contracts';
import type { ModifierReference, ModifierWeight } from '@poe/contracts';

import { isContaining, isCovering, lineSet, statIds, isUntrackable } from '../probability.ts';
import type { Slot } from '../probability.ts';
import { COMPLETE } from './complete-pool.ts';
import { formatReference, setText } from './reference-text.ts';

/** The entries excluded from a hybrid reference's containment set. */
function hybridExclusions(reference: ModifierReference, scoped: readonly ModifierWeight[]): string[] {
  const named = statIds(reference);
  const lines = linesOf(reference);
  const excluded: string[] = [];
  for (const entry of scoped) {
    const tierSet = lineSet(entry);
    if (isUntrackable(entry, COMPLETE)) {
      if (named.every((statId) => tierSet.includes(statId))) {
        excluded.push(`${entry.sourceModifierId} (not-in-game)`);
      }
      continue;
    }
    if (lines.some((rl) => entry.lines.every((line) => !isCovering(rl, line)))) {
      continue;
    }
    // Covering every line means carrying every named statId, so only the tier's extra lines differ.
    const differ = tierSet.filter((statId) => !named.includes(statId));
    if (differ.length > 0) {
      excluded.push(`${entry.sourceModifierId} (line set ${setText(tierSet)} differs on ${differ.join(', ')})`);
    }
  }
  return excluded;
}

/** The detail when no scoped entry contains the reference, never `P = 0`. */
export function emptyContainment(
  slot: Slot,
  reference: ModifierReference,
  scoped: readonly ModifierWeight[],
  floor: number,
): string | undefined {
  if (scoped.some((entry) => isContaining(reference, entry))) {
    return undefined;
  }
  const head = `${formatReference(slot, reference)} at floor ${String(floor)}: no scoped entry contains it`;
  if (reference.kind === 'hybrid') {
    const excluded = hybridExclusions(reference, scoped);
    return excluded.length === 0 ? head : `${head}; excluded: ${excluded.join(', ')}`;
  }
  const carrying = scoped.filter(
    (entry) => entry.weight > 0 && entry.lines.some((line) => line.statId === reference.statId),
  ).length;
  return `${head} (${String(carrying)} scoped ${carrying === 1 ? 'entry carries' : 'entries carry'} that statId)`;
}
