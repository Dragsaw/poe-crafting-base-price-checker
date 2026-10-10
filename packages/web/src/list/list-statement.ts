import type { Ranking } from '@poe/core';

import { formatThreshold } from '../shared/money';
import { DIV_UNIT } from '../shared/product';
import type { ActiveRanking } from './active-ranking';

/** The list's one statement, at most one printed (EXPERIENCE.md states 23, 25, 35). */
export type ListStatement =
  | { readonly kind: 'honest-empty'; readonly text: string }
  | { readonly kind: 'uncostable'; readonly text: string }
  | { readonly kind: 'nothing-clears'; readonly text: string }
  | { readonly kind: 'none' };

/** State 23's copy; a list of only broken rows drops "yet": no sync will price them. */
export function honestEmptyCopy(league: string, isNeverPriced = false): string {
  return `In canonical order, not ranked: no tracked unit has a price from ${league}${isNeverPriced ? '' : ' yet'}.`;
}

/** State 25's copy: the live threshold at the page's 2dp. */
export function nothingClearsCopy(threshold: number): string {
  return `Nothing clears your Payout Threshold of ${formatThreshold(threshold)} ${DIV_UNIT}.`;
}

/** State 35's copy (EXPERIENCE.md Copy Deck). */
export function uncostableCopy(recipeWord: string): string {
  return `The ${recipeWord} Craft Recipe has no Craft Cost figure yet: Item Classes and Raw Bases are ordered apart, not ranked against each other.`;
}

/** State 23's predicate, shared with `toDisplayRows`; it outranks states 35 and 25. */
export function isHonestEmpty(ranking: Ranking): boolean {
  return (
    !ranking.pricedInLeague &&
    // The rows the list prints when nothing is priced: the active recipe's crafted rows, then
    // `noListings`, `notYetSynced`, `unresolvable` and `recipeless`. Unpriced, no Raw Base is in the ordering.
    ranking.ordering.length +
      ranking.noListings.length +
      ranking.notYetSynced.length +
      ranking.unresolvable.length +
      ranking.recipeless.length >
      0
  );
}

/** State 23 drops "yet" on core's verdict (AD-17): a pending row may still be priced by a sync, a broken one never. */
function isEveryRowBroken(ranking: Ranking): boolean {
  return [ranking.ordering, ranking.noListings, ranking.notYetSynced, ranking.unresolvable, ranking.recipeless]
    .flat()
    .every((row) => row.trust.verdict === 'broken');
}

/** State 25's predicate: nothing clears, while something is on the list to say it of. */
function isNothingClearing(ranking: Ranking): boolean {
  const hasCleared = ranking.ordering.some((row) => row.kind === 'raw' || row.summands.length > 0);
  return !hasCleared && (ranking.belowThreshold.length > 0 || ranking.ordering.length > 0);
}

/** Never re-ranks. Check order is the precedence (states 23, 35, 25); else no statement. */
export function listStatement(
  ranking: Ranking & Partial<Pick<ActiveRanking, 'split' | 'recipe'>>,
  threshold: number,
  league: string,
): ListStatement {
  if (isHonestEmpty(ranking)) {
    return { kind: 'honest-empty', text: honestEmptyCopy(league, isEveryRowBroken(ranking)) };
  }
  if (ranking.split === true && ranking.recipe !== undefined) {
    return { kind: 'uncostable', text: uncostableCopy(ranking.recipe.word) };
  }
  return isNothingClearing(ranking) ? { kind: 'nothing-clears', text: nothingClearsCopy(threshold) } : { kind: 'none' };
}
