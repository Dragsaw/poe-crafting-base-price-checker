import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { createFakeFilesystemPort } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { DataFileError } from '../load-data-file.ts';
import { JSON_NULL } from '../test-support/json-null.ts';
import { CATALOGUE_ITEMS_PATH } from '../pricing/load-item-types.ts';
import { CATALOGUE_FILTERS_PATH, CATALOGUE_STATS_PATH, loadCatalogueIds } from './catalogue-ids.ts';

const STATS = {
  schemaVersion: '1.0.0',
  result: [
    { id: 'pseudo', label: 'Pseudo', entries: [{ id: 'pseudo.a', text: 'a' }] },
    { id: 'explicit', label: 'Explicit', entries: [{ id: 'explicit.b', text: 'b' }] },
  ],
};
const ITEMS = {
  schemaVersion: '1.0.0',
  result: [
    { id: 'accessory', label: 'Accessories', entries: [{ type: 'Gold Amulet' }] },
    { id: 'jewel', label: 'Jewels', entries: [{ type: 'Emerald' }, { type: 'Emerald', name: 'Unique' }] },
  ],
};
const FILTERS = {
  schemaVersion: '1.0.0',
  result: [
    {
      id: 'type_filters',
      filters: [
        {
          id: 'category',
          option: {
            options: [
              { id: JSON_NULL, text: 'Any' },
              { id: 'weapon.bow', text: 'Bow' },
            ],
          },
        },
        { id: 'rarity', option: { options: [{ id: 'magic', text: 'Magic' }] } },
      ],
    },
  ],
};

function fsWith(overrides: Record<string, string | undefined> = {}) {
  const files: Record<string, string | undefined> = {
    [CATALOGUE_STATS_PATH]: JSON.stringify(STATS),
    [CATALOGUE_ITEMS_PATH]: JSON.stringify(ITEMS),
    [CATALOGUE_FILTERS_PATH]: JSON.stringify(FILTERS),
    ...overrides,
  };
  return createFakeFilesystemPort(
    Object.fromEntries(
      Object.entries(files).flatMap(([path, contents]) => (contents === undefined ? [] : [[path, { contents }]])),
    ),
  );
}

const read = (path: string): string =>
  readFileSync(fileURLToPath(new URL(`../../../../${path}`, import.meta.url)), 'utf8');

describe('loadCatalogueIds', () => {
  it('flattens every group of the three files into id sets', async () => {
    const loaded = await loadCatalogueIds(fsWith());
    expect(loaded).toEqual({
      ok: true,
      value: {
        statIds: new Set(['pseudo.a', 'explicit.b']),
        baseTypeIds: new Set(['Gold Amulet', 'Emerald']),
        categoryIds: new Set(['weapon.bow']),
      },
    });
  });

  it('never admits the "Any" sentinel or another filter’s options as a category', async () => {
    const loaded = await loadCatalogueIds(fsWith());
    expect(loaded.ok && [...loaded.value.categoryIds]).toEqual(['weapon.bow']);
  });

  it.each([CATALOGUE_STATS_PATH, CATALOGUE_ITEMS_PATH, CATALOGUE_FILTERS_PATH])(
    'refuses an absent or invalid %s with a typed error naming it',
    async (path) => {
      const bodies = [undefined, '{"schemaVersion":"1.0.0"}', '{"schemaVersion":"2.0.0","result":[]}'];
      await Promise.all(
        bodies.map(async (contents) => {
          const loaded = await loadCatalogueIds(fsWith({ [path]: contents }));
          expect(loaded.ok).toBe(false);
          if (loaded.ok) {
            return;
          }

          expect(loaded.error).toBeInstanceOf(DataFileError);
          expect(loaded.error.path).toBe(path);
        }),
      );
    },
  );

  it('loads the committed catalogue', async () => {
    const loaded = await loadCatalogueIds(
      fsWith({
        [CATALOGUE_STATS_PATH]: read(CATALOGUE_STATS_PATH),
        [CATALOGUE_ITEMS_PATH]: read(CATALOGUE_ITEMS_PATH),
        [CATALOGUE_FILTERS_PATH]: read(CATALOGUE_FILTERS_PATH),
      }),
    );
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) {
      return;
    }

    expect(loaded.value.statIds.size).toBeGreaterThan(0);
    expect(loaded.value.baseTypeIds.size).toBeGreaterThan(0);
    expect(loaded.value.categoryIds.has('jewel')).toBe(true);
  });
});
