/** The page's one money precision: EV, price and the Payout Threshold all print at 2dp. */

/** The decimals every money figure prints and the Payout Threshold keeps. */
export const MONEY_DECIMALS = 2;

/** The figure a present but too-small value prints. It is a quantity, not a money slot. */
export const BELOW_PRINTABLE = '< 0.01';

/** A value at the page's money precision, with no floor. A negative that rounds to zero prints `0.00`, never `-0.00`. */
export function formatTwoDecimals(value: number): string {
  const text = value.toFixed(MONEY_DECIMALS);
  return Number(text) === 0 ? (0).toFixed(MONEY_DECIMALS) : text;
}

/** The Payout Threshold figure: always two decimals (`0.25`, `3.00`). */
export function formatThreshold(value: number): string {
  return formatTwoDecimals(value);
}

/** EV and price at 2dp. A value `0 < v < 0.005` would print `0.00`, so it prints `< 0.01`. */
export function formatDivine(value: number): string {
  return value > 0 && value < 0.005 ? BELOW_PRINTABLE : formatTwoDecimals(value);
}
