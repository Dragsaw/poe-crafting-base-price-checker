import type { DatasetEntry, NotYetSyncedReason } from '@poe/contracts';

import { formatDivine, formatThreshold } from '../shared/money';
import { DENOMINATION } from '../shared/product';
import { plural } from '../shared/text';
import { exactAge } from '../shared/time';
import { glyphs } from '../theme/tokens';

// `web` computes no ranking term (AD-4): every helper here turns a held value into text.

/** The five money-slot phrases (EXPERIENCE.md, Money slots). A missing figure is never `0`. */
export const MONEY_PHRASES = {
  noListings: 'an open question',
  notYetSynced: 'no figure yet',
  unresolvable: 'not valued',
  unknown: 'unknown',
  pruned: 'not tracked',
} as const;

const DEFENCE_WORDS: Readonly<Record<string, string>> = { str: 'Str', dex: 'Dex', int: 'Int' };

/** Only the label changes; the stored `className` stays the identity (AD-5). EXPERIENCE.md *Item Class labels*. */
export function unitLabel(className: string): string {
  const words = className.split('_');
  let cut = words.length;
  while (cut > 1 && DEFENCE_WORDS[words[cut - 1] ?? ''] !== undefined) {
    cut -= 1;
  }
  const name = words.slice(0, cut).join(' ');
  const defences = words.slice(cut).map((word) => DEFENCE_WORDS[word] ?? word);
  return defences.length === 0 ? name : `${name} (${defences.join('/')})`;
}

/** The lead words of the Raw Base row's chase slot (EXPERIENCE.md Copy Deck). */
export const SELL_AS_IS = 'Sell as is';

/** The Item Level Floor as the sell-as-is line spells it. */
export function itemLevelFloor(itemLevelMin: number): string {
  return `item level ${String(itemLevelMin)}+`;
}

/** The Raw Base row's chase slot: `Sell as is · item level 82+` (EXPERIENCE.md Copy Deck). */
export function sellAsIsLine(itemLevelMin: number): string {
  return `${SELL_AS_IS} · ${itemLevelFloor(itemLevelMin)}`;
}

// --- the expansion panel ---------------------------------------------------

/** `core`'s resolved state, not the stored one: a league mismatch is `not-yet-synced` (FR-31). */
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

// Verbatim from EXPERIENCE.md states 2, 4, 5, 6 and 7. State 4 names no id kind: one wording.
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

// A priced non-summand is below the threshold (state 20): `core` sums every entry at or above it.
export function craftedCombinationNote(state: CombinationState, isSummand: boolean): string {
  switch (state.state) {
    case 'priced': {
      return isSummand ? '' : BELOW_THRESHOLD_NOTE;
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

// Resolved as `core` resolves a Raw Base's (AD-9, AD-19, FR-31). No threshold is read here.
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

// `priced …` shows only on a printed state of `priced`; a never-synced entry has none (state 5).
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

/** Mockup `key-expanded-states.html`, the Raw Base panel. */
export function rawPanelSubLine(itemLevelMin: number, threshold: number): string {
  return [
    `Uncrafted at Item Level ${String(itemLevelMin)}, valued at its own current asking price and not at a craft outcome.`,
    'One Combination is tracked here: the degenerate Combination of no affixes.',
    `Payout Threshold ${formatThreshold(threshold)} ${DENOMINATION}.`,
    RAW_NO_RECIPE_SENTENCE,
    PANEL_ASKING_SENTENCE,
  ].join(' ');
}

// EXPERIENCE.md `{components.expansion-panel}`; mockup `key-expanded-states.html`, the Rings panel.
// Provisional: the crafted sub-line has no verbatim owner.
export function classPanelSubLine(threshold: number, recipeWord: string): string {
  return `Payout Threshold ${formatThreshold(threshold)} ${DENOMINATION} | Craft Recipe ${recipeWord}. ${PANEL_ASKING_SENTENCE}`;
}
