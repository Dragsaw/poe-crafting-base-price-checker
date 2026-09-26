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
    .describe('What one craft spends. `core` costs each line at the current rate (AD-20).'),
  modifierLevelMin: z
    .int()
    .min(0)
    .describe('The modifier-level floor the recipe rolls from. Required; `0` means no floor.'),
});

export type CraftRecipe = z.infer<typeof CraftRecipeSchema>;
