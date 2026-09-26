import { z } from 'zod';

/**
 * The trade catalogue: four committed artifacts under `data/catalogue/`,
 * refreshed only by an explicit human command at GGG patch cadence (AD-25).
 *
 * **It is an identity and validation authority only** and contributes nothing
 * to any eligible pool — no tier, no item-level availability, no spawn weight.
 *
 * All four endpoints answer with **category groups**, never a flat list
 * (*verified 2026-09-12, re-checked 2026-09-13*), so every consumer flattens
 * before looking an id up and the group's `label` carries no pool meaning. The
 * flatteners below are that step, written once.
 *
 * Every schema here is a `looseObject`, deliberately, and `looseObject` rather
 * than the default `object` is the load-bearing half. These are captured
 * third-party payloads carrying fields this product does not consume: a
 * **strict** parse would refuse a live response over a field GGG added, and the
 * default **stripping** parse would silently drop that field on the way to
 * disk, so the refresh diff would stop being a diff of the API's own response —
 * which is the whole point of committing the catalogue (AD-25).
 */

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

/**
 * A static group's `label` is **optional and nullable**: the live API sends
 * `{"id": "Misc", "label": null, "entries": []}` (*verified against the
 * recorded `fixtures/trade-data-static.json`, 2026-09-20*). The label is a
 * heading and carries no pool meaning either way, so a missing one is data, not
 * a fault — and refusing it would refuse the real response.
 */
export const StaticCatalogueGroupSchema = z.looseObject({
  id: z.string(),
  label: z.string().nullable().optional(),
  entries: z.array(StaticCatalogueEntrySchema),
});

export const StaticCatalogueSchema = z.looseObject({
  result: z.array(StaticCatalogueGroupSchema),
});

/**
 * One option of one filter.
 *
 * `id` is **nullable**: most option lists the live API sends open with
 * `{"id": null, "text": "Any"}`, the sentinel for "this filter is not applied"
 * — 17 of the 19 option lists in the recorded
 * `fixtures/trade-data-filters.json` (*verified 2026-09-20, recounted
 * 2026-09-26*). The two that do not are `status`, which opens with
 * `{"id": "available", …}`, and `sale_type`, which opens with
 * `{"id": "any", …}`; both carry a real id, so the sentinel is common rather
 * than universal. Where it does appear it is not an option id and never a
 * `categoryId` — refusing it would refuse the real response, and
 * `filterOptionIds` drops it rather than handing a consumer a `null` to look an
 * id up by.
 */
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

/**
 * `/api/trade2/data/filters` — filter ids and options, **including the category
 * filter's option list**, which is the authority for `categoryId` (AD-5, AD-9).
 */
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

/**
 * The option ids of one named filter — `category` being the one AD-16's crafted
 * branch sends and AD-9 validates a `categoryId` against.
 *
 * The `"Any"` sentinel, whose `id` is `null`, is **not** an option id and is
 * dropped here: it means "this filter is not applied", so admitting it would
 * make an unfiltered search look like a validated category.
 */
export function filterOptionIds(catalogue: FilterCatalogue, filterId: string): string[] {
  return flattenFilterCatalogue(catalogue)
    .filter((filter) => filter.id === filterId)
    .flatMap((filter) => filter.option?.options ?? [])
    .map((option) => option.id)
    .filter((id): id is string => id !== null);
}
