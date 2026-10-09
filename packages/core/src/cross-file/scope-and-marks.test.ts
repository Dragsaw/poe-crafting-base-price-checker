import {
  canonicalKey,
  compareCanonicalKeys,
  parseEnvelope,
  TRACKED_SCHEMA_VERSION,
  TrackedFileSchema,
  WEIGHTS_SCHEMA_VERSION,
  WeightsFileSchema,
} from '@poe/contracts';
import type { TrackedEntry } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { classDiscriminability, crossFileChecks } from '../cross-file.ts';
import {
  band,
  bows,
  byCodeUnit,
  byPair,
  checksOf,
  entry,
  failuresOf,
  pools,
  SUFFIX_STAT,
  SUFFIX_TIER,
  T7,
  T8,
  weightsOf,
} from './test-support.ts';

describe('unvalidated marks', () => {
  const a = entry({ prefix: band(43, 56.5) });
  const b = entry({ prefix: band(56, 80) });

  it('marks every crafted entry weights-absent, and fails none, without a weights file', () => {
    expect(crossFileChecks([a, b], undefined)).toEqual({
      failures: [],
      unvalidated: [a, b]
        .map((tracked) => canonicalKey(tracked))
        .toSorted(compareCanonicalKeys)
        .map((entryKey) => ({
          entryKey,
          categoryId: 'weapon.bow',
          className: 'Bows',
          reason: 'weights-absent',
        })),
    });
  });

  it('marks every entry of a partial or absent class partial-pool, with no pool failure', () => {
    const sentinel = entry({ prefix: band(0, 9999) });
    const partial = crossFileChecks([sentinel, b], bows(pools([T7()], [SUFFIX_TIER], { suffix: 'partial' })));
    expect(partial.failures).toEqual([]);
    expect(partial.unvalidated.map((mark) => [mark.entryKey, mark.reason])).toEqual(
      [sentinel, b].map((tracked) => [canonicalKey(tracked), 'partial-pool']).toSorted(byPair),
    );
    const absent = crossFileChecks([sentinel], weightsOf({}));
    expect(absent.unvalidated.map((mark) => mark.reason)).toEqual(['partial-pool']);
  });

  it('marks nothing on a complete class', () => {
    expect(crossFileChecks([a], bows(pools([T7(), T8()])))).toEqual({ failures: [], unvalidated: [] });
  });
});

describe('class discriminability', () => {
  const plain = pools([T7()]);

  it('fails a plain class in a mixed category, naming class, category, sibling count and the reason', () => {
    const weights = weightsOf({
      'armour.chest': { Body_Armours: plain, Body_Armours_dex: plain, Body_Armours_str: plain },
    });
    const tracked = entry({ prefix: band(43, 56.5) }, { categoryId: 'armour.chest', className: 'Body_Armours' });
    const failures = failuresOf([tracked], weights);
    expect(failures.map((failure) => failure.check)).toEqual(['class-discriminability']);
    const detail = failures[0]?.detail ?? '';
    for (const part of ['Body_Armours', 'armour.chest', '2 sibling classes', 'class not discriminable']) {
      expect(detail).toContain(part);
    }
  });

  it('passes arm 1, arm 2 and arm 3', () => {
    const mixed = weightsOf({ 'armour.chest': { Body_Armours_dex: plain, Body_Armours_str: plain } });
    const jewels = weightsOf({ jewel: { Emerald: plain, Ruby: plain } });
    const single = weightsOf({ 'weapon.bow': { Bows: plain } });
    expect(classDiscriminability({ categoryId: 'armour.chest', className: 'Body_Armours_dex' }, mixed)).toBeUndefined();
    expect(classDiscriminability({ categoryId: 'jewel', className: 'Emerald' }, jewels)).toBeUndefined();
    expect(classDiscriminability({ categoryId: 'weapon.bow', className: 'Bows' }, single)).toBeUndefined();
  });
});

describe('crossFileChecks scope', () => {
  it('runs no check without a weights file', () => {
    expect(failuresOf([entry({ prefix: band(0, 9999) })], undefined)).toEqual([]);
  });

  it('runs no pool check on an absent class or a partial slot', () => {
    const tracked = entry({ prefix: band(0, 9999) });
    expect(failuresOf([tracked], weightsOf({}))).toEqual([]);
    expect(failuresOf([tracked], bows(pools([T7()], [SUFFIX_TIER], { suffix: 'partial' })))).toEqual([]);
  });

  it('still runs class discriminability on a class whose own pool is partial', () => {
    const complete = pools([T7()]);
    const weights = weightsOf({
      'armour.chest': {
        Body_Armours: pools([T7()], [SUFFIX_TIER], { prefix: 'partial' }),
        Body_Armours_dex: complete,
        Body_Armours_str: complete,
      },
    });
    const tracked = entry({ prefix: band(0, 9999) }, { categoryId: 'armour.chest', className: 'Body_Armours' });
    expect(checksOf([tracked], weights)).toEqual([['class-discriminability', canonicalKey(tracked)]]);
  });

  it('sees neither pruned nor raw entries', () => {
    const pruned: TrackedEntry = { ...entry({ prefix: band(0, 9999) }), status: 'pruned', prunedReason: 'gone' };
    const raw: TrackedEntry = { kind: 'raw', baseTypeId: 'Gold Amulet', itemLevelMin: 82, status: 'active' };
    expect(failuresOf([pruned, raw], bows(pools([T7()])))).toEqual([]);
  });

  it('reports one failure per (check, entry), every slot in its detail, sorted by key then check', () => {
    const tracked = entry({ prefix: band(0, 9999), suffix: band(0, 9999, SUFFIX_STAT) });
    const alsoEmpty = entry({ prefix: band(1000, 2000), suffix: band(1, 2, SUFFIX_STAT) });
    const failures = failuresOf([tracked, alsoEmpty], bows(pools([T7(), T8()])));
    const edge = failures.find((failure) => failure.check === 'edge-alignment');
    expect(edge?.detail).toContain('prefix');
    expect(edge?.detail).toContain('suffix');
    expect(failures.filter((failure) => failure.check === 'edge-alignment')).toHaveLength(1);
    const keys = failures.map((failure) => `${failure.entryKey}|${failure.check}`);
    expect(keys).toEqual(keys.toSorted(byCodeUnit));
    expect(failures[0]).toMatchObject({ categoryId: 'weapon.bow', className: 'Bows' });
  });

  it('finds no failure on the committed files', async () => {
    const here = (import.meta as { readonly dirname: string }).dirname;
    const load = async (name: string): Promise<unknown> =>
      ((await import(/* @vite-ignore */ `${here}/../../../../test/fixtures/frozen-data/${name}`)) as { default: unknown }).default;
    const tracked = parseEnvelope(TrackedFileSchema, await load('tracked.json'), TRACKED_SCHEMA_VERSION);
    const weights = parseEnvelope(WeightsFileSchema, await load('weights.json'), WEIGHTS_SCHEMA_VERSION);
    if (!tracked.ok || !weights.ok) {
      throw new Error('a committed data file was refused');
    }
    expect(failuresOf(tracked.value.entries, weights.value)).toEqual([]);
  });
});
