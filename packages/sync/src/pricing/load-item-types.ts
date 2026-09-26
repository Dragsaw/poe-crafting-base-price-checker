/**
 * `data/catalogue/items.json` — the committed item catalogue, read as the
 * search builder's `ItemTypes` (AD-25). Absent or invalid is a typed load
 * error naming the file, refused before any request.
 */

import { CatalogueItemsFileSchema, parseEnvelope } from '@poe/contracts';
import type { FilesystemPort } from '@poe/contracts';

import { loadDataFile } from '../load-data-file.ts';
import type { DataFileResult } from '../load-data-file.ts';
import { itemTypesOf } from './search-body.ts';
import type { ItemTypes } from './search-body.ts';

export const CATALOGUE_ITEMS_PATH = 'data/catalogue/items.json';

export async function loadItemTypes(fs: FilesystemPort): Promise<DataFileResult<ItemTypes>> {
  const loaded = await loadDataFile(fs, CATALOGUE_ITEMS_PATH, (data) =>
    parseEnvelope(CatalogueItemsFileSchema, data),
  );
  return loaded.ok ? { ok: true, value: itemTypesOf(loaded.value) } : loaded;
}
