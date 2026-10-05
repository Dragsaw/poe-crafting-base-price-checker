import { recipeWord, type CraftRecipe, type CurrencyRate } from '@poe/contracts';
import { craftCost } from '@poe/core';

import { MONEY_PHRASES } from '../list/format';
import { formatDivine } from '../shared/money';
import type { RecipeCost, RecipeOption } from './CraftRecipe';

/** Each recipe's id and `recipeWord`, in file order; a missing word breaks a schema invariant. */
export function recipeOptions(recipes: readonly CraftRecipe[]): RecipeOption[] {
  return recipes.map((recipe) => {
    const word = recipeWord(recipe);
    if (word === undefined) {
      throw new Error(`recipe ${recipe.id} derives no word; RecipesFileSchema should have refused it`);
    }
    return { id: recipe.id, word };
  });
}

/** Craft Cost at 2dp, or *no figure yet* if uncostable (FR-26, AD-20); `core` costs. */
export function recipeCostLine(
  recipe: CraftRecipe,
  rates: readonly CurrencyRate[],
  league: string,
  isUncostable: boolean,
): RecipeCost {
  if (isUncostable) {
    return { kind: 'phrase', text: MONEY_PHRASES.notYetSynced };
  }
  const cost = craftCost(recipe, rates, league);
  if (!cost.ok) {
    throw new Error(`recipe ${recipe.id} is costable per Ranking.uncostableRecipes but craftCost refused it`);
  }
  return { kind: 'figure', text: formatDivine(cost.divine) };
}
