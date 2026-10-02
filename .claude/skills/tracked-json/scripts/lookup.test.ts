import { execFile } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { WeightsFileSchema } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import {
  createJsonReader,
  FILTERS_PATH,
  ITEMS_PATH,
  LookupError,
  loadWeights,
  lookupBase,
  lookupClass,
  lookupMods,
  lookupStat,
  lookupTiers,
  MATCH_CAP,
  parseCommand,
  REPO_ROOT,
  runCommand,
  STATS_PATH,
  UsageError,
  WEIGHTS_PATH,
} from './lookup';

const SCRIPT = fileURLToPath(new URL('./lookup.ts', import.meta.url));
const DATA_DIR = join(REPO_ROOT, 'data');

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
              { id: null, text: 'Any' },
              { id: 'accessory.amulet', text: 'Amulet' },
              { id: 'armour.chest', text: 'Body Armour' },
            ],
          },
        },
      ],
    },
  ],
};

function tier(
  slot: string,
  modGroup: string,
  itemLevelMin: number,
  tierLabel: string,
  text: string,
  lines: readonly { statId: string | null; ranges: number[][] }[],
): Record<string, unknown> {
  return {
    sourceModifierId: `${slot}\u0000${modGroup}\u0000${String(itemLevelMin)}\u0000${text}`,
    modGroup,
    itemLevelMin,
    tierLabel,
    weight: 500,
    weightSource: 'published',
    lines,
  };
}

const SPIRIT = 'explicit.stat_spirit';
const EVASION = 'explicit.stat_evasion';
const LIFE = 'explicit.stat_life';
const SPELL = 'explicit.stat_spell';
const MELEE = 'explicit.stat_melee';

const WEIGHTS = WeightsFileSchema.parse({
  schemaVersion: '6.0.0',
  gamePatch: '0.4.0',
  producer: { id: 'test', generatedAt: '2026-10-02T00:00:00Z' },
  bases: {
    'accessory.amulet': {
      Amulets: {
        prefix: {
          poolCoverage: 'complete',
          // Out of order on purpose: `tiers` sorts by itemLevelMin.
          entries: [
            tier('prefix', 'BaseSpirit', 25, 'T2', '+# to Spirit', [{ statId: SPIRIT, ranges: [[34, 37]] }]),
            tier('prefix', 'BaseSpirit', 16, 'T3', '+# to Spirit', [{ statId: SPIRIT, ranges: [[30, 33]] }]),
            tier('prefix', 'BaseSpirit', 54, 'T1', '+# to Spirit', [{ statId: SPIRIT, ranges: [[47, 50]] }]),
            tier('prefix', 'IncreasedLife', 1, 'T1', '+# to maximum Life', [{ statId: LIFE, ranges: [[10, 19]] }]),
          ],
        },
        suffix: {
          poolCoverage: 'complete',
          entries: [
            tier('suffix', 'SpiritSuffix', 40, 'T1', '+# to Spirit', [{ statId: SPIRIT, ranges: [[5, 6]] }]),
            // One modGroup, two mod families: two rows, not one hybrid.
            tier('suffix', 'GemLevel', 41, 'T1', '+# to Level of all Melee Skills', [{ statId: MELEE, ranges: [[2, 2]] }]),
            tier('suffix', 'GemLevel', 5, 'T2', '+# to Level of all Spell Skills', [{ statId: SPELL, ranges: [[1, 1]] }]),
            tier('suffix', 'GemLevel', 41, 'T1', '+# to Level of all Spell Skills', [{ statId: SPELL, ranges: [[2, 2]] }]),
          ],
        },
      },
    },
    'armour.chest': {
      Body_Armours_dex: {
        prefix: {
          poolCoverage: 'complete',
          entries: [
            tier('prefix', 'BaseLocalDefencesAndLife', 33, 'T1', '#% increased Evasion Rating\n+# to maximum Life', [
              { statId: EVASION, ranges: [[21, 26]] },
              { statId: LIFE, ranges: [[20, 23]] },
            ]),
            tier('prefix', 'BaseLocalDefencesAndLife', 16, 'T2', '#% increased Evasion Rating\n+# to maximum Life', [
              { statId: EVASION, ranges: [[14, 20]] },
              { statId: LIFE, ranges: [[11, 19]] },
            ]),
            tier('prefix', 'IncreasedLife', 1, 'T1', '+# to maximum Life', [{ statId: LIFE, ranges: [[10, 19]] }]),
          ],
        },
        suffix: {
          poolCoverage: 'complete',
          entries: [tier('suffix', 'Thorns', 1, 'T1', '# to # Thorns', [{ statId: null, ranges: [] }])],
        },
      },
    },
    // A second category with a class of the same name, for the ambiguity row.
    'armour.shield': { Body_Armours_dex: { prefix: { poolCoverage: 'complete', entries: [] }, suffix: { poolCoverage: 'complete', entries: [] } } },
  },
});

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
      { categoryId: 'armour.shield', categoryText: null, className: 'Body_Armours_dex' },
    ]);
  });

  it('refuses an unreadable or non-JSON weights file, naming it', () => {
    const root = mkdtempSync(join(tmpdir(), 'tracked-lookup-'));
    try {
      mkdirSync(join(root, WEIGHTS_PATH), { recursive: true });
      expect(() => createJsonReader(root)(WEIGHTS_PATH)).toThrow(`${WEIGHTS_PATH}: not readable`);
      rmSync(join(root, WEIGHTS_PATH), { recursive: true });
      writeFileSync(join(root, WEIGHTS_PATH), '{ not json');
      expect(() => createJsonReader(root)(WEIGHTS_PATH)).toThrow(LookupError);
      expect(() => createJsonReader(root)(WEIGHTS_PATH)).toThrow(`${WEIGHTS_PATH}: not valid JSON`);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('refuses an absent weights file, naming it', () => {
    const read = createJsonReader(join(REPO_ROOT, 'no-such-directory'));

    expect(() => runCommand({ kind: 'class', query: 'amul' }, read)).toThrow(LookupError);
    expect(() => runCommand({ kind: 'class', query: 'amul' }, read)).toThrow(`${WEIGHTS_PATH}: the file is absent`);
  });
});

describe('loadWeights', () => {
  function readerOf(weights: unknown) {
    return (path: string): unknown => {
      expect(path).toBe(WEIGHTS_PATH);
      return weights;
    };
  }

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

describe('lookupMods', () => {
  it('prints one row per modGroup, a hybrid with all its statIds, verbatim', () => {
    const found = lookupMods(WEIGHTS, { className: 'Body_Armours_dex', category: 'armour.chest', slot: 'prefix' });

    expect(found).toEqual({
      categoryId: 'armour.chest',
      className: 'Body_Armours_dex',
      mods: [
        {
          slot: 'prefix',
          modGroup: 'BaseLocalDefencesAndLife',
          text: 'BaseLocalDefencesAndLife',
          statIds: [EVASION, LIFE],
          tierCount: 2,
          itemLevelMin: { min: 16, max: 33 },
          tierLabels: ['T2', 'T1'],
        },
        {
          slot: 'prefix',
          modGroup: 'IncreasedLife',
          text: 'IncreasedLife',
          statIds: [LIFE],
          tierCount: 1,
          itemLevelMin: { min: 1, max: 1 },
          tierLabels: ['T1'],
        },
      ],
    });
  });

  it('prints both slots without a slot, and keeps a null statId', () => {
    const found = lookupMods(WEIGHTS, { className: 'Body_Armours_dex', category: 'armour.chest' });

    expect(found.mods.map((row) => [row.slot, row.modGroup])).toEqual([
      ['prefix', 'BaseLocalDefencesAndLife'],
      ['prefix', 'IncreasedLife'],
      ['suffix', 'Thorns'],
    ]);
    expect(found.mods[2]?.statIds).toEqual([null]);
  });

  it('prints one row per mod family when a modGroup holds several', () => {
    const found = lookupMods(WEIGHTS, { className: 'Amulets', slot: 'suffix' });

    expect(
      found.mods
        .filter((row) => row.modGroup === 'GemLevel')
        .map((row) => [row.text, row.statIds, row.tierLabels]),
    ).toEqual([
      ['GemLevel', [MELEE], ['T1']],
      ['GemLevel', [SPELL], ['T2', 'T1']],
    ]);
  });

  it('refuses an unknown class', () => {
    expect(() => lookupMods(WEIGHTS, { className: 'Nope' })).toThrow('unknown class Nope');
    expect(() => lookupMods(WEIGHTS, { className: 'Amulets', category: 'armour.chest' })).toThrow(
      'unknown class Amulets in category armour.chest',
    );
  });

  it('refuses a class in several categories without a category', () => {
    expect(() => lookupMods(WEIGHTS, { className: 'Body_Armours_dex' })).toThrow(
      'appears in categories armour.chest, armour.shield; pass --category',
    );
  });
});

describe('lookupTiers', () => {
  it('lists, per slot, the tiers carrying the statId in itemLevelMin order, ranges verbatim', () => {
    const found = lookupTiers(WEIGHTS, SPIRIT, { className: 'Amulets' });

    expect(found.categoryId).toBe('accessory.amulet');
    expect(found.tiers.map((row) => [row.slot, row.tierLabel, row.itemLevelMin])).toEqual([
      ['prefix', 'T3', 16],
      ['prefix', 'T2', 25],
      ['prefix', 'T1', 54],
      ['suffix', 'T1', 40],
    ]);
    expect(found.tiers[0]).toEqual({
      slot: 'prefix',
      tierLabel: 'T3',
      itemLevelMin: 16,
      weight: 500,
      weightSource: 'published',
      modGroup: 'BaseSpirit',
      lines: [{ statId: SPIRIT, ranges: [[30, 33]] }],
    });
  });

  it('prints every line of a hybrid tier that carries the statId', () => {
    const found = lookupTiers(WEIGHTS, EVASION, { className: 'Body_Armours_dex', category: 'armour.chest' });

    expect(found.tiers.map((row) => row.lines)).toEqual([
      [
        { statId: EVASION, ranges: [[14, 20]] },
        { statId: LIFE, ranges: [[11, 19]] },
      ],
      [
        { statId: EVASION, ranges: [[21, 26]] },
        { statId: LIFE, ranges: [[20, 23]] },
      ],
    ]);
  });

  it('refuses an unknown class, and a class in several categories without a category', () => {
    expect(() => lookupTiers(WEIGHTS, SPIRIT, { className: 'Nope' })).toThrow(LookupError);
    expect(() => lookupTiers(WEIGHTS, SPIRIT, { className: 'Body_Armours_dex' })).toThrow('pass --category');
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

describe('the committed data/', () => {
  const read = createJsonReader(REPO_ROOT);

  it('finds a stat, a base type and a class in the committed catalogue shape', () => {
    expect(lookupStat(read(STATS_PATH), 'to Spirit').matches.map((match) => match.id)).toContain(
      'explicit.stat_3981240776',
    );
    expect(lookupBase(read(ITEMS_PATH), 'amulet').matches).toContainEqual({ type: 'Gold Amulet', group: 'accessory' });
    const classes = lookupClass(loadWeights(read), read(FILTERS_PATH), 'body armour').matches;
    const dex = classes.find((match) => match.className === 'Body_Armours_dex');
    expect(dex).toBeDefined();
    expect(dex?.categoryText).not.toBeNull();
  });

  it('lists the Body_Armours_dex prefixes: 7 modGroups, the defences-and-life hybrid one row', () => {
    const found = lookupMods(loadWeights(read), { className: 'Body_Armours_dex', slot: 'prefix' });

    expect(found.mods).toHaveLength(7);
    const hybrid = found.mods.filter((row) => row.modGroup === 'BaseLocalDefencesAndLife');
    expect(hybrid).toHaveLength(1);
    expect(hybrid[0]?.statIds).toHaveLength(2);
    expect(hybrid[0]?.text).toBe('BaseLocalDefencesAndLife');
    expect(found.mods.filter((row) => row.text === '')).toEqual([]);
  });

  it('splits the Amulets gem-level suffix modGroup into its four mod families', () => {
    const found = lookupMods(loadWeights(read), { className: 'Amulets', slot: 'suffix' });
    const families = found.mods.filter((row) => row.modGroup === 'IncreaseSocketedGemLevel');

    expect(families.map((row) => row.statIds.length)).toEqual([1, 1, 1, 1]);
    expect(families.map((row) => row.text)).toEqual(Array.from({ length: 4 }, () => 'IncreaseSocketedGemLevel'));
  });
});

interface Run {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

function runScript(args: readonly string[]): Promise<Run> {
  return new Promise((done) => {
    const child = execFile(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' }, (_error, stdout, stderr) => {
      done({ code: child.exitCode, stdout, stderr });
    });
  });
}

/** Every path under `data/` with its size and modification time. */
function snapshot(directory: string): Record<string, string> {
  const found: Record<string, string> = {};
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      Object.assign(found, snapshot(path));
    } else {
      found[path] = `${String(stats.size)}:${String(stats.mtimeMs)}`;
    }
  }
  return found;
}

describe('pnpm tracked:lookup', () => {
  it('prints the Amulets spirit prefix tiers T5 to T1, verbatim, and writes nothing to disk', async () => {
    const before = snapshot(DATA_DIR);

    const run = await runScript(['tiers', 'explicit.stat_3981240776', '--class', 'Amulets']);

    expect(run.code, run.stderr).toBe(0);
    expect(run.stderr).toBe('');
    const printed = JSON.parse(run.stdout) as {
      tiers: { slot: string; tierLabel: string; itemLevelMin: number; lines: { ranges: unknown }[] }[];
    };
    const prefixes = printed.tiers.filter((row) => row.slot === 'prefix');
    expect(prefixes.map((row) => [row.tierLabel, row.itemLevelMin])).toEqual([
      ['T5', 16],
      ['T4', 25],
      ['T3', 33],
      ['T2', 46],
      ['T1', 54],
    ]);
    expect(prefixes.map((row) => row.lines[0]?.ranges)).toEqual([
      [[30, 33]],
      [[34, 37]],
      [[38, 42]],
      [[43, 46]],
      [[47, 50]],
    ]);
    expect(snapshot(DATA_DIR)).toEqual(before);
  });

  it('prints a lookup error as {error} on stdout with exit 1', async () => {
    const run = await runScript(['mods', '--class', 'Nope']);

    expect(run.code).toBe(1);
    expect(JSON.parse(run.stdout)).toEqual({ error: `${WEIGHTS_PATH}: unknown class Nope` });
  });

  it('prints the usage on stderr with exit 1 on an unknown subcommand', async () => {
    const run = await runScript(['bogus', 'x']);

    expect(run.code).toBe(1);
    expect(run.stdout).toBe('');
    expect(run.stderr).toContain('usage: pnpm tracked:lookup');
  });

  it('is reachable at the script name', () => {
    const manifest = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    const script = manifest.scripts['tracked:lookup'];

    expect(script).toBe('node .claude/skills/tracked-json/scripts/lookup.ts');
    expect(resolve(REPO_ROOT, (script ?? '').split(/\s+/).at(-1) ?? '')).toBe(SCRIPT);
  });
});
