import type { Ranking } from '@poe/core';

import { formatThreshold } from '../shared/money';
import { DENOMINATION } from '../shared/product';
import type { ActiveRanking } from './active-ranking';

/**
 * The one statement the list makes about itself, above the column header
 * (EXPERIENCE.md states 23, 25 and 35). One chrome slot,
 * `frameReserveListStatement`, serves all three, so at most one prints:
 * honest-empty, then uncostable, then nothing-clears (a provisional
 * precedence, Story 3.4).
 */
export type ListStatement =
  | { readonly kind: 'honest-empty'; readonly text: string }
  | { readonly kind: 'uncostable'; readonly text: string }
  | { readonly kind: 'nothing-clears'; readonly text: string }
  | { readonly kind: 'none' };

/**
 * State 23's copy (Story 2.7 decision, 2026-09-27). A list of only
 * `unresolvable` rows drops "yet", because no sync will bring a price
 * (EXPERIENCE.md revision 9, the paragraph after the State Patterns table).
 */
export function honestEmptyCopy(league: string, isOnlyUnresolvable = false): string {
  return `In canonical order, not ranked: no tracked unit has a price from ${league}${isOnlyUnresolvable ? '' : ' yet'}.`;
}

/** State 25's copy (Story 2.7 decision, 2026-09-27): the live threshold at the page's 2dp. */
export function nothingClearsCopy(threshold: number): string {
  return `Nothing clears your Payout Threshold of ${formatThreshold(threshold)} ${DENOMINATION}.`;
}

/**
 * State 35's copy (provisional, Story 3.4): it names the active recipe and
 * states that the two branches are not comparable while it holds.
 */
export function uncostableCopy(recipeWord: string): string {
  return `The ${recipeWord} Craft Recipe has no Craft Cost figure yet: Item Classes and Raw Bases are ordered apart, not ranked against each other.`;
}

/**
 * State 23's predicate, the one definition the statement and the row order share:
 * nothing tracked is priced in the active league (`core`'s `pricedInLeague`),
 * and the list still has a row to show — an unpriced Raw Base, or a crafted
 * row of the active recipe. While it holds, `toDisplayRows` prints every row in
 * canonical key order, so the statement's "In canonical order" is true. It
 * takes precedence over states 35 and 25.
 */
export function isHonestEmpty(ranking: Ranking): boolean {
  return (
    !ranking.pricedInLeague &&
    // The rows the list prints when nothing is priced: the active recipe's crafted rows, then
    // `noListings`, `notYetSynced` and `unresolvable`. Unpriced, no Raw Base is in the ordering.
    ranking.ordering.length + ranking.noListings.length + ranking.notYetSynced.length + ranking.unresolvable.length > 0
  );
}

/**
 * State 25's predicate: nothing clears the threshold. No Raw Base is in the
 * ordering and no crafted row has a summand, while something is on the list
 * to say it of — a Raw Base below the threshold, or a crafted row ranked at
 * minus its Craft Cost, whose numeral still prints.
 */
function isNothingClearing(ranking: Ranking): boolean {
  const hasCleared = ranking.ordering.some((row) => row.kind === 'raw' || row.summands.length > 0);
  return !hasCleared && (ranking.belowThreshold.length > 0 || ranking.ordering.length > 0);
}

/**
 * A pure predicate over `core`'s ranking, narrowed to the active recipe
 * (`forRecipe`); it never re-ranks.
 *
 * - Honest-empty (state 23): when `isHonestEmpty` holds.
 * - Uncostable (state 35): the active recipe is uncostable and a crafted row
 *   is on the list.
 * - Nothing-clears (state 25): see `isNothingClearing`.
 * - Otherwise, including a partial refresh (state 24) and an empty Tracked
 *   List, the list makes no statement.
 */
export function listStatement(
  ranking: Ranking & Partial<Pick<ActiveRanking, 'split' | 'recipe'>>,
  threshold: number,
  league: string,
): ListStatement {
  if (isHonestEmpty(ranking)) {
    // Every row the list shows is `unresolvable` when no crafted row and neither other unpriced group remains.
    const isOnlyUnresolvable =
      ranking.ordering.length === 0 && ranking.noListings.length === 0 && ranking.notYetSynced.length === 0;
    return { kind: 'honest-empty', text: honestEmptyCopy(league, isOnlyUnresolvable) };
  }
  if (ranking.split === true && ranking.recipe !== undefined) {
    return { kind: 'uncostable', text: uncostableCopy(ranking.recipe.word) };
  }
  return isNothingClearing(ranking) ? { kind: 'nothing-clears', text: nothingClearsCopy(threshold) } : { kind: 'none' };
}
