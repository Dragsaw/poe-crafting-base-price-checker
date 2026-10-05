import type { CurrencyRate } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { currentRates, lowerMedian, outputRates, roundDivine, toDivine } from './normalise.ts';

const LEAGUE = 'Forbidden Rites';

function rate(currencyId: string, value: number, league = LEAGUE): CurrencyRate {
  return { currencyId, rate: value, source: 'measured', league, asOf: '2026-09-26T00:00:00Z' };
}

describe('currentRates', () => {
  it('keeps only rates whose own league is the active one', () => {
    const current = currentRates([rate('exalted', 0.002), rate('chaos', 0.13, 'Standard')], LEAGUE);
    expect(current.keys().toArray()).toEqual(['exalted']);
  });

  it('pins divine at exactly 1', () => {
    expect(currentRates([rate('divine', 0.97)], LEAGUE).get('divine')?.rate).toBe(1);
  });
});

describe('toDivine and roundDivine', () => {
  it('normalises with n × rate and rounds once to 4dp', () => {
    expect(toDivine(3, rate('exalted', 0.002012))).toBeCloseTo(0.006, 10);
    expect(toDivine(7, rate('chaos', 0.13078))).toBeCloseTo(0.9155, 10);
    expect(roundDivine(1.00005)).toBeCloseTo(1.0001, 10);
    expect(roundDivine(2)).toBe(2);
  });
});

describe('lowerMedian', () => {
  it('takes the lower of the two middle values on an even sample', () => {
    expect(lowerMedian([10, 1, 9, 2, 8, 3, 7, 4, 6, 5])).toBe(5);
  });

  it('takes the middle value on an odd sample', () => {
    expect(lowerMedian([3, 1, 2])).toBe(2);
  });

  it('refuses an empty sample', () => {
    expect(() => lowerMedian([])).toThrow(RangeError);
  });
});

describe('outputRates', () => {
  it('writes divine at 1, other rates at 4dp, league and asOf verbatim', () => {
    const rates = [
      rate('divine', 1.2),
      rate('exalted', 0.002012),
      { ...rate('chaos', 0.13078, 'Standard'), asOf: '2025-01-01T00:00:00Z' },
    ];

    expect(outputRates(rates)).toEqual([
      rate('divine', 1),
      rate('exalted', 0.002),
      { ...rate('chaos', 0.1308, 'Standard'), asOf: '2025-01-01T00:00:00Z' },
    ]);
  });
});
