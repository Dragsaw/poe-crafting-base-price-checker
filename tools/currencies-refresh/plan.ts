import type { CurrenciesFile, CurrencyRate } from '@poe/contracts';
import { z } from 'zod';

export const POE2SCOUT_BASE = 'https://api.poe2scout.com/poe2';

const DIVINE = 'divine';
const SIGNIFICANT_FIGURES = 3;
const RATE_INDENT = ' '.repeat(4);

// Loose objects: only the fields the command reads are checked, so an added field is no failure.
const Poe2ScoutItemSchema = z.looseObject({
  ApiId: z.string().min(1),
  CurrentPrice: z.number().nullable(),
});

export const Poe2ScoutPageSchema = z.looseObject({
  CurrentPage: z.int().min(1),
  Pages: z.int().min(0),
  Items: z.array(Poe2ScoutItemSchema),
});

export type Poe2ScoutItem = z.infer<typeof Poe2ScoutItemSchema>;

export function leagueSlug(league: string): string {
  return league.toLowerCase().replaceAll(/[^a-z0-9]/g, '');
}

export function currenciesUrl(slug: string, page: number): string {
  return `${POE2SCOUT_BASE}/Leagues/${slug}/Currencies/ByCategory?Category=currency&Page=${String(page)}&PerPage=100`;
}

export function roundSignificant(value: number): number {
  return Number(value.toPrecision(SIGNIFICANT_FIGURES));
}

/** Second precision, as the hand-typed entries of `data/currencies.json` are. */
export function secondPrecisionIso(instant: Date): string {
  return instant.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export type PlanResult =
  | { readonly ok: true; readonly file: CurrenciesFile; readonly written: number; readonly warnings: readonly string[] }
  | { readonly ok: false; readonly error: string };

function isPositivePrice(price: number | null): price is number {
  return price !== null && Number.isFinite(price) && price > 0;
}

export function planRates(
  existing: CurrenciesFile,
  items: readonly Poe2ScoutItem[],
  league: string,
  asOf: string,
): PlanResult {
  const priceById = new Map<string, number | null>();
  for (const item of items) {
    if (!priceById.has(item.ApiId)) {
      priceById.set(item.ApiId, item.CurrentPrice);
    }
  }

  const divinePrice = priceById.get(DIVINE);
  if (divinePrice === undefined) {
    return { ok: false, error: `the response holds no ${DIVINE} item; every rate is divided by its price` };
  }
  if (!isPositivePrice(divinePrice)) {
    return { ok: false, error: `the ${DIVINE} item has CurrentPrice ${String(divinePrice)}; it must be positive` };
  }

  const warnings: string[] = [];
  let written = 0;
  const rates = existing.rates.map((entry): CurrencyRate => {
    const price = priceById.get(entry.currencyId);
    if (price === undefined) {
      warnings.push(`${entry.currencyId}: not in the response; entry kept unchanged`);
      return entry;
    }
    if (!isPositivePrice(price)) {
      warnings.push(`${entry.currencyId}: CurrentPrice ${String(price)} is not positive; entry kept unchanged`);
      return entry;
    }
    written += 1;
    const rate = entry.currencyId === DIVINE ? 1 : roundSignificant(price / divinePrice);
    return { currencyId: entry.currencyId, rate, source: 'measured', league, asOf };
  });

  return { ok: true, file: { schemaVersion: existing.schemaVersion, rates }, written, warnings };
}

function serialiseRate(rate: CurrencyRate): string {
  const fields = Object.entries(rate).map(([key, value]) => `${JSON.stringify(key)}: ${JSON.stringify(value)}`);
  return `${RATE_INDENT}{ ${fields.join(', ')} }`;
}

export function serialiseCurrencies(file: CurrenciesFile): string {
  const lines = file.rates.map((rate) => serialiseRate(rate));
  const rates = lines.length === 0 ? '[]' : `[\n${lines.join(',\n')}\n  ]`;
  return `{\n  "schemaVersion": ${JSON.stringify(file.schemaVersion)},\n  "rates": ${rates}\n}\n`;
}
