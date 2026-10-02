import type { CraftRecipe, CurrencyRate } from '@poe/contracts';

/**
 * The Craft Cost of one recipe (AD-20, AD-17, FR-26).
 *
 * Pure (AD-1). `Σ quantity × rate` over the recipe's currencies, where `rate`
 * is divine per one unit (`CurrencyRateSchema`). Only a rate whose own
 * `league` is the active league is read. A currency with no rate, or only a
 * rate from another league, makes the recipe **uncostable** — never `0`, which
 * would look free and inflate every crafted EV (AD-20). The first such
 * currency, in the recipe's file order, is named.
 *
 * `core` never rounds (IMPLEMENTATION-NOTES.md §4.2): the rates arrive at 4dp
 * from `sync` and the sum is passed on as computed. `sync` never calls this.
 */
export type CraftCostResult =
  | { readonly ok: true; readonly divine: number }
  | { readonly ok: false; readonly reason: { readonly kind: 'uncostable'; readonly currencyId: string } };

export function craftCost(
  recipe: Pick<CraftRecipe, 'currencies'>,
  rates: readonly CurrencyRate[],
  league: string,
): CraftCostResult {
  let divine = 0;
  for (const line of recipe.currencies) {
    const rate = rates.find((candidate) => candidate.currencyId === line.currencyId && candidate.league === league);
    if (rate === undefined) {
      return { ok: false, reason: { kind: 'uncostable', currencyId: line.currencyId } };
    }
    divine += line.quantity * rate.rate;
  }
  return { ok: true, divine };
}
