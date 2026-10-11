import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import type { CurrenciesFile } from '@poe/contracts';

import { type Poe2ScoutItem, Poe2ScoutPageSchema } from './plan.ts';

const FIXTURE_PATH = nodePath.join(import.meta.dirname, '../../fixtures/poe2scout-currencies.json');

export const LEAGUE = 'Forbidden Rites';

// eslint-disable-next-line unicorn/no-null -- boundary: poe2scout sends `CurrentPrice: null` for an unpriced item.
export const NULL_PRICE = null;

/** The captured response body, parsed raw so a test can reshape it. */
export function capturedBody(): { readonly Items: readonly Poe2ScoutItem[] } & Record<string, unknown> {
  const body: unknown = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));
  return Poe2ScoutPageSchema.parse(body);
}

export function capturedItems(): readonly Poe2ScoutItem[] {
  return capturedBody().Items;
}

const OLD_AS_OF = '2026-09-26T00:00:00Z';

function oldRate(currencyId: string, rate: number): CurrenciesFile['rates'][number] {
  return { currencyId, rate, source: 'measured', league: LEAGUE, asOf: OLD_AS_OF };
}

/** A file holding divine, exalted, chaos and the four recipe orbs, each with an old `asOf`. */
export function existingFile(): CurrenciesFile {
  return {
    schemaVersion: '1.0.0',
    rates: [
      oldRate('divine', 1),
      oldRate('exalted', 0.00133),
      oldRate('chaos', 0.088),
      oldRate('greater-orb-of-transmutation', 0.00226),
      oldRate('greater-orb-of-augmentation', 0.00532),
      oldRate('perfect-orb-of-transmutation', 0.0186),
      oldRate('perfect-orb-of-augmentation', 0.242),
    ],
  };
}
