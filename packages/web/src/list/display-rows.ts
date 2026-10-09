import {
  canonicalKey,
  compareCanonicalKeys,
  type CraftedRankedRow,
  type CraftedTrackedEntry,
  type CurationStatus,
  type DatasetEntry,
  type TrackedEntry,
} from '@poe/contracts';
import { craftedClassesOf, type Ranking, type UnrankedEntry } from '@poe/core';

import { formatDivine } from '../shared/money';
import { combinationText, type AffixPart, type StatTexts } from './combination-text';
import {
  combinationAges,
  craftedCombinationNote,
  MONEY_PHRASES,
  resolvedState,
  type CombinationAges,
  type CombinationState,
  unitLabel,
} from './format';
import type { ActiveRanking } from './active-ranking';
import { isHonestEmpty } from './list-statement';

/** Ranks 1–5, 6–10, 11 onward, by position only, never by kind (UX-DR11); state 35: per branch. */
export type Tier = 1 | 2 | 3;

/** What an EV cell holds: a figure at 2dp, or the money-slot phrase naming the open question. */
type ExpectedValueCell =
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
  readonly ev: ExpectedValueCell;
  /** The Curation Status. `pinned` leads the combination cell; the trade-link test refuses `pruned`. */
  readonly status: CurationStatus;
  /** The Price State the expansion prints, as `core` resolved it (a league mismatch included). */
  readonly state: CombinationState;
  /** The row's dataset entry, joined by `entryKey`: its clocks and stored search. `undefined` when never synced. */
  readonly entry: DatasetEntry | undefined;
  /** The expansion's two exact labelled ages, read against the view's held `now`. */
  readonly ages: CombinationAges;
}

/** One crafted row, keyed by class key so its panel survives a recipe switch (state 34, AD-10). */
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
  readonly ev: ExpectedValueCell;
  /** `core`'s label of the pair. Only `uniform-prior` prints a mark; `measured` is silence (FR-11). */
  readonly provenance: CraftedRankedRow['provenance'];
  /** The first three of `core`'s summands, in its order, as Combination text; fewer leave blank. */
  readonly chase: readonly (readonly AffixPart[])[];
  /** The expansion's combination rows: the summands in `core`'s order, then every other non-pruned entry by canonical key. */
  readonly combinations: readonly CraftedCombination[];
}

/** One crafted Tracked Entry as its combination row prints it. */
export interface CraftedCombination {
  /** The entry's canonical key. */
  readonly key: string;
  readonly text: readonly AffixPart[];
  readonly status: CurationStatus;
  readonly state: CombinationState;
  readonly note: string;
  /** The entry's dataset entry, for its stored search. `undefined` when never synced. */
  readonly entry: DatasetEntry | undefined;
  readonly ages: CombinationAges;
}

/** What a crafted row needs beyond `core`'s row: the tracked list, the catalogue's stat texts and the active league. */
export interface CraftedContext {
  readonly tracked: readonly TrackedEntry[];
  readonly stats: StatTexts;
  readonly activeLeague: string;
}

/** The chase column holds at most three cells (DESIGN.md `col-chase` 492 = 3 × 164). */
export const CHASE_CELLS = 3;

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

const NO_CRAFTED_CONTEXT: CraftedContext = { tracked: [], stats: new Map(), activeLeague: '' };

interface KeyedEntry {
  readonly entry: CraftedTrackedEntry;
  readonly entryKey: string;
}

/** The non-pruned crafted entries, grouped by their class key, each with its canonical key. */
function trackedByClass(tracked: readonly TrackedEntry[]): ReadonlyMap<string, readonly KeyedEntry[]> {
  return new Map(
    [...craftedClassesOf(tracked)].map(([classKey, members]) => [
      classKey,
      members.map((entry) => ({ entry, entryKey: canonicalKey(entry) })),
    ]),
  );
}

/** `web` reorders nothing: `core`'s summands, then the class's other non-pruned entries by key. */
function craftedDetail(
  row: CraftedRankedRow,
  {
    entries,
    byKey,
    crafted: { stats, activeLeague },
    now,
  }: {
    readonly entries: readonly KeyedEntry[];
    readonly byKey: ReadonlyMap<string, DatasetEntry>;
    readonly crafted: CraftedContext;
    readonly now: number;
  },
): Pick<ClassDisplayRow, 'chase' | 'combinations'> {
  const tracked = new Map(entries.map((keyed) => [keyed.entryKey, keyed.entry]));
  const summandKeys = new Set(row.summands.map((summand) => summand.entryKey));
  const text = (entryKey: string): readonly AffixPart[] => {
    const entry = tracked.get(entryKey);
    return entry === undefined ? [] : combinationText(entry, stats);
  };
  const combination = (entryKey: string): CraftedCombination[] => {
    const entry = tracked.get(entryKey);
    if (entry === undefined) {
      return [];
    }
    const stored = byKey.get(entryKey);
    const state = resolvedState(stored, activeLeague);
    return [
      {
        key: entryKey,
        text: combinationText(entry, stats),
        status: entry.status,
        state,
        note: craftedCombinationNote(state, summandKeys.has(entryKey)),
        entry: stored,
        ages: combinationAges(state, stored?.lastAttemptedAt, now),
      },
    ];
  };
  const rest = entries
    .map((keyed) => keyed.entryKey)
    .filter((entryKey) => !summandKeys.has(entryKey))
    .toSorted(compareCanonicalKeys);
  return {
    chase: row.summands.slice(0, CHASE_CELLS).map((summand) => text(summand.entryKey)),
    combinations: [...row.summands.map((summand) => summand.entryKey), ...rest].flatMap((entryKey) => combination(entryKey)),
  };
}

interface RowContext {
  readonly byKey: ReadonlyMap<string, DatasetEntry>;
  readonly now: number;
}

function rowDetail(
  { byKey, now }: RowContext,
  entryKey: string,
  state: CombinationState,
): Pick<DisplayRow, 'state' | 'entry' | 'ages'> {
  const entry = byKey.get(entryKey);
  return {
    state,
    entry,
    ages: combinationAges(state, entry?.lastAttemptedAt, now),
  };
}

function rankedRows(
  ranking: Ranking,
  context: RowContext,
  crafted: CraftedContext,
  isNumbered: boolean,
): ListRow[] {
  const classes = trackedByClass(crafted.tracked);
  return ranking.ordering.map((row, index): ListRow => {
    const position = { numeral: isNumbered ? index + 1 : undefined, tier: tierOf(index + 1) };
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
        provenance: row.provenance,
        ...craftedDetail(row, { entries: classes.get(row.classKey) ?? [], byKey: context.byKey, crafted, now: context.now }),
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
      ...rowDetail(context, row.entryKey, {
        state: 'priced',
        priceDivine: row.observation.priceDivine,
        sampleSize: row.observation.sampleSize,
        observedAt: row.observation.observedAt,
      }),
    };
  });
}

function unpricedRow(context: RowContext, entry: UnrankedEntry, phrase: string, state: CombinationState): DisplayRow {
  return {
    key: entry.entryKey,
    numeral: undefined,
    tier: 3,
    unit: 'raw',
    label: entry.entry.baseTypeId,
    itemLevel: entry.entry.itemLevelMin,
    ev: { kind: 'phrase', text: phrase },
    status: entry.entry.status,
    ...rowDetail(context, entry.entryKey, state),
  };
}

function trailingRows(ranking: Ranking, context: RowContext): DisplayRow[] {
  return [
    ...ranking.noListings.map((entry) => unpricedRow(context, entry, MONEY_PHRASES.noListings, { state: 'no-listings' })),
    ...ranking.notYetSynced.map((entry) =>
      unpricedRow(context, entry, MONEY_PHRASES.notYetSynced, { state: 'not-yet-synced', reason: entry.reason }),
    ),
    ...ranking.unresolvable.map((entry) =>
      unpricedRow(context, entry, MONEY_PHRASES.unresolvable, { state: 'unresolvable' }),
    ),
  ];
}

/** `core`'s `ordering`, then unpriced Raw Bases at tier 3 (FR-24, state 4); belowThreshold out. */
export function toDisplayRows(
  ranking: Ranking,
  dataset: readonly DatasetEntry[],
  now: number,
  {
    numbered = true,
    honestEmpty = isHonestEmpty(ranking),
    crafted = NO_CRAFTED_CONTEXT,
  }: { readonly numbered?: boolean; readonly honestEmpty?: boolean; readonly crafted?: CraftedContext } = {},
): ListRow[] {
  const context: RowContext = { byKey: new Map(dataset.map((entry) => [entry.entryKey, entry])), now };
  const ranked = rankedRows(ranking, context, crafted, numbered);
  const trailing = trailingRows(ranking, context);

  // State 23 prints "In canonical order": one sequence across the crafted rows and all three
  // unpriced groups, by key (a class key or a canonical key), with no numeral and one EV phrase.
  if (honestEmpty) {
    const phrase: ExpectedValueCell = { kind: 'phrase', text: MONEY_PHRASES.notYetSynced };
    return [...ranked, ...trailing]
      .map((row): ListRow => ({ ...row, numeral: undefined, tier: 3, ev: phrase }))
      .toSorted((left, right) => compareCanonicalKeys(left.key, right.key));
  }
  return [...ranked, ...trailing];
}

/** One branch in every state but 35, where an uncostable recipe gives raw then crafted. */
export function toListBranches(
  active: ActiveRanking,
  dataset: readonly DatasetEntry[],
  now: number,
  crafted: CraftedContext,
): ListBranches {
  if (!active.split) {
    return [toDisplayRows(active, dataset, now, { crafted })];
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
    toDisplayRows(rawOnly, dataset, now, { numbered: false, honestEmpty: false, crafted }),
    toDisplayRows(craftedOnly, dataset, now, { numbered: false, honestEmpty: false, crafted }),
  ];
}
