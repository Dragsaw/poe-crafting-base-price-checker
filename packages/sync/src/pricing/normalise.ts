/** Divine normalisation at the sync boundary: pure, no rate request (AD-20, §4.2-§4.3). */

import type { CurrencyRate, LeagueId } from '@poe/contracts';

/** The one currency whose rate is exactly `1` by definition (AD-20). */
const DIVINE_CURRENCY_ID = 'divine';

const DIVINE_DECIMALS = 4;
const DIVINE_SCALE = 10 ** DIVINE_DECIMALS;

/** Rounds to 4 decimal places, once per value; `core` never re-rounds (§4.2). */
export function roundDivine(value: number): number {
  return Math.round((value + Number.EPSILON) * DIVINE_SCALE) / DIVINE_SCALE;
}

// A rate from another league is missing, never relabelled (AD-19, AD-20). Divine is always 1,
// and the first current entry of a currency wins.
export function currentRates(
  rates: readonly CurrencyRate[],
  league: LeagueId,
): ReadonlyMap<string, CurrencyRate> {
  const current = new Map<string, CurrencyRate>();
  for (const rate of rates) {
    if (rate.league !== league || current.has(rate.currencyId)) {
      continue;
    }
    current.set(rate.currencyId, rate.currencyId === DIVINE_CURRENCY_ID ? { ...rate, rate: 1 } : rate);
  }
  return current;
}

/** Uses the unrounded file rate, so the product is rounded exactly once (§4.2). */
export function toDivine(amount: number, rate: CurrencyRate): number {
  return roundDivine(amount * rate.rate);
}

// The lower middle value of an even sample (§4.3). Throws on an empty sample: no listings is
// `no-listings`, never a price.
export function lowerMedian(values: readonly number[]): number {
  if (values.length === 0) {
    throw new RangeError('lowerMedian: an empty sample has no median');
  }
  const sorted = values.toSorted((a, b) => a - b);
  const middle = sorted[Math.floor((sorted.length - 1) / 2)];
  if (middle === undefined) {
    throw new RangeError('lowerMedian: unreachable index');
  }
  return middle;
}

/** Divine at exactly 1, every other rate at 4dp; `league` and `asOf` pass through (§4.2, AD-20). */
export function outputRate(rate: CurrencyRate): CurrencyRate {
  return {
    currencyId: rate.currencyId,
    rate: rate.currencyId === DIVINE_CURRENCY_ID ? 1 : roundDivine(rate.rate),
    source: rate.source,
    league: rate.league,
    asOf: rate.asOf,
  };
}

/** The whole rate set as `sync` writes it out, in the file's own order. */
export function outputRates(rates: readonly CurrencyRate[]): CurrencyRate[] {
  return rates.map((rate) => outputRate(rate));
}
