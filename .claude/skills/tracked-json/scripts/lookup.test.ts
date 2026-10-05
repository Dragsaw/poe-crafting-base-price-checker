import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  createJsonReader,
  LookupError,
  loadWeights,
  lookupBase,
  lookupClass,
  lookupStat,
  MATCH_CAP,
  parseCommand,
  REPO_ROOT,
  runCommand,
  UsageError,
  WEIGHTS_PATH,
} from './lookup';
import { JSON_NULL, SPIRIT, WEIGHTS } from './lookup.test-support';

const STATS = {
  schemaVersion: '1.0.0',
  result: [
    {
      id: 'pseudo',
      entries: [{ id: 'pseudo.pseudo_total_mana', text: '+# total maximum Mana', type: 'pseudo' }],
    },
    {
      id: 'explicit',
      entries: [
        { id: 'explicit.stat_1', text: '# to Maximum Mana', type: 'explicit' },
        { id: 'explicit.stat_2', text: '# to maximum Life', type: 'explicit' },
      ],
    },
  ],
};

const ITEMS = {
  result: [
    {
      id: 'accessory',
      entries: [
        { type: 'Gold Amulet' },
        { type: 'Gold Amulet', text: 'Astramentis Gold Amulet', name: 'Astramentis', flags: { unique: true } },
        { type: 'Solar Amulet' },
        { type: 'Gold Ring' },
      ],
    },
  ],
};

const FILTERS = {
  result: [
    {
      id: 'type_filters',
      filters: [
        {
          id: 'category',
          option: {
            options: [
              { id: JSON_NULL, text: 'Any' },
              { id: 'accessory.amulet', text: 'Amulet' },
              { id: 'armour.chest', text: 'Body Armour' },
            ],
          },
        },
      ],
    },
  ],
};

describe('lookupStat', () => {
  it('matches case-insensitively over every group', () => {
    expect(lookupStat(STATS, 'MAXIMUM MANA')).toEqual({
      matches: [
        { id: 'pseudo.pseudo_total_mana', text: '+# total maximum Mana', type: 'pseudo' },
        { id: 'explicit.stat_1', text: '# to Maximum Mana', type: 'explicit' },
      ],
      truncated: 0,
    });
  });

  it('caps the matches and counts the rest', () => {
    const many = {
      result: [
        {
          id: 'explicit',
          entries: Array.from({ length: MATCH_CAP + 7 }, (_, index) => ({
            id: `explicit.stat_${String(index)}`,
            text: 'Life',
            type: 'explicit',
          })),
        },
      ],
    };
    const found = lookupStat(many, 'life');

    expect(found.matches).toHaveLength(MATCH_CAP);
    expect(found.truncated).toBe(7);
  });

  it('matches on the id', () => {
    expect(lookupStat(STATS, 'STAT_2').matches).toEqual([
      { id: 'explicit.stat_2', text: '# to maximum Life', type: 'explicit' },
    ]);
  });

  it('returns zero matches as a value, not an error', () => {
    expect(lookupStat(STATS, 'no such stat')).toEqual({ matches: [], truncated: 0 });
  });
});

describe('lookupBase', () => {
  it('matches base types only: an entry with a name is a unique', () => {
    expect(lookupBase(ITEMS, 'amulet')).toEqual({
      matches: [
        { type: 'Gold Amulet', group: 'accessory' },
        { type: 'Solar Amulet', group: 'accessory' },
      ],
      truncated: 0,
    });
  });
});

describe('lookupBase de-duplication', () => {
  it('prints a base type repeated in one group once', () => {
    const repeated = { result: [{ id: 'accessory', entries: [{ type: 'Gold Amulet' }, { type: 'Gold Amulet' }] }] };

    expect(lookupBase(repeated, 'gold').matches).toEqual([{ type: 'Gold Amulet', group: 'accessory' }]);
  });
});

describe('lookupClass', () => {
  it('matches on className, categoryId or category text', () => {
    expect(lookupClass(WEIGHTS, FILTERS, 'amul').matches).toEqual([
      { categoryId: 'accessory.amulet', categoryText: 'Amulet', className: 'Amulets' },
    ]);
    expect(lookupClass(WEIGHTS, FILTERS, 'body armour').matches).toEqual([
      { categoryId: 'armour.chest', categoryText: 'Body Armour', className: 'Body_Armours_dex' },
    ]);
    expect(lookupClass(WEIGHTS, FILTERS, 'armour.shield').matches).toEqual([
      { categoryId: 'armour.shield', categoryText: JSON_NULL, className: 'Body_Armours_dex' },
    ]);
  });

  it('refuses an unreadable or non-JSON weights file, naming it', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'tracked-lookup-'));
    try {
      mkdirSync(nodePath.join(root, WEIGHTS_PATH), { recursive: true });
      expect(() => createJsonReader(root)(WEIGHTS_PATH)).toThrow(`${WEIGHTS_PATH}: not readable`);
      rmSync(nodePath.join(root, WEIGHTS_PATH), { recursive: true });
      writeFileSync(nodePath.join(root, WEIGHTS_PATH), '{ not json');
      expect(() => createJsonReader(root)(WEIGHTS_PATH)).toThrow(LookupError);
      expect(() => createJsonReader(root)(WEIGHTS_PATH)).toThrow(`${WEIGHTS_PATH}: not valid JSON`);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('refuses an absent weights file, naming it', () => {
    const read = createJsonReader(nodePath.join(REPO_ROOT, 'no-such-directory'));

    expect(() => runCommand({ kind: 'class', query: 'amul' }, read)).toThrow(LookupError);
    expect(() => runCommand({ kind: 'class', query: 'amul' }, read)).toThrow(`${WEIGHTS_PATH}: the file is absent`);
  });
});

function readerOf(weights: unknown) {
  return (path: string): unknown => {
    expect(path).toBe(WEIGHTS_PATH);
    return weights;
  };
}

describe('loadWeights', () => {
  it('names the file, the path and the message of a schema-invalid weights file', () => {
    const broken = structuredClone(WEIGHTS) as unknown as {
      bases: Record<string, Record<string, { prefix: { entries: Record<string, unknown>[] } }>>;
    };
    const entry = broken.bases['accessory.amulet']?.['Amulets']?.prefix.entries[0];
    expect(entry).toBeDefined();
    delete entry?.['modGroup'];

    expect(() => loadWeights(readerOf(broken))).toThrow(LookupError);
    expect(() => loadWeights(readerOf(broken))).toThrow(
      `${WEIGHTS_PATH}: bases.accessory.amulet.Amulets.prefix.entries.0.modGroup: modGroup is missing`,
    );
  });

  it('refuses a negative weight', () => {
    const broken = structuredClone(WEIGHTS) as unknown as {
      bases: Record<string, Record<string, { prefix: { entries: Record<string, unknown>[] } }>>;
    };
    const entry = broken.bases['accessory.amulet']?.['Amulets']?.prefix.entries[0];
    if (entry !== undefined) {
      entry['weight'] = -1;
    }

    expect(() => runCommand({ kind: 'class', query: 'amul' }, (path) => (path === WEIGHTS_PATH ? broken : FILTERS))).toThrow(
      `${WEIGHTS_PATH}: bases.accessory.amulet.Amulets.prefix.entries.0.weight: weight is negative`,
    );
  });
});

describe('parseCommand', () => {
  it('parses each subcommand', () => {
    expect(parseCommand(['stat', 'maximum mana'])).toEqual({ kind: 'stat', query: 'maximum mana' });
    expect(parseCommand(['class', ''])).toEqual({ kind: 'class', query: '' });
    expect(parseCommand(['mods', '--class', 'Body_Armours_dex', '--slot', 'prefix'])).toEqual({
      kind: 'mods',
      className: 'Body_Armours_dex',
      slot: 'prefix',
    });
    expect(parseCommand(['tiers', SPIRIT, '--class', 'Amulets', '--category', 'accessory.amulet'])).toEqual({
      kind: 'tiers',
      statId: SPIRIT,
      className: 'Amulets',
      category: 'accessory.amulet',
    });
  });

  it.each([
    [[]],
    [['bogus', 'x']],
    [['stat']],
    [['base']],
    [['class']],
    [['tiers', '--class', 'Amulets']],
    [['tiers', SPIRIT]],
    [['mods']],
    [['mods', '--class', 'Amulets', '--slot', 'implicit']],
    [['stat', 'mana', '--bogus']],
    [['stat', 'mana', 'extra']],
  ])('refuses %j as a usage error', (argv) => {
    expect(() => parseCommand(argv)).toThrow(UsageError);
  });
});
