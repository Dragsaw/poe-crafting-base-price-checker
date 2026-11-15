/** The active recipe's persisted value (EXPERIENCE.md *What survives a reload*; FR-7, AD-15). */

import { recipeWord, type CraftRecipe } from '@poe/contracts';

export const RECIPE_STORAGE_KEY = 'poe-cbpc.craftRecipe';

/** The option word a first visit shows (EXPERIENCE.md *What survives a reload*). */
const FIRST_VISIT_RECIPE_WORD = 'perfect';

function defaultStorage(): Storage {
  return globalThis.localStorage;
}

/** The stored recipe id, read once at mount, or `undefined` when nothing usable is stored. */
export function readStoredRecipe(storage?: Pick<Storage, 'getItem'>): string | undefined {
  try {
    const raw = (storage ?? defaultStorage()).getItem(RECIPE_STORAGE_KEY);
    return raw === null || raw === '' ? undefined : raw;
  } catch {
    return undefined;
  }
}

/** Persists the active recipe id. A storage that throws is ignored. */
export function writeStoredRecipe(recipeId: string, storage?: Pick<Storage, 'setItem'>): void {
  try {
    (storage ?? defaultStorage()).setItem(RECIPE_STORAGE_KEY, recipeId);
  } catch {
    // Browser storage is a convenience: a blocked write leaves the page as it is.
  }
}

/**
 * The stored id if `recipes.json` declares it, else the first recipe. With nothing stored, the recipe
 * whose option word is `perfect`, else the first. `undefined` if none (*What survives a reload*).
 */
export function activeRecipe(
  recipes: readonly CraftRecipe[],
  storedId: string | undefined,
): CraftRecipe | undefined {
  const found =
    storedId === undefined
      ? recipes.find((recipe) => recipeWord(recipe) === FIRST_VISIT_RECIPE_WORD)
      : recipes.find((recipe) => recipe.id === storedId);
  return found ?? recipes[0];
}
