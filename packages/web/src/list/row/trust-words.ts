import type { PriceTrust, PriceTrustReason } from '@poe/contracts';
import { DAY_MS, MINUTE_MS } from '@poe/core';

import type { MarkedVerdict } from '../../marks/marks';
import { JOINER, plural } from '../../shared/text';
import { reasonAge } from '../../shared/time';
import { NO_FIGURE_YET } from '../format';

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
  uncostable: `${NO_FIGURE_YET} — craft cost unknown`,
  'all-broken': 'all combinations gone after a patch',
  'no-prices': 'no prices yet',
};

/** One reason in the words of a ranked row's tooltip. */
export function rowReasonWords(reason: PriceTrustReason): string {
  switch (reason.kind) {
    case 'old': {
      return `priced ${reasonAge(reason.days * DAY_MS)}`;
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

/** A trust verdict's mark, word and joined reasons; `undefined` when current. */
export interface TrustParts {
  readonly verdict: MarkedVerdict;
  readonly word: string;
  readonly reason: string;
}

function trustParts(trust: PriceTrust, words: (reason: PriceTrustReason) => string): TrustParts | undefined {
  return trust.verdict === 'current'
    ? undefined
    : { verdict: trust.verdict, word: VERDICT_WORDS[trust.verdict], reason: trust.reasons.map((reason) => words(reason)).join(JOINER) };
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
  return reason.minutes === undefined ? NO_LISTINGS_LINE : `tried ${reasonAge(reason.minutes * MINUTE_MS)}${JOINER}${NO_LISTINGS_LINE}`;
}

/** An expansion line's trust cell, `<word> · <reason>`, the reasons in `core`'s order. */
export function lineTrustParts(trust: PriceTrust): TrustParts | undefined {
  return trustParts(trust, lineReasonWords);
}
