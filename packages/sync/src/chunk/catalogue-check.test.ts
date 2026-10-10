import { canonicalKey } from '@poe/contracts';
import type { DatasetEntry, TrackedEntry } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import type { CatalogueIds } from '../catalogue/catalogue-ids.ts';
import { checkCatalogue, markUnresolvable } from './catalogue-check.ts';

const IDS: CatalogueIds = {
  statIds: new Set(['explicit.a', 'explicit.b']),
  baseTypeIds: new Set(['Gold Amulet']),
  categoryIds: new Set(['weapon.bow', 'accessory.amulet']),
};

const RAW: TrackedEntry = { kind: 'raw', baseTypeId: 'Gold Amulet', categoryId: 'accessory.amulet', className: 'Amulets', itemLevelMin: 82, status: 'active' };
const GONE_BASE: TrackedEntry = { kind: 'raw', baseTypeId: 'Gone Amulet', categoryId: 'accessory.amulet', className: 'Amulets', itemLevelMin: 82, status: 'active' };

function crafted(
  categoryId: string,
  prefix: string,
  suffix: string,
  status: TrackedEntry['status'] = 'active',
): TrackedEntry {
  return {
    kind: 'crafted',
    categoryId,
    className: 'Not_A_Catalogue_Name',
    itemLevelMin: 75,
    prefix: { kind: 'valueless', statId: prefix },
    suffix: { kind: 'valueless', statId: suffix },
    status,
    ...((status === 'pruned') && { prunedReason: 'x' }),
  };
}

const PRICED = (entryKey: string): DatasetEntry => ({
  entryKey,
  price: {
    state: 'priced',
    observation: {
      league: 'Standard',
      observedAt: '2026-09-20T00:00:00.000Z',
      priceDivine: 2,
      sampleSize: 3,
      exchangeObservation: {
        currencyId: 'divine',
        rate: 1,
        source: 'measured',
        league: 'Standard',
        asOf: '2026-09-20T00:00:00Z',
      },
    },
  },
  lastAttemptedAt: '2026-09-20T00:00:00.000Z',
  lastSearchId: 'S1',
  lastSearchLeague: 'Standard',
});

describe('checkCatalogue', () => {
  it('passes an entry whose ids all resolve, and never checks className', () => {
    const entry = crafted('weapon.bow', 'explicit.a', 'explicit.b');
    expect(checkCatalogue([RAW, entry], [], IDS)).toEqual({
      marked: [],
      records: [],
      excludedKeys: new Set(),
      orderDataset: [],
    });
  });

  it('marks an unknown stat, records it, and excludes the entry', () => {
    const entry = crafted('weapon.bow', 'explicit.gone', 'explicit.b');
    const check = checkCatalogue([RAW, entry], [], IDS);
    expect(check.marked).toEqual([{ entryKey: canonicalKey(entry), price: { state: 'unresolvable' } }]);
    expect(check.records).toEqual([
      { kind: 'unresolvable', entryKey: canonicalKey(entry), identifier: 'explicit.gone', identifierKind: 'statId' },
    ]);
    expect(check.excludedKeys).toEqual(new Set([canonicalKey(entry)]));
  });

  it('checks each line of a hybrid reference, one record per missing statId, in line order', () => {
    const base = crafted('weapon.bow', 'explicit.a', 'explicit.b');
    if (base.kind !== 'crafted') {
      throw new Error('expected a crafted entry');
    }
    const resolving: TrackedEntry = {
      ...base,
      prefix: { kind: 'hybrid', lines: [{ statId: 'explicit.a', valueMin: 1, valueMax: 2 }, { statId: 'explicit.b' }] },
    };
    expect(checkCatalogue([resolving], [], IDS).records).toEqual([]);

    const missing: TrackedEntry = {
      ...base,
      prefix: {
        kind: 'hybrid',
        lines: [{ statId: 'explicit.a' }, { statId: 'explicit.gone' }, { statId: 'explicit.lost', valueMin: 1, valueMax: 2 }],
      },
    };
    const check = checkCatalogue([missing], [], IDS);
    expect(check.records).toEqual([
      { kind: 'unresolvable', entryKey: canonicalKey(missing), identifier: 'explicit.gone', identifierKind: 'statId' },
      { kind: 'unresolvable', entryKey: canonicalKey(missing), identifier: 'explicit.lost', identifierKind: 'statId' },
    ]);
    expect(check.excludedKeys).toEqual(new Set([canonicalKey(missing)]));
  });

  it('checks a raw baseTypeId and a crafted categoryId', () => {
    const entry = crafted('weapon.gone', 'explicit.a', 'explicit.b');
    const check = checkCatalogue([GONE_BASE, entry], [], IDS);
    expect(check.records).toEqual([
      { kind: 'unresolvable', entryKey: canonicalKey(GONE_BASE), identifier: 'Gone Amulet', identifierKind: 'baseTypeId' },
      { kind: 'unresolvable', entryKey: canonicalKey(entry), identifier: 'weapon.gone', identifierKind: 'categoryId' },
    ]);
  });

  it('checks a raw categoryId, after its baseTypeId, in field order (AD-9)', () => {
    const goneClass: TrackedEntry = { ...RAW, categoryId: 'accessory.gone' };
    const goneBoth: TrackedEntry = { ...GONE_BASE, categoryId: 'accessory.gone' };
    const check = checkCatalogue([goneClass, goneBoth], [], IDS);
    expect(check.records).toEqual([
      { kind: 'unresolvable', entryKey: canonicalKey(goneClass), identifier: 'accessory.gone', identifierKind: 'categoryId' },
      { kind: 'unresolvable', entryKey: canonicalKey(goneBoth), identifier: 'Gone Amulet', identifierKind: 'baseTypeId' },
      { kind: 'unresolvable', entryKey: canonicalKey(goneBoth), identifier: 'accessory.gone', identifierKind: 'categoryId' },
    ]);
    expect(check.excludedKeys).toEqual(new Set([canonicalKey(goneClass), canonicalKey(goneBoth)]));
  });

  it('writes one record per miss, in field order: category, prefix, suffix', () => {
    const entry = crafted('weapon.gone', 'explicit.p', 'explicit.s');
    expect(checkCatalogue([entry], [], IDS).records.map((record) => record.identifier)).toEqual([
      'weapon.gone',
      'explicit.p',
      'explicit.s',
    ]);
  });

  it('keeps the attempt metadata of a previously priced entry and drops only the observation', () => {
    const published = PRICED(canonicalKey(GONE_BASE));
    expect(checkCatalogue([GONE_BASE], [published], IDS).marked).toEqual([
      {
        entryKey: canonicalKey(GONE_BASE),
        price: { state: 'unresolvable' },
        lastAttemptedAt: '2026-09-20T00:00:00.000Z',
        lastSearchId: 'S1',
        lastSearchLeague: 'Standard',
      },
    ]);
  });

  it('does not check, mark or record a pruned entry', () => {
    const pruned = crafted('weapon.gone', 'explicit.gone', 'explicit.b', 'pruned');
    expect(checkCatalogue([pruned], [], IDS)).toEqual({
      marked: [],
      records: [],
      excludedKeys: new Set(),
      orderDataset: [],
    });
  });

  it('strips the state of a recovered entry from the order’s input only', () => {
    const recovered: DatasetEntry = {
      entryKey: canonicalKey(RAW),
      price: { state: 'unresolvable' },
      lastAttemptedAt: '2026-09-25T00:00:00.000Z',
    };
    const stillMissing: DatasetEntry = { entryKey: canonicalKey(GONE_BASE), price: { state: 'unresolvable' } };
    const check = checkCatalogue([RAW, GONE_BASE], [recovered, stillMissing], IDS);
    expect(check.orderDataset).toEqual([
      { ...recovered, price: { state: 'not-yet-synced', reason: 'never-synced' } },
      stillMissing,
    ]);
    expect(check.marked).toEqual([stillMissing]);
  });
});

describe('checkCatalogue: jewel entries', () => {
  it('never recovers a crafted jewel entry, which only the pricing step can decide', () => {
    const jewel = crafted('jewel', 'explicit.a', 'explicit.b');
    const published: DatasetEntry = { entryKey: canonicalKey(jewel), price: { state: 'unresolvable' } };
    const ids: CatalogueIds = { ...IDS, categoryIds: new Set(['jewel']) };
    expect(checkCatalogue([jewel], [published], ids)).toEqual({
      marked: [],
      records: [],
      excludedKeys: new Set(),
      orderDataset: [published],
    });
  });

  it('still marks a jewel entry for its own catalogue-id misses', () => {
    const jewel = crafted('jewel', 'explicit.gone', 'explicit.b');
    const ids: CatalogueIds = { ...IDS, categoryIds: new Set(['jewel']) };
    expect(checkCatalogue([jewel], [], ids).records).toEqual([
      { kind: 'unresolvable', entryKey: canonicalKey(jewel), identifier: 'explicit.gone', identifierKind: 'statId' },
    ]);
  });
});

describe('markUnresolvable', () => {
  it('carries no timestamp for a never-synced entry', () => {
    expect(markUnresolvable('k', undefined)).toEqual({ entryKey: 'k', price: { state: 'unresolvable' } });
  });
});
