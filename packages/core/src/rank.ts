import { canonicalKey, compareCanonicalKeys } from '@poe/contracts';
import type {
  CraftedTrackedEntry,
  CraftRecipe,
  CurrencyRate,
  DatasetEntry,
  RankedRow,
  RawRankedRow,
  TrackedEntry,
  WeightsClassPools,
  WeightsFile,
} from '@poe/contracts';

import { craftCost, type CraftCostResult } from './craft-cost.ts';
import { classKeyOf, craftedClassesOf } from './crafted-classes.ts';
import type { CrossFileFailure } from './cross-file.ts';
import { isEmptyPool, poolOf } from './probability.ts';
import { compareOrdering } from './rank-order.ts';
import { craftedRow } from './rank-crafted-row.ts';
import { groupRawEntries, type NotYetSyncedEntry, type UnrankedEntry } from './rank-raw-groups.ts';

export { compareRankedRows } from './rank-order.ts';
export type { NotYetSyncedEntry, UnrankedEntry } from './rank-raw-groups.ts';

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
   * The parsed weights file, or `undefined` when it is absent (AD-24). A crafted
   * Item Class whose pair is missing from it, or with no file at all, is
   * Unrankable as `class absent from weights file`; one with a `partial` slot
   * is Unrankable as `pool partial` (FR-4).
   */
  readonly weights: WeightsFile | undefined;
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
 * file; `class disagrees with weights file` is any of the six cross-file
 * checks (`cross-file.ts`), one string for all six. `recipe cannot reach this
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
 * The reason for an `(Item Class, recipe)` pair whose eligible pool is empty
 * after the recipe floor (`empty-eligible-pool`), or where a reference
 * contains no eligible tier (`empty-contained`, both IN §9), or whose augment
 * has nothing left to add (`augment-exhausted`, IN §11). The string lives in
 * code, not in `prd.md`.
 */
export const RECIPE_UNREACHABLE = 'recipe cannot reach this class';

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
  weights: WeightsFile | undefined,
  categoryId: string,
  className: string,
): UnrankableReason | undefined {
  const classes = weights !== undefined && Object.hasOwn(weights.bases, categoryId) ? weights.bases[categoryId] : undefined;
  const pools = classes !== undefined && Object.hasOwn(classes, className) ? classes[className] : undefined;
  if (pools === undefined) {
    return 'class absent from weights file';
  }
  if (pools.prefix.poolCoverage === 'partial' || pools.suffix.poolCoverage === 'partial') {
    return 'pool partial';
  }
  // One definition with `poolCoverage` (IN §3): an empty slot makes the class unrankable under every recipe.
  return isEmptyPool(pools.prefix) || isEmptyPool(pools.suffix) ? RECIPE_UNREACHABLE : undefined;
}

interface RankableClass {
  readonly pools: WeightsClassPools;
  readonly entries: CraftedTrackedEntry[];
}

interface CraftedClasses {
  /** Keyed on the serialised pair, so one class with several entries is one row. */
  readonly unrankable: Map<string, UnrankableClass>;
  /** The non-pruned crafted entries of each rankable class, keyed on the serialised pair. */
  readonly rankable: Map<string, RankableClass>;
}

function claimReasonOf(
  input: RankInput,
  disagreeing: ReadonlySet<string>,
  classKey: string,
  first: CraftedTrackedEntry,
): UnrankableReason | undefined {
  return (
    unrankableReasonOf(input.weights, first.categoryId, first.className) ??
    (disagreeing.has(classKey) ? 'class disagrees with weights file' : undefined)
  );
}

function sortCraftedClasses(input: RankInput): CraftedClasses {
  const disagreeing = new Set(
    (input.crossFileFailures ?? []).map((failure) => classKeyOf(failure.categoryId, failure.className)),
  );
  const unrankable = new Map<string, UnrankableClass>();
  const rankable = new Map<string, RankableClass>();
  for (const [classKey, members] of craftedClassesOf(input.tracked)) {
    const [first] = members;
    if (first === undefined) {
      continue;
    }
    const { categoryId, className } = first;
    const reason = claimReasonOf(input, disagreeing, classKey, first);
    if (reason !== undefined) {
      unrankable.set(classKey, { categoryId, className, reason });
      continue;
    }
    const lookup = input.weights === undefined ? undefined : poolOf(input.weights, categoryId, className);
    if (lookup?.ok === true) {
      rankable.set(classKey, { pools: lookup.pools, entries: members });
    }
  }
  return { unrankable, rankable };
}

interface CostedRecipe {
  readonly recipe: CraftRecipe;
  readonly cost: CraftCostResult;
}

interface RankClassContext {
  readonly costed: readonly CostedRecipe[];
  readonly byKey: ReadonlyMap<string, DatasetEntry>;
  readonly input: RankInput;
}

function rankCraftedClass(
  { pools, entries }: RankableClass,
  { costed, byKey, input }: RankClassContext,
  surviving: RankedRow[],
  unrankable: Map<string, UnrankableClass>,
): void {
  // Canonical key order, so the summation order and so the figure never depend on the input order.
  const keyed = entries
    .map((entry) => ({ entry, entryKey: canonicalKey(entry) }))
    .toSorted((left, right) => compareCanonicalKeys(left.entryKey, right.entryKey));
  const first = keyed[0]?.entry;
  if (first === undefined) {
    return;
  }
  if (costed.length === 0) {
    // No recipe exists to try, so the class would be in neither list nor appendix. Retro item 29.
    unrankable.set(classKeyOf(first.categoryId, first.className), {
      categoryId: first.categoryId,
      className: first.className,
      reason: RECIPE_UNREACHABLE,
    });
    return;
  }
  for (const { recipe, cost } of costed) {
    const row = craftedRow({ first, recipe, cost, pools, keyed, byKey, activeLeague: input.activeLeague, threshold: input.threshold });
    if (row === undefined) {
      unrankable.set(JSON.stringify([classKeyOf(first.categoryId, first.className), recipe.id]), {
        categoryId: first.categoryId,
        className: first.className,
        reason: RECIPE_UNREACHABLE,
        recipeId: recipe.id,
      });
    } else {
      surviving.push(row);
    }
  }
}

function hasPricedInLeague(input: RankInput, byKey: ReadonlyMap<string, DatasetEntry>): boolean {
  return input.tracked.some((entry) => {
    if (entry.status === 'pruned') {
      return false;
    }
    const price = byKey.get(canonicalKey(entry))?.price;
    return price?.state === 'priced' && price.observation.league === input.activeLeague;
  });
}

function uncostableOf(costed: readonly CostedRecipe[]): UncostableRecipe[] {
  const uncostable: UncostableRecipe[] = [];
  for (const { recipe, cost } of costed) {
    if (!cost.ok) {
      uncostable.push({ recipeId: recipe.id, currencyId: cost.reason.currencyId });
    }
  }
  return uncostable;
}

export function rank(input: RankInput): Ranking {
  if (!Number.isFinite(input.threshold) || input.threshold < 0) {
    throw new RangeError(
      `rank: threshold must be a finite number >= 0, got ${String(input.threshold)}`,
    );
  }
  const byKey = new Map(input.dataset.map((published) => [published.entryKey, published]));
  const rates = input.currencyRates ?? [];
  const costed = (input.recipes ?? []).map((recipe) => ({
    recipe,
    cost: craftCost(recipe, rates, input.activeLeague),
  }));

  const raw = groupRawEntries(input.tracked, byKey, input);
  const { unrankable, rankable } = sortCraftedClasses(input);
  for (const crafted of rankable.values()) {
    rankCraftedClass(crafted, { costed, byKey, input }, raw.surviving, unrankable);
  }

  return {
    ordering: raw.surviving.toSorted(compareOrdering),
    belowThreshold: raw.belowThreshold.toSorted(byEntryKey),
    noListings: raw.noListings.toSorted(byEntryKey),
    notYetSynced: raw.notYetSynced.toSorted(byEntryKey),
    unresolvable: raw.unresolvable.toSorted(byEntryKey),
    unrankable: [...unrankable.values()].toSorted(byItemClass),
    uncostableRecipes: uncostableOf(costed),
    pricedInLeague: hasPricedInLeague(input, byKey),
  };
}
