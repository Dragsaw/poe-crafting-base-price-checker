import type { CraftRecipe, CurrencyRate } from '@poe/contracts';

/**
 * The Craft Cost of one recipe (AD-20, FR-26): an unrated currency is uncostable, never `0`.
 */
export type CraftCostResult =
  | {
      readonly ok: true;
      readonly divine: number;
      /**
       * The `asOf` of each rate used, in recipe order; not a timestamp input of the row (AD-10).
       */
      readonly asOf: readonly string[];
    }
  | { readonly ok: false; readonly reason: { readonly kind: 'uncostable'; readonly currencyId: string } };

export function craftCost(
  recipe: Pick<CraftRecipe, 'currencies'>,
  rates: readonly CurrencyRate[],
  league: string,
): CraftCostResult {
  let divine = 0;
  const asOf: string[] = [];
  for (const line of recipe.currencies) {
    const rate = rates.find((candidate) => candidate.currencyId === line.currencyId && candidate.league === league);
    if (rate === undefined) {
      return { ok: false, reason: { kind: 'uncostable', currencyId: line.currencyId } };
    }
    divine += line.quantity * rate.rate;
    asOf.push(rate.asOf);
  }
  return { ok: true, divine, asOf };
}
