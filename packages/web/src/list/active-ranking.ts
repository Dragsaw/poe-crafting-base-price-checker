import type { Ranking } from '@poe/core';

/** The active Craft Recipe as the list needs it: its id and the one word the control prints. */
export interface ListRecipe {
  readonly id: string;
  readonly word: string;
}

/**
 * `core`'s ranking narrowed to the active recipe (AD-17: `core` orders every
 * `(Item Class, recipe)` pair; `web` filters, then bounds). A filter only: no
 * row is re-ordered and no term is computed.
 */
export interface ActiveRanking extends Ranking {
  /** The active recipe, or `undefined` when `recipes.json` holds none or is absent. */
  readonly recipe: ListRecipe | undefined;
  /** The active recipe is uncostable (AD-20). */
  readonly uncostable: boolean;
  /**
   * State 35: the recipe is uncostable, a crafted row is on the list and the
   * list is not honest-empty (state 23 takes precedence), so the two branches
   * are shown apart, with no rank numeral (EXPERIENCE.md).
   */
  readonly split: boolean;
}

/**
 * Keeps every raw row and the crafted rows of the active recipe, in `core`'s
 * order, and the Unrankable classes that hold under every recipe plus the
 * pairs of the active recipe (state 36). With no recipe, no crafted row is
 * kept.
 */
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
