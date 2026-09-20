import { describe, expect, it } from 'vitest';

import { PriceObservationSchema } from './price-observation';
import { without } from './test-support';

const observation = {
  league: 'Forbidden Rites',
  observedAt: '2026-09-20T09:30:00Z',
  priceDivine: 12.5,
  sampleSize: 10,
  exchangeObservation: {
    currencyId: 'exalted',
    rate: 0.0042,
    source: 'in-game exchange, by hand',
    league: 'Forbidden Rites',
    asOf: '2026-09-19T08:00:00Z',
  },
};

describe('PriceObservationSchema', () => {
  it('parses an observation carrying its league, its time and the exchange observation used', () => {
    expect(PriceObservationSchema.parse(observation)).toEqual(observation);
  });

  it('records the true sample size, and refuses a sample of zero', () => {
    expect(PriceObservationSchema.parse({ ...observation, sampleSize: 3 }).sampleSize).toBe(3);
    expect(PriceObservationSchema.safeParse({ ...observation, sampleSize: 0 }).success).toBe(false);
  });

  it('carries no attempt-scoped field — those belong to the dataset entry (AD-9, AD-16)', () => {
    for (const field of ['lastSearchId', 'lastSearchLeague', 'lastAttemptedAt']) {
      const result = PriceObservationSchema.safeParse({ ...observation, [field]: 'x' });
      expect(result.success, `${field} must not be accepted on a PriceObservation`).toBe(false);
    }
  });

  it('requires the exchange observation, so no price is half-normalised', () => {
    expect(PriceObservationSchema.safeParse(without(observation, 'exchangeObservation')).success).toBe(
      false,
    );
  });
});
