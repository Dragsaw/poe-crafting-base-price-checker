/**
 * The committed catalogue as the run-start check reads it (AD-9, AD-25): three
 * flat id sets, built from `data/catalogue/stats.json`, `items.json` and
 * `filters.json`. Every endpoint answers in category groups, so each file is
 * flattened before an id is looked up. Absent or invalid is a typed load error
 * naming the file, raised before any request.
 *
 * `className` has no set here: no catalogue endpoint carries a class axis.
 */

import {
  CatalogueFiltersFileSchema,
  CatalogueItemsFileSchema,
  CatalogueStatsFileSchema,
  filterOptionIds,
  flattenItemCatalogue,
  flattenStatCatalogue,
  parseEnvelope,
} from '@poe/contracts';
import type { FilesystemPort } from '@poe/contracts';

import { loadDataFile } from '../load-data-file.ts';
import type { DataFileResult } from '../load-data-file.ts';
import { CATALOGUE_ITEMS_PATH } from '../pricing/load-item-types.ts';

export const CATALOGUE_STATS_PATH = 'data/catalogue/stats.json';
export const CATALOGUE_FILTERS_PATH = 'data/catalogue/filters.json';

export interface CatalogueIds {
  /** Every stat id in `stats.json`, across every group. */
  readonly statIds: ReadonlySet<string>;
  /** Every base type (`type`) in `items.json`, across every group. */
  readonly baseTypeIds: ReadonlySet<string>;
  /** The `category` filter's option ids in `filters.json`, the `"Any"` sentinel dropped. */
  readonly categoryIds: ReadonlySet<string>;
}

export async function loadCatalogueIds(fs: FilesystemPort): Promise<DataFileResult<CatalogueIds>> {
  const stats = await loadDataFile(fs, CATALOGUE_STATS_PATH, (data) =>
    parseEnvelope(CatalogueStatsFileSchema, data),
  );
  if (!stats.ok) {
    return stats;
  }
  const items = await loadDataFile(fs, CATALOGUE_ITEMS_PATH, (data) =>
    parseEnvelope(CatalogueItemsFileSchema, data),
  );
  if (!items.ok) {
    return items;
  }
  const filters = await loadDataFile(fs, CATALOGUE_FILTERS_PATH, (data) =>
    parseEnvelope(CatalogueFiltersFileSchema, data),
  );
  if (!filters.ok) {
    return filters;
  }
  return {
    ok: true,
    value: {
      statIds: new Set(flattenStatCatalogue(stats.value).map((entry) => entry.id)),
      baseTypeIds: new Set(flattenItemCatalogue(items.value).map((entry) => entry.type)),
      categoryIds: new Set(filterOptionIds(filters.value, 'category')),
    },
  };
}
