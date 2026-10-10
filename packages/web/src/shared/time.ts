import { plural } from './text';

/** Clock units and age spellings; the price-trust verdict and its old bound are `core`'s (AD-10). */

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

function unitAgo(count: number, unit: string): string {
  const units = `${unit}s`;
  return `${String(count)} ${plural(count, unit, units)} ago`;
}

/** A relative age: `< 1 minute ago`, then whole minutes under 1h, hours under 24h, then days. */
export function relativeAge(ageMs: number): string {
  if (ageMs < MINUTE_MS) {
    return '< 1 minute ago';
  }
  if (ageMs < HOUR_MS) {
    return unitAgo(Math.floor(ageMs / MINUTE_MS), 'minute');
  }
  return ageMs < DAY_MS ? unitAgo(Math.floor(ageMs / HOUR_MS), 'hour') : unitAgo(Math.floor(ageMs / DAY_MS), 'day');
}
