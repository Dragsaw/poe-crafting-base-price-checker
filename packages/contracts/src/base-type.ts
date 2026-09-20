import { z } from 'zod';

/**
 * A trade-API base type. The identity **is** the API's own `type` string,
 * exactly as `data/items` spells it, and no component re-encodes it or derives
 * it from a `categoryId` (AD-5, Consistency Conventions, *Ids*).
 */
export const BaseTypeIdSchema = z
  .string()
  .min(1)
  .describe(
    "The trade API's base type `type` string, verbatim as `catalogue/items.json` spells it. Never re-encoded, and never derived from a categoryId.",
  );

export type BaseTypeId = z.infer<typeof BaseTypeIdSchema>;

export const BaseTypeSchema = z
  .strictObject({
    baseTypeId: BaseTypeIdSchema,
  })
  .describe('A base type, keyed on the trade API’s own `type` string (AD-5).');

export type BaseType = z.infer<typeof BaseTypeSchema>;
