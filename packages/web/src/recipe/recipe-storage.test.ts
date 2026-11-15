import type { CraftRecipe } from '@poe/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import { activeRecipe, readStoredRecipe, RECIPE_STORAGE_KEY, writeStoredRecipe } from './recipe-storage';
import { THRESHOLD_STORAGE_KEY } from '../threshold/threshold-storage';

const throwing = {
  getItem: (): string | null => {
    throw new Error('blocked');
  },
  setItem: (): void => {
    throw new Error('blocked');
  },
};

const recipeOf = (id: string, grade = id): CraftRecipe => ({
  id,
  currencies: [{ currencyId: `${grade}-orb-of-transmutation`, quantity: 1 }],
  modifierLevelMin: 0,
});

afterEach(() => {
  localStorage.clear();
});

describe('the persisted Craft Recipe', () => {
  it('sits beside the threshold under its own key', () => {
    expect(RECIPE_STORAGE_KEY).toBe('poe-cbpc.craftRecipe');
    expect(RECIPE_STORAGE_KEY.split('.', 1)[0]).toBe(THRESHOLD_STORAGE_KEY.split('.', 1)[0]);
  });

  it('round-trips an id, and reads nothing stored as undefined', () => {
    expect(readStoredRecipe()).toBeUndefined();
    writeStoredRecipe('perfect');
    expect(localStorage.getItem(RECIPE_STORAGE_KEY)).toBe('perfect');
    expect(readStoredRecipe()).toBe('perfect');
    localStorage.setItem(RECIPE_STORAGE_KEY, '');
    expect(readStoredRecipe()).toBeUndefined();
  });

  it('survives a storage that throws on read and on write', () => {
    expect(readStoredRecipe(throwing)).toBeUndefined();
    expect(() => {
      writeStoredRecipe('perfect', throwing);
    }).not.toThrow();
  });
});

describe('activeRecipe', () => {
  const recipes = [recipeOf('greater'), recipeOf('perfect')];

  it('is the stored recipe while recipes.json declares it', () => {
    expect(activeRecipe(recipes, 'perfect')?.id).toBe('perfect');
  });

  // I/O matrix: "Saved recipe gone".
  it('falls back to the first recipe in file order for a stored id that is gone, though `perfect` is published', () => {
    expect(activeRecipe(recipes, 'regular')?.id).toBe('greater');
  });

  // I/O matrix: "First visit".
  it('opens a first visit on the recipe whose option word is `perfect`, matched by word, not id', () => {
    expect(activeRecipe(recipes, undefined)?.id).toBe('perfect');
    expect(activeRecipe([recipeOf('perfect', 'greater'), recipeOf('top', 'perfect')], undefined)?.id).toBe('top');
  });

  it('opens a first visit on the first recipe when no recipe reads `perfect`', () => {
    expect(activeRecipe([recipeOf('greater'), recipeOf('a', 'greater')], undefined)?.id).toBe('greater');
  });

  it('is undefined with no recipe', () => {
    expect(activeRecipe([], 'perfect')).toBeUndefined();
  });
});
