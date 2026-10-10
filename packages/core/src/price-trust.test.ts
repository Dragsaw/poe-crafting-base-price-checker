import { canonicalKey } from '@poe/contracts';
import type { DatasetEntry, PriceState, PriceTrust } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { HOUR_MS } from './clock.ts';
import { craftedTrust, entryTrust, OLD_AFTER_HOURS, THIN_BELOW_LISTINGS, UNRELIABLE_SHARE_MIN } from './price-trust.ts';
import { LEAGUE, observation, OLD_LEAGUE, raw } from './rank/test-support.ts';

const NOW = '2026-10-01T12:00:00.000Z';
const A = raw('A');

const hoursBefore = (hours: number): string => new Date(Date.parse(NOW) - hours * HOUR_MS).toISOString();

function pricedAt(observedAt: string, sampleSize = 10, league = LEAGUE): PriceState {
  return { state: 'priced', observation: { ...observation(1, league), observedAt, sampleSize } };
}

function entryOf(price: PriceState, lastAttemptedAt?: string): DatasetEntry {
  return lastAttemptedAt === undefined
    ? { entryKey: canonicalKey(A), price }
    : { entryKey: canonicalKey(A), price, lastAttemptedAt };
}

const trustOf = (published: DatasetEntry | undefined): PriceTrust => entryTrust(A, published, LEAGUE, NOW);
const msBefore = (ms: number): string => new Date(Date.parse(NOW) - ms).toISOString();
const noListingsReason = (attemptedAt: string): unknown => trustOf(entryOf({ state: 'no-listings' }, attemptedAt)).reasons[0];

const CURRENT: PriceTrust = { verdict: 'current', reasons: [] };
const ROUGH: PriceTrust = { verdict: 'rough', reasons: [{ kind: 'old', days: 3 }] };
const PENDING: PriceTrust = { verdict: 'pending', reasons: [{ kind: 'never-synced' }] };
const BROKEN: PriceTrust = { verdict: 'broken', reasons: [{ kind: 'unresolvable' }] };

describe('the Price trust bounds', () => {
  it('are EXPERIENCE.md *Price trust* values: 3 days, 3 listings, 70%', () => {
    expect(OLD_AFTER_HOURS).toBe(72);
    expect(THIN_BELOW_LISTINGS).toBe(3);
    expect(UNRELIABLE_SHARE_MIN).toBeCloseTo(0.7, 12);
  });
});

describe('entryTrust: a priced entry', () => {
  it('is current when fresh and thick, with no reason', () => {
    expect(trustOf(entryOf(pricedAt(hoursBefore(2))))).toEqual(CURRENT);
  });

  it('is current one millisecond before the old bound, and rough at it, with its whole days', () => {
    const justUnder = new Date(Date.parse(NOW) - OLD_AFTER_HOURS * HOUR_MS + 1).toISOString();
    expect(trustOf(entryOf(pricedAt(justUnder)))).toEqual(CURRENT);
    expect(trustOf(entryOf(pricedAt(hoursBefore(OLD_AFTER_HOURS))))).toEqual(ROUGH);
  });

  it('rounds the days down', () => {
    expect(trustOf(entryOf(pricedAt(hoursBefore(4 * 24 + 23))))).toEqual({
      verdict: 'rough',
      reasons: [{ kind: 'old', days: 4 }],
    });
  });

  it('is thin below 3 listings, with its count, and current at 3', () => {
    expect(trustOf(entryOf(pricedAt(hoursBefore(1), 1)))).toEqual({ verdict: 'rough', reasons: [{ kind: 'thin', listings: 1 }] });
    expect(trustOf(entryOf(pricedAt(hoursBefore(1), 2)))).toEqual({ verdict: 'rough', reasons: [{ kind: 'thin', listings: 2 }] });
    expect(trustOf(entryOf(pricedAt(hoursBefore(1), THIN_BELOW_LISTINGS)))).toEqual(CURRENT);
  });

  it('carries both reasons when old and thin, age first', () => {
    expect(trustOf(entryOf(pricedAt(hoursBefore(80), 2)))).toEqual({
      verdict: 'rough',
      reasons: [
        { kind: 'old', days: 3 },
        { kind: 'thin', listings: 2 },
      ],
    });
  });

  it('reads the age from observedAt, not lastAttemptedAt', () => {
    expect(trustOf(entryOf(pricedAt(hoursBefore(1)), hoursBefore(200)))).toEqual(CURRENT);
  });

  it('is pending league-mismatch when observed in another league, however fresh', () => {
    expect(trustOf(entryOf(pricedAt(hoursBefore(1), 10, OLD_LEAGUE)))).toEqual({
      verdict: 'pending',
      reasons: [{ kind: 'league-mismatch' }],
    });
  });
});

describe('entryTrust: an entry with no price', () => {
  it('no-listings is pending, with the whole minutes since lastAttemptedAt', () => {
    expect(trustOf(entryOf({ state: 'no-listings' }, hoursBefore(4)))).toEqual({
      verdict: 'pending',
      reasons: [{ kind: 'no-listings', minutes: 240 }],
    });
  });

  it('rounds the minutes down', () => {
    expect(noListingsReason(msBefore(59_999))).toEqual({ kind: 'no-listings', minutes: 0 });
    expect(noListingsReason(msBefore(60_000))).toEqual({ kind: 'no-listings', minutes: 1 });
    expect(noListingsReason(hoursBefore(2 * 24 + 0.5))).toEqual({ kind: 'no-listings', minutes: 2 * 1440 + 30 });
  });

  it('reads a clock ahead of now as age zero', () => {
    const ahead = new Date(Date.parse(NOW) + HOUR_MS).toISOString();
    expect(trustOf(entryOf({ state: 'no-listings' }, ahead))).toEqual({
      verdict: 'pending',
      reasons: [{ kind: 'no-listings', minutes: 0 }],
    });
    expect(trustOf(entryOf(pricedAt(ahead)))).toEqual(CURRENT);
  });

  it('no-listings with no lastAttemptedAt carries no minutes', () => {
    expect(trustOf(entryOf({ state: 'no-listings' }))).toEqual({ verdict: 'pending', reasons: [{ kind: 'no-listings' }] });
  });

  it('never-synced is pending, from no dataset entry or from the published reason', () => {
    expect(trustOf(undefined)).toEqual(PENDING);
    expect(trustOf(entryOf({ state: 'not-yet-synced', reason: 'never-synced' }))).toEqual(PENDING);
  });

  it('every not-yet-synced cause is pending with its own reason', () => {
    for (const reason of ['never-synced', 'league-mismatch', 'no-exchange-rate'] as const) {
      expect(trustOf(entryOf({ state: 'not-yet-synced', reason }, hoursBefore(1)))).toEqual({
        verdict: 'pending',
        reasons: [{ kind: reason }],
      });
    }
  });

  it('unresolvable is broken', () => {
    expect(trustOf(entryOf({ state: 'unresolvable' }, hoursBefore(1)))).toEqual(BROKEN);
  });

  it('refuses a pruned entry: it has no verdict', () => {
    expect(() => entryTrust(raw('A', 'pruned'), undefined, LEAGUE, NOW)).toThrow(RangeError);
  });
});

describe('craftedTrust: the ordered rules, first match wins', () => {
  it('uncostable wins over every entry being broken', () => {
    expect(craftedTrust({ uncostable: true, entries: [{ trust: BROKEN }, { trust: BROKEN }] })).toEqual({
      verdict: 'pending',
      reasons: [{ kind: 'uncostable' }],
    });
  });

  it('every entry broken is broken', () => {
    expect(craftedTrust({ uncostable: false, entries: [{ trust: BROKEN }, { trust: BROKEN }] })).toEqual({
      verdict: 'broken',
      reasons: [{ kind: 'all-broken' }],
    });
  });

  it('no priced entry is pending no-prices, whether all pending or pending and broken', () => {
    const noPrices = { verdict: 'pending', reasons: [{ kind: 'no-prices' }] };
    expect(craftedTrust({ uncostable: false, entries: [{ trust: PENDING }, { trust: PENDING }] })).toEqual(noPrices);
    expect(craftedTrust({ uncostable: false, entries: [{ trust: PENDING }, { trust: BROKEN }] })).toEqual(noPrices);
  });

  it('is rough when the unreliable gross share reaches the bound, the percent rounded down', () => {
    expect(craftedTrust({ uncostable: false, entries: [{ trust: ROUGH, gross: 7 }, { trust: CURRENT, gross: 3 }] })).toEqual({
      verdict: 'rough',
      reasons: [{ kind: 'unreliable-share', percent: 70 }],
    });
    expect(craftedTrust({ uncostable: false, entries: [{ trust: ROUGH, gross: 0.7 }, { trust: CURRENT, gross: 0.3 }] })).toEqual({
      verdict: 'rough',
      reasons: [{ kind: 'unreliable-share', percent: 70 }],
    });
    expect(craftedTrust({ uncostable: false, entries: [{ trust: ROUGH, gross: 7.59 }, { trust: CURRENT, gross: 2.41 }] })).toEqual({
      verdict: 'rough',
      reasons: [{ kind: 'unreliable-share', percent: 75 }],
    });
    expect(craftedTrust({ uncostable: false, entries: [{ trust: ROUGH, gross: 1 }] })).toEqual({
      verdict: 'rough',
      reasons: [{ kind: 'unreliable-share', percent: 100 }],
    });
  });

  it('prints 70 for a share just inside the tolerance, as the rule reads it rough', () => {
    expect(craftedTrust({ uncostable: false, entries: [{ trust: ROUGH, gross: 0.6999999995 }, { trust: CURRENT, gross: 0.3000000005 }] })).toEqual({
      verdict: 'rough',
      reasons: [{ kind: 'unreliable-share', percent: 70 }],
    });
  });

  it('is current just under the bound', () => {
    expect(craftedTrust({ uncostable: false, entries: [{ trust: ROUGH, gross: 69 }, { trust: CURRENT, gross: 31 }] })).toEqual(CURRENT);
  });

  it('leaves pending and broken entries out of both sums', () => {
    const entries = [{ trust: ROUGH, gross: 7 }, { trust: CURRENT, gross: 3 }, { trust: PENDING }, { trust: BROKEN }];
    expect(craftedTrust({ uncostable: false, entries })).toEqual({
      verdict: 'rough',
      reasons: [{ kind: 'unreliable-share', percent: 70 }],
    });
  });
});
