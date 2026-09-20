import { describe, expect, it } from 'vitest';

import { DatasetEntrySchema, PriceStateSchema } from './dataset';
import type { PriceState } from './dataset';

const observation = {
  league: 'Forbidden Rites',
  observedAt: '2026-09-20T09:30:00Z',
  priceDivine: 12.5,
  sampleSize: 10,
  exchangeObservation: {
    currencyId: 'exalted',
    rate: 0.0042,
    source: 'by hand',
    league: 'Forbidden Rites',
    asOf: '2026-09-19T08:00:00Z',
  },
};

describe('PriceStateSchema', () => {
  it('carries four states, and the observation lives inside the priced arm alone', () => {
    expect(PriceStateSchema.parse({ state: 'priced', observation })).toEqual({
      state: 'priced',
      observation,
    });
    expect(PriceStateSchema.parse({ state: 'no-listings' })).toEqual({ state: 'no-listings' });
    expect(PriceStateSchema.parse({ state: 'unresolvable' })).toEqual({ state: 'unresolvable' });
    expect(PriceStateSchema.safeParse({ state: 'no-listings', observation }).success).toBe(false);
  });

  it('carries one of exactly three declared reasons on not-yet-synced', () => {
    for (const reason of ['never-synced', 'league-mismatch', 'no-exchange-rate']) {
      expect(PriceStateSchema.safeParse({ state: 'not-yet-synced', reason }).success).toBe(true);
    }
    expect(PriceStateSchema.safeParse({ state: 'not-yet-synced' }).success).toBe(false);
    expect(
      PriceStateSchema.safeParse({ state: 'not-yet-synced', reason: 'because' }).success,
    ).toBe(false);
  });

  it('never spells absence as zero, null or a missing key', () => {
    expect(PriceStateSchema.safeParse({ state: 'priced', observation: null }).success).toBe(false);
    expect(PriceStateSchema.safeParse({}).success).toBe(false);
  });

  it('exhausts all four states with no default arm', () => {
    function label(price: PriceState): string {
      switch (price.state) {
        case 'priced':
          return String(price.observation.priceDivine);
        case 'no-listings':
          return 'no listings';
        case 'not-yet-synced':
          return price.reason;
        case 'unresolvable':
          return 'unresolvable';
      }
    }

    expect(label({ state: 'not-yet-synced', reason: 'never-synced' })).toBe('never-synced');
  });
});

describe('DatasetEntrySchema', () => {
  const entry = {
    entryKey: '["raw","Advanced Dualstring Bow",82]',
    price: { state: 'priced', observation },
    lastAttemptedAt: '2026-09-20T09:30:00Z',
    lastSearchId: 'aBcDeF',
    lastSearchLeague: 'Forbidden Rites',
  };

  it('carries the search fields on the entry and never on the observation', () => {
    const parsed = DatasetEntrySchema.parse(entry);
    expect(parsed.lastSearchId).toBe('aBcDeF');
    expect(parsed.lastSearchLeague).toBe('Forbidden Rites');
    expect(Object.keys(parsed.price.state === 'priced' ? parsed.price.observation : {})).not.toContain(
      'lastSearchId',
    );
  });

  it('lets a never-synced entry carry none of the three, with no placeholder', () => {
    const parsed = DatasetEntrySchema.parse({
      entryKey: entry.entryKey,
      price: { state: 'not-yet-synced', reason: 'never-synced' },
    });
    expect(parsed.lastAttemptedAt).toBeUndefined();
    expect(parsed.lastSearchId).toBeUndefined();
    expect(parsed.lastSearchLeague).toBeUndefined();
  });

  it('allows a stored search older than the last attempt', () => {
    expect(
      DatasetEntrySchema.safeParse({
        ...entry,
        price: { state: 'no-listings' },
        lastAttemptedAt: '2026-09-20T10:00:00Z',
      }).success,
    ).toBe(true);
  });

  it('refuses an unknown field on the entry', () => {
    expect(DatasetEntrySchema.safeParse({ ...entry, rank: 1 }).success).toBe(false);
  });
});
