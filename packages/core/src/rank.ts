import { canonicalKey, compareCanonicalKeys } from '@poe/contracts';
import type {
  CraftedRankedRow,
  CraftedSummand,
  CraftedTrackedEntry,
  CraftRecipe,
  CurrencyRate,
  DatasetEntry,
  NotYetSyncedReason,
  RankedRow,
  RawRankedRow,
  RawTrackedEntry,
  TrackedEntry,
  WeightsClassPools,
  WeightsFile,
} from '@poe/contracts';

import { craftCost, type CraftCostResult } from './craft-cost.ts';
import { classKeyOf, craftedClassesOf } from './crafted-classes.ts';
import type { CrossFileFailure } from './cross-file.ts';
import { combinationProbability, isEmptyPool, poolOf } from './probability.ts';
import { foldPair, oldestOf, weakest } from './provenance.ts';

/**
 * The ranking, both branches (AD-17, AD-9, AD-19, AD-20, IMPLEMENTATION-NOTES.md
 * §4.1, §4.2, §9, §11).
 *
 * Pure (AD-1, AD-4). The tracked entries, the published dataset entries, the
 * active league and the Payout Threshold go in as values; a typed `Ranking`
 * comes out. Nothing is read from anywhere else and no clock is consulted.
 * Every expected data condition is a group of the result. One caller error
 * throws: a threshold that is not a finite number ≥ 0 is a `RangeError`,
 * before anything is grouped. `rank` never clamps or coerces it.
 *
 * Per non-pruned `raw` tracked entry, joined to its dataset entry by canonical
 * key:
 *
 * - no dataset entry: `notYetSynced`, reason `never-synced`.
 * - `priced` with `observation.league !== activeLeague`: `notYetSynced`,
 *   reason `league-mismatch` (AD-19). Only the observation's league is
 *   compared, and the threshold is never applied to it.
 * - `priced` with `priceDivine < threshold`: a row in `belowThreshold`, never
 *   in the ordering (FR-3, AD-17).
 * - `priced` with `priceDivine ≥ threshold`: a row in `ordering`, EV equal to
 *   the price verbatim, Craft Cost zero.
 * - `no-listings`, `unresolvable`, `not-yet-synced`: their own group, the
 *   published reason kept.
 *
 * `pruned` entries appear in no group. Each distinct non-pruned crafted
 * `(categoryId, className)` is looked up directly in the parsed weights file,
 * by `categoryId`, then `className`, and never through a sibling `className`:
 * with no file, or no such pair, it is one `unrankable` class, reason `class
 * absent from weights file` (AD-24); with either slot declaring `poolCoverage: "partial"`, reason
 * `pool partial`. A complete pair named by a cross-file failure is reason
 * `class disagrees with weights file` (AD-17); the other two reasons take
 * precedence. Otherwise a complete pair makes no claim. `poolCoverage` is trusted as
 * declared (AD-11). Dataset entries no tracked entry names are ignored.
 * `core` never reads `lastSearchId` or `lastSearchLeague` (AD-9).
 *
 * **The crafted branch (AD-17).** Every class that makes no claim above is
 * ranked once per recipe: one `(Item Class, recipe)` pair per row, every pair
 * in the one `ordering`. The pair's EV is `Σ P × price` over the entries priced
 * in the active league whose gross price is `≥ threshold`, less the recipe's
 * Craft Cost (`craftCost`, AD-20), subtracted once. P is
 * `combinationProbability` and nothing else. A pair with no surviving summand
 * ranks at `−craftCost` with `summands: []`. A pair the recipe cannot reach is
 * Unrankable under that recipe only, as `recipe cannot reach this class`. An
 * uncostable recipe still ranks its pairs, with EV `null`, after the
 * comparable rows and by gross payout (EXPERIENCE.md state 35), and is named
 * in `uncostableRecipes`.
 */

export interface RankInput {
  readonly tracked: readonly TrackedEntry[];
  /** The published dataset's entries. */
  readonly dataset: readonly DatasetEntry[];
  /** The active league, verbatim from `data/config.json` (AD-19). */
  readonly activeLeague: string;
  /**
   * The Payout Threshold in divine (FR-7). An entry survives at `price ≥ threshold`.
   * Must be finite and ≥ 0 (0 is valid); any other value makes `rank` throw a `RangeError`.
   */
  readonly threshold: number;
  /**
   * The parsed weights file, or `null` when it is absent (AD-24). A crafted
   * Item Class whose pair is missing from it, or with no file at all, is
   * Unrankable as `class absent from weights file`; one with a `partial` slot
   * is Unrankable as `pool partial` (FR-4).
   */
  readonly weights: WeightsFile | null;
  /**
   * The cross-file failures of this tracked list against `weights`, from
   * `crossFileChecks`, computed once per load by the caller. Each failure's
   * `(categoryId, className)` is Unrankable as `class disagrees with weights
   * file`, unless the lookup already gave it one of the other two reasons,
   * which take precedence. Absent means none.
   */
  readonly crossFileFailures?: readonly Pick<CrossFileFailure, 'categoryId' | 'className'>[];
  /**
   * The Craft Recipes, in `recipes.json` file order (AD-3). Every rankable
   * crafted Item Class is ranked once per recipe. Absent or empty: no crafted
   * row exists.
   */
  readonly recipes?: readonly CraftRecipe[];
  /** The rate set `core` costs recipes from: `dataset.json`'s `currencyRates` (AD-20). Absent means none. */
  readonly currencyRates?: readonly CurrencyRate[];
}

/**
 * FR-4's three reasons, verbatim (PRD-owned), and the provisional fourth. The
 * first two come from the direct lookup of the crafted pair in the weights
 * file; `class disagrees with weights file` is any of the five cross-file
 * checks (`cross-file.ts`), one string for all five. `recipe cannot reach this
 * class` is recipe-scoped and provisional (`RECIPE_UNREACHABLE`).
 */
export type UnrankableReason =
  | 'class absent from weights file'
  | 'pool partial'
  | 'class disagrees with weights file'
  | typeof RECIPE_UNREACHABLE;

/** One Unrankable Item Class: the `(categoryId, className)` pair and its reason. Never a Base Type. */
export interface UnrankableClass {
  readonly categoryId: string;
  readonly className: string;
  readonly reason: UnrankableReason;
  /**
   * Present only on the recipe-scoped form of `recipe cannot reach this
   * class`: the one recipe whose pair is unrankable. The class may rank under
   * another recipe (EXPERIENCE.md state 36). The same reason without a recipe
   * id holds under every recipe: a `complete` slot with total weight 0, the
   * same test as `poolCoverage`, or no recipe existing at all (retro item
   * 29). The other reasons carry no recipe id.
   */
  readonly recipeId?: string;
}

/** An entry that contributes nothing to the ordering — not zero, nothing (AD-9). */
export interface UnrankedEntry {
  readonly entry: RawTrackedEntry;
  readonly entryKey: string;
  /** Present where the dataset entry carries it, for the view's *tried* clock. */
  readonly lastAttemptedAt?: string;
}

export interface NotYetSyncedEntry extends UnrankedEntry {
  readonly reason: NotYetSyncedReason;
}

export interface Ranking {
  /**
   * Every ranked row, raw and crafted, over every recipe, in one ordering
   * (AD-17). First the comparable rows — raw rows and the crafted rows of a
   * costable recipe — by EV descending, then `compareRankedRows`. Then the
   * crafted rows of an uncostable recipe, whose EV is `null`: by gross payout
   * descending, then `compareRankedRows` (EXPERIENCE.md state 35). They are
   * ordered among themselves only, never against the comparable rows.
   */
  readonly ordering: readonly RankedRow[];
  /** Priced raw rows below the threshold, in canonical key order. Never in `ordering`. */
  readonly belowThreshold: readonly RawRankedRow[];
  /** In canonical key order. */
  readonly noListings: readonly UnrankedEntry[];
  /** In canonical key order, each with its reason. */
  readonly notYetSynced: readonly NotYetSyncedEntry[];
  /** In canonical key order. */
  readonly unresolvable: readonly UnrankedEntry[];
  /**
   * One per distinct non-pruned crafted `(categoryId, className)` whose pair is
   * absent from the weights file, declares a `partial` slot, has an empty
   * slot (total weight 0) or fails a cross-file check; and one per `(class, recipe)` pair the recipe cannot
   * reach. By `className` in UTF-8 code-unit order, then `categoryId`, then the
   * recipe-free row first, then `recipeId`.
   */
  readonly unrankable: readonly UnrankableClass[];
  /** The recipes `core` could not cost, in `recipes.json` file order, each naming its first unrated currency (AD-20). */
  readonly uncostableRecipes: readonly UncostableRecipe[];
  /**
   * Some non-pruned tracked entry, raw or crafted, carries a `priced`
   * observation in the active league, at any price. `false` after a league
   * reset (EXPERIENCE.md state 23): a crafted pair still ranks at minus its
   * Craft Cost, but nothing it rests on is priced.
   */
  readonly pricedInLeague: boolean;
}

/** A recipe with no active-league rate for one of its currencies (AD-20, FR-26). */
export interface UncostableRecipe {
  readonly recipeId: string;
  readonly currencyId: string;
}

/**
 * The provisional reason for an `(Item Class, recipe)` pair whose eligible
 * pool is empty after the recipe floor (`empty-eligible-pool`, IN §9), or
 * whose augment has nothing left to add (`augment-exhausted`, IN §11). Story
 * 3.4 Decision, 2026-10-02: FR-4 owns the string and may adopt or reword it.
 */
export const RECIPE_UNREACHABLE = 'recipe cannot reach this class';

/** Raw before crafted at an equal EV (AD-17). */
const KIND_ORDER: Readonly<Record<RankedRow['kind'], number>> = { raw: 0, crafted: 1 };

/** The serialised key a row breaks ties on: a raw row's canonical key, a crafted row's class key. */
function rowKey(row: RankedRow): string {
  return row.kind === 'raw' ? row.entryKey : row.classKey;
}

/**
 * The tie-break at an equal EV (AD-17, decision 2026-09-26): kind first, raw
 * before crafted; then the serialised key by `compareCanonicalKeys`, within
 * the kind — a raw row's canonical key, a crafted row's class key; then the
 * recipe id, by the same comparison. The canonical key's own leading kind tag
 * sorts `crafted` first, which is why the kind is compared explicitly before it.
 */
export function compareRankedRows(left: RankedRow, right: RankedRow): number {
  const byKind = KIND_ORDER[left.kind] - KIND_ORDER[right.kind];
  if (byKind !== 0) {
    return byKind;
  }
  const byKey = compareCanonicalKeys(rowKey(left), rowKey(right));
  if (byKey !== 0 || left.kind !== 'crafted' || right.kind !== 'crafted') {
    return byKey;
  }
  return compareCanonicalKeys(left.recipeId, right.recipeId);
}

/**
 * The one ordering (AD-17). Comparable rows first, by EV descending; then the
 * rows of an uncostable recipe, whose EV is `null`, by gross payout descending
 * (EXPERIENCE.md state 35). `compareRankedRows` breaks every tie.
 */
function compareOrdering(left: RankedRow, right: RankedRow): number {
  const leftEv = left.ev;
  const rightEv = right.ev;
  if ((leftEv === null) !== (rightEv === null)) {
    return leftEv === null ? 1 : -1;
  }
  const leftFigure = leftEv ?? (left.kind === 'crafted' ? left.grossPayout : 0);
  const rightFigure = rightEv ?? (right.kind === 'crafted' ? right.grossPayout : 0);
  if (leftFigure !== rightFigure) {
    return rightFigure - leftFigure;
  }
  return compareRankedRows(left, right);
}

/** Contribution descending, then the entry's canonical key (AD-17). */
function compareSummands(left: CraftedSummand, right: CraftedSummand): number {
  if (left.contribution !== right.contribution) {
    return right.contribution - left.contribution;
  }
  return compareCanonicalKeys(left.entryKey, right.entryKey);
}

const byEntryKey = (left: { entryKey: string }, right: { entryKey: string }): number =>
  compareCanonicalKeys(left.entryKey, right.entryKey);

/** `className` by UTF-8 code unit, as the `weights-absent` record sorts; `categoryId` breaks a shared name. */
const byItemClass = (left: UnrankableClass, right: UnrankableClass): number =>
  compareCanonicalKeys(left.className, right.className) ||
  compareCanonicalKeys(left.categoryId, right.categoryId) ||
  compareCanonicalKeys(left.recipeId ?? '', right.recipeId ?? '');

/**
 * The direct lookup `bases[categoryId][className]`, by `categoryId`, then
 * `className`, never falling back to a sibling class (WEIGHTS-FILE-SCHEMA.md, *`bases` key*).
 * Own keys only, so a pair never resolves through the object prototype.
 */
function unrankableReasonOf(
  weights: WeightsFile | null,
  categoryId: string,
  className: string,
): UnrankableReason | undefined {
  const classes = weights !== null && Object.hasOwn(weights.bases, categoryId) ? weights.bases[categoryId] : undefined;
  const pools = classes !== undefined && Object.hasOwn(classes, className) ? classes[className] : undefined;
  if (pools === undefined) {
    return 'class absent from weights file';
  }
  if (pools.prefix.poolCoverage === 'partial' || pools.suffix.poolCoverage === 'partial') {
    return 'pool partial';
  }
  // One definition with `poolCoverage` (IN §3): an empty slot makes the class unrankable under every recipe.
  if (isEmptyPool(pools.prefix) || isEmptyPool(pools.suffix)) {
    return RECIPE_UNREACHABLE;
  }
  return undefined;
}

function unranked(
  entry: RawTrackedEntry,
  entryKey: string,
  published: DatasetEntry | undefined,
): UnrankedEntry {
  return published?.lastAttemptedAt === undefined
    ? { entry, entryKey }
    : { entry, entryKey, lastAttemptedAt: published.lastAttemptedAt };
}

export function rank(input: RankInput): Ranking {
  if (!Number.isFinite(input.threshold) || input.threshold < 0) {
    throw new RangeError(
      `rank: threshold must be a finite number >= 0, got ${String(input.threshold)}`,
    );
  }
  const byKey = new Map(input.dataset.map((published) => [published.entryKey, published]));
  const recipes = input.recipes ?? [];
  const rates = input.currencyRates ?? [];

  const surviving: RankedRow[] = [];
  const belowThreshold: RawRankedRow[] = [];
  const noListings: UnrankedEntry[] = [];
  const notYetSynced: NotYetSyncedEntry[] = [];
  const unresolvable: UnrankedEntry[] = [];
  /** Keyed on the serialised pair, so one class with several entries is one row. */
  const unrankable = new Map<string, UnrankableClass>();
  const disagreeing = new Set(
    (input.crossFileFailures ?? []).map((failure) => classKeyOf(failure.categoryId, failure.className)),
  );
  /** The non-pruned crafted entries of each rankable class, keyed on the serialised pair. */
  const rankableClasses = new Map<string, { readonly pools: WeightsClassPools; readonly entries: CraftedTrackedEntry[] }>();

  for (const entry of input.tracked) {
    if (entry.status === 'pruned') {
      continue;
    }
    if (entry.kind === 'crafted') {
      continue;
    }
    const entryKey = canonicalKey(entry);
    const published = byKey.get(entryKey);
    const base = unranked(entry, entryKey, published);

    if (published === undefined) {
      notYetSynced.push({ ...base, reason: 'never-synced' });
      continue;
    }

    const price = published.price;
    switch (price.state) {
      case 'no-listings':
        noListings.push(base);
        break;
      case 'unresolvable':
        unresolvable.push(base);
        break;
      case 'not-yet-synced':
        notYetSynced.push({ ...base, reason: price.reason });
        break;
      case 'priced': {
        const { observation } = price;
        if (observation.league !== input.activeLeague) {
          notYetSynced.push({ ...base, reason: 'league-mismatch' });
          break;
        }
        const row: RawRankedRow = {
          kind: 'raw',
          entryKey,
          baseTypeId: entry.baseTypeId,
          itemLevelMin: entry.itemLevelMin,
          status: entry.status,
          ev: observation.priceDivine,
          craftCost: 0,
          observation,
          ...(base.lastAttemptedAt === undefined ? {} : { lastAttemptedAt: base.lastAttemptedAt }),
        };
        if (observation.priceDivine < input.threshold) {
          belowThreshold.push(row);
        } else {
          surviving.push(row);
        }
        break;
      }
    }
  }

  for (const [classKey, members] of craftedClassesOf(input.tracked)) {
    const [first] = members;
    if (first === undefined) {
      continue;
    }
    const { categoryId, className } = first;
    const reason =
      unrankableReasonOf(input.weights, categoryId, className) ??
      (disagreeing.has(classKey) ? 'class disagrees with weights file' : undefined);
    if (reason !== undefined) {
      unrankable.set(classKey, { categoryId, className, reason });
      continue;
    }
    const lookup = input.weights === null ? undefined : poolOf(input.weights, categoryId, className);
    if (lookup?.ok === true) {
      rankableClasses.set(classKey, { pools: lookup.pools, entries: members });
    }
  }

  const costs = recipes.map((recipe) => craftCost(recipe, rates, input.activeLeague));
  const uncostableRecipes: UncostableRecipe[] = [];
  recipes.forEach((recipe, index) => {
    const cost = costs[index];
    if (cost !== undefined && !cost.ok) {
      uncostableRecipes.push({ recipeId: recipe.id, currencyId: cost.reason.currencyId });
    }
  });

  for (const { pools, entries } of rankableClasses.values()) {
    // Canonical key order, so the summation order and so the figure never depend on the input order.
    const keyed = entries
      .map((entry) => ({ entry, entryKey: canonicalKey(entry) }))
      .toSorted((left, right) => compareCanonicalKeys(left.entryKey, right.entryKey));
    const first = keyed[0]?.entry;
    if (first === undefined) {
      continue;
    }
    if (recipes.length === 0) {
      // No recipe exists to try, so the class would be in neither list nor appendix. Retro item 29.
      unrankable.set(classKeyOf(first.categoryId, first.className), {
        categoryId: first.categoryId,
        className: first.className,
        reason: RECIPE_UNREACHABLE,
      });
      continue;
    }
    recipes.forEach((recipe, index) => {
      const cost = costs[index];
      if (cost === undefined) {
        return;
      }
      const row = craftedRow(first, recipe, cost, pools, keyed, byKey, input);
      if (row === undefined) {
        unrankable.set(JSON.stringify([classKeyOf(first.categoryId, first.className), recipe.id]), {
          categoryId: first.categoryId,
          className: first.className,
          reason: RECIPE_UNREACHABLE,
          recipeId: recipe.id,
        });
        return;
      }
      surviving.push(row);
    });
  }

  return {
    ordering: surviving.toSorted(compareOrdering),
    belowThreshold: belowThreshold.toSorted(byEntryKey),
    noListings: noListings.toSorted(byEntryKey),
    notYetSynced: notYetSynced.toSorted(byEntryKey),
    unresolvable: unresolvable.toSorted(byEntryKey),
    unrankable: [...unrankable.values()].toSorted(byItemClass),
    uncostableRecipes,
    pricedInLeague: input.tracked.some((entry) => {
      if (entry.status === 'pruned') {
        return false;
      }
      const price = byKey.get(canonicalKey(entry))?.price;
      return price?.state === 'priced' && price.observation.league === input.activeLeague;
    }),
  };
}

/**
 * One `(Item Class, recipe)` pair (AD-17), or `undefined` when the recipe
 * cannot reach it: an entry's `combinationProbability` came back
 * `empty-eligible-pool` or `augment-exhausted` (IN §9, §11) — a reason, never
 * `P = 0`. P is computed for every non-pruned entry, priced or not, so the
 * verdict does not move with the threshold or the dataset.
 *
 * A summand is an entry priced in the active league whose **gross** price is
 * at or above the threshold; its contribution is `P × price`. Nothing else is
 * summed. EV is the gross payout less the Craft Cost, subtracted once; an
 * uncostable recipe leaves EV `null`.
 */
function craftedRow(
  first: CraftedTrackedEntry,
  recipe: CraftRecipe,
  cost: CraftCostResult,
  pools: WeightsClassPools,
  keyed: readonly { readonly entry: CraftedTrackedEntry; readonly entryKey: string }[],
  byKey: ReadonlyMap<string, DatasetEntry>,
  input: RankInput,
): CraftedRankedRow | undefined {
  const summands: CraftedSummand[] = [];
  const stamps: string[] = cost.ok ? [...cost.asOf] : [];
  for (const { entry, entryKey } of keyed) {
    const probability = combinationProbability(pools, entry, recipe.modifierLevelMin);
    if (!probability.ok) {
      return undefined;
    }
    const price = byKey.get(entryKey)?.price;
    if (
      price?.state !== 'priced' ||
      price.observation.league !== input.activeLeague ||
      price.observation.priceDivine < input.threshold
    ) {
      continue;
    }
    const priceDivine = price.observation.priceDivine;
    stamps.push(price.observation.observedAt);
    summands.push({ entryKey, probability: probability.p, priceDivine, contribution: probability.p * priceDivine });
  }
  const ordered = summands.toSorted(compareSummands);
  const asOf = oldestOf(stamps);
  const grossPayout = ordered.reduce((sum, summand) => sum + summand.contribution, 0);
  return {
    kind: 'crafted',
    classKey: classKeyOf(first.categoryId, first.className),
    categoryId: first.categoryId,
    className: first.className,
    itemLevelMin: first.itemLevelMin,
    recipeId: recipe.id,
    grossPayout,
    craftCost: cost.ok ? cost.divine : { kind: 'uncostable', currencyId: cost.reason.currencyId },
    ev: cost.ok ? grossPayout - cost.divine : null,
    summands: ordered,
    provenance: keyed.map(({ entry }) => foldPair(pools, entry, recipe.modifierLevelMin)).reduce(weakest),
    ...(asOf === undefined ? {} : { asOf }),
  };
}
