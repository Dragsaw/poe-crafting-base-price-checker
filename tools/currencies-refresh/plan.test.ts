import { CurrenciesFileSchema } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { capturedItems, existingFile, LEAGUE, NULL_PRICE } from './fixture.ts';
import {
  currenciesUrl,
  leagueSlug,
  planRates,
  roundSignificant,
  secondPrecisionIso,
  serialiseCurrencies,
} from './plan.ts';

const AS_OF = '2026-10-11T12:34:56Z';

function planned(items = capturedItems(), existing = existingFile()) {
  const result = planRates(existing, items, LEAGUE, AS_OF);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result;
}

function rateOf(result: ReturnType<typeof planned>, currencyId: string) {
  return result.file.rates.find((rate) => rate.currencyId === currencyId);
}

describe('leagueSlug', () => {
  it('lowercases and drops every non-alphanumeric character', () => {
    expect(leagueSlug('Forbidden Rites')).toBe('forbiddenrites');
    expect(leagueSlug("Dawn of the Hunt (HC) 0.2")).toBe('dawnofthehunthc02');
  });

  it('builds the currency-category URL for a page', () => {
    expect(currenciesUrl('forbiddenrites', 2)).toBe(
      'https://api.poe2scout.com/poe2/Leagues/forbiddenrites/Currencies/ByCategory?Category=currency&Page=2&PerPage=100',
    );
  });
});

describe('roundSignificant', () => {
  it.each([
    [0.001333284, 0.00133],
    [0.00003617, 0.0000362],
    [8.65317, 8.65],
    [5366.7, 5370],
  ])('rounds %f to three significant figures', (value, expected) => {
    expect(roundSignificant(value)).toBe(expected);
  });
});

describe('secondPrecisionIso', () => {
  it('drops the milliseconds', () => {
    expect(secondPrecisionIso(new Date('2026-10-11T12:34:56.789Z'))).toBe('2026-10-11T12:34:56Z');
  });
});

describe('planRates', () => {
  it('rewrites every file id from the captured response, divine as exactly 1', () => {
    const result = planned();

    expect(result.written).toBe(7);
    expect(result.warnings).toEqual([]);
    expect(rateOf(result, 'divine')?.rate).toBe(1);
    expect(rateOf(result, 'exalted')).toEqual({
      currencyId: 'exalted',
      rate: 0.00133,
      source: 'measured',
      league: LEAGUE,
      asOf: AS_OF,
    });
    // Each is the fixture's CurrentPrice over divine's (750.0276), to three significant figures.
    expect(result.file.rates.map((rate) => [rate.currencyId, rate.rate])).toEqual([
      ['divine', 1],
      ['exalted', 0.00133],
      ['chaos', 0.0937],
      ['greater-orb-of-transmutation', 0.00119],
      ['greater-orb-of-augmentation', 0.00372],
      ['perfect-orb-of-transmutation', 0.0231],
      ['perfect-orb-of-augmentation', 0.264],
    ]);
    expect(CurrenciesFileSchema.safeParse(result.file).success).toBe(true);
  });

  it('writes no currency the file does not hold', () => {
    expect(capturedItems().some((item) => item.ApiId === 'mirror')).toBe(true);
    expect(rateOf(planned(), 'mirror')).toBeUndefined();
  });

  it('keeps an entry the response lacks unchanged and warns with its id', () => {
    const existing = existingFile();
    const kept = { currencyId: 'not-on-poe2scout', rate: 0.5, source: 'measured', league: 'Old', asOf: AS_OF };
    const result = planned(capturedItems(), { ...existing, rates: [...existing.rates, kept] });

    expect(rateOf(result, 'not-on-poe2scout')).toEqual(kept);
    expect(result.warnings).toEqual([expect.stringContaining('not-on-poe2scout')]);
  });

  it.each([NULL_PRICE, 0, -1])('skips an item with CurrentPrice %s and keeps its entry', (price) => {
    const items = capturedItems().map((item) => (item.ApiId === 'chaos' ? { ...item, CurrentPrice: price } : item));
    const result = planned(items);

    expect(rateOf(result, 'chaos')).toEqual(existingFile().rates[2]);
    expect(result.written).toBe(6);
    expect(result.warnings).toEqual([expect.stringContaining('chaos')]);
  });

  it('fails, naming divine, when the response holds no divine', () => {
    const items = capturedItems().filter((item) => item.ApiId !== 'divine');
    const result = planRates(existingFile(), items, LEAGUE, AS_OF);

    expect(result.ok ? '' : result.error).toContain('divine');
  });

  it('fails when divine has no positive price', () => {
    const items = capturedItems().map((item) => (item.ApiId === 'divine' ? { ...item, CurrentPrice: NULL_PRICE } : item));

    expect(planRates(existingFile(), items, LEAGUE, AS_OF).ok).toBe(false);
  });
});

describe('serialiseCurrencies', () => {
  it('writes one rate object per line, two-space indented, with a trailing newline', () => {
    const text = serialiseCurrencies({ schemaVersion: '1.0.0', rates: existingFile().rates.slice(0, 2) });

    expect(text).toBe(
      [
        '{',
        '  "schemaVersion": "1.0.0",',
        '  "rates": [',
        '    { "currencyId": "divine", "rate": 1, "source": "measured", "league": "Forbidden Rites", "asOf": "2026-09-26T00:00:00Z" },',
        '    { "currencyId": "exalted", "rate": 0.00133, "source": "measured", "league": "Forbidden Rites", "asOf": "2026-09-26T00:00:00Z" }',
        '  ]',
        '}',
        '',
      ].join('\n'),
    );
  });

  it('writes an empty rate list on one line', () => {
    expect(serialiseCurrencies({ schemaVersion: '1.0.0', rates: [] })).toBe('{\n  "schemaVersion": "1.0.0",\n  "rates": []\n}\n');
  });
});
