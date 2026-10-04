import { describe, expect, it } from 'vitest';

import { parseEnvelope, RecipesFileSchema } from '../envelopes';
import { INITIAL_SCHEMA_VERSION } from '../schema-version';

function recipesFileOf(recipes: readonly unknown[]) {
  return { schemaVersion: INITIAL_SCHEMA_VERSION, recipes };
}

function recipesIssuesOf(recipes: readonly unknown[]) {
  const result = parseEnvelope(RecipesFileSchema, recipesFileOf(recipes));
  if (result.ok || result.reason !== 'invalid') {
    throw new Error(`expected an invalid refusal, got ${JSON.stringify(result)}`);
  }
  return result.issues;
}

describe('RecipesFileSchema', () => {
  const recipe = {
    id: 'greater',
    currencies: [{ currencyId: 'greater-transmute', quantity: 1 }],
    modifierLevelMin: 0,
  } as const;

  const perfect = {
    id: 'perfect',
    currencies: [{ currencyId: 'perfect-transmute', quantity: 1 }],
    modifierLevelMin: 70,
  } as const;

  it('parses a versioned file of recipes', () => {
    const result = parseEnvelope(RecipesFileSchema, recipesFileOf([recipe, perfect]));
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.recipes).toHaveLength(2);
  });

  it('accepts one regular recipe beside graded ones', () => {
    const regular = { id: 'regular', currencies: [{ currencyId: 'orb-of-transmutation', quantity: 1 }], modifierLevelMin: 0 };
    expect(parseEnvelope(RecipesFileSchema, recipesFileOf([recipe, perfect, regular])).ok).toBe(true);
  });

  it('refuses a recipe that mixes grades, with one issue at its index naming it', () => {
    const mixed = {
      id: 'mixed',
      currencies: [
        { currencyId: 'greater-transmute', quantity: 1 },
        { currencyId: 'perfect-augment', quantity: 1 },
      ],
      modifierLevelMin: 44,
    };
    const issues = recipesIssuesOf([perfect, mixed]);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.path).toEqual(['recipes', 1]);
    expect(issues[0]?.message).toContain('mixed');
    expect(recipesIssuesOf([{ ...mixed, currencies: [mixed.currencies[0], { currencyId: 'exalted', quantity: 1 }] }])).toHaveLength(1);
  });

  it('refuses two recipes that derive one word, naming the word and the first recipe', () => {
    const issues = recipesIssuesOf([recipe, perfect, { ...recipe, id: 'greater-too' }]);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.path).toEqual(['recipes', 2]);
    expect(issues[0]?.message).toContain('greater');
    expect(issues[0]?.message).toContain('recipes.0');
  });

  it('declares schemaVersion and refuses a file with none', () => {
    expect(Object.keys(RecipesFileSchema.shape)).toContain('schemaVersion');
    expect(RecipesFileSchema.safeParse({ recipes: [] }).success).toBe(false);
  });

  it('refuses a repeated id with one issue at the repeat, naming the id and the first index', () => {
    const result = parseEnvelope(RecipesFileSchema, recipesFileOf([recipe, { ...recipe, modifierLevelMin: 5 }]));
    if (result.ok || result.reason !== 'invalid') {
      throw new Error(`expected an invalid refusal, got ${JSON.stringify(result)}`);
    }
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.path).toEqual(['recipes', 1]);
    expect(result.issues[0]?.message).toContain('greater');
    expect(result.issues[0]?.message).toContain('recipes.0');
  });

  it('accepts an empty list', () => {
    expect(parseEnvelope(RecipesFileSchema, recipesFileOf([])).ok).toBe(true);
  });
});
