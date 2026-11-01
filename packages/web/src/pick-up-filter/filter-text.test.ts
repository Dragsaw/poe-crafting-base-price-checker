import { canonicalKey, type CraftedRankedRow, type PriceTrust, type RawRankedRow, type RawTrackedEntry, type TrackedEntry } from '@poe/contracts';
import { classKeyOf, pickUpPurposes, type PickUpEntry, type PickUpPurpose, type Ranking } from '@poe/core';
import { describe, expect, it } from 'vitest';

import { TEST_LEAGUE } from '../test-support/artifact-server';
import { rawEntry } from '../test-support/list-fixtures';
import { filterText, TREATMENTS } from './filter-text';

const BASE_FILTER = 'Base.filter';
const RECIPE = 'greater';
const CURRENT: PriceTrust = { verdict: 'current', reasons: [] };
const RINGS = { categoryId: 'accessory.ring', className: 'Rings' } as const;
const PURPOSES: readonly PickUpPurpose[] = ['craft', 'sell-raw', 'check-rolls'];

const CONDITION_KEYWORDS = ['BaseType', 'Rarity', 'ItemLevel', 'UnidentifiedItemTier'] as const;
const TREATMENT_KEYWORDS = ['SetFontSize', 'SetTextColor', 'SetBorderColor', 'SetBackgroundColor', 'MinimapIcon'] as const;
const ALLOWED_LINE = new RegExp(String.raw`^(?:|Show|Import ".*"|\t(?:${[...CONDITION_KEYWORDS, ...TREATMENT_KEYWORDS].join('|')}) .+)$`);

const MINIMAP_COLOURS = new Set(['Red', 'Green', 'Blue', 'Brown', 'White', 'Yellow', 'Cyan', 'Grey', 'Orange', 'Pink', 'Purple']);
const MINIMAP_SHAPES = new Set(['Circle', 'Diamond', 'Hexagon', 'Square', 'Star', 'Triangle', 'Cross', 'Moon', 'Raindrop', 'Kite', 'Pentagon', 'UpsideDownHouse']);

const whiteCraft: PickUpEntry = { baseTypeId: 'Gold Amulet', rarity: 'normal', itemLevelMin: 82, purpose: 'craft' };
const whiteSell: PickUpEntry = { baseTypeId: 'Solar Amulet', rarity: 'normal', itemLevelMin: 75, purpose: 'sell-raw' };
const magicCheck: PickUpEntry = { baseTypeId: 'Gold Amulet', rarity: 'magic', itemLevelMin: 82, unidentifiedTierMin: 4, purpose: 'check-rolls' };
const jewelKind: PickUpEntry = { baseTypeId: 'Ruby', rarity: 'magic', itemLevelMin: 75, purpose: 'check-rolls' };
const rubyRing: PickUpEntry = { baseTypeId: 'Ruby Ring', rarity: 'normal', itemLevelMin: 82, purpose: 'sell-raw' };
const ALL = [whiteCraft, whiteSell, magicCheck, jewelKind, rubyRing];

/** Each `Show` block's lines, without its trailing blank line. */
const blocksOf = (text: string): string[][] =>
  text
    .split('\n\n')
    .filter((chunk) => chunk.startsWith('Show'))
    .map((chunk) => chunk.split('\n'));

const treatmentOf = (block: readonly string[]): string[] =>
  block.filter((line) => TREATMENT_KEYWORDS.some((keyword) => line.startsWith(`\t${keyword} `))).map((line) => line.slice(1));

/** The game's `BaseType` predicate: `==` is an exact match on a quoted name, no operator is a substring match. */
function isCaughtBy(block: readonly string[], baseName: string): boolean {
  const match = /^\tBaseType (==\s)?(.*)$/.exec(block.find((line) => line.startsWith('\tBaseType ')) ?? '');
  if (match === null) {
    return false;
  }
  const names = (match[2] ?? '')
    .matchAll(/"([^"]*)"/g)
    .map((name) => name[1] ?? '')
    .toArray();
  return names.some((name) => (match[1] === undefined ? baseName.includes(name) : baseName === name));
}

const DIGITS = /^\d+$/;
const isWithin = (value: string | undefined, low: number, high: number): boolean => value !== undefined && DIGITS.test(value) && Number(value) >= low && Number(value) <= high;

/** The value forms the game's parser accepts for each treatment keyword. */
function isExpressible(line: string): boolean {
  const [keyword, ...values] = line.split(' ');
  switch (keyword) {
    case 'SetFontSize': {
      return values.length === 1 && isWithin(values[0], 1, 45);
    }
    case 'SetTextColor':
    case 'SetBorderColor':
    case 'SetBackgroundColor': {
      return (values.length === 3 || values.length === 4) && values.every((value) => isWithin(value, 0, 255));
    }
    case 'MinimapIcon': {
      return values.length === 3 && ['0', '1', '2'].includes(values[0] ?? '') && MINIMAP_COLOURS.has(values[1] ?? '') && MINIMAP_SHAPES.has(values[2] ?? '');
    }
    default: {
      return false;
    }
  }
}

function classRow(categoryId: string, className: string, expectedValue: number, itemLevelMin: number): CraftedRankedRow {
  return {
    kind: 'crafted',
    classKey: classKeyOf(categoryId, className),
    categoryId,
    className,
    itemLevelMin,
    recipeId: RECIPE,
    grossPayout: expectedValue + 0.5,
    craftCost: 0.5,
    ev: expectedValue,
    summands: [],
    combinations: [],
    provenance: 'measured',
    trust: CURRENT,
  };
}

function rawRow(entry: RawTrackedEntry, priceDivine: number): RawRankedRow {
  const league = TEST_LEAGUE;
  return {
    kind: 'raw',
    entryKey: canonicalKey(entry),
    baseTypeId: entry.baseTypeId,
    categoryId: entry.categoryId,
    className: entry.className,
    itemLevelMin: entry.itemLevelMin,
    status: 'active',
    ev: priceDivine,
    craftCost: 0,
    observation: {
      league,
      observedAt: '2026-10-31T10:00:00Z',
      priceDivine,
      sampleSize: 10,
      exchangeObservation: { currencyId: 'exalted', rate: 0.0042, source: 'in-game exchange, by hand', league, asOf: '2026-10-30T08:00:00Z' },
    },
    trust: CURRENT,
  };
}

const rankingOf = (ordering: Ranking['ordering']): Ranking => ({
  ordering,
  unpricedCrafted: [],
  belowThreshold: [],
  noListings: [],
  notYetSynced: [],
  unresolvable: [],
  unrankable: [],
  recipeless: [],
  uncostableRecipes: [],
  pricedInLeague: true,
});

const purposesOf = (ordering: Ranking['ordering'], tracked: readonly TrackedEntry[]): readonly PickUpEntry[] =>
  pickUpPurposes({ ranking: rankingOf(ordering), tracked, recipeId: RECIPE });

describe('filterText: the I/O matrix', () => {
  it('Empty: an empty list is the `Import` line alone', () => {
    expect(filterText([], BASE_FILTER)).toBe('Import "Base.filter"\n');
  });

  it('White craft: `BaseType ==`, `Rarity Normal`, `ItemLevel >= 82`, the craft treatment, then `Import`', () => {
    expect(filterText([whiteCraft], BASE_FILTER)).toBe(
      [
        'Show',
        '\tBaseType == "Gold Amulet"',
        '\tRarity Normal',
        '\tItemLevel >= 82',
        ...TREATMENTS.craft.map((line) => `\t${line}`),
        '',
        'Import "Base.filter"',
        '',
      ].join('\n'),
    );
  });

  it('Magic check: adds `UnidentifiedItemTier >= 4` after the item level, then the check-the-rolls treatment', () => {
    const [block] = blocksOf(filterText([magicCheck], BASE_FILTER));
    expect(block).toEqual([
      'Show',
      '\tBaseType == "Gold Amulet"',
      '\tRarity Magic',
      '\tItemLevel >= 82',
      '\tUnidentifiedItemTier >= 4',
      ...TREATMENTS['check-rolls'].map((line) => `\t${line}`),
    ]);
  });

  it('Jewel kind: a magic entry with no tier has no `UnidentifiedItemTier` line', () => {
    const [block] = blocksOf(filterText([jewelKind], BASE_FILTER));
    expect(block?.slice(0, 4)).toEqual(['Show', '\tBaseType == "Ruby"', '\tRarity Magic', '\tItemLevel >= 75']);
    expect(block?.some((line) => line.includes('UnidentifiedItemTier'))).toBe(false);
  });

  it('writes the file name verbatim, with no `.filter` added', () => {
    expect(filterText([], 'NeverSink very strict')).toBe('Import "NeverSink very strict"\n');
  });

  it('keeps the input order, uses tab indentation and LF line endings, and leaves one blank line after each block', () => {
    const text = filterText([rubyRing, whiteCraft], BASE_FILTER);
    expect(text).not.toContain('\r');
    expect(blocksOf(text).map((block) => block[1])).toEqual(['\tBaseType == "Ruby Ring"', '\tBaseType == "Gold Amulet"']);
    expect(text.split('\n').filter((line) => line.startsWith(' '))).toEqual([]);
    expect(text.match(/\n\n/g)).toHaveLength(2);
    expect(text).toMatch(/\n\nImport "Base\.filter"\n$/);
  });

  it('open FR-36 case (deferred-work.md), no rule yet: one base and rarity at two floors gives both blocks in input order', () => {
    const blocks = blocksOf(filterText([{ ...whiteSell, itemLevelMin: 82 }, whiteSell], BASE_FILTER));
    expect(blocks.map((block) => block.slice(1, 4))).toEqual([
      ['\tBaseType == "Solar Amulet"', '\tRarity Normal', '\tItemLevel >= 82'],
      ['\tBaseType == "Solar Amulet"', '\tRarity Normal', '\tItemLevel >= 75'],
    ]);
  });
});

describe('filterText: AC 1, only `Show` blocks, and the `Import` of the Base Filter last', () => {
  it('holds only `Show` blocks, with no `Continue` and no `Hide`', () => {
    const lines = filterText(ALL, BASE_FILTER).split('\n');
    expect(lines.filter((line) => line === 'Show')).toHaveLength(ALL.length);
    expect(lines.filter((line) => /Continue|Hide/.test(line))).toEqual([]);
  });

  it('ends with the `Import` of the given file name, after every block', () => {
    const lines = filterText(ALL, BASE_FILTER).split('\n');
    expect(lines.at(-2)).toBe('Import "Base.filter"');
    expect(lines.at(-1)).toBe('');
    expect(lines.findIndex((line) => line.startsWith('Import'))).toBeGreaterThan(lines.lastIndexOf('Show'));
  });

  it('starts every line with `Show`, `Import`, a condition keyword or a treatment keyword', () => {
    const lines = filterText(ALL, BASE_FILTER).split('\n');
    expect(lines.filter((line) => !ALLOWED_LINE.test(line))).toEqual([]);
  });
});

describe('filterText: AC 2, a block matches by `BaseType ==` and never by `Class`', () => {
  it('matches each entry by `BaseType ==` on its `baseTypeId`, with its rarity, item-level and tier conditions', () => {
    const blocks = blocksOf(filterText(ALL, BASE_FILTER));
    expect(blocks).toHaveLength(ALL.length);
    for (const [index, block] of blocks.entries()) {
      const entry = ALL[index];
      expect(block.slice(1, block.length - treatmentOf(block).length)).toEqual([
        `\tBaseType == "${entry?.baseTypeId ?? ''}"`,
        `\tRarity ${entry?.rarity === 'magic' ? 'Magic' : 'Normal'}`,
        `\tItemLevel >= ${String(entry?.itemLevelMin)}`,
        ...(entry?.unidentifiedTierMin === undefined ? [] : ['\tUnidentifiedItemTier >= 4']),
      ]);
    }
  });

  it('writes no `Class` condition and no condition AD-31 does not name', () => {
    const text = filterText(ALL, BASE_FILTER);
    expect(text).not.toMatch(/^\t(?:Class|Corrupted|Mirrored|AreaLevel)\b/m);
  });

  it('Prefix names: the `Ruby` block catches only `Ruby`, and the `Ruby Ring` block catches only `Ruby Ring`', () => {
    const [ruby, ring] = blocksOf(filterText([jewelKind, rubyRing], BASE_FILTER));
    expect(ruby?.[1]).toBe('\tBaseType == "Ruby"');
    expect(ring?.[1]).toBe('\tBaseType == "Ruby Ring"');
    expect([isCaughtBy(ruby ?? [], 'Ruby'), isCaughtBy(ruby ?? [], 'Ruby Ring')]).toEqual([true, false]);
    expect([isCaughtBy(ring ?? [], 'Ruby Ring'), isCaughtBy(ring ?? [], 'Ruby')]).toEqual([true, false]);
    // The substring form the serialiser must not write: it would catch the longer name.
    expect(isCaughtBy(['Show', '\tBaseType "Ruby"'], 'Ruby Ring')).toBe(true);
  });
});

describe('filterText: AC 3, one quiet treatment per purpose', () => {
  it('gives each purpose exactly its one treatment, whatever the entry', () => {
    for (const purpose of PURPOSES) {
      const entries = ALL.filter((entry) => entry.purpose === purpose);
      expect(entries.length).toBeGreaterThan(0);
      const blocks = blocksOf(filterText(entries, BASE_FILTER));
      for (const block of blocks) {
        expect(treatmentOf(block)).toEqual(TREATMENTS[purpose]);
      }
    }
  });

  it('is not graded by EV: a class with EV 0.1 and one with EV 50 give their craft blocks the same treatment', () => {
    const cheap = rawEntry('Gold Amulet');
    const dear = rawEntry('Gold Ring', 82, RINGS);
    const entries = purposesOf(
      [classRow('accessory.amulet', 'Amulets', 0.1, 82), classRow(RINGS.categoryId, RINGS.className, 50, 82)],
      [cheap, dear],
    );
    const crafts = entries.filter((entry) => entry.purpose === 'craft');
    expect(crafts.map((entry) => entry.baseTypeId)).toEqual(['Gold Amulet', 'Gold Ring']);
    const [low, high] = blocksOf(filterText(crafts, BASE_FILTER)).map((block) => treatmentOf(block));
    expect(low).toEqual(high);
  });

  it('is quiet: a font size, colours and a minimap icon, with no sound and no beam', () => {
    for (const purpose of PURPOSES) {
      expect(TREATMENTS[purpose][0]).toBe('SetFontSize 40');
      expect(TREATMENTS[purpose].at(-1)).toMatch(/^MinimapIcon 2 \w+ Diamond$/);
      expect(TREATMENTS[purpose].filter((line) => /Sound|PlayEffect/.test(line))).toEqual([]);
    }
  });

  it('gives each purpose its own colour and its own minimap icon colour', () => {
    const colours = PURPOSES.map((purpose) => TREATMENTS[purpose].filter((line) => line.includes('Color')).join('|'));
    const icons = PURPOSES.map((purpose) => TREATMENTS[purpose].at(-1));
    expect(new Set(colours).size).toBe(PURPOSES.length);
    expect(icons).toEqual(['MinimapIcon 2 Yellow Diamond', 'MinimapIcon 2 Blue Diamond', 'MinimapIcon 2 Cyan Diamond']);
  });

  it('stays within what the filter syntax expresses', () => {
    const lines = PURPOSES.flatMap((purpose) => TREATMENTS[purpose]);
    expect(lines.filter((line) => !isExpressible(line))).toEqual([]);
  });
});

describe('filterText: AC 4, an empty purpose list', () => {
  it('holds only the `Import` line (state 47)', () => {
    expect(filterText([], 'very strict.filter').split('\n')).toEqual(['Import "very strict.filter"', '']);
  });
});

describe('filterText: AC 5, deterministic text and the golden file', () => {
  const amulets = { categoryId: 'accessory.amulet', className: 'Amulets' } as const;
  const gold = rawEntry('Gold Amulet');
  const solar = rawEntry('Solar Amulet', 75);
  const ring = rawEntry('Ruby Ring', 82, RINGS);
  const lapis: RawTrackedEntry = { ...rawEntry('Lapis Amulet'), status: 'pruned', prunedReason: 'no market' };
  const ordering: Ranking['ordering'] = [
    classRow(amulets.categoryId, amulets.className, 2, 82),
    classRow('jewel', 'Ruby', 1.5, 75),
    rawRow(gold, 1),
    rawRow(solar, 3),
    rawRow(ring, 0.5),
  ];
  const golden = (): string => filterText(purposesOf(ordering, [gold, solar, ring, lapis]), 'very strict.filter');

  it('Twice: equal input gives byte-identical text', () => {
    expect(filterText(ALL, BASE_FILTER)).toBe(filterText(ALL, BASE_FILTER));
    expect(golden()).toBe(golden());
  });

  it('pins the full text for craft, sell raw, check the rolls, a jewel kind and a pruned base', () => {
    expect(golden()).not.toContain('"Lapis Amulet"');
    expect(golden()).toBe(
      [
        'Show\n\tBaseType == "Ruby"\n\tRarity Magic\n\tItemLevel >= 75\n\tSetFontSize 40\n\tSetTextColor 0 240 190 255\n\tMinimapIcon 2 Cyan Diamond\n\n',
        'Show\n\tBaseType == "Gold Amulet"\n\tRarity Normal\n\tItemLevel >= 82\n\tSetFontSize 40\n\tSetBorderColor 255 127 127 255\n\tSetBackgroundColor 20 20 0 255\n\tMinimapIcon 2 Yellow Diamond\n\n',
        'Show\n\tBaseType == "Gold Amulet"\n\tRarity Magic\n\tItemLevel >= 82\n\tUnidentifiedItemTier >= 4\n\tSetFontSize 40\n\tSetTextColor 0 240 190 255\n\tMinimapIcon 2 Cyan Diamond\n\n',
        'Show\n\tBaseType == "Ruby Ring"\n\tRarity Normal\n\tItemLevel >= 82\n\tSetFontSize 40\n\tSetTextColor 0 70 255 255\n\tSetBorderColor 0 70 255 255\n\tSetBackgroundColor 30 0 70 255\n\tMinimapIcon 2 Blue Diamond\n\n',
        'Show\n\tBaseType == "Solar Amulet"\n\tRarity Normal\n\tItemLevel >= 75\n\tSetFontSize 40\n\tSetTextColor 0 70 255 255\n\tSetBorderColor 0 70 255 255\n\tSetBackgroundColor 30 0 70 255\n\tMinimapIcon 2 Blue Diamond\n\n',
        'Show\n\tBaseType == "Solar Amulet"\n\tRarity Magic\n\tItemLevel >= 82\n\tUnidentifiedItemTier >= 4\n\tSetFontSize 40\n\tSetTextColor 0 240 190 255\n\tMinimapIcon 2 Cyan Diamond\n\n',
        'Import "very strict.filter"\n',
      ].join(''),
    );
  });
});

describe('filterText: AC 6, no Combination, modifier or price', () => {
  it('quotes only the base type ids and the file name', () => {
    const text = filterText(ALL, BASE_FILTER);
    const quoted = text
      .matchAll(/"([^"]*)"/g)
      .map((match) => match[1])
      .toArray();
    expect(quoted).toEqual([...ALL.map((entry) => entry.baseTypeId), BASE_FILTER]);
  });
});
