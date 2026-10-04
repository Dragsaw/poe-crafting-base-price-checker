import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { createFakeFilesystemPort } from '@poe/contracts';
import type { TrackedEntry } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { DataFileError } from '../load-data-file.ts';
import type { CatalogueIds } from './catalogue-ids.ts';
import { checkWeightsIds, readWeightsIds, weightsAbsentRecord, WEIGHTS_PATH } from './weights-ids.ts';

function line(statId: string | null): unknown {
  return { statId, ranges: [] };
}

function pool(...lines: unknown[]): unknown {
  return {
    poolCoverage: 'complete',
    entries:
      lines.length === 0
        ? []
        : [{ sourceModifierId: 'x', modGroup: 'X', itemLevelMin: 1, weight: 1, weightSource: 'published', lines }],
  };
}

const WEIGHTS = {
  schemaVersion: '6.1.0',
  gamePatch: '0.5.5',
  producer: { id: 'test', generatedAt: '2026-09-26T00:00:00Z' },
  bases: {
    'weapon.bow': { Bows: { prefix: pool(line('explicit.a'), line(null)), suffix: pool(line('explicit.b')) } },
    jewel: {
      Emerald: { prefix: pool(line('explicit.a')), suffix: pool() },
      Ruby: { prefix: pool(line('explicit.c')), suffix: pool(line(null)) },
    },
  },
};

function fsWith(contents: string | undefined) {
  return createFakeFilesystemPort(contents === undefined ? {} : { [WEIGHTS_PATH]: { contents } });
}

/** The last BMP code point and the first astral one: code-unit and code-point order disagree on them. */
const BMP_LAST = String.fromCodePoint(0xFF_FF);
const ASTRAL = String.fromCodePoint(0x1_00_00);

describe('readWeightsIds', () => {
  it('reads the outer categoryIds and every non-null line statId, and carries the parsed file', async () => {
    expect(await readWeightsIds(fsWith(JSON.stringify(WEIGHTS)))).toEqual({
      kind: 'present',
      statIds: new Set(['explicit.a', 'explicit.b', 'explicit.c']),
      categoryIds: new Set(['weapon.bow', 'jewel']),
      file: WEIGHTS,
    });
  });

  it('answers absent for an absent file', async () => {
    expect(await readWeightsIds(fsWith(undefined))).toEqual({ kind: 'absent' });
  });

  it.each([
    ['not JSON', '{', 'not-json'],
    ['an unknown major', JSON.stringify({ ...WEIGHTS, schemaVersion: '5.1.0' }), 'unknown-major'],
    ['a malformed version', JSON.stringify({ ...WEIGHTS, schemaVersion: 'six' }), 'malformed-version'],
    ['no version', JSON.stringify({ bases: {} }), 'invalid'],
    ['no bases', JSON.stringify({ ...WEIGHTS, schemaVersion: '6.0.0', bases: undefined }), 'invalid'],
  ])('refuses %s loudly, naming the file', async (_label, contents, reason) => {
    const read = readWeightsIds(fsWith(contents));
    await expect(read).rejects.toBeInstanceOf(DataFileError);
    await expect(read).rejects.toMatchObject({ path: WEIGHTS_PATH, reason });
  });

  it('refuses a hard error as a whole, naming the first issue path and its rule', async () => {
    const bad = { ...WEIGHTS, bases: { jewel: { Emerald: { prefix: 'nonsense', suffix: pool(line('explicit.a')) } } } };
    const read = readWeightsIds(fsWith(JSON.stringify(bad)));
    await expect(read).rejects.toMatchObject({ path: WEIGHTS_PATH, reason: 'invalid' });
    await expect(read).rejects.toThrow(/^data\/weights\.json: invalid: bases\.jewel\.Emerald\.prefix: /);
  });

  it('names the failing rule of a within-file hard error', async () => {
    const twice = { ...WEIGHTS, bases: { 'weapon.bow': { Bows: { prefix: { poolCoverage: 'complete', entries: [
      { sourceModifierId: 'x', modGroup: 'X', itemLevelMin: 1, weight: 1, weightSource: 'published', lines: [line('explicit.a')] },
      { sourceModifierId: 'x', modGroup: 'X', itemLevelMin: 2, weight: 1, weightSource: 'published', lines: [line('explicit.a')] },
    ] }, suffix: pool() } } } };
    await expect(readWeightsIds(fsWith(JSON.stringify(twice)))).rejects.toThrow(
      'data/weights.json: invalid: bases.weapon.bow.Bows.prefix.entries.1.sourceModifierId: sourceModifierId repeats entries.0; a sourceModifierId may appear once per slot',
    );
  });

  it('reads the frozen weights.json fixture', async () => {
    const committed = readFileSync(fileURLToPath(new URL('../../../../test/fixtures/frozen-data/weights.json', import.meta.url)), 'utf8');
    const ids = await readWeightsIds(fsWith(committed));
    expect(ids.kind).toBe('present');
  });
});

describe('checkWeightsIds', () => {
  const catalogue: CatalogueIds = {
    statIds: new Set(['explicit.a']),
    baseTypeIds: new Set(),
    categoryIds: new Set(['jewel']),
  };

  it('reports each distinct miss once, sorted by kind then identifier', () => {
    expect(
      checkWeightsIds(
        {
          kind: 'present',
          statIds: new Set(['explicit.c', 'explicit.a', 'explicit.b']),
          categoryIds: new Set(['weapon.bow', 'jewel', 'armour.chest']),
        },
        catalogue,
      ),
    ).toEqual([
      { kind: 'uncatalogued-weights-id', identifier: 'armour.chest', identifierKind: 'categoryId' },
      { kind: 'uncatalogued-weights-id', identifier: 'weapon.bow', identifierKind: 'categoryId' },
      { kind: 'uncatalogued-weights-id', identifier: 'explicit.b', identifierKind: 'statId' },
      { kind: 'uncatalogued-weights-id', identifier: 'explicit.c', identifierKind: 'statId' },
    ]);
  });

  it('reports nothing where every id is catalogued', () => {
    expect(
      checkWeightsIds({ kind: 'present', statIds: new Set(['explicit.a']), categoryIds: new Set(['jewel']) }, catalogue),
    ).toEqual([]);
  });

  it('sorts identifiers by code point, not by UTF-16 code unit', () => {
    // U+10000 encodes as 0xD800 0xDC00, which precedes 0xFFFF by code unit but follows U+FFFF by code point.
    expect(
      checkWeightsIds(
        {
          kind: 'present',
          statIds: new Set([ASTRAL, BMP_LAST]),
          categoryIds: new Set(['jewel', `weapon.${ASTRAL}`, `weapon.${BMP_LAST}`]),
        },
        catalogue,
      ).map((record) => [record.identifierKind, record.identifier]),
    ).toEqual([
      ['categoryId', `weapon.${BMP_LAST}`],
      ['categoryId', `weapon.${ASTRAL}`],
      ['statId', BMP_LAST],
      ['statId', ASTRAL],
    ]);
  });
});

describe('weightsAbsentRecord', () => {
  const craftedOf = (className: string, status: TrackedEntry['status'] = 'active'): TrackedEntry =>
    ({
      kind: 'crafted',
      categoryId: 'c',
      className,
      itemLevelMin: 1,
      prefix: { kind: 'valueless', statId: 's' },
      suffix: { kind: 'valueless', statId: 't' },
      status,
      ...((status === 'pruned') && { prunedReason: 'x' }),
    });

  it('names the distinct classNames of non-pruned crafted entries, sorted by code point', () => {
    expect(
      weightsAbsentRecord([
        craftedOf('bows'),
        craftedOf('Bows'),
        craftedOf('Amulets', 'pinned'),
        craftedOf('Bows'),
        craftedOf('Pruned_Class', 'pruned'),
        { kind: 'raw', baseTypeId: 'Gold Amulet', itemLevelMin: 1, status: 'active' },
      ]),
    ).toEqual({ kind: 'weights-absent', uncheckableClassNames: ['Amulets', 'Bows', 'bows'] });
  });

  it('sorts classNames by code point, not by UTF-16 code unit', () => {
    expect(weightsAbsentRecord([craftedOf(ASTRAL), craftedOf(BMP_LAST)]).uncheckableClassNames).toEqual([
      BMP_LAST,
      ASTRAL,
    ]);
  });
});
