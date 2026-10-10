import { plural } from './text';

/** Clock units and age spellings; the price-trust verdict and its old bound are `core`'s (AD-10). */

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

/** An exact age, no cut-off: `< 1h`, hours, then days; a clock ahead of `now` reads `< 1h`. */
export function exactAge(clock: string, now: number): string {
  const hours = (now - Date.parse(clock)) / HOUR_MS;
  if (hours >= 1) {
    return hours < 24 ? `${String(Math.floor(hours))}h` : `${String(Math.floor(hours / 24))}d`;
  }
  return '< 1h';
}

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
