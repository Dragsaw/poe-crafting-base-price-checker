import { describe, expect, it } from 'vitest';

import { CraftRecipeSchema } from './craft-recipe';
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

  it('refuses an undeclared key', () => {
    expect(CraftRecipeSchema.safeParse({ ...greater, name: 'Greater' }).success).toBe(false);
  });
});
