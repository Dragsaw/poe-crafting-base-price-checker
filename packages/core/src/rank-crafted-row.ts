import { compareCanonicalKeys } from '@poe/contracts';
import type {
  CraftedCombination,
  CraftedRankedRow,
  CraftedSummand,
  CraftedTrackedEntry,
  CraftRecipe,
  DatasetEntry,
  WeightsClassPools,
} from '@poe/contracts';

import type { CraftCostResult } from './craft-cost.ts';
import { classKeyOf } from './crafted-classes.ts';
import { craftedTrust, type CraftedTrustEntry, entryTrust, resolvedPrice } from './price-trust.ts';
import type { CraftingItemLevel } from './crafting-item-level.ts';
import { combinationProbability, type ProbabilityResult, type RecipeScope } from './probability.ts';
import { foldPair, oldestOf } from './provenance.ts';

/** Contribution descending, then the entry's canonical key (AD-17). */
function compareSummands(left: CraftedSummand, right: CraftedSummand): number {
  return left.contribution === right.contribution ? compareCanonicalKeys(left.entryKey, right.entryKey) : right.contribution - left.contribution;
}

interface CraftedRowOptions {
  readonly first: CraftedTrackedEntry;
  readonly recipe: CraftRecipe;
  /** The Crafting Item Level `L` every crafted EV of the pair is scoped to (FR-38, AD-17). */
  readonly itemLevel: CraftingItemLevel;
  readonly cost: CraftCostResult;
  readonly pools: WeightsClassPools;
  readonly keyed: readonly { readonly entry: CraftedTrackedEntry; readonly entryKey: string }[];
  readonly byKey: ReadonlyMap<string, DatasetEntry>;
  readonly activeLeague: string;
  readonly threshold: number;
  /** ISO-8601, the clock the verdict reads ages against (AD-10). */
  readonly now: string;
}

interface SummandScan {
  readonly summands: CraftedSummand[];
  readonly combinations: CraftedCombination[];
  /** Every entry of the pair that the recipe reaches, for the share rule of *Price trust*. */
  readonly trusted: CraftedTrustEntry[];
  readonly stamps: string[];
}

const COMBINATION_GROUP = { current: 0, rough: 0, pending: 1, broken: 2 } as const;

/** Priced (current or rough), then pending, then broken, then the entry's canonical key (EXPERIENCE.md *The expansion*). */
export function compareCombinations(left: CraftedCombination, right: CraftedCombination): number {
  return (
    COMBINATION_GROUP[left.trust.verdict] - COMBINATION_GROUP[right.trust.verdict] ||
    compareCanonicalKeys(left.entryKey, right.entryKey)
  );
}

/** A pair `core` cannot rank under one recipe, with the cause it observed (AD-17, FR-4). */
export interface PairFailure {
  readonly kind: 'pair-failure';
  readonly reason: 'pool empty' | 'augment exhausted';
}

const NOT_COUNTED: ProbabilityResult = { ok: true, p: 0 };

/** An entry above `L` is skipped before its probability runs, so its slot can never fail the pair (AD-17, FR-38). */
function summandProbability(pools: WeightsClassPools, entry: CraftedTrackedEntry, scope: RecipeScope): ProbabilityResult {
  return entry.itemLevelMin > scope.itemLevel ? NOT_COUNTED : combinationProbability(pools, entry, scope);
}

/** An entry the recipe cannot reach, or whose floor is above `L`, is not a summand and stays out of the trust sums (AD-17, FR-26, FR-38). */
function scanSummands({ recipe, itemLevel, pools, keyed, byKey, activeLeague, threshold, now }: CraftedRowOptions): SummandScan | PairFailure {
  const summands: CraftedSummand[] = [];
  const combinations: CraftedCombination[] = [];
  const trusted: CraftedTrustEntry[] = [];
  // Summands only: the rates' asOf is not a timestamp input (AD-10).
  const stamps: string[] = [];
  const scope = { itemLevel, modifierLevelMin: recipe.modifierLevelMin };
  for (const { entry, entryKey } of keyed) {
    const probability = summandProbability(pools, entry, scope);
    if (!probability.ok && probability.reason.kind !== 'empty-contained') {
      return { kind: 'pair-failure', reason: probability.reason.kind === 'augment-exhausted' ? 'augment exhausted' : 'pool empty' };
    }
    const published = byKey.get(entryKey);
    const trust = entryTrust(entry, published, activeLeague, now);
    if (!probability.ok || probability.p === 0) {
      combinations.push({ entryKey, trust });
      continue;
    }
    const price = resolvedPrice(published, activeLeague);
    if (price.state !== 'priced') {
      trusted.push({ trust });
      combinations.push({ entryKey, trust });
      continue;
    }
    const { priceDivine, observedAt } = price.observation;
    const contribution = probability.p * priceDivine;
    trusted.push({ trust, gross: contribution });
    if (priceDivine < threshold) {
      combinations.push({ entryKey, trust, priceDivine });
      continue;
    }
    stamps.push(observedAt);
    summands.push({ entryKey, probability: probability.p, priceDivine, contribution, trust });
  }
  return { summands, combinations: combinations.toSorted(compareCombinations), trusted, stamps };
}

/** The lowest floor among the class's non-pruned crafted entries: the jewel-kind floor of FR-36. */
export function lowestFloorOf(keyed: readonly { readonly entry: CraftedTrackedEntry }[]): number {
  return Math.min(...keyed.map(({ entry }) => entry.itemLevelMin));
}

/** One `(Item Class, recipe)` pair (AD-17), or the failure that makes it unrankable. */
export function craftedRow(options: CraftedRowOptions): CraftedRankedRow | PairFailure {
  const { first, recipe, itemLevel, cost, pools, keyed, byKey } = options;
  const scan = scanSummands(options);
  if ('kind' in scan) {
    return scan;
  }
  const ordered = scan.summands.toSorted(compareSummands);
  const asOf = oldestOf(scan.stamps);
  // No summand: fall back to the oldest attempt among the class's entries (AD-10).
  const lastAttemptedAt =
    asOf === undefined
      ? oldestOf(keyed.flatMap(({ entryKey }) => byKey.get(entryKey)?.lastAttemptedAt ?? []))
      : undefined;
  const grossPayout = ordered.reduce((sum, summand) => sum + summand.contribution, 0);
  return {
    kind: 'crafted',
    classKey: classKeyOf(first.categoryId, first.className),
    categoryId: first.categoryId,
    className: first.className,
    itemLevelMin: lowestFloorOf(keyed),
    recipeId: recipe.id,
    grossPayout,
    craftCost: cost.ok ? cost.divine : { kind: 'uncostable', currencyId: cost.reason.currencyId },
    // eslint-disable-next-line unicorn/no-null -- boundary: `RankedRow.ev` is `z.number().nullable()` in the contracts schema.
    ev: cost.ok ? grossPayout - cost.divine : null,
    summands: ordered,
    combinations: scan.combinations,
    provenance: foldPair(pools, { itemLevel, modifierLevelMin: recipe.modifierLevelMin }),
    ...(asOf !== undefined && { asOf }),
    ...(lastAttemptedAt !== undefined && { lastAttemptedAt }),
    trust: craftedTrust({ uncostable: !cost.ok, entries: scan.trusted }),
  };
}
