import {
  SUPPORTED_SCHEMA_VERSION,
  TRACKED_SCHEMA_VERSION,
  WEIGHTS_SCHEMA_VERSION,
} from '@poe/contracts';
import type { CurrencyRate, TrackedEntry } from '@poe/contracts';

import type { DryRunSnapshot } from '../dry-run.ts';
import { LEAGUES_FIXTURE_NAME, searchFixtureName } from '../pricing/fixture-names.ts';
import { itemTypesOf } from '../pricing/search-body.ts';
import { RAW_CLASS_FILTERS } from '../test-support/shell-data-inputs.ts';

export const LEAGUE = 'Test League';
/** A yardstick of 2, so the one pinned entry fits the load-time cap. */
const CONFIG = JSON.stringify({ schemaVersion: SUPPORTED_SCHEMA_VERSION, league: LEAGUE, minChunkSearches: 2 });
export const CURRENCY_RATES: CurrencyRate[] = [
  { currencyId: 'divine', rate: 1, source: 'measured', league: LEAGUE, asOf: '2026-01-01T00:00:00Z' },
];
const CURRENCIES = JSON.stringify({ schemaVersion: SUPPORTED_SCHEMA_VERSION, rates: CURRENCY_RATES });
/** Every base type the synthetic entries below name, in one group no category id matches. */
export const ITEMS_CATALOGUE = {
  result: [
    {
      id: 'test',
      label: 'Test',
      entries: ['Solar Amulet', 'Gold Amulet', 'Wide Belt', 'A', 'B', 'C', 'P'].map((type) => ({ type })),
    },
  ],
};
const ITEMS = JSON.stringify({ schemaVersion: SUPPORTED_SCHEMA_VERSION, ...ITEMS_CATALOGUE });
const STATS = JSON.stringify({ schemaVersion: SUPPORTED_SCHEMA_VERSION, result: [] });
const FILTERS = RAW_CLASS_FILTERS;
/** A present weights file with no ids, so no weights record arises. */
const WEIGHTS = JSON.stringify({ schemaVersion: WEIGHTS_SCHEMA_VERSION, gamePatch: '0.5.5', producer: { id: 'test', generatedAt: '2026-09-26T00:00:00Z' }, bases: {} });

/** The league gate's answer: the synthetic league is one the API carries. */
const LEAGUES_ANSWER = JSON.stringify({ result: [{ id: 'Standard' }, { id: LEAGUE }] });

/** An in-memory empty search per entry: ordering tests need synthetic entries, not captures. */
export function emptySearches(entries: readonly TrackedEntry[]): Map<string, string> {
  const itemTypes = itemTypesOf(ITEMS_CATALOGUE);
  return new Map([
    [LEAGUES_FIXTURE_NAME, LEAGUES_ANSWER],
    ...entries.map((entry, index) => [
      searchFixtureName(entry, LEAGUE, itemTypes),
      JSON.stringify({ id: `S${String(index)}`, complexity: 1, result: [], total: 0 }),
    ] as const),
  ]);
}

export function snapshotOf(entries: readonly TrackedEntry[] | undefined, extra: Partial<DryRunSnapshot> = {}): DryRunSnapshot {
  return {
    ...(entries !== undefined && { tracked: JSON.stringify({ schemaVersion: TRACKED_SCHEMA_VERSION, entries }) }),
    config: CONFIG,
    currencies: CURRENCIES,
    items: ITEMS,
    stats: STATS,
    filters: FILTERS,
    weights: WEIGHTS,
    fixtures: emptySearches(entries ?? []),
    ...extra,
  };
}

export const entries: TrackedEntry[] = [
  { kind: 'raw', baseTypeId: 'Solar Amulet', categoryId: 'accessory.amulet', className: 'Amulets', itemLevelMin: 82, status: 'active' },
  { kind: 'raw', baseTypeId: 'Gold Amulet', categoryId: 'accessory.amulet', className: 'Amulets', itemLevelMin: 82, status: 'pinned' },
  { kind: 'raw', baseTypeId: 'Wide Belt', categoryId: 'accessory.belt', className: 'Belts', itemLevelMin: 82, status: 'pruned', prunedReason: 'x' },
];
