/**
 * Divine normalisation at the sync boundary (AD-20, `IMPLEMENTATION-NOTES.md`
 * §4.2–§4.3). Pure functions only: no request for a rate is ever made (AD-20);
 * the rates are the player's hand-maintained `data/currencies.json`.
 */

import type { CurrencyRate, LeagueId } from '@poe/contracts';

/** The one currency whose rate is exactly `1` by definition (AD-20). */
export const DIVINE_CURRENCY_ID = 'divine';

const DIVINE_DECIMALS = 4;
const DIVINE_SCALE = 10 ** DIVINE_DECIMALS;

/**
 * Rounds a divine value to 4 decimal places (§4.2). `sync` calls it **once**
 * per value, at the point of normalisation; `core` never re-rounds.
 */
export function roundDivine(value: number): number {
  return Math.round((value + Number.EPSILON) * DIVINE_SCALE) / DIVINE_SCALE;
}

/**
 * The rates that are **current**: those whose own `league` equals the active
 * league. A rate from another league is treated as missing, never relabelled
 * (AD-19, AD-20). Divine's rate is always exactly `1`, whatever the file says.
 * Where a currency appears twice, the first current entry wins.
 */
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

/**
 * One listing of `amount` units, normalised to divine with `amount × rate` and
 * rounded **once** (§4.2). The unrounded file rate is used, so the product is
 * rounded exactly one time.
 */
export function toDivine(amount: number, rate: CurrencyRate): number {
  return roundDivine(amount * rate.rate);
}

/**
 * The median, taking the **lower** of the two middle values on an even sample
 * (§4.3), so every persisted price is one someone actually asked.
 *
 * @throws RangeError on an empty sample: zero listings is `no-listings`, never
 *   a price.
 */
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

/**
 * One rate as `sync` writes it out: divine at exactly `1`, every other rate at
 * 4dp (§4.2), and the file's own `league` and `asOf` copied through unchanged
 * (AD-20).
 */
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
  return rates.map(outputRate);
}
