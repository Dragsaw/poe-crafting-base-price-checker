import type { PriceTrust, PriceTrustReason } from '@poe/contracts';

import { plural } from '../../shared/text';
import { reasonAge } from '../../shared/time';

/** The joiner between a word and its reason, and between two reasons (EXPERIENCE.md Copy Deck). */
export const TRUST_JOINER = ' · ';

/** The state words of EXPERIENCE.md *Price trust*. A current price has none. */
export const VERDICT_WORDS = { rough: 'rough', pending: 'pending', broken: 'broken' } as const;

type FixedReason = Exclude<PriceTrustReason['kind'], 'old' | 'thin' | 'unreliable-share'>;

/** *Price trust*'s Raw Base tooltip column and its crafted rules: the reasons that carry no figure. */
export const FIXED_ROW_REASONS: Readonly<Record<FixedReason, string>> = {
  'no-listings': 'no listings found',
  'never-synced': 'not checked yet',
  'league-mismatch': 'price from last league',
  'no-exchange-rate': 'no Divine rate for its currency',
  unresolvable: 'gone after a patch',
  'no-recipe': 'no recipe published',
  uncostable: 'no figure yet — craft cost unknown',
  'all-broken': 'all combinations gone after a patch',
  'no-prices': 'no prices yet',
};

/** One reason in the words of a ranked row's tooltip. */
export function rowReasonWords(reason: PriceTrustReason): string {
  switch (reason.kind) {
    case 'old': {
      return `priced ${String(reason.days)} days ago`;
    }
    case 'thin': {
      return `only ${String(reason.listings)} ${plural(reason.listings, 'listing', 'listings')}`;
    }
    case 'unreliable-share': {
      return `${String(reason.percent)}% of this EV rests on unreliable prices`;
    }
    default: {
      return FIXED_ROW_REASONS[reason.kind];
    }
  }
}

/** A trust verdict's word and its joined reasons; `undefined` when current. */
export interface TrustParts {
  readonly word: string;
  readonly reason: string;
}

function trustParts(trust: PriceTrust, words: (reason: PriceTrustReason) => string): TrustParts | undefined {
  return trust.verdict === 'current'
    ? undefined
    : { word: VERDICT_WORDS[trust.verdict], reason: trust.reasons.map((reason) => words(reason)).join(TRUST_JOINER) };
}

/** The mark tooltip's `<word> · <reason>`, the reasons in `core`'s order. */
export function markTooltipParts(trust: PriceTrust): TrustParts | undefined {
  return trustParts(trust, rowReasonWords);
}

/** The `no-listings` reason on an expansion line, which names its attempt clock (*Price trust*). */
export const NO_LISTINGS_LINE = 'no listings';

/** One reason in the words of an expansion line; only `no-listings` differs from the row tooltip. */
export function lineReasonWords(reason: PriceTrustReason): string {
  if (reason.kind !== 'no-listings') {
    return rowReasonWords(reason);
  }
  return reason.minutes === undefined ? NO_LISTINGS_LINE : `tried ${reasonAge(reason.minutes)}${TRUST_JOINER}${NO_LISTINGS_LINE}`;
}

/** An expansion line's trust cell, `<word> · <reason>`, the reasons in `core`'s order. */
export function lineTrustParts(trust: PriceTrust): TrustParts | undefined {
  return trustParts(trust, lineReasonWords);
}
