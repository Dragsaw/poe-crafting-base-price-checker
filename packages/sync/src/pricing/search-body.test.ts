import { defenceLettersOf } from '@poe/contracts';
import type { TrackedEntry } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import {
  buildSearchBody,
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

type Affixes = Pick<Extract<TrackedEntry, { kind: 'crafted' }>, 'prefix' | 'suffix'>;

const DEFAULT_AFFIXES: Affixes = {
  prefix: { kind: 'banded', statId: 'explicit.stat_1', valueMin: 47, valueMax: 50.5, acceptedTier: 'T5' },
  suffix: { kind: 'valueless', statId: 'explicit.stat_2', acceptedTier: 'T5' },
};

function crafted(
  categoryId: string,
  className: string,
  affixes: Affixes = DEFAULT_AFFIXES,
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
            filters: [
              { id: 'explicit.stat_1', value: { min: 47, max: 50.5 }, disabled: false },
              { id: 'explicit.stat_2', value: {}, disabled: false },
            ],
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
      crafted('accessory.amulet', 'Amulets', {
        prefix: { kind: 'valueless', statId: 'explicit.v' },
        suffix: { kind: 'banded', statId: 'explicit.s', valueMin: 3, valueMax: 3 },
      }),
      itemTypes,
    );

    expect(body.query.stats[0].filters).toEqual([
      { id: 'explicit.v', value: {}, disabled: false },
      { id: 'explicit.s', value: { min: 3, max: 3 }, disabled: false },
    ]);
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

describe('buildSearchBody: a hybrid reference', () => {
  it('sends one filter per line under the one and group: {min,max} banded, {} valueless', () => {
    const entry = crafted('weapon.bow', 'Bows', {
      prefix: {
        kind: 'hybrid',
        lines: [
          { statId: 'explicit.stat_1', valueMin: 10, valueMax: 20.5 },
          { statId: 'explicit.stat_3' },
        ],
      },
      suffix: { kind: 'valueless', statId: 'explicit.stat_2' },
    });
    const body = buildSearchBody(entry, itemTypes);

    expect(body.query.stats).toEqual([
      {
        type: 'and',
        filters: [
          { id: 'explicit.stat_1', value: { min: 10, max: 20.5 }, disabled: false },
          { id: 'explicit.stat_3', value: {}, disabled: false },
          { id: 'explicit.stat_2', value: {}, disabled: false },
        ],
      },
    ]);
  });

  it('expands a hybrid suffix after the prefix and leaves the rest of the body unchanged', () => {
    const entry = crafted('weapon.bow', 'Bows', {
      prefix: { kind: 'valueless', statId: 'explicit.stat_2' },
      suffix: {
        kind: 'hybrid',
        lines: [
          { statId: 'explicit.stat_1', valueMin: 1, valueMax: 2 },
          { statId: 'explicit.stat_3', valueMin: 3, valueMax: 4 },
        ],
      },
    });
    const body = buildSearchBody(entry, itemTypes);

    expect(body.query.stats[0].filters.map((f) => f.id)).toEqual([
      'explicit.stat_2',
      'explicit.stat_1',
      'explicit.stat_3',
    ]);
    expect(body.query.filters.type_filters.filters.rarity).toEqual({ option: 'magic' });
  });
});

const filtersOf = (entry: TrackedEntry) => buildSearchBody(entry, itemTypes).query.stats[0].filters;
const ids = (entry: TrackedEntry) => filtersOf(entry).map((filter) => filter.id);

describe('buildSearchBody: a summed statId (IMPLEMENTATION-NOTES.md §5.5)', () => {
  const RARITY = 'explicit.stat_3917489142';
  const PHYS = 'explicit.stat_1509134228';
  const ACCURACY = 'explicit.stat_691932474';
  const LIGHT = 'explicit.stat_1263695895';

  it('pure + pure: one rarity filter whose edges are the sums', () => {
    const entry = crafted('accessory.amulet', 'Amulets', {
      prefix: { kind: 'banded', statId: RARITY, valueMin: 16, valueMax: 19, acceptedTier: 'T1' },
      suffix: { kind: 'banded', statId: RARITY, valueMin: 15, valueMax: 18, acceptedTier: 'T1' },
    });
    expect(filtersOf(entry)).toEqual([{ id: RARITY, value: { min: 31, max: 37 }, disabled: false }]);
  });

  it('hybrid + pure: one summed filter in the prefix line’s place, and the other hybrid line', () => {
    const entry = crafted('weapon.bow', 'Bows', {
      prefix: {
        kind: 'hybrid',
        lines: [
          { statId: PHYS, valueMin: 75, valueMax: 79 },
          { statId: ACCURACY, valueMin: 175, valueMax: 200 },
        ],
      },
      suffix: { kind: 'banded', statId: ACCURACY, valueMin: 41, valueMax: 60 },
    });
    expect(filtersOf(entry)).toEqual([
      { id: PHYS, value: { min: 75, max: 79 }, disabled: false },
      { id: ACCURACY, value: { min: 216, max: 260 }, disabled: false },
    ]);
  });

  it('pure + hybrid: the summed filter sits at the prefix, the suffix’s other line follows', () => {
    const entry = crafted('weapon.bow', 'Bows', {
      prefix: { kind: 'banded', statId: ACCURACY, valueMin: 551, valueMax: 650 },
      suffix: {
        kind: 'hybrid',
        lines: [
          { statId: LIGHT, valueMin: 15, valueMax: 15 },
          { statId: ACCURACY, valueMin: 41, valueMax: 60 },
        ],
      },
    });
    expect(filtersOf(entry)).toEqual([
      { id: ACCURACY, value: { min: 592, max: 710 }, disabled: false },
      { id: LIGHT, value: { min: 15, max: 15 }, disabled: false },
    ]);
  });

  it('hybrid + hybrid: the Bows phys%+accuracy prefix with LightRadiusAndAccuracy; no id repeats', () => {
    const entry = crafted('weapon.bow', 'Bows', {
      prefix: {
        kind: 'hybrid',
        lines: [
          { statId: PHYS, valueMin: 75, valueMax: 79 },
          { statId: ACCURACY, valueMin: 175, valueMax: 200 },
        ],
      },
      suffix: {
        kind: 'hybrid',
        lines: [
          { statId: LIGHT, valueMin: 15, valueMax: 15 },
          { statId: ACCURACY, valueMin: 41, valueMax: 60 },
        ],
      },
    });
    expect(filtersOf(entry)).toEqual([
      { id: PHYS, value: { min: 75, max: 79 }, disabled: false },
      { id: ACCURACY, value: { min: 216, max: 260 }, disabled: false },
      { id: LIGHT, value: { min: 15, max: 15 }, disabled: false },
    ]);
    expect(new Set(ids(entry)).size).toBe(ids(entry).length);
  });

  it('adds half-integer edges exactly, never rounded', () => {
    const entry = crafted('weapon.bow', 'Bows', {
      prefix: { kind: 'banded', statId: 'explicit.stat_1', valueMin: 43, valueMax: 56.5 },
      suffix: { kind: 'banded', statId: 'explicit.stat_1', valueMin: 0.5, valueMax: 10 },
    });
    expect(filtersOf(entry)).toEqual([{ id: 'explicit.stat_1', value: { min: 43.5, max: 66.5 }, disabled: false }]);
  });

  it('throws on a valueless operand, which the tracked schema refuses first', () => {
    const entry = crafted('weapon.bow', 'Bows', {
      prefix: { kind: 'valueless', statId: 'explicit.stat_1' },
      suffix: { kind: 'banded', statId: 'explicit.stat_1', valueMin: 1, valueMax: 2 },
    });
    expect(() => buildSearchBody(entry, itemTypes)).toThrow(/explicit\.stat_1.*valueless operand/);
  });

  it('leaves a statId that only one slot names as its own filter', () => {
    const entry = crafted('weapon.bow', 'Bows', {
      prefix: { kind: 'banded', statId: 'explicit.stat_1', valueMin: 1, valueMax: 2 },
      suffix: { kind: 'banded', statId: 'explicit.stat_2', valueMin: 3, valueMax: 4 },
    });
    expect(ids(entry)).toEqual(['explicit.stat_1', 'explicit.stat_2']);
  });
});
