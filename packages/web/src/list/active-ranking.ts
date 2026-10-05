import type { Ranking } from '@poe/core';

/** The active Craft Recipe as the list needs it: its id and the one word the control prints. */
export interface ListRecipe {
  readonly id: string;
  readonly word: string;
}

/** `core`'s ranking narrowed to the active recipe (AD-17): a filter only, no re-order. */
export interface ActiveRanking extends Ranking {
  /** The active recipe, or `undefined` when `recipes.json` holds none or is absent. */
  readonly recipe: ListRecipe | undefined;
  /** The active recipe is uncostable (AD-20). */
  readonly uncostable: boolean;
  /** EXPERIENCE.md state 35: two branches shown apart; state 23 (honest-empty) takes precedence. */
  readonly split: boolean;
}

/** Keeps Unrankable classes that hold under every recipe plus the active recipe's (state 36). */
export function forRecipe(ranking: Ranking, recipe: ListRecipe | undefined): ActiveRanking {
  const id = recipe?.id;
  const ordering = ranking.ordering.filter((row) => row.kind === 'raw' || row.recipeId === id);
  const isUncostable = id !== undefined && ranking.uncostableRecipes.some((item) => item.recipeId === id);
  return {
    ...ranking,
    ordering,
    unrankable: ranking.unrankable.filter((item) => item.recipeId === undefined || item.recipeId === id),
    recipe,
    uncostable: isUncostable,
    // State 23 takes precedence: with nothing priced in the league the list is one canonical sequence.
    split: isUncostable && ranking.pricedInLeague && ordering.some((row) => row.kind === 'crafted'),
  };
}
