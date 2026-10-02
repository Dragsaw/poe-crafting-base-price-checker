import { compareCanonicalKeys, type CurationStatus, type DatasetEntry } from '@poe/contracts';
import type { Ranking, UnrankedEntry } from '@poe/core';

import { formatDivine } from '../shared/money';
import {
  ageMark,
  combinationAges,
  MONEY_PHRASES,
  type AgeMark,
  type CombinationAges,
  type CombinationState,
  unitLabel,
} from './format';
import type { ActiveRanking } from './active-ranking';
import { isHonestEmpty } from './list-statement';

/**
 * Ranks 1–5, 6–10, and 11 onward — by position only, never by kind (UX-DR11).
 * In state 35 the position is within the row's own branch (EXPERIENCE.md).
 */
export type Tier = 1 | 2 | 3;

/** What an EV cell holds: a figure at 2dp, or the money-slot phrase naming the open question. */
export type EvCell =
  | { readonly kind: 'figure'; readonly text: string }
  | { readonly kind: 'phrase'; readonly text: string };

/** One Raw Base row as the view prints it. Nothing here is a ranking term: `core` ordered it. */
export interface DisplayRow {
  readonly key: string;
  /** The rank numeral, or `undefined` for an unpriced trailing row, which holds no rank. */
  readonly numeral: number | undefined;
  readonly tier: Tier;
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

/**
 * One crafted `(Item Class, recipe)` row as the view prints it: the class
 * glyph, the Item Class name, its EV. The key is the class key, so a row keeps
 * its open panel across a recipe switch (state 34). No age, Provenance mark or
 * chase cell yet (Stories 3.5, 3.6).
 */
export interface ClassDisplayRow {
  readonly key: string;
  /** The rank numeral, or `undefined` in state 35, where no numeral spans the two branches. */
  readonly numeral: number | undefined;
  readonly tier: Tier;
  readonly unit: 'class';
  /** The `className` with each underscore a space (AD-5). */
  readonly label: string;
  readonly itemLevel: number;
  /** The EV at 2dp — negative is a real figure — or *no figure yet* when the recipe is uncostable. */
  readonly ev: EvCell;
  readonly age: undefined;
}

/** Any row of the list. */
export type ListRow = DisplayRow | ClassDisplayRow;

/** The list's rows in branches: one branch, or in state 35 the raw branch then the crafted branch. */
export type ListBranches = readonly (readonly ListRow[])[];

export function tierOf(position: number): Tier {
  if (position <= 5) {
    return 1;
  }
  return position <= 10 ? 2 : 3;
}

/**
 * The ranking as rows: `ordering` in `core`'s order, numbered by position —
 * a crafted row prints its Item Class name, the class glyph and `core`'s EV,
 * or *no figure yet* for an uncostable recipe; `numbered: false` suppresses
 * every numeral (state 35); then
 * the unpriced Raw Bases trailing in canonical order, `noListings` then
 * `notYetSynced` (decision 2026-09-26, option a) then `unresolvable` (FR-24,
 * EXPERIENCE state 4: shown, not merely omitted), unnumbered and at tier 3.
 * The one exception is the honest-empty state (`isHonestEmpty`, EXPERIENCE
 * state 23): its statement claims canonical order, so the unpriced rows print
 * as one sequence by `compareCanonicalKeys` on `entryKey`, across all three
 * groups, and every EV cell reads *no figure yet*, whatever the row's own Price
 * State (EXPERIENCE state 23, revision 8). Each row keeps its own Price State,
 * so its expansion still prints its own money phrase.
 * `belowThreshold` leaves the list (FR-3). The health line counts the Sync
 * Report's records, not these rows, so a row renders with the report absent.
 * The age reads the row's dataset entry, joined by `entryKey`.
 * Each row also carries what its expansion prints (Story 2.5): the resolved
 * Price State, the Curation Status, the dataset entry and both exact ages.
 */
export function toDisplayRows(
  ranking: Ranking,
  dataset: readonly DatasetEntry[],
  now: number,
  { numbered = true, honestEmpty = isHonestEmpty(ranking) }: { readonly numbered?: boolean; readonly honestEmpty?: boolean } = {},
): ListRow[] {
  const byKey = new Map(dataset.map((entry) => [entry.entryKey, entry]));

  const detail = (
    entryKey: string,
    state: CombinationState,
  ): Pick<DisplayRow, 'age' | 'state' | 'entry' | 'ages'> => {
    const entry = byKey.get(entryKey);
    return {
      age: ageMark(state, entry?.lastAttemptedAt, now),
      state,
      entry,
      ages: combinationAges(state, entry?.lastAttemptedAt, now),
    };
  };

  const ranked = ranking.ordering.map((row, index): ListRow => {
    const position = { numeral: numbered ? index + 1 : undefined, tier: tierOf(index + 1) };
    if (row.kind === 'crafted') {
      return {
        key: row.classKey,
        ...position,
        unit: 'class',
        label: unitLabel(row.className),
        itemLevel: row.itemLevelMin,
        ev:
          row.ev === null
            ? { kind: 'phrase', text: MONEY_PHRASES.notYetSynced }
            : { kind: 'figure', text: formatDivine(row.ev) },
        age: undefined,
      };
    }
    return {
      key: row.entryKey,
      ...position,
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
    };
  });

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
    ...ranking.unresolvable.map((entry) => unpriced(entry, MONEY_PHRASES.unresolvable, { state: 'unresolvable' })),
  ];

  // State 23 prints "In canonical order": one sequence across the crafted rows and all three
  // unpriced groups, by key (a class key or a canonical key), with no numeral and one EV phrase.
  if (honestEmpty) {
    const phrase: EvCell = { kind: 'phrase', text: MONEY_PHRASES.notYetSynced };
    return [...ranked, ...trailing]
      .map((row): ListRow => ({ ...row, numeral: undefined, tier: 3, ev: phrase }))
      .toSorted((left, right) => compareCanonicalKeys(left.key, right.key));
  }
  return [...ranked, ...trailing];
}

/**
 * The list's branches for the active recipe (`forRecipe`). One branch in
 * every state but 35. In state 35 — an uncostable recipe with a crafted row
 * to show — the raw branch, with its trailing unpriced rows, then the crafted
 * branch: each in `core`'s order, tiered by its own position, and no rank
 * numeral on either, because none can span the two (EXPERIENCE.md state 35).
 */
export function toListBranches(active: ActiveRanking, dataset: readonly DatasetEntry[], now: number): ListBranches {
  if (!active.split) {
    return [toDisplayRows(active, dataset, now)];
  }
  const rawOnly = { ...active, ordering: active.ordering.filter((row) => row.kind === 'raw') };
  const craftedOnly = {
    ...active,
    ordering: active.ordering.filter((row) => row.kind === 'crafted'),
    noListings: [],
    notYetSynced: [],
    unresolvable: [],
  };
  return [
    toDisplayRows(rawOnly, dataset, now, { numbered: false, honestEmpty: false }),
    toDisplayRows(craftedOnly, dataset, now, { numbered: false, honestEmpty: false }),
  ];
}
