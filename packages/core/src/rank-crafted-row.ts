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
  /** ISO-8601, the clock the verdict reads ages against (AD-10). */
  readonly now: string;
}

interface SummandScan {
  readonly summands: CraftedSummand[];
  readonly combinations: CraftedCombination[];
  /** Every entry of the pair, for the share rule of *Price trust*. */
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

/** `undefined`: the recipe cannot reach the class. P is computed priced or not, so no threshold. */
function scanSummands({ recipe, pools, keyed, byKey, activeLeague, threshold, now }: CraftedRowOptions): SummandScan | undefined {
  const summands: CraftedSummand[] = [];
  const combinations: CraftedCombination[] = [];
  const trusted: CraftedTrustEntry[] = [];
  // Summands only: the rates' asOf is not a timestamp input (AD-10).
  const stamps: string[] = [];
  for (const { entry, entryKey } of keyed) {
    const probability = combinationProbability(pools, entry, recipe.modifierLevelMin);
    if (!probability.ok) {
      return undefined;
    }
    const published = byKey.get(entryKey);
    const trust = entryTrust(entry, published, activeLeague, now);
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

function weakestProvenance({ first, recipe, pools, keyed }: CraftedRowOptions): CraftedRankedRow['provenance'] {
  let provenance = foldPair(pools, first, recipe.modifierLevelMin);
  for (const { entry } of keyed.slice(1)) {
    provenance = weakest(provenance, foldPair(pools, entry, recipe.modifierLevelMin));
  }
  return provenance;
}

/** One `(Item Class, recipe)` pair (AD-17), or `undefined` if unreachable. */
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
    combinations: scan.combinations,
    provenance: weakestProvenance(options),
    ...(asOf !== undefined && { asOf }),
    ...(lastAttemptedAt !== undefined && { lastAttemptedAt }),
    trust: craftedTrust({ uncostable: !cost.ok, entries: scan.trusted }),
  };
}
