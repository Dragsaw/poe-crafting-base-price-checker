import { recipeWord, type CraftRecipe, type CurrencyRate } from '@poe/contracts';
import { craftCost } from '@poe/core';

import { MONEY_PHRASES } from '../list/format';
import { formatDivine } from '../shared/money';
import type { RecipeCost, RecipeOption } from './CraftRecipe';

/**
 * Each recipe's id and the one word `recipeWord` derives for it, in file
 * order. `RecipesFileSchema` refuses a set in which a recipe derives no word,
 * so a missing word here is a broken invariant, not data.
 */
export function recipeOptions(recipes: readonly CraftRecipe[]): RecipeOption[] {
  return recipes.map((recipe) => {
    const word = recipeWord(recipe);
    if (word === undefined) {
      throw new Error(`recipe ${recipe.id} derives no word; RecipesFileSchema should have refused it`);
    }
    return { id: recipe.id, word };
  });
}

/**
 * The cost line: `core`'s Craft Cost at the page's 2dp, or *no figure yet*
 * when the recipe is uncostable (FR-26, AD-20). `web` formats; `core` costs.
 */
export function recipeCostLine(recipe: CraftRecipe, rates: readonly CurrencyRate[], league: string): RecipeCost {
  const cost = craftCost(recipe, rates, league);
  return cost.ok
    ? { kind: 'figure', text: formatDivine(cost.divine) }
    : { kind: 'phrase', text: MONEY_PHRASES.notYetSynced };
}
