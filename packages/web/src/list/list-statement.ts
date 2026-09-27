import type { Ranking } from '@poe/core';

/**
 * The one statement the list makes about itself, above the column header
 * (EXPERIENCE.md states 23 and 25). The two are mutually exclusive, so one
 * chrome slot, `frameReserveListStatement`, serves both.
 */
export type ListStatement =
  | { readonly kind: 'honest-empty'; readonly text: string }
  | { readonly kind: 'nothing-clears'; readonly text: string }
  | { readonly kind: 'none' };

/** State 23's copy (Story 2.7 decision, 2026-09-27). */
export function honestEmptyCopy(league: string): string {
  return `In canonical order, not ranked: no tracked unit has a price from ${league} yet.`;
}

/** State 25's copy (Story 2.7 decision, 2026-09-27): the live threshold at the page's 2dp. */
export function nothingClearsCopy(threshold: number): string {
  return `Nothing clears your Payout Threshold of ${threshold.toFixed(2)} Divine.`;
}

/**
 * State 23's predicate, the one definition the statement and the row order share:
 * nothing is priced in the active league — `ordering` and `belowThreshold` are
 * both empty — and the list still has an unpriced row to show. While it holds,
 * `toDisplayRows` prints the unpriced rows in canonical key order, so the
 * statement's "In canonical order" is true.
 */
export function isHonestEmpty(ranking: Ranking): boolean {
  return (
    ranking.ordering.length === 0 &&
    ranking.belowThreshold.length === 0 &&
    // The rows the list prints when nothing is priced: `noListings`, `notYetSynced`, then `unresolvable`.
    ranking.noListings.length + ranking.notYetSynced.length + ranking.unresolvable.length > 0
  );
}

/**
 * A pure predicate over `core`'s ranking; it never re-ranks.
 *
 * - Honest-empty (state 23): when `isHonestEmpty` holds.
 * - Nothing-clears (state 25): something is priced, and all of it is below the
 *   threshold.
 * - Otherwise, including a partial refresh (state 24) and an empty Tracked
 *   List, the list makes no statement.
 */
export function listStatement(ranking: Ranking, threshold: number, league: string): ListStatement {
  if (isHonestEmpty(ranking)) {
    return { kind: 'honest-empty', text: honestEmptyCopy(league) };
  }
  if (ranking.ordering.length === 0 && ranking.belowThreshold.length > 0) {
    return { kind: 'nothing-clears', text: nothingClearsCopy(threshold) };
  }
  return { kind: 'none' };
}
