import { type CraftRecipe, RecipesFileSchema } from '@poe/contracts';

import { LookupError } from './lookup-error.ts';
import { type ReadJson } from './lookup-weights.ts';

export const RECIPES_PATH = 'data/recipes.json';

/** The recipes, or none when the file is unusable: the reach column is advice and no lookup fails on it. */
export function loadRecipes(read: ReadJson): readonly CraftRecipe[] {
  try {
    const parsed = RecipesFileSchema.safeParse(read(RECIPES_PATH));
    return parsed.success ? parsed.data.recipes : [];
  } catch (error) {
    if (error instanceof LookupError) {
      return [];
    }
    throw error;
  }
}
