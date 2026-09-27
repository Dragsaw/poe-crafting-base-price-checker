/**
 * Product-owned numbers the page reads in more than one folder. Each value's
 * owner is the PRD requirement its comment cites.
 */

/** The top-N bound. A display slice only: `core` ranks the full Tracked List (FR-5). */
export const TOP_ROWS = 20;

/** The Payout Threshold the page starts at, in Divine (FR-7). Story 2.4 makes it editable. */
export const DEFAULT_THRESHOLD = 0.25;

/**
 * The one denomination word the page prints (PRD §3, AD-24, AD-20). A `web`
 * constant, never read from `catalogue/static.json`, whose label is `Divine Orb`.
 */
export const DENOMINATION = 'Divine';
