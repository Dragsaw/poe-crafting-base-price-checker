import { describe, expect, it } from 'vitest';

import { CraftRecipeSchema, recipeWord } from './craft-recipe';
import { without } from './test-support';

const greater = {
  id: 'greater',
  currencies: [
    { currencyId: 'greater-transmute', quantity: 1 },
    { currencyId: 'greater-augment', quantity: 1 },
  ],
  modifierLevelMin: 0,
};

describe('CraftRecipeSchema', () => {
  it('parses a recipe with its currencies and its modifier-level floor', () => {
    expect(CraftRecipeSchema.parse(greater)).toEqual(greater);
  });

  it('accepts a fractional positive quantity', () => {
    const recipe = { ...greater, currencies: [{ currencyId: 'exalted', quantity: 0.5 }] };
    expect(CraftRecipeSchema.safeParse(recipe).success).toBe(true);
  });

  it('refuses a zero or negative quantity', () => {
    for (const quantity of [0, -1]) {
      const recipe = { ...greater, currencies: [{ currencyId: 'exalted', quantity }] };
      expect(CraftRecipeSchema.safeParse(recipe).success, String(quantity)).toBe(false);
    }
  });

  it('requires modifierLevelMin, a non-negative integer where 0 means no floor', () => {
    expect(CraftRecipeSchema.safeParse(without(greater, 'modifierLevelMin')).success).toBe(false);
    expect(CraftRecipeSchema.safeParse({ ...greater, modifierLevelMin: -1 }).success).toBe(false);
    expect(CraftRecipeSchema.safeParse({ ...greater, modifierLevelMin: 1.5 }).success).toBe(false);
    expect(CraftRecipeSchema.safeParse({ ...greater, modifierLevelMin: 82 }).success).toBe(true);
  });

  it('requires a non-empty id and a currency id on every line', () => {
    expect(CraftRecipeSchema.safeParse({ ...greater, id: '' }).success).toBe(false);
    const noCurrency = { ...greater, currencies: [{ currencyId: '', quantity: 1 }] };
    expect(CraftRecipeSchema.safeParse(noCurrency).success).toBe(false);
  });

  it('refuses an empty currency list, with an issue at currencies', () => {
    const result = CraftRecipeSchema.safeParse({ ...greater, currencies: [] });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([['currencies']]);
  });

  it('refuses a repeated currency id, naming the id and the first line', () => {
    const recipe = {
      ...greater,
      currencies: [
        { currencyId: 'exalted', quantity: 1 },
        { currencyId: 'chaos', quantity: 1 },
        { currencyId: 'exalted', quantity: 2 },
      ],
    };
    const result = CraftRecipeSchema.safeParse(recipe);
    expect(result.success).toBe(false);
    expect(result.error?.issues).toHaveLength(1);
    expect(result.error?.issues[0]?.path).toEqual(['currencies', 2]);
    expect(result.error?.issues[0]?.message).toContain('exalted');
    expect(result.error?.issues[0]?.message).toContain('currencies.0');
  });

  it('refuses an undeclared key', () => {
    expect(CraftRecipeSchema.safeParse({ ...greater, name: 'Greater' }).success).toBe(false);
  });
});

describe('recipeWord', () => {
  const recipeOf = (...currencyIds: string[]) => ({
    currencies: currencyIds.map((currencyId) => ({ currencyId, quantity: 1 })),
  });

  it('reads the grade every currency id shares', () => {
    expect(recipeWord(recipeOf('greater-orb-of-transmutation', 'greater-orb-of-augmentation'))).toBe('greater');
    expect(recipeWord(recipeOf('perfect-orb-of-transmutation', 'perfect-orb-of-augmentation'))).toBe('perfect');
  });

  it('reads regular when no currency carries a grade prefix', () => {
    expect(recipeWord(recipeOf('orb-of-transmutation', 'orb-of-augmentation'))).toBe('regular');
    expect(recipeWord(recipeOf())).toBe('regular');
  });

  it('counts only greater- and perfect- as grades, as a prefix with its hyphen', () => {
    expect(recipeWord(recipeOf('lesser-orb-of-transmutation'))).toBe('regular');
    expect(recipeWord(recipeOf('greaterorb'))).toBe('regular');
    expect(recipeWord(recipeOf('orb-greater-x'))).toBe('regular');
  });

  it('is undefined for mixed grades, or a grade beside an ungraded currency', () => {
    expect(recipeWord(recipeOf('greater-orb-of-transmutation', 'perfect-orb-of-augmentation'))).toBeUndefined();
    expect(recipeWord(recipeOf('greater-orb-of-transmutation', 'orb-of-augmentation'))).toBeUndefined();
  });
});
