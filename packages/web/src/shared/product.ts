/** Product-owned numbers read by more than one folder; each cites its PRD requirement. */

import type { CraftingItemLevel } from '@poe/core';

/** The top-N bound. A display slice only: `core` ranks the full Tracked List (FR-5). */
export const TOP_ROWS = 20;

/** The lines an expansion opens on (EXPERIENCE.md state 39). Every entry stays one click away (FR-8). */
export const TOP_LINES = 8;

/** The Payout Threshold the page starts at, in Divine (FR-7). Story 2.4 makes it editable. */
export const DEFAULT_THRESHOLD = 0.25;

/** The Crafting Item Level a first visit shows, and a stored value that is no offered level (FR-38; EXPERIENCE.md *What survives a reload*). */
export const FIRST_VISIT_CRAFTING_ITEM_LEVEL: CraftingItemLevel = 82;

/** The denomination word the page prints (PRD §3, AD-24, AD-20); not read from `static.json`. */
export const DENOMINATION = 'Divine';

/** The unit word after a figure in the header bar and the EV tooltip (EXPERIENCE.md, Mapping). */
export const DIV_UNIT = 'div';
