import { plural } from './text';

/**
 * The clock units and the two unruled age spellings. The list's 48h stale mark
 * (`ageMark`) stays in `list/format.ts`: it is a third, list-only copy.
 */

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

/**
 * An exact age, with no 48h cut-off: `< 1h`, then whole hours under a day,
 * then whole days. A clock ahead of `now` reads `< 1h`.
 */
export function exactAge(clock: string, now: number): string {
  const hours = (now - Date.parse(clock)) / HOUR_MS;
  if (!(hours >= 1)) {
    return '< 1h';
  }
  if (hours < 24) {
    return `${String(Math.floor(hours))}h`;
  }
  return `${String(Math.floor(hours / 24))}d`;
}

function unitAgo(count: number, unit: string): string {
  return `${String(count)} ${plural(count, unit, `${unit}s`)} ago`;
}

/** A relative age: `< 1 minute ago`, then whole minutes under 1h, hours under 24h, then days. */
export function relativeAge(ageMs: number): string {
  if (ageMs < MINUTE_MS) {
    return '< 1 minute ago';
  }
  if (ageMs < HOUR_MS) {
    return unitAgo(Math.floor(ageMs / MINUTE_MS), 'minute');
  }
  if (ageMs < DAY_MS) {
    return unitAgo(Math.floor(ageMs / HOUR_MS), 'hour');
  }
  return unitAgo(Math.floor(ageMs / DAY_MS), 'day');
}
