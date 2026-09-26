import type { DatasetEntry } from '@poe/contracts';
import type { Ranking, UnrankedEntry } from '@poe/core';

import { ageMark, formatDivine, MONEY_PHRASES, type AgeMark } from './format';

/** Ranks 1–5, 6–10, and 11 onward — by position only, never by branch (UX-DR11). */
export type Tier = 1 | 2 | 3;

/** What an EV cell holds: a figure at 2dp, or the money-slot phrase naming the open question. */
export type EvCell =
  | { readonly kind: 'figure'; readonly text: string }
  | { readonly kind: 'phrase'; readonly text: string };

/** One row as the view prints it. Nothing here is a ranking term: `core` ordered it. */
export interface DisplayRow {
  readonly key: string;
  /** The rank numeral, or `undefined` for an unpriced trailing row, which holds no rank. */
  readonly numeral: number | undefined;
  readonly tier: Tier;
  /** `raw` today; Epic 3 adds `class`. */
  readonly unit: 'raw';
  /** A Base Type's id, verbatim. */
  readonly label: string;
  readonly itemLevel: number;
  readonly ev: EvCell;
  readonly age: AgeMark | undefined;
}

export function tierOf(position: number): Tier {
  if (position <= 5) {
    return 1;
  }
  return position <= 10 ? 2 : 3;
}

/**
 * The ranking as rows: `ordering` in `core`'s order, numbered by position; then
 * the unpriced Raw Bases trailing in canonical order, `noListings` then
 * `notYetSynced` (decision 2026-09-26, option a), unnumbered and at tier 3.
 * `belowThreshold` leaves the list (FR-3); `unresolvable` is Story 2.6's health
 * line (FR-24). The age reads the row's dataset entry, joined by `entryKey`.
 */
export function toDisplayRows(ranking: Ranking, dataset: readonly DatasetEntry[], now: number): DisplayRow[] {
  const byKey = new Map(dataset.map((entry) => [entry.entryKey, entry]));

  const ranked = ranking.ordering.map((row, index): DisplayRow => ({
    key: row.entryKey,
    numeral: index + 1,
    tier: tierOf(index + 1),
    unit: 'raw',
    label: row.baseTypeId,
    itemLevel: row.itemLevelMin,
    ev: { kind: 'figure', text: formatDivine(row.ev) },
    age: ageMark(byKey.get(row.entryKey), now),
  }));

  const unpriced = (entry: UnrankedEntry, phrase: string): DisplayRow => ({
    key: entry.entryKey,
    numeral: undefined,
    tier: 3,
    unit: 'raw',
    label: entry.entry.baseTypeId,
    itemLevel: entry.entry.itemLevelMin,
    ev: { kind: 'phrase', text: phrase },
    age: ageMark(byKey.get(entry.entryKey), now),
  });

  return [
    ...ranked,
    ...ranking.noListings.map((entry) => unpriced(entry, MONEY_PHRASES.noListings)),
    ...ranking.notYetSynced.map((entry) => unpriced(entry, MONEY_PHRASES.notYetSynced)),
  ];
}
