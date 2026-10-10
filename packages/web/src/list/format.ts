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

/** State 20: a priced entry below the threshold, shown, never hidden (EXPERIENCE.md Copy Deck). */
export const BELOW_THRESHOLD_NOTE = 'below threshold';

/** The curation marks (EXPERIENCE.md Copy Deck). `active` prints nothing (state 8). */
export const CURATION_MARKS = { pinned: '* pinned', pruned: '† pruned' } as const;

/** The ≈ context sentence after the name of a `uniform-prior` row (EXPERIENCE.md Copy Deck, state 12). */
export const ESTIMATED_ODDS_CONTEXT = 'Some roll odds are estimated: no published weight for one mod tier. All prices below are real listings.';

/** The remainder affordance, closed: N counts the hidden lines without the pruned ones (state 39). */
export function moreLinesCopy(hidden: number): string {
  return `${glyphs.open} ${String(hidden)} more combinations`;
}

/** The remainder affordance, open (Interaction 7). */
export const FEWER_LINES_COPY = `${glyphs.close} show fewer`;

/** The pruned affordance (Interaction 3), its sign `+` closed and `−` open (DESIGN.md `show-more`). */
export function prunedCopy(count: number, isOpen: boolean): string {
  return `${isOpen ? glyphs.close : glyphs.open} ${String(count)} pruned`;
}
