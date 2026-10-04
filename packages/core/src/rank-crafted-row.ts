import { compareCanonicalKeys } from '@poe/contracts';
import type { CraftedRankedRow, CraftedSummand, CraftedTrackedEntry, CraftRecipe, DatasetEntry, WeightsClassPools } from '@poe/contracts';

import type { CraftCostResult } from './craft-cost.ts';
import { classKeyOf } from './crafted-classes.ts';
import { combinationProbability } from './probability.ts';
import { foldPair, oldestOf, weakest } from './provenance.ts';

/** Contribution descending, then the entry's canonical key (AD-17). */
function compareSummands(left: CraftedSummand, right: CraftedSummand): number {
  return left.contribution === right.contribution ? compareCanonicalKeys(left.entryKey, right.entryKey) : right.contribution - left.contribution;
}

interface CraftedRowOptions {
  readonly first: CraftedTrackedEntry;
  readonly recipe: CraftRecipe;
  readonly cost: CraftCostResult;
  readonly pools: WeightsClassPools;
  readonly keyed: readonly { readonly entry: CraftedTrackedEntry; readonly entryKey: string }[];
  readonly byKey: ReadonlyMap<string, DatasetEntry>;
  readonly activeLeague: string;
  readonly threshold: number;
}

interface SummandScan {
  readonly summands: CraftedSummand[];
  readonly stamps: string[];
}

/** `undefined`: the recipe cannot reach the class. P is computed for priced and unpriced entries alike, so the verdict ignores the threshold. */
function scanSummands({ recipe, pools, keyed, byKey, activeLeague, threshold }: CraftedRowOptions): SummandScan | undefined {
  const summands: CraftedSummand[] = [];
  // Summands only: the rates' asOf is not a timestamp input (AD-10).
  const stamps: string[] = [];
  for (const { entry, entryKey } of keyed) {
    const probability = combinationProbability(pools, entry, recipe.modifierLevelMin);
    if (!probability.ok) {
      return undefined;
    }
    const price = byKey.get(entryKey)?.price;
    if (
      price?.state !== 'priced' ||
      price.observation.league !== activeLeague ||
      price.observation.priceDivine < threshold
    ) {
      continue;
    }
    const priceDivine = price.observation.priceDivine;
    stamps.push(price.observation.observedAt);
    summands.push({ entryKey, probability: probability.p, priceDivine, contribution: probability.p * priceDivine });
  }
  return { summands, stamps };
}

function weakestProvenance({ first, recipe, pools, keyed }: CraftedRowOptions): CraftedRankedRow['provenance'] {
  let provenance = foldPair(pools, first, recipe.modifierLevelMin);
  for (const { entry } of keyed.slice(1)) {
    provenance = weakest(provenance, foldPair(pools, entry, recipe.modifierLevelMin));
  }
  return provenance;
}

/** One `(Item Class, recipe)` pair (AD-17), or `undefined` when the recipe cannot reach it (IN §9, §11). */
export function craftedRow(options: CraftedRowOptions): CraftedRankedRow | undefined {
  const { first, recipe, cost, keyed, byKey } = options;
  const scan = scanSummands(options);
  if (scan === undefined) {
    return undefined;
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
    itemLevelMin: first.itemLevelMin,
    recipeId: recipe.id,
    grossPayout,
    craftCost: cost.ok ? cost.divine : { kind: 'uncostable', currencyId: cost.reason.currencyId },
    // eslint-disable-next-line unicorn/no-null -- boundary: `RankedRow.ev` is `z.number().nullable()` in the contracts schema.
    ev: cost.ok ? grossPayout - cost.divine : null,
    summands: ordered,
    provenance: weakestProvenance(options),
    ...(asOf !== undefined && { asOf }),
    ...(lastAttemptedAt !== undefined && { lastAttemptedAt }),
  };
}
