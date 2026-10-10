/** The page's one money precision: EV, price and the Payout Threshold all print at 2dp. */

/** The decimals every money figure prints and the Payout Threshold keeps. */
export const MONEY_DECIMALS = 2;

/** The figure a present but too-small value prints. It is a quantity, not a money slot. */
export const BELOW_PRINTABLE = '< 0.01';

/** The figure a loss too small to print takes. It is a quantity, not a money slot. */
export const LOSS_BELOW_PRINTABLE = '< 0.00';

/** A value at the page's money precision, with no floor. A negative that rounds to zero prints `0.00`, never `-0.00`. */
function formatTwoDecimals(value: number): string {
  const text = value.toFixed(MONEY_DECIMALS);
  return Number(text) === 0 ? (0).toFixed(MONEY_DECIMALS) : text;
}

/** The Payout Threshold figure: always two decimals (`0.25`, `3.00`). */
export function formatThreshold(value: number): string {
  return formatTwoDecimals(value);
}

/** The sign a negative figure takes: U+2212, never a hyphen (EXPERIENCE.md, Money). */
export const MINUS = '\u{2212}';

/** EV and price at 2dp. A value that would print `0.00` prints `< 0.01`, or `< 0.00` when negative; `-0` stays `0.00`. */
export function formatDivine(value: number): string {
  if (value > 0 && value < 0.005) {
    return BELOW_PRINTABLE;
  }
  if (value < 0 && value > -0.005) {
    return LOSS_BELOW_PRINTABLE;
  }
  const text = formatTwoDecimals(value);
  return text.startsWith('-') ? `${MINUS}${text.slice(1)}` : text;
}
