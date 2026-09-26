import type { DatasetEntry } from '@poe/contracts';

/**
 * Pure view helpers for the ranked list. `web` computes no ranking term (AD-4):
 * everything here turns a value `core` or the dataset already holds into text.
 */

/** The freshness cut-off, in hours (AD-10, FR-12). A younger row shows no age. */
export const FRESHNESS_CUTOFF_HOURS = 48;

/** The top-N bound. A display slice only: `core` ranks the full Tracked List (FR-5). */
export const TOP_ROWS = 20;

/** The Payout Threshold the page starts at, in Divine (FR-7). Story 2.4 makes it editable. */
export const DEFAULT_THRESHOLD = 0.25;

/** The five money-slot phrases (EXPERIENCE.md, Money slots). A missing figure is never `0`. */
export const MONEY_PHRASES = {
  noListings: 'an open question',
  notYetSynced: 'no figure yet',
  unresolvable: 'not valued',
  unknown: 'unknown',
  pruned: 'not tracked',
} as const;

/** The figure a present but too-small value prints. It is a quantity, not a money slot. */
export const BELOW_PRINTABLE = '< 0.01';

const HOUR_MS = 3_600_000;

/** EV, price and threshold at 2dp. A value `0 < v < 0.005` would print `0.00`, so it prints `< 0.01`. */
export function formatDivine(value: number): string {
  if (value > 0 && value < 0.005) {
    return BELOW_PRINTABLE;
  }
  return value.toFixed(2);
}

/** A trust mark in the Age cell: the stale mark names its clock; the never mark has no age. */
export type AgeMark =
  | { readonly kind: 'stale'; readonly word: string }
  | { readonly kind: 'never'; readonly word: 'never attempted' };

export const NEVER_ATTEMPTED = 'never attempted';

/**
 * The Age cell (FR-12, AD-9, AD-10). The clock is `observedAt` where the entry's
 * price is `priced` — a league-mismatched observation included — and
 * `lastAttemptedAt` otherwise. Neither clock: *never attempted*. Younger than
 * the cut-off: no mark at all. At or past it: `priced Nd ago` / `tried Nd ago`,
 * N = floor(hours / 24).
 */
export function ageMark(entry: DatasetEntry | undefined, now: number): AgeMark | undefined {
  const priced = entry?.price.state === 'priced' ? entry.price.observation.observedAt : undefined;
  const clock = priced === undefined ? entry?.lastAttemptedAt : priced;
  if (clock === undefined) {
    return { kind: 'never', word: NEVER_ATTEMPTED };
  }
  const hours = (now - Date.parse(clock)) / HOUR_MS;
  if (!(hours >= FRESHNESS_CUTOFF_HOURS)) {
    return undefined;
  }
  const days = Math.floor(hours / 24);
  return { kind: 'stale', word: `${priced === undefined ? 'tried' : 'priced'} ${String(days)}d ago` };
}

/**
 * An Item Class's printed label: each underscore becomes a space and nothing
 * else changes (AD-5). The stored `className` stays the identity; only the
 * label is trimmed. No crafted row exists until Epic 3.
 */
export function unitLabel(className: string): string {
  return className.replaceAll('_', ' ');
}

/** The Raw Base row's note, spelling the Item Level Floor (DESIGN.md `raw-base-row`). */
export function rawNote(itemLevel: number): string {
  return `uncrafted at Item Level ${String(itemLevel)} — ranked at its own current asking price, not at a craft outcome`;
}
