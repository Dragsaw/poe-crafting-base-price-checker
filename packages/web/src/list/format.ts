import type { DatasetEntry, NotYetSyncedReason } from '@poe/contracts';

import { formatDivine, formatThreshold } from '../shared/money';
import { DENOMINATION } from '../shared/product';
import { plural } from '../shared/text';
import { exactAge, HOUR_MS } from '../shared/time';
import { glyphs } from '../theme/tokens';

/**
 * Pure view helpers for the ranked list. `web` computes no ranking term (AD-4):
 * everything here turns a value `core` or the dataset already holds into text.
 */

/** The freshness cut-off, in hours (AD-10, FR-12). A younger row shows no age. */
export const FRESHNESS_CUTOFF_HOURS = 48;

/** The five money-slot phrases (EXPERIENCE.md, Money slots). A missing figure is never `0`. */
export const MONEY_PHRASES = {
  noListings: 'an open question',
  notYetSynced: 'no figure yet',
  unresolvable: 'not valued',
  unknown: 'unknown',
  pruned: 'not tracked',
} as const;

/** A trust mark in the Age cell: the stale mark names its clock; the never mark has no age. */
export type AgeMark =
  | { readonly kind: 'stale'; readonly word: string }
  | { readonly kind: 'never'; readonly word: 'never attempted' };

export const NEVER_ATTEMPTED = 'never attempted';

/**
 * The Age cell (FR-12, AD-9, AD-10). The clock follows the row's resolved
 * Price State, not the stored one: `observedAt` only where the row prints
 * `priced`, and `lastAttemptedAt` otherwise. A league-mismatched observation
 * resolves to `not-yet-synced`, so it reads `lastAttemptedAt`, the same clock
 * as the expansion's `tried …` age. Neither clock: *never attempted*.
 * Younger than the cut-off: no mark at all. At or past it: `priced Nd ago` /
 * `tried Nd ago`, N = floor(hours / 24).
 */
export function ageMark(
  state: CombinationState,
  lastAttemptedAt: string | undefined,
  now: number,
): AgeMark | undefined {
  const priced = state.state === 'priced' ? state.observedAt : undefined;
  const clock = priced ?? lastAttemptedAt;
  if (clock === undefined) {
    return { kind: 'never', word: NEVER_ATTEMPTED };
  }
  const hours = (now - Date.parse(clock)) / HOUR_MS;
  if (hours >= FRESHNESS_CUTOFF_HOURS) {
    const days = Math.floor(hours / 24);
    return { kind: 'stale', word: `${priced === undefined ? 'tried' : 'priced'} ${String(days)}d ago` };
  }
  return undefined;
}

/**
 * An Item Class's printed label: each underscore becomes a space and nothing
 * else changes (AD-5). The stored `className` stays the identity; only the
 * label is trimmed.
 */
export function unitLabel(className: string): string {
  return className.replaceAll('_', ' ');
}

/** The Raw Base row's note, spelling the Item Level Floor (DESIGN.md `raw-base-row`). */
export function rawNote(itemLevelMin: number): string {
  return `uncrafted at Item Level ${String(itemLevelMin)} — valued at its own current asking price, not at a craft outcome`;
}

// --- the expansion panel ---------------------------------------------------

/**
 * The Price State a combination row prints: the row's own state as `core`
 * resolved it, not the stored one. A league-mismatched observation is stored
 * `priced` and prints `not-yet-synced · league-mismatch` (FR-31); an entry the
 * dataset does not hold prints `not-yet-synced · never-synced`.
 */
export type CombinationState =
  | { readonly state: 'priced'; readonly priceDivine: number; readonly sampleSize: number; readonly observedAt: string }
  | { readonly state: 'no-listings' }
  | { readonly state: 'not-yet-synced'; readonly reason: NotYetSyncedReason }
  | { readonly state: 'unresolvable' };

/** `{components.price-state-glyph}`. The glyph never prints without its word. */
export const PRICE_STATE_GLYPHS = {
  priced: glyphs.priced,
  'no-listings': glyphs.noListings,
  'not-yet-synced': glyphs.notYetSynced,
  unresolvable: glyphs.unresolvable,
} as const;

/** The state word, with ` · <reason>` for `not-yet-synced` (FR-9: the reason is displayed, not merely stored). */
export function stateWord(state: CombinationState): string {
  return state.state === 'not-yet-synced' ? `${state.state} · ${state.reason}` : state.state;
}

/**
 * Line two's notes, from EXPERIENCE.md states 2, 4, 5, 6 and 7 verbatim. State
 * 4's note names no id kind, so one wording serves every `unresolvable` row, a
 * Raw Base or a Combination (EXPERIENCE.md revision 9).
 */
export const STATE_NOTES = {
  'no-listings': 'nobody is listing this right now — a jackpot and junk look alike here',
  unresolvable: 'its id is gone from the trade API — a patch did this',
  'never-synced': 'no request was ever issued for this entry',
  'league-mismatch': 'the observation belongs to another league',
  'no-exchange-rate': 'the listing currency had no rate at sync time',
} as const;

/** A Raw Base's single combination (DESIGN.md `raw-base-row.expansionNote`). */
export const NO_AFFIXES = 'no affixes';

/** The priced Raw Base combination's note, spelling its Item Level Floor. */
export function rawExpansionNote(itemLevelMin: number): string {
  return `${NO_AFFIXES} — this Base Type priced as it drops, at Item Level ${String(itemLevelMin)}`;
}

/** Line two's note for a Raw Base: the raw note when priced; otherwise the state's own note replaces it. */
export function rawCombinationNote(state: CombinationState, itemLevelMin: number): string {
  switch (state.state) {
    case 'priced': {
      return rawExpansionNote(itemLevelMin);
    }
    case 'no-listings': {
      return STATE_NOTES['no-listings'];
    }
    case 'not-yet-synced': {
      return STATE_NOTES[state.reason];
    }
    case 'unresolvable': {
      return STATE_NOTES.unresolvable;
    }
  }
}

/** State 20: a priced entry below the threshold. Shown, never hidden, never greyed (EXPERIENCE.md). */
export const BELOW_THRESHOLD_NOTE = 'below the threshold — adds nothing to EV';

/**
 * Line two's note for a crafted entry. A summand's note is empty. A priced
 * entry that is not a summand is below the threshold (state 20), because
 * `core` sums every entry priced in the active league at or above it. Every
 * other state takes its own state note, as a Raw Base's does.
 */
export function craftedCombinationNote(state: CombinationState, summand: boolean): string {
  switch (state.state) {
    case 'priced': {
      return summand ? '' : BELOW_THRESHOLD_NOTE;
    }
    case 'no-listings': {
      return STATE_NOTES['no-listings'];
    }
    case 'not-yet-synced': {
      return STATE_NOTES[state.reason];
    }
    case 'unresolvable': {
      return STATE_NOTES.unresolvable;
    }
  }
}

/**
 * The Price State a crafted entry's combination row prints, resolved as
 * `core` resolves a Raw Base's: no dataset entry is `not-yet-synced ·
 * never-synced`, and an observation from another league is `not-yet-synced ·
 * league-mismatch` (AD-9, AD-19, FR-31). Every other stored state prints as
 * stored. No threshold is read here.
 */
export function resolvedState(entry: DatasetEntry | undefined, activeLeague: string): CombinationState {
  if (entry === undefined) {
    return { state: 'not-yet-synced', reason: 'never-synced' };
  }
  const { price } = entry;
  if (price.state !== 'priced') {
    return price;
  }
  const { observation } = price;
  if (observation.league !== activeLeague) {
    return { state: 'not-yet-synced', reason: 'league-mismatch' };
  }
  return {
    state: 'priced',
    priceDivine: observation.priceDivine,
    sampleSize: observation.sampleSize,
    observedAt: observation.observedAt,
  };
}

/** The figure cell: a figure at 2dp (or `< 0.01`), or the money-slot phrase naming the open question. */
export function combinationFigure(
  state: CombinationState,
): { readonly kind: 'figure' | 'phrase'; readonly text: string } {
  switch (state.state) {
    case 'priced': {
      return { kind: 'figure', text: formatDivine(state.priceDivine) };
    }
    case 'no-listings': {
      return { kind: 'phrase', text: MONEY_PHRASES.noListings };
    }
    case 'not-yet-synced': {
      return { kind: 'phrase', text: MONEY_PHRASES.notYetSynced };
    }
    case 'unresolvable': {
      return { kind: 'phrase', text: MONEY_PHRASES.unresolvable };
    }
  }
}

/** The sample cell: the listing count the figure rested on. */
export function sampleText(state: CombinationState): string {
  switch (state.state) {
    case 'priced': {
      return `${String(state.sampleSize)} ${plural(state.sampleSize, 'listing', 'listings')}`;
    }
    case 'no-listings': {
      return '0 listings found';
    }
    case 'not-yet-synced':
    case 'unresolvable': {
      return 'no sample';
    }
  }
}

/**
 * Line two's two labelled ages. `priced …` reads `observedAt` and shows only
 * on a row whose printed state is `priced`; `tried …` reads `lastAttemptedAt`.
 * A missing clock leaves its cell empty, and a never-synced entry leaves both
 * empty — the one row with no age at all (state 5).
 */
export interface CombinationAges {
  readonly observed: string | undefined;
  readonly attempted: string | undefined;
}

export function combinationAges(
  state: CombinationState,
  lastAttemptedAt: string | undefined,
  now: number,
): CombinationAges {
  if (state.state === 'not-yet-synced' && state.reason === 'never-synced') {
    return { observed: undefined, attempted: undefined };
  }
  return {
    observed: state.state === 'priced' ? `priced ${exactAge(state.observedAt, now)} ago` : undefined,
    attempted: lastAttemptedAt === undefined ? undefined : `tried ${exactAge(lastAttemptedAt, now)} ago`,
  };
}

/** The asking-price framing, repeated so a panel read on its own cannot be misread (FR-13, UX-DR25). */
export const PANEL_ASKING_SENTENCE = 'Every price here is a current asking price from a live instant-buyout listing.';

/** The Raw Base panel's Craft Recipe sentence (mockup `key-expanded-states.html`, the Raw Base panel). */
export const RAW_NO_RECIPE_SENTENCE = 'No Craft Recipe applies — a Raw Base is sold, not crafted, so it carries no Craft Cost.';

/**
 * A Raw Base panel's context sub-line (mockup `key-expanded-states.html`, the
 * Raw Base panel), with its Craft Recipe sentence after the threshold.
 */
export function rawPanelSubLine(itemLevelMin: number, threshold: number): string {
  return [
    `Uncrafted at Item Level ${String(itemLevelMin)}, valued at its own current asking price and not at a craft outcome.`,
    'One Combination is tracked here: the degenerate Combination of no affixes.',
    `Payout Threshold ${formatThreshold(threshold)} ${DENOMINATION}.`,
    RAW_NO_RECIPE_SENTENCE,
    PANEL_ASKING_SENTENCE,
  ].join(' ');
}

/**
 * A crafted Item Class panel's context sub-line: the two things its figures
 * depend on, the threshold and the active Craft Recipe, then the asking-price
 * framing (EXPERIENCE.md `{components.expansion-panel}`; mockup
 * `key-expanded-states.html`, the Rings panel, whose lead sentence about the
 * Combinations listed waits for Story 3.5's rows). Provisional: the crafted
 * sub-line has no verbatim owner.
 */
export function classPanelSubLine(threshold: number, recipeWord: string): string {
  return `Payout Threshold ${formatThreshold(threshold)} ${DENOMINATION} | Craft Recipe ${recipeWord}. ${PANEL_ASKING_SENTENCE}`;
}
