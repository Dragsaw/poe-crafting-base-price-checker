import type { WeightsLine } from '@poe/contracts';

function fractionDigits(value: number): number {
  const text = String(value);
  const point = text.indexOf('.');
  return point === -1 ? 0 : text.length - point - 1;
}

/** The most fraction digits among a banded line's range endpoints. */
export function lineDigits(line: WeightsLine): number {
  return Math.max(...line.ranges.flat().map((value) => fractionDigits(value)));
}

// In grid steps (`highest * steps`): a float midpoint such as (0.7 + 0.1) / 2 misses its decimal
// by a few ulps, while an off-grid maximum (a two-`#` midpoint on a one-`#` line) sits half a step off.
const ON_GRID = 1e-6;

/**
 * The first grid value above `highest`; a two-`#` line steps by half its values' grid. `k / steps`
 * is the decimal's own double, so an on-grid maximum steps once and an off-grid one lands on the next value.
 */
export function nextOnGrid(highest: number, digits: number, hashes: number): number {
  const steps = 10 ** digits * hashes;
  return (Math.floor(highest * steps + ON_GRID) + 1) / steps;
}
