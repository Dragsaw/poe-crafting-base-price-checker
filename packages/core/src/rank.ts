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
 * The ranking, both branches (AD-17, AD-9, AD-19, AD-20); a threshold not finite or < 0 throws.
 */

export interface RankInput {
  readonly tracked: readonly TrackedEntry[];
  /** The published dataset's entries. */
  readonly dataset: readonly DatasetEntry[];
  /** The active league, verbatim from `data/config.json` (AD-19). */
  readonly activeLeague: string;
  /** The Payout Threshold in divine (FR-7), finite and ≥ 0; any other value throws `RangeError`. */
  readonly threshold: number;
  /** Parsed weights, or `undefined` when absent (AD-24); `partial` is Unrankable (FR-4). */
  readonly weights: WeightsFile | undefined;
  /** Cross-file failures from `crossFileChecks`, once per load; other Unrankable reasons win. */
  readonly crossFileFailures?: readonly Pick<CrossFileFailure, 'categoryId' | 'className'>[];
  /** The Craft Recipes in `recipes.json` order (AD-3); absent or empty means no crafted row. */
  readonly recipes?: readonly CraftRecipe[];
  /** The rate set `core` costs recipes from: `dataset.json`'s `currencyRates` (AD-20). Absent means none. */
  readonly currencyRates?: readonly CurrencyRate[];
}

/**
 * FR-4's three reasons (PRD-owned) and the provisional fourth: two by lookup, one by cross-file.
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
   * Only on the recipe-scoped `recipe cannot reach this class`; else it holds under every recipe.
   */
  readonly recipeId?: string;
}


export interface Ranking {
  /**
   * Every ranked row over every recipe (AD-17): by EV, uncostable rows (EV `null`) last (state 35).
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
  /** One per Unrankable class and unreachable pair; by `className`, `categoryId`, `recipeId`. */
  readonly unrankable: readonly UnrankableClass[];
  /** The recipes `core` could not cost, in `recipes.json` file order, each naming its first unrated currency (AD-20). */
  readonly uncostableRecipes: readonly UncostableRecipe[];
  /** Some non-pruned entry has a `priced` observation in the active league; false after a reset. */
  readonly pricedInLeague: boolean;
}

/** A recipe with no active-league rate for one of its currencies (AD-20, FR-26). */
export interface UncostableRecipe {
  readonly recipeId: string;
  readonly currencyId: string;
}

/**
 * The reason for an empty eligible pool or contained set (IN §9) or exhausted augment (§11).
 */
export const RECIPE_UNREACHABLE = 'recipe cannot reach this class';

const byEntryKey = (left: { entryKey: string }, right: { entryKey: string }): number =>
  compareCanonicalKeys(left.entryKey, right.entryKey);

/** `className` by UTF-8 code unit, as the `weights-absent` record sorts; `categoryId` breaks a shared name. */
const byItemClass = (left: UnrankableClass, right: UnrankableClass): number =>
  compareCanonicalKeys(left.className, right.className) ||
  compareCanonicalKeys(left.categoryId, right.categoryId) ||
  compareCanonicalKeys(left.recipeId ?? '', right.recipeId ?? '');

/** The direct lookup `bases[categoryId][className]` (WEIGHTS-FILE-SCHEMA.md); own keys only. */
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
