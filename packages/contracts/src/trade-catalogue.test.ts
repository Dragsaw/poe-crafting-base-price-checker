import { describe, expect, it } from 'vitest';

import { JSON_NULL } from './test-support';
import {
  FilterCatalogueSchema,
  FilterOptionSchema,
  filterOptionIds,
  flattenFilterCatalogue,
  flattenItemCatalogue,
  flattenStatCatalogue,
  flattenStaticCatalogue,
  ItemCatalogueSchema,
  StatCatalogueSchema,
  StaticCatalogueGroupSchema,
  StaticCatalogueSchema,
  TradeCatalogueSchema,
} from './trade-catalogue';

const stats = {
  result: [
    {
      id: 'explicit',
      label: 'Explicit',
      entries: [
        { id: 'explicit.stat_1509134228', text: '# to maximum Life', type: 'explicit' },
        { id: 'explicit.stat_518292764', text: '#% increased Attack Speed', type: 'explicit' },
      ],
    },
    {
      id: 'implicit',
      label: 'Implicit',
      entries: [{ id: 'implicit.stat_1', text: '# to Strength', type: 'implicit' }],
    },
  ],
};

const items = {
  result: [
    { id: 'weapon', label: 'Weapons', entries: [{ type: 'Advanced Dualstring Bow' }] },
    { id: 'jewel', label: 'Jewels', entries: [{ type: 'Sapphire' }, { type: 'Time-Lost Diamond' }] },
  ],
};

const statics = {
  result: [
    {
      id: 'Currency',
      label: 'Currency',
      entries: [
        { id: 'divine', text: 'Divine Orb', image: '/image/divine.png' },
        { id: 'exalted', text: 'Exalted Orb' },
      ],
    },
    // The live API sends this group with a null label and no entries.
    { id: 'Misc', label: JSON_NULL, entries: [] },
  ],
};

const filters = {
  result: [
    {
      id: 'type_filters',
      title: 'Type Filters',
      filters: [
        {
          id: 'category',
          text: 'Item Category',
          option: {
            options: [
              // The live API opens every option list with this sentinel.
              { id: JSON_NULL, text: 'Any' },
              { id: 'weapon.bow', text: 'Bow' },
              { id: 'armour.chest', text: 'Body Armour' },
              { id: 'jewel', text: 'Jewel' },
            ],
          },
        },
        { id: 'ilvl', text: 'Item Level' },
      ],
    },
  ],
};

describe('the four catalogue artifacts', () => {
  it('parses each endpoint as category groups, never as a flat list', () => {
    expect(StatCatalogueSchema.safeParse(stats).success).toBe(true);
    expect(ItemCatalogueSchema.safeParse(items).success).toBe(true);
    expect(StaticCatalogueSchema.safeParse(statics).success).toBe(true);
    expect(FilterCatalogueSchema.safeParse(filters).success).toBe(true);

    // A consumer that assumed a flat list would find no entries at all.
    expect(StatCatalogueSchema.safeParse({ result: [{ id: 'x', text: 'y' }] }).success).toBe(false);
  });

  it('flattens the groups before an id is looked up', () => {
    expect(flattenStatCatalogue(StatCatalogueSchema.parse(stats)).map((entry) => entry.id)).toEqual([
      'explicit.stat_1509134228',
      'explicit.stat_518292764',
      'implicit.stat_1',
    ]);
    expect(flattenItemCatalogue(ItemCatalogueSchema.parse(items)).map((entry) => entry.type)).toEqual([
      'Advanced Dualstring Bow',
      'Sapphire',
      'Time-Lost Diamond',
    ]);
    expect(
      flattenStaticCatalogue(StaticCatalogueSchema.parse(statics)).map((entry) => entry.id),
    ).toEqual(['divine', 'exalted']);
    expect(
      flattenFilterCatalogue(FilterCatalogueSchema.parse(filters)).map((entry) => entry.id),
    ).toEqual(['category', 'ilvl']);
  });

  it("reaches the category filter's own option list, which is the categoryId authority", () => {
    // The `"Any"` sentinel is parsed — refusing it would refuse the real
    // response — and then dropped, because it is not a `categoryId`.
    expect(filterOptionIds(FilterCatalogueSchema.parse(filters), 'category')).toEqual([
      'weapon.bow',
      'armour.chest',
      'jewel',
    ]);
    expect(filterOptionIds(FilterCatalogueSchema.parse(filters), 'ilvl')).toEqual([]);
  });

  it('admits the null sentinels the API sends, and nothing further', () => {
    // `null` is the "Any" option; `""` is not an id and never was.
    expect(FilterOptionSchema.safeParse({ id: JSON_NULL, text: 'Any' }).success).toBe(true);
    expect(FilterOptionSchema.safeParse({ id: '', text: 'Any' }).success).toBe(false);

    // A group may omit its label or send it as null; anything else is a shape
    // change worth failing on.
    expect(
      StaticCatalogueGroupSchema.safeParse({ id: 'Misc', label: JSON_NULL, entries: [] }).success,
    ).toBe(true);
    expect(
      StaticCatalogueGroupSchema.safeParse({ id: 'Misc', label: 7, entries: [] }).success,
    ).toBe(false);
  });

  it('preserves fields this product does not consume, rather than stripping them', () => {
    const captured = {
      result: [
        {
          id: 'explicit',
          label: 'Explicit',
          entries: [{ id: 'explicit.stat_1', text: 'x', type: 'explicit', option: { options: [] } }],
        },
      ],
    };
    const parsed = StatCatalogueSchema.parse(captured);

    // A stripping parse would drop `option` on the way back to disk, and the
    // refresh diff would stop being a diff of GGG's own response (AD-25).
    expect(parsed).toEqual(captured);
    expect(parsed.result[0]?.entries[0]).toHaveProperty('option');
  });

  it('preserves an unconsumed field on an item entry and a filter option too', () => {
    const itemsWithExtras = {
      result: [
        {
          id: 'jewel',
          label: 'Jewels',
          entries: [{ type: 'Sapphire', disc: 'a discriminator this product ignores' }],
          unknownGroupField: 1,
        },
      ],
    };
    expect(ItemCatalogueSchema.parse(itemsWithExtras)).toEqual(itemsWithExtras);

    const filtersWithExtras = {
      result: [
        {
          id: 'type_filters',
          title: 'Type Filters',
          filters: [
            {
              id: 'category',
              option: { options: [{ id: 'jewel', text: 'Jewel', unknownOptionField: true }] },
            },
          ],
        },
      ],
    };
    expect(FilterCatalogueSchema.parse(filtersWithExtras)).toEqual(filtersWithExtras);
  });

  it('holds all four together', () => {
    expect(
      TradeCatalogueSchema.safeParse({ items, stats, static: statics, filters }).success,
    ).toBe(true);
  });
});
