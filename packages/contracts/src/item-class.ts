import { z } from 'zod';

/** An item class is the pair `(categoryId, className)`, one modifier pool: a search sends `categoryId`, the weights file keys on `className` (AD-5). */

export const CategoryIdSchema = z
  .string()
  .min(1)
  .describe(
    "A trade category filter option id, verbatim as `catalogue/filters.json` spells it (e.g. `weapon.bow`). Never a base type name.",
  );

export type CategoryId = z.infer<typeof CategoryIdSchema>;

/** The one identifier not from the trade API: a poe2db pool name, never sent to the trade site; `sync` reads its grammar to derive AD-16's class discriminator. */
export const ClassNameSchema = z
  .string()
  .min(1)
  .describe(
    'A poe2db pool name, carried verbatim and never sent to the trade site. Validated only by the cross-file gate against weights.json (AD-5, AD-25).',
  );

export type ClassName = z.infer<typeof ClassNameSchema>;

export const ItemClassSchema = z
  .strictObject({
    categoryId: CategoryIdSchema,
    className: ClassNameSchema,
  })
  .describe(
    'The (categoryId, className) pair. Neither rung identifies a pool alone: className -> categoryId is many-to-one, and className is never a value the trade API accepts (AD-5).',
  );

export type ItemClass = z.infer<typeof ItemClassSchema>;
