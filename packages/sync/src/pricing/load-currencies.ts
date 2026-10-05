// Outside `chunk/`: the chunk runner receives rates as a value and names no player file (AD-20).

import { CurrenciesFileSchema, parseEnvelope } from '@poe/contracts';
import type { CurrencyRate, FilesystemPort } from '@poe/contracts';

import { loadDataFile } from '../load-data-file.ts';
import type { DataFileResult } from '../load-data-file.ts';

export const CURRENCIES_PATH = 'data/currencies.json';

export async function loadCurrencies(
  fs: FilesystemPort,
): Promise<DataFileResult<readonly CurrencyRate[]>> {
  const loaded = await loadDataFile(fs, CURRENCIES_PATH, (data) =>
    parseEnvelope(CurrenciesFileSchema, data),
  );
  return loaded.ok ? { ok: true, value: loaded.value.rates } : loaded;
}
