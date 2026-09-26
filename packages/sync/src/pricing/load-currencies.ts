/**
 * `data/currencies.json` — the player's hand-maintained rates (AD-20). `sync`
 * reads the file and never fetches against it. An absent file, or one that
 * fails `CurrenciesFileSchema`, is a typed load error naming the file, and it
 * is refused before any request.
 *
 * This module lives outside `chunk/`: the chunk runner receives rates as a
 * value and never names a player file other than its own inputs.
 */

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
