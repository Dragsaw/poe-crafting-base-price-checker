import { describe, expect, it } from 'vitest';

import { defenceLettersOf } from './class-name';
import { parseEnvelope } from './envelopes';
import * as contracts from './index';
import { WEIGHTS_SCHEMA_VERSION, WeightsFileSchema } from './weights-file';

type Json = Record<string, unknown>;

const byCodeUnit = (a: string, b: string): number => Number(a > b) - Number(a < b);

function entryOf(overrides: Json = {}): Json {
  return {
    sourceModifierId: 'prefix\0BaseSpirit\u{0}16\0+# to Spirit',
    modGroup: 'BaseSpirit',
    itemLevelMin: 16,
    tierLabel: 'T5',
    weight: 500,
    weightSource: 'published',
    lines: [{ statId: 'explicit.stat_3981240776', ranges: [[30, 33]] }],
    ...overrides,
  };
}

function poolOf(entries: readonly Json[] = [entryOf()]): Json {
  return { poolCoverage: 'complete', entries };
}

function classOf(prefix: Json = poolOf(), suffix: Json = poolOf([])): Json {
  return { prefix, suffix };
}

const DEFAULT_BASES: Json = { 'accessory.amulet': { Amulets: classOf() } };

function fileOf(bases: Json = DEFAULT_BASES, overrides: Json = {}): Json {
  return {
    schemaVersion: '6.0.0',
    gamePatch: '0.5.5',
    producer: { id: 'poe-mod-weights-producer', version: '6.0.0', generatedAt: '2026-09-26T10:52:22.504Z' },
    bases,
    ...overrides,
  };
}

/** A file whose one Amulets prefix pool holds `entries`. */
function fileWithEntries(...entries: Json[]): Json {
  return fileOf({ 'accessory.amulet': { Amulets: classOf(poolOf(entries)) } });
}

const parse = (data: unknown) => parseEnvelope(WeightsFileSchema, data, WEIGHTS_SCHEMA_VERSION);

const ENTRY_PATH = ['bases', 'accessory.amulet', 'Amulets', 'prefix', 'entries', 0];

describe('WeightsFileSchema — conforming files', () => {
  it('parses the frozen weights.json fixture, every entry keeping its lines nested', async () => {
    // A non-literal specifier: the file sits outside this package's `rootDir`,
    // so the compiler must not resolve it; Vitest resolves it from this file.
    const here = (import.meta as { readonly dirname: string }).dirname;
    const specifier = `${here}/../../../test/fixtures/frozen-data/weights.json`;
    const committed = ((await import(/* @vite-ignore */ specifier)) as { default: unknown }).default;
    const result = parse(committed);
    if (!result.ok) {
      throw new Error(`committed weights.json refused: ${JSON.stringify(result)}`);
    }
    const pools = Object.values(result.value.bases).flatMap((classes) => Object.values(classes));
    const entries = pools.flatMap((classPools) => [...classPools.prefix.entries, ...classPools.suffix.entries]);
    expect(entries).toHaveLength(569);
    expect(entries.every((entry) => entry.lines.length > 0)).toBe(true);
    const nullStatIds = entries.flatMap((entry) => entry.lines).filter((line) => line.statId === null);
    expect(nullStatIds).toHaveLength(1);
    const partialPools = pools
      .flatMap((classPools) => [classPools.prefix, classPools.suffix])
      .filter((pool) => pool.poolCoverage === 'partial');
    expect(partialPools).toHaveLength(0);
  });

  it('keeps a hybrid tier as one entry with two nested lines', () => {
    const hybrid = entryOf({
      lines: [
        { statId: 'explicit.a', ranges: [[4, 6]] },
        { statId: 'explicit.b', ranges: [[6, 13]] },
      ],
    });
    const result = parse(fileWithEntries(hybrid));
    expect(result.ok && result.value.bases['accessory.amulet']?.['Amulets']?.prefix.entries[0]?.lines).toHaveLength(2);
  });

  it.each([
    ['the same sourceModifierId in prefix and suffix', fileOf({ 'accessory.amulet': { Amulets: classOf(poolOf(), poolOf()) } })],
    ['ranges: []', fileWithEntries(entryOf({ lines: [{ statId: 'explicit.a', ranges: [] }] }))],
    ['two range pairs', fileWithEntries(entryOf({ lines: [{ statId: 'explicit.a', ranges: [[43, 43], [56, 56.5]] }] }))],
    ['weight: 0', fileWithEntries(entryOf({ weight: 0 }))],
    ['an empty entries list', fileWithEntries()],
    ['a null statId', fileWithEntries(entryOf({ lines: [{ statId: null, ranges: [[10, 20]] }] }))],
    ['two null statIds in one entry', fileWithEntries(entryOf({ lines: [{ statId: null, ranges: [] }, { statId: null, ranges: [] }] }))],
    ['weightSource absent', fileWithEntries(entryOf({ weightSource: 'absent' }))],
    ['a not-in-game entry with weight 0 and a null statId (6.1.0)', fileWithEntries(entryOf({ weight: 0, weightSource: 'not-in-game', lines: [{ statId: null, ranges: [[5, 10]] }] }))],
    ['no tierLabel, producer.version or producer.sourceUrl', fileOf(
      { 'accessory.amulet': { Amulets: classOf(poolOf([{ ...entryOf(), tierLabel: undefined }])) } },
      { producer: { id: 'p', generatedAt: '2026-09-26T10:52:22.504Z' } },
    )],
    ['unknown keys at every level (a later additive 6.x)', {
      ...fileOf({ jewel: { Emerald: { ...classOf(poolOf([{ ...entryOf(), extra: 1 }])), extra: 1 }, } }),
      schemaVersion: '6.3.0',
      extra: { any: 'thing' },
    }],
    ['a full armour lattice', fileOf({
      'armour.boots': Object.fromEntries(
        ['Boots_str', 'Boots_dex', 'Boots_int', 'Boots_str_dex', 'Boots_str_int', 'Boots_dex_int'].map((name) => [name, classOf()]),
      ),
    })],
    ['an all-plain fan-out category', fileOf({ jewel: { Emerald: classOf(), 'Time-Lost_Diamond': classOf() } })],
  ])('parses %s', (_label, file) => {
    expect(parse(file).ok).toBe(true);
  });
});

describe('WeightsFileSchema — refusals', () => {
  it('refuses an old major as unknown-major, before the body is parsed', () => {
    expect(parse({ schemaVersion: '5.1.0', bases: 'not even an object' })).toEqual({
      ok: false,
      reason: 'unknown-major',
      expected: '6.1.0',
      found: '5.1.0',
    });
  });

  const entryWithout = (key: string): Json => {
    const entry = entryOf();
    delete entry[key];
    return entry;
  };
  const noModuleGroup = entryWithout('modGroup');

  it.each([
    ...(['sourceModifierId', 'itemLevelMin', 'weight', 'lines'] as const).map(
      (key) => [`a missing ${key}`, fileWithEntries(entryWithout(key)), [...ENTRY_PATH, key], 'received undefined'] as const,
    ),
    ['a missing modGroup', fileWithEntries(noModuleGroup), [...ENTRY_PATH, 'modGroup'], 'modGroup is missing'],
    ['an empty modGroup', fileWithEntries(entryOf({ modGroup: '' })), [...ENTRY_PATH, 'modGroup'], 'modGroup'],
    ['a non-string modGroup', fileWithEntries(entryOf({ modGroup: 7 })), [...ENTRY_PATH, 'modGroup'], 'not a string'],
    ['a negative weight', fileWithEntries(entryOf({ weight: -1 })), [...ENTRY_PATH, 'weight'], 'weight'],
    ['a bad weightSource', fileWithEntries(entryOf({ weightSource: 'measured' })), [...ENTRY_PATH, 'weightSource'], 'weightSource is not'],
    ['a not-in-game entry with a non-zero weight', fileWithEntries(entryOf({ weightSource: 'not-in-game' })), [...ENTRY_PATH, 'weight'], 'not-in-game'],
    ['empty lines', fileWithEntries(entryOf({ lines: [] })), [...ENTRY_PATH, 'lines'], 'lines'],
    [
      'min > max',
      fileWithEntries(entryOf({ lines: [{ statId: 'explicit.a', ranges: [[5, 4]] }] })),
      [...ENTRY_PATH, 'lines', 0, 'ranges', 0],
      'min > max',
    ],
    [
      'three range pairs',
      fileWithEntries(entryOf({ lines: [{ statId: 'explicit.a', ranges: [[1, 2], [3, 4], [5, 6]] }] })),
      [...ENTRY_PATH, 'lines', 0, 'ranges'],
      'more than two',
    ],
    [
      'a duplicate sourceModifierId in one slot',
      fileWithEntries(entryOf(), entryOf({ itemLevelMin: 25 })),
      ['bases', 'accessory.amulet', 'Amulets', 'prefix', 'entries', 1, 'sourceModifierId'],
      'once per slot',
    ],
    [
      "a duplicate statId in one entry's lines",
      fileWithEntries(
        entryOf({
          lines: [
            { statId: 'explicit.a', ranges: [] },
            { statId: 'explicit.a', ranges: [[1, 2]] },
          ],
        }),
      ),
      [...ENTRY_PATH, 'lines', 1, 'statId'],
      'repeats lines.0',
    ],
    ['an empty gamePatch', fileOf(undefined, { gamePatch: '' }), ['gamePatch'], 'gamePatch'],
    ['a missing gamePatch', fileOf(undefined, { gamePatch: undefined }), ['gamePatch'], 'gamePatch is missing'],
    [
      'a missing poolCoverage',
      fileOf({ 'accessory.amulet': { Amulets: classOf({ entries: [] }) } }),
      ['bases', 'accessory.amulet', 'Amulets', 'prefix', 'poolCoverage'],
      'poolCoverage is missing',
    ],
    [
      'a category that mixes defence-suffixed and plain classes',
      fileOf({ 'armour.gloves': { Gloves_str: classOf(), Gloves: classOf() } }),
      ['bases', 'armour.gloves'],
      'never mixes',
    ],
    [
      'two defence classes with the same letter set',
      fileOf({ 'armour.gloves': { Gloves_str_dex: classOf(), Gloves_dex_str: classOf() } }),
      ['bases', 'armour.gloves', 'Gloves_dex_str'],
      'distinct letter sets',
    ],
    [
      'a className matching neither grammar',
      fileOf({ 'armour.gloves': { _str: classOf() } }),
      ['bases', 'armour.gloves', '_str'],
      'neither grammar',
    ],
  ] as const)('refuses %s as invalid, naming the path and the rule', (_label, file, path, message) => {
    const result = parse(file);
    if (result.ok || result.reason !== 'invalid') {
      throw new Error(`expected invalid, got ${JSON.stringify(result)}`);
    }
    const issue = result.issues.find((candidate) => JSON.stringify(candidate.path) === JSON.stringify(path));
    expect(issue, JSON.stringify(result.issues)).toBeDefined();
    expect(issue?.message).toContain(message);
  });

  it('never returns a partly loaded value: one bad entry refuses the whole file', () => {
    const good = fileOf({ 'weapon.bow': { Bows: classOf() }, 'accessory.amulet': { Amulets: classOf(poolOf([entryOf({ weight: -1 })])) } });
    expect(parse(good)).toMatchObject({ ok: false, reason: 'invalid' });
  });
});

describe('the className grammar', () => {
  it.each([
    ['Body_Armours_str_dex', ['str', 'dex']],
    ['Boots_int', ['int']],
    ['Bows', undefined],
    ['Time-Lost_Diamond', undefined],
    ['str', undefined],
  ] as const)('splits %s', (className, letters) => {
    const split = defenceLettersOf(className);
    expect(split === undefined ? undefined : [...split].toSorted(byCodeUnit)).toEqual(
      letters === undefined ? undefined : [...letters].toSorted(byCodeUnit),
    );
  });

  it('is exported once, from the contracts barrel', () => {
    expect(contracts.defenceLettersOf).toBe(defenceLettersOf);
    expect(contracts.DEFENCE_OF_LETTER).toEqual({ str: 'ar', dex: 'ev', int: 'es' });
    expect(contracts.WEIGHTS_SCHEMA_VERSION).toBe('6.1.0');
    expect(contracts.WeightsFileSchema).toBe(WeightsFileSchema);
  });
});
