import { z } from 'zod';

// Identity and validation authority only (AD-25). Endpoints answer in groups, so consumers flatten.
// `looseObject`: strict would refuse a field GGG adds, stripping would drop it from the committed
// copy, and the refresh diff would stop being a diff of the API's own response.

/** `/api/trade2/data/stats` — stat ids and their display text. */
export const StatCatalogueEntrySchema = z.looseObject({
  id: z.string().min(1),
  text: z.string(),
  type: z.string().optional(),
});

export const StatCatalogueGroupSchema = z.looseObject({
  id: z.string(),
  label: z.string(),
  entries: z.array(StatCatalogueEntrySchema),
});

export const StatCatalogueSchema = z.looseObject({
  result: z.array(StatCatalogueGroupSchema),
});

/** `/api/trade2/data/items` — base types by category. The `type` string is the `baseTypeId`. */
export const ItemCatalogueEntrySchema = z.looseObject({
  type: z.string().min(1),
  text: z.string().optional(),
  name: z.string().optional(),
});

export const ItemCatalogueGroupSchema = z.looseObject({
  id: z.string(),
  label: z.string(),
  entries: z.array(ItemCatalogueEntrySchema),
});

export const ItemCatalogueSchema = z.looseObject({
  result: z.array(ItemCatalogueGroupSchema),
});

/** `/api/trade2/data/static` — currency ids, labels and icons (icons unconsumed in v1). */
export const StaticCatalogueEntrySchema = z.looseObject({
  id: z.string().min(1),
  text: z.string(),
  image: z.string().optional(),
});

/** The live API sends `"label": null` for the `Misc` group; refusing it would refuse the response. */
export const StaticCatalogueGroupSchema = z.looseObject({
  id: z.string(),
  label: z.string().nullable().optional(),
  entries: z.array(StaticCatalogueEntrySchema),
});

export const StaticCatalogueSchema = z.looseObject({
  result: z.array(StaticCatalogueGroupSchema),
});

// `id` is null for the "Any" sentinel that opens most option lists (not `status`, `sale_type`).
// It is no option id and never a `categoryId`; `filterOptionIds` drops it, and refusing it
// would refuse the real response.
export const FilterOptionSchema = z.looseObject({
  id: z.string().min(1).nullable(),
  text: z.string().optional(),
});

export const FilterSchema = z.looseObject({
  id: z.string().min(1),
  text: z.string().optional(),
  option: z.looseObject({ options: z.array(FilterOptionSchema) }).optional(),
});

export const FilterCatalogueGroupSchema = z.looseObject({
  id: z.string(),
  title: z.string().optional(),
  filters: z.array(FilterSchema),
});

/** `/api/trade2/data/filters`; its category option list is the authority for `categoryId` (AD-5, AD-9). */
export const FilterCatalogueSchema = z.looseObject({
  result: z.array(FilterCatalogueGroupSchema),
});

/** The four artifacts together. */
export const TradeCatalogueSchema = z.looseObject({
  items: ItemCatalogueSchema,
  stats: StatCatalogueSchema,
  static: StaticCatalogueSchema,
  filters: FilterCatalogueSchema,
});

export type StatCatalogueEntry = z.infer<typeof StatCatalogueEntrySchema>;
export type StatCatalogueGroup = z.infer<typeof StatCatalogueGroupSchema>;
export type StatCatalogue = z.infer<typeof StatCatalogueSchema>;
export type ItemCatalogueEntry = z.infer<typeof ItemCatalogueEntrySchema>;
export type ItemCatalogueGroup = z.infer<typeof ItemCatalogueGroupSchema>;
export type ItemCatalogue = z.infer<typeof ItemCatalogueSchema>;
export type StaticCatalogueEntry = z.infer<typeof StaticCatalogueEntrySchema>;
export type StaticCatalogueGroup = z.infer<typeof StaticCatalogueGroupSchema>;
export type StaticCatalogue = z.infer<typeof StaticCatalogueSchema>;
export type FilterOption = z.infer<typeof FilterOptionSchema>;
export type CatalogueFilter = z.infer<typeof FilterSchema>;
export type FilterCatalogueGroup = z.infer<typeof FilterCatalogueGroupSchema>;
export type FilterCatalogue = z.infer<typeof FilterCatalogueSchema>;
export type TradeCatalogue = z.infer<typeof TradeCatalogueSchema>;

/** Every stat, across every group. A consumer looks an id up here, never in `result`. */
export function flattenStatCatalogue(catalogue: StatCatalogue): StatCatalogueEntry[] {
  return catalogue.result.flatMap((group) => group.entries);
}

export function flattenItemCatalogue(catalogue: ItemCatalogue): ItemCatalogueEntry[] {
  return catalogue.result.flatMap((group) => group.entries);
}

export function flattenStaticCatalogue(catalogue: StaticCatalogue): StaticCatalogueEntry[] {
  return catalogue.result.flatMap((group) => group.entries);
}

export function flattenFilterCatalogue(catalogue: FilterCatalogue): CatalogueFilter[] {
  return catalogue.result.flatMap((group) => group.filters);
}

/** Drops the null "Any" sentinel: admitting it would make an unfiltered search look validated (AD-9). */
export function filterOptionIds(catalogue: FilterCatalogue, filterId: string): string[] {
  return flattenFilterCatalogue(catalogue)
    .filter((filter) => filter.id === filterId)
    .flatMap((filter) => filter.option?.options ?? [])
    .map((option) => option.id)
    .filter((id): id is string => id !== null);
}
