import { compareCanonicalKeys, type CurationStatus, type DatasetEntry } from '@poe/contracts';
import type { Ranking, UnrankedEntry } from '@poe/core';

import {
  ageMark,
  combinationAges,
  formatDivine,
  MONEY_PHRASES,
  type AgeMark,
  type CombinationAges,
  type CombinationState,
} from './format';
import { isHonestEmpty } from './list-statement';

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
  /** The Curation Status. `pinned` leads the combination cell; the trade-link test refuses `pruned`. */
  readonly status: CurationStatus;
  /** The Price State the expansion prints, as `core` resolved it (a league mismatch included). */
  readonly state: CombinationState;
  /** The row's dataset entry, joined by `entryKey`: its clocks and stored search. `undefined` when never synced. */
  readonly entry: DatasetEntry | undefined;
  /** The expansion's two exact labelled ages, read against the same `now` as `age`. */
  readonly ages: CombinationAges;
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
 * The one exception is the honest-empty state (`isHonestEmpty`, EXPERIENCE
 * state 23): its statement claims canonical order, so the unpriced rows print
 * as one sequence by `compareCanonicalKeys` on `entryKey`, across both groups,
 * and every EV cell reads *no figure yet*, a `no-listings` row included
 * (EXPERIENCE state 23, revision 8). Each row keeps its own Price State, so its
 * expansion still prints its own money phrase.
 * `belowThreshold` leaves the list (FR-3); `unresolvable` is Story 2.6's health
 * line (FR-24). The age reads the row's dataset entry, joined by `entryKey`.
 * Each row also carries what its expansion prints (Story 2.5): the resolved
 * Price State, the Curation Status, the dataset entry and both exact ages.
 */
export function toDisplayRows(ranking: Ranking, dataset: readonly DatasetEntry[], now: number): DisplayRow[] {
  const byKey = new Map(dataset.map((entry) => [entry.entryKey, entry]));

  const detail = (
    entryKey: string,
    state: CombinationState,
  ): Pick<DisplayRow, 'age' | 'state' | 'entry' | 'ages'> => {
    const entry = byKey.get(entryKey);
    return {
      age: ageMark(entry, now),
      state,
      entry,
      ages: combinationAges(state, entry?.lastAttemptedAt, now),
    };
  };

  const ranked = ranking.ordering.map(
    (row, index): DisplayRow => ({
      key: row.entryKey,
      numeral: index + 1,
      tier: tierOf(index + 1),
      unit: 'raw',
      label: row.baseTypeId,
      itemLevel: row.itemLevelMin,
      ev: { kind: 'figure', text: formatDivine(row.ev) },
      status: row.status,
      ...detail(row.entryKey, {
        state: 'priced',
        priceDivine: row.observation.priceDivine,
        sampleSize: row.observation.sampleSize,
        observedAt: row.observation.observedAt,
      }),
    }),
  );

  const unpriced = (entry: UnrankedEntry, phrase: string, state: CombinationState): DisplayRow => ({
    key: entry.entryKey,
    numeral: undefined,
    tier: 3,
    unit: 'raw',
    label: entry.entry.baseTypeId,
    itemLevel: entry.entry.itemLevelMin,
    ev: { kind: 'phrase', text: phrase },
    status: entry.entry.status,
    ...detail(entry.entryKey, state),
  });

  const trailing = [
    ...ranking.noListings.map((entry) => unpriced(entry, MONEY_PHRASES.noListings, { state: 'no-listings' })),
    ...ranking.notYetSynced.map((entry) =>
      unpriced(entry, MONEY_PHRASES.notYetSynced, { state: 'not-yet-synced', reason: entry.reason }),
    ),
  ];

  // State 23 prints "In canonical order": one sequence across both groups, one EV phrase.
  if (isHonestEmpty(ranking)) {
    const phrase: EvCell = { kind: 'phrase', text: MONEY_PHRASES.notYetSynced };
    return [
      ...ranked,
      ...trailing
        .map((row) => ({ ...row, ev: phrase }))
        .toSorted((left, right) => compareCanonicalKeys(left.key, right.key)),
    ];
  }
  return [...ranked, ...trailing];
}
