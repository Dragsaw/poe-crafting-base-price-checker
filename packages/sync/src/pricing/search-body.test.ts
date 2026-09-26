import type { TrackedEntry } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import {
  buildSearchBody,
  defenceLettersOf,
  itemTypesOf,
  UnknownClassBaseTypeError,
} from './search-body.ts';

const itemTypes = itemTypesOf({
  result: [
    { id: 'accessory', label: 'Accessories', entries: [{ type: 'Gold Amulet' }] },
    {
      id: 'jewel',
      label: 'Jewels',
      entries: [{ type: 'Emerald' }, { type: 'Time-Lost Diamond' }],
    },
  ],
});

const STATUS = { option: 'securable' };
const TRADE_FILTERS = { filters: { price: { option: 'exalted_divine' } } };
const SORT = { price: 'asc' };

function crafted(
  categoryId: string,
  className: string,
  affixes: Partial<Pick<Extract<TrackedEntry, { kind: 'crafted' }>, 'prefix' | 'suffix'>> = {
    prefix: { kind: 'banded', statId: 'explicit.stat_1', valueMin: 47, valueMax: 50.5, acceptedTier: 'T5' },
  },
): TrackedEntry {
  return { kind: 'crafted', categoryId, className, itemLevelMin: 75, ...affixes, status: 'active' };
}

describe('buildSearchBody: raw', () => {
  it('sends query.type, no category, rarity normal and the ilvl floor', () => {
    const body = buildSearchBody(
      { kind: 'raw', baseTypeId: 'Gold Amulet', itemLevelMin: 82, status: 'active' },
      itemTypes,
    );

    expect(body).toEqual({
      query: {
        status: STATUS,
        type: 'Gold Amulet',
        stats: [{ type: 'and', filters: [] }],
        filters: {
          type_filters: { filters: { ilvl: { min: 82 }, rarity: { option: 'normal' } } },
          trade_filters: TRADE_FILTERS,
        },
      },
      sort: SORT,
    });
  });
});

describe('buildSearchBody: crafted', () => {
  it('arm 1 (defence): all three keys, present at min 1, absent at max 0', () => {
    const body = buildSearchBody(crafted('armour.boots', 'Boots_str_int'), itemTypes);

    expect(body.query.type).toBeUndefined();
    expect(body.query.filters.type_filters.filters).toEqual({
      category: { option: 'armour.boots' },
      ilvl: { min: 75 },
      rarity: { option: 'magic' },
    });
    expect(body.query.filters.equipment_filters).toEqual({
      filters: { ar: { min: 1 }, ev: { max: 0 }, es: { min: 1 } },
    });
  });

  it('arm 2 (type): query.type beside the category, underscores as spaces', () => {
    const body = buildSearchBody(crafted('jewel', 'Time-Lost_Diamond'), itemTypes);

    expect(body.query.type).toBe('Time-Lost Diamond');
    expect(body.query.filters.type_filters.filters.category).toEqual({ option: 'jewel' });
    expect(body.query.filters.type_filters.filters.rarity).toEqual({ option: 'magic' });
    expect(body.query.filters.equipment_filters).toBeUndefined();
  });

  it('arm 2 refuses a base type the catalogue does not carry, naming the class', () => {
    expect(() => buildSearchBody(crafted('jewel', 'Emerld'), itemTypes)).toThrow(
      UnknownClassBaseTypeError,
    );
    expect(() => buildSearchBody(crafted('jewel', 'Emerld'), itemTypes)).toThrow(/Emerld/);
  });

  it('arm 3 (none): the category alone, no type and no equipment filters', () => {
    const body = buildSearchBody(crafted('accessory.amulet', 'Amulets'), itemTypes);

    expect(body).toEqual({
      query: {
        status: STATUS,
        stats: [
          {
            type: 'and',
            filters: [{ id: 'explicit.stat_1', value: { min: 47, max: 50.5 }, disabled: false }],
          },
        ],
        filters: {
          type_filters: {
            filters: {
              category: { option: 'accessory.amulet' },
              ilvl: { min: 75 },
              rarity: { option: 'magic' },
            },
          },
          trade_filters: TRADE_FILTERS,
        },
      },
      sort: SORT,
    });
  });

  it('arm 1 is tried before arm 2, so a defence suffix wins under a catalogue group', () => {
    const body = buildSearchBody(crafted('jewel', 'Odd_dex'), itemTypes);
    expect(body.query.type).toBeUndefined();
    expect(body.query.filters.equipment_filters?.filters).toEqual({
      ar: { max: 0 },
      ev: { min: 1 },
      es: { max: 0 },
    });
  });

  it('puts prefix and suffix in one and-group, band edges exact, disabled false', () => {
    const body = buildSearchBody(
      crafted('accessory.amulet', 'Amulets', {
        prefix: { kind: 'banded', statId: 'explicit.p', valueMin: 4.5, valueMax: 56.5 },
        suffix: { kind: 'banded', statId: 'explicit.s', valueMin: 3, valueMax: 3 },
      }),
      itemTypes,
    );

    expect(body.query.stats).toEqual([
      {
        type: 'and',
        filters: [
          { id: 'explicit.p', value: { min: 4.5, max: 56.5 }, disabled: false },
          { id: 'explicit.s', value: { min: 3, max: 3 }, disabled: false },
        ],
      },
    ]);
  });

  it('sends a valueless stat as value {} with no edges', () => {
    const body = buildSearchBody(
      crafted('accessory.amulet', 'Amulets', { prefix: { kind: 'valueless', statId: 'explicit.v' } }),
      itemTypes,
    );

    expect(body.query.stats[0].filters).toEqual([{ id: 'explicit.v', value: {}, disabled: false }]);
  });

  it('never reads acceptedTier and never emits sale_type', () => {
    const withTier = buildSearchBody(crafted('accessory.amulet', 'Amulets'), itemTypes);
    const text = JSON.stringify(withTier);
    expect(text).not.toContain('T5');
    expect(text).not.toContain('sale_type');
  });

  it('serialises one entry to one byte string', () => {
    const entry = crafted('armour.boots', 'Boots_str_int');
    expect(JSON.stringify(buildSearchBody(entry, itemTypes))).toBe(
      JSON.stringify(buildSearchBody(entry, itemTypes)),
    );
  });
});

describe('defenceLettersOf', () => {
  it.each([
    ['Body_Armours_str_dex_int', ['str', 'dex', 'int']],
    ['Boots_int', ['int']],
    ['Shields_str_dex', ['str', 'dex']],
  ])('%s carries %j', (className, letters) => {
    expect([...(defenceLettersOf(className) ?? [])].toSorted()).toEqual(letters.toSorted());
  });

  it.each(['Amulets', 'Time-Lost_Diamond', 'One_Hand_Axes', 'str', 'Boots_int_int'])(
    '%s takes the greedy run without repetition',
    (className) => {
      const letters = defenceLettersOf(className);
      if (className === 'Boots_int_int') {
        expect([...(letters ?? [])]).toEqual(['int']);
      } else {
        expect(letters).toBeUndefined();
      }
    },
  );
});
