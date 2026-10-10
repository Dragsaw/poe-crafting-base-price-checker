import {
  canonicalKey,
  compareCanonicalKeys,
  type CraftedRankedRow,
  type CraftedTrackedEntry,
  type CurationStatus,
  type DatasetEntry,
  type PriceTrust,
  type TrackedEntry,
} from '@poe/contracts';
import { classKeyOf, type Ranking, type UnrankedEntry } from '@poe/core';

import { formatDivine } from '../shared/money';
import { combinationText, type AffixPart, type StatTexts } from './combination-text';
import { unitLabel } from './format';
import type { ActiveRanking } from './active-ranking';
import { isHonestEmpty } from './list-statement';

/** Ranks 1–5, 6–10, 11 onward, by position only, never by kind (UX-DR11); state 35: per branch. */
export type Tier = 1 | 2 | 3;

/** What an EV cell holds: a figure at 2dp, dimmed when negative (state 21), or a missing figure beside its mark. */
export type ExpectedValueCell =
  | { readonly kind: 'figure'; readonly text: string; readonly negative: boolean }
  | { readonly kind: 'missing' };

const MISSING: ExpectedValueCell = { kind: 'missing' };

/** A pending or broken row's EV cell is `—` beside its mark (EXPERIENCE.md *Missing figures*; states 18, 41). */
function hasNoFigure(trust: PriceTrust): boolean {
  return trust.verdict === 'pending' || trust.verdict === 'broken';
}

function figure(expectedValue: number): ExpectedValueCell {
  return { kind: 'figure', text: formatDivine(expectedValue), negative: expectedValue < 0 };
}

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
  /** `core`'s verdict on the row's one entry; `web` derives none (AD-17). */
  readonly trust: PriceTrust;
  /** The Curation Status. `pinned` leads the expansion line; the trade-link test refuses `pruned`. */
  readonly status: CurationStatus;
  /** The ranked observation's price; `undefined` on an unpriced row, whose line prints `—`. */
  readonly price: number | undefined;
  /** The row's dataset entry, joined by `entryKey`, for its stored search. `undefined` when never synced. */
  readonly entry: DatasetEntry | undefined;
}

/** One crafted row, keyed by class key so its panel survives a recipe switch (state 34, AD-10). */
export interface ClassDisplayRow {
  readonly key: string;
  /** The rank numeral, or `undefined` in state 35, where no numeral spans the two branches, and in state 43. */
  readonly numeral: number | undefined;
  readonly tier: Tier;
  readonly unit: 'class';
  /** The `className` with each underscore a space (AD-5). */
  readonly label: string;
  readonly itemLevel: number;
  /** The EV at 2dp — negative is a real figure — or missing when the recipe is uncostable. */
  readonly ev: ExpectedValueCell;
  /** `core`'s first matching crafted rule (AD-17). */
  readonly trust: PriceTrust;
  /** `core`'s label of the pair, unset on a recipeless class. Only `uniform-prior` prints ≈ (FR-11). */
  readonly provenance?: CraftedRankedRow['provenance'];
  /** The first three of `core`'s summands, in its order, as Combination text; fewer leave blank. */
  readonly chase: readonly (readonly AffixPart[])[];
  /** The expansion lines in `core`'s order: `summands`, then `combinations`. */
  readonly combinations: readonly CraftedCombination[];
  /** The class's pruned entries, by canonical key, behind `+ N pruned` (FR-15). */
  readonly pruned: readonly PrunedCombination[];
}

/** One non-pruned crafted Tracked Entry as its expansion line prints it. */
export interface CraftedCombination {
  /** The entry's canonical key. */
  readonly key: string;
  readonly text: readonly AffixPart[];
  readonly status: CurationStatus;
  /** The price in Divine, or `undefined` where `—` prints beside the mark. */
  readonly price: number | undefined;
  /** `core`'s verdict on the entry (AD-17). */
  readonly trust: PriceTrust;
  /** A priced member of `core`'s `combinations`: below the threshold (state 20). */
  readonly isBelowThreshold: boolean;
  /** The entry's dataset entry, for its stored search. `undefined` when never synced. */
  readonly entry: DatasetEntry | undefined;
}

/** One pruned crafted Tracked Entry: its text and the reason the curator gave (state 10). */
export interface PrunedCombination {
  readonly key: string;
  readonly text: readonly AffixPart[];
  readonly reason: string;
}

/** What a crafted row needs beyond `core`'s row: the tracked list, pruned entries included, and the catalogue's stat texts. */
export interface CraftedContext {
  readonly tracked: readonly TrackedEntry[];
  readonly stats: StatTexts;
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

const NO_CRAFTED_CONTEXT: CraftedContext = { tracked: [], stats: new Map() };

/** Every crafted entry, pruned included, grouped by its class key (`classKeyOf`). */
function trackedByClass(tracked: readonly TrackedEntry[]): ReadonlyMap<string, readonly CraftedTrackedEntry[]> {
  const classes = new Map<string, CraftedTrackedEntry[]>();
  for (const entry of tracked) {
    if (entry.kind !== 'crafted') {
      continue;
    }
    const key = classKeyOf(entry.categoryId, entry.className);
    classes.set(key, [...(classes.get(key) ?? []), entry]);
  }
  return classes;
}

/** The stored observation's price; read only for a line `core` judged priced. */
function storedPrice(entry: DatasetEntry | undefined): number | undefined {
  return entry?.price.state === 'priced' ? entry.price.observation.priceDivine : undefined;
}

function isPriced(trust: PriceTrust): boolean {
  return trust.verdict === 'current' || trust.verdict === 'rough';
}

/** `web` reorders nothing: `core`'s summands, then its combinations, then the pruned entries by key. */
function craftedDetail(
  row: CraftedRankedRow,
  { entries, byKey, crafted: { stats } }: ClassLineSource,
): Pick<ClassDisplayRow, 'chase' | 'combinations' | 'pruned'> {
  const { text, line, pruned } = classLines({ entries, byKey, stats });
  return {
    chase: row.summands.slice(0, CHASE_CELLS).map((summand) => text(summand.entryKey)),
    combinations: [
      ...row.summands.flatMap((summand) => line(summand.entryKey, { trust: summand.trust, price: summand.priceDivine, isBelowThreshold: false })),
      ...row.combinations.flatMap((combination) => {
        const isBelowThreshold = isPriced(combination.trust);
        const price = isBelowThreshold ? storedPrice(byKey.get(combination.entryKey)) : undefined;
        return line(combination.entryKey, { trust: combination.trust, price, isBelowThreshold });
      }),
    ],
    pruned,
  };
}

interface ClassLineSource {
  readonly entries: readonly CraftedTrackedEntry[];
  readonly byKey: ReadonlyMap<string, DatasetEntry>;
  readonly crafted: CraftedContext;
}

type LineFigures = Pick<CraftedCombination, 'trust' | 'price' | 'isBelowThreshold'>;

/** One class's line builders and its pruned lines; an entry key the tracked list lacks makes no line. */
function classLines({
  entries,
  byKey,
  stats,
}: {
  readonly entries: readonly CraftedTrackedEntry[];
  readonly byKey: ReadonlyMap<string, DatasetEntry>;
  readonly stats: StatTexts;
}): {
  readonly text: (entryKey: string) => readonly AffixPart[];
  readonly line: (entryKey: string, figures: LineFigures) => CraftedCombination[];
  readonly pruned: readonly PrunedCombination[];
} {
  const tracked = new Map(entries.map((entry) => [canonicalKey(entry), entry]));
  const text = (entryKey: string): readonly AffixPart[] => {
    const entry = tracked.get(entryKey);
    return entry === undefined ? [] : combinationText(entry, stats);
  };
  const line = (entryKey: string, { trust, price, isBelowThreshold }: LineFigures): CraftedCombination[] => {
    const entry = tracked.get(entryKey);
    return entry === undefined
      ? []
      : [{ key: entryKey, text: text(entryKey), status: entry.status, price, trust, isBelowThreshold, entry: byKey.get(entryKey) }];
  };
  const pruned = [...tracked]
    .filter(([, entry]) => entry.status === 'pruned')
    .toSorted(([left], [right]) => compareCanonicalKeys(left, right))
    .map(([entryKey, entry]) => ({ key: entryKey, text: text(entryKey), reason: entry.prunedReason ?? '' }));
  return { text, line, pruned };
}

/** State 43: a recipeless class, unnumbered, `—` beside its mark, its lines in `core`'s order. */
function recipelessRows(ranking: Ranking, byKey: ReadonlyMap<string, DatasetEntry>, crafted: CraftedContext): ClassDisplayRow[] {
  const classes = trackedByClass(crafted.tracked);
  return ranking.recipeless.map((item) => {
    const { line, pruned } = classLines({ entries: classes.get(item.classKey) ?? [], byKey, stats: crafted.stats });
    return {
      key: item.classKey,
      numeral: undefined,
      tier: 3,
      unit: 'class',
      label: unitLabel(item.className),
      itemLevel: item.itemLevelMin,
      ev: MISSING,
      trust: item.trust,
      chase: [],
      combinations: item.combinations.flatMap(({ entryKey, trust }) =>
        line(entryKey, { trust, price: isPriced(trust) ? storedPrice(byKey.get(entryKey)) : undefined, isBelowThreshold: false }),
      ),
      pruned,
    };
  });
}

function rankedRows(
  ranking: Ranking,
  byKey: ReadonlyMap<string, DatasetEntry>,
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
        ev: row.ev === null || hasNoFigure(row.trust) ? MISSING : figure(row.ev),
        trust: row.trust,
        provenance: row.provenance,
        ...craftedDetail(row, { entries: classes.get(row.classKey) ?? [], byKey, crafted }),
      };
    }
    return {
      key: row.entryKey,
      ...position,
      unit: 'raw',
      label: row.baseTypeId,
      itemLevel: row.itemLevelMin,
      ev: figure(row.ev),
      trust: row.trust,
      status: row.status,
      price: row.observation.priceDivine,
      entry: byKey.get(row.entryKey),
    };
  });
}

function unpricedRow(byKey: ReadonlyMap<string, DatasetEntry>, entry: UnrankedEntry): DisplayRow {
  return {
    key: entry.entryKey,
    numeral: undefined,
    tier: 3,
    unit: 'raw',
    label: entry.entry.baseTypeId,
    itemLevel: entry.entry.itemLevelMin,
    ev: MISSING,
    trust: entry.trust,
    status: entry.entry.status,
    price: undefined,
    entry: byKey.get(entry.entryKey),
  };
}

function trailingRows(ranking: Ranking, byKey: ReadonlyMap<string, DatasetEntry>): DisplayRow[] {
  return [...ranking.noListings, ...ranking.notYetSynced, ...ranking.unresolvable].map((entry) => unpricedRow(byKey, entry));
}

/** `core`'s `ordering`, unpriced Raw Bases (FR-24, state 4), then recipeless classes (state 43); `belowThreshold` out. */
export function toDisplayRows(
  ranking: Ranking,
  dataset: readonly DatasetEntry[],
  {
    numbered = true,
    honestEmpty = isHonestEmpty(ranking),
    crafted = NO_CRAFTED_CONTEXT,
  }: { readonly numbered?: boolean; readonly honestEmpty?: boolean; readonly crafted?: CraftedContext } = {},
): ListRow[] {
  const byKey = new Map(dataset.map((entry) => [entry.entryKey, entry]));
  const ranked = rankedRows(ranking, byKey, crafted, numbered);
  const trailing = [...trailingRows(ranking, byKey), ...recipelessRows(ranking, byKey, crafted)];

  // State 23 prints "In canonical order": one sequence across the crafted rows and all three
  // unpriced groups and the recipeless classes, by key (a class key or a canonical key), with no numeral and every EV `—`.
  return honestEmpty
    ? [...ranked, ...trailing]
        .map((row): ListRow => ({ ...row, numeral: undefined, tier: 3, ev: MISSING }))
        .toSorted((left, right) => compareCanonicalKeys(left.key, right.key))
    : [...ranked, ...trailing];
}

/** One branch in every state but 35, where an uncostable recipe gives raw then crafted. */
export function toListBranches(active: ActiveRanking, dataset: readonly DatasetEntry[], crafted: CraftedContext): ListBranches {
  if (!active.split) {
    return [toDisplayRows(active, dataset, { crafted })];
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
    toDisplayRows(rawOnly, dataset, { numbered: false, honestEmpty: false, crafted }),
    toDisplayRows(craftedOnly, dataset, { numbered: false, honestEmpty: false, crafted }),
  ];
}
