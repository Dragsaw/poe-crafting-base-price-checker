import { z } from 'zod';

import { CurrencyIdSchema } from './currency-rate.ts';

/**
 * One Craft Recipe, as `data/recipes.json` declares it (AD-3, AD-20).
 *
 * A member of a versioned file, so it carries no `schemaVersion` of its own —
 * `RecipesFileSchema` carries it. Uniqueness of `id` is a file-level rule and
 * lives on the envelope, the same way `TrackedFileSchema` owns canonical-key
 * uniqueness.
 */
export const CraftRecipeSchema = z.strictObject({
  id: z.string().min(1).describe('The recipe id. Unique within `recipes.json`.'),
  currencies: z
    .array(
      z.strictObject({
        currencyId: CurrencyIdSchema,
        quantity: z
          .number()
          .positive()
          .describe('How many units of the currency one craft spends. Always positive.'),
      }),
    )
    .min(1, 'a recipe spends at least one currency; an empty list would cost nothing (AD-20)')
    .superRefine((lines, context) => {
      const firstIndexById = new Map<string, number>();
      lines.forEach((line, index) => {
        const first = firstIndexById.get(line.currencyId);
        if (first === undefined) {
          firstIndexById.set(line.currencyId, index);
          return;
        }
        context.addIssue({
          code: 'custom',
          path: [index],
          message: `currency id ${line.currencyId} repeats currencies.${String(first)}; an id may appear once in one recipe`,
        });
      });
    })
    .describe('What one craft spends. `core` costs each line at the current rate (AD-20).'),
  modifierLevelMin: z
    .int()
    .min(0)
    .describe('The modifier-level floor the recipe rolls from. Required; `0` means no floor.'),
});

export type CraftRecipe = z.infer<typeof CraftRecipeSchema>;

/** The currency-id prefixes that count as grades (IMPLEMENTATION-NOTES.md §9.1). */
export const RECIPE_GRADES = ['greater', 'perfect'] as const;

export type RecipeGrade = (typeof RECIPE_GRADES)[number];

/** The word a recipe with no grade prefix reads (UX memlog 233). */
export const REGULAR_RECIPE_WORD = 'regular';

export type RecipeWord = RecipeGrade | typeof REGULAR_RECIPE_WORD;

function gradeOf(currencyId: string): RecipeGrade | undefined {
  return RECIPE_GRADES.find((grade) => currencyId.startsWith(`${grade}-`));
}

/**
 * The one word the Craft Recipe control prints for a recipe (UX memlog 233):
 * the grade every currency id shares, or `regular` when none carries a grade.
 * `undefined` when the recipe mixes grades, or mixes a grade with an ungraded
 * currency — `RecipesFileSchema` refuses such a recipe. Pure; no display name
 * is coined and the file declares none.
 */
export function recipeWord(recipe: Pick<CraftRecipe, 'currencies'>): RecipeWord | undefined {
  const grades = new Set(recipe.currencies.map((line) => gradeOf(line.currencyId)));
  if (grades.size > 1) {
    return undefined;
  }
  const [grade] = grades;
  return grade ?? REGULAR_RECIPE_WORD;
}
