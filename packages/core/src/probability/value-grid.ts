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

/**
 * The first grid value above `highest`; a two-`#` line steps by half its values' grid. `nearest / steps`
 * is the decimal's own double, so an on-grid maximum steps once and an off-grid one lands on the next value.
 */
export function nextOnGrid(highest: number, digits: number, hashes: number): number {
  const steps = 10 ** digits * hashes;
  const nearest = Math.round(highest * steps);
  return (nearest / steps > highest ? nearest : nearest + 1) / steps;
}
