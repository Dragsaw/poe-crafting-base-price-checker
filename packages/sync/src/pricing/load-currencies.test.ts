import { createFakeFilesystemPort } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { loadActiveLeague } from '../load-config.ts';
import { DataFileError } from '../load-data-file.ts';
import { CURRENCIES_PATH, loadCurrencies } from './load-currencies.ts';
import { loadItemTypes } from './load-item-types.ts';

const RATE = {
  currencyId: 'exalted',
  rate: 0.002012,
  source: 'measured',
  league: 'Forbidden Rites',
  asOf: '2026-09-26T00:00:00Z',
};

function fsWith(contents: string | undefined, path = CURRENCIES_PATH) {
  return createFakeFilesystemPort(contents === undefined ? {} : { [path]: { contents } });
}

describe('loadCurrencies', () => {
  it('returns the rates of a valid file', async () => {
    const loaded = await loadCurrencies(fsWith(JSON.stringify({ schemaVersion: '1.0.0', rates: [RATE] })));
    expect(loaded).toEqual({ ok: true, value: [RATE] });
  });

  it('refuses an absent file with a typed error naming it', async () => {
    const loaded = await loadCurrencies(fsWith(undefined));
    expect(loaded.ok).toBe(false);
    if (loaded.ok) {
      return;
    }

    expect(loaded.error).toBeInstanceOf(DataFileError);
    expect(loaded.error.reason).toBe('absent');
    expect(loaded.error.path).toBe(CURRENCIES_PATH);
    expect(loaded.error.message).toContain(CURRENCIES_PATH);
  });

  it.each([
    ['not JSON', '{', 'not-json'],
    ['a zero rate', JSON.stringify({ schemaVersion: '1.0.0', rates: [{ ...RATE, rate: 0 }] }), 'invalid'],
    ['an unknown major', JSON.stringify({ schemaVersion: '2.0.0', rates: [] }), 'unknown-major'],
  ])('refuses %s', async (_label, contents, reason) => {
    const loaded = await loadCurrencies(fsWith(contents));
    expect(loaded.ok).toBe(false);
    if (loaded.ok) {
      return;
    }

    expect(loaded.error.reason).toBe(reason);
    expect(loaded.error.message).toContain(CURRENCIES_PATH);
  });
});

describe('loadActiveLeague', () => {
  it('reads the league from data/config.json', async () => {
    const fs = fsWith(
      JSON.stringify({ schemaVersion: '1.0.0', league: 'Forbidden Rites', minChunkSearches: 1 }),
      'data/config.json',
    );
    expect(await loadActiveLeague(fs)).toEqual({ ok: true, value: 'Forbidden Rites' });
  });

  it('refuses an absent or invalid config file, naming it', async () => {
    for (const contents of [undefined, JSON.stringify({ schemaVersion: '1.0.0' })]) {
      const loaded = await loadActiveLeague(fsWith(contents, 'data/config.json'));
      expect(loaded.ok).toBe(false);
      if (!loaded.ok) {
        expect(loaded.error.message).toContain('data/config.json');
      }
    }
  });
});

describe('loadItemTypes', () => {
  it('maps each catalogue group to its base type names', async () => {
    const fs = fsWith(
      JSON.stringify({
        schemaVersion: '1.0.0',
        result: [{ id: 'jewel', label: 'Jewels', entries: [{ type: 'Emerald' }] }],
      }),
      'data/catalogue/items.json',
    );
    const loaded = await loadItemTypes(fs);
    expect(loaded.ok && loaded.value.get('jewel')?.has('Emerald')).toBe(true);
  });

  it('refuses an absent catalogue, naming it', async () => {
    const loaded = await loadItemTypes(fsWith(undefined));
    expect(!loaded.ok && loaded.error.message).toContain('data/catalogue/items.json');
  });
});
