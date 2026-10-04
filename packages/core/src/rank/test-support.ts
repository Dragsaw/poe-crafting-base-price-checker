import { canonicalKey } from '@poe/contracts';
import type {
  CraftedRankedRow,
  CraftRecipe,
  CurrencyRate,
  DatasetEntry,
  ModifierWeight,
  PriceObservation,
  PriceState,
  RankedRow,
  TrackedEntry,
  WeightsFile,
  WeightsPool,
} from '@poe/contracts';

import { rank } from '../rank.ts';
import type { RankInput, Ranking } from '../rank.ts';

export const LEAGUE = 'Forbidden Rites';
export const OLD_LEAGUE = 'Standard Rites';
export const THRESHOLD = 0.25;
export const ATTEMPTED = '2026-09-26T11:00:00Z';

export function raw(baseTypeId: string, status: TrackedEntry['status'] = 'active'): TrackedEntry {
  return status === 'pruned'
    ? { kind: 'raw', baseTypeId, itemLevelMin: 82, status, prunedReason: 'no market' }
    : { kind: 'raw', baseTypeId, itemLevelMin: 82, status };
}

type Coverage = WeightsPool['poolCoverage'];

const SLOT_FILLER: ModifierWeight = {
  sourceModifierId: 'slot-filler',
  modGroup: 'slot-filler',
  itemLevelMin: 1,
  weight: 1,
  weightSource: 'published',
  lines: [{ statId: 'explicit.stat_slot_filler', ranges: [[1, 10]] }],
};

function slotOf(coverage: Coverage): WeightsFile['bases'][string][string]['prefix'] {
  return { poolCoverage: coverage, entries: coverage === 'complete' ? [SLOT_FILLER] : [] };
}

/** A parsed weights file carrying exactly `classes`, each `[categoryId, className, prefix, suffix]` coverage. */
export function weightsWith(...classes: readonly (readonly [string, string, Coverage?, Coverage?])[]): WeightsFile {
  const bases: Record<string, WeightsFile['bases'][string]> = {};
  for (const [categoryId, className, prefix = 'complete', suffix = 'complete'] of classes) {
    bases[categoryId] = {
      ...bases[categoryId],
      // A complete slot holds one weighted tier: an empty one is unreachable (IN §3).
      [className]: { prefix: slotOf(prefix), suffix: slotOf(suffix) },
    };
  }
  return {
    schemaVersion: '6.0.0',
    gamePatch: '0.5.5',
    producer: { id: 'test', generatedAt: '2026-09-26T00:00:00Z' },
    bases,
  };
}


/** Every crafted class these tests name by default, both slots `complete`. */
export const WEIGHTS = weightsWith(['accessory.amulet', 'Amulets'], ['weapon.bow', 'Bows']);

export const crafted: TrackedEntry = {
  kind: 'crafted',
  categoryId: 'accessory.amulet',
  className: 'Amulets',
  itemLevelMin: 54,
  prefix: { kind: 'valueless', statId: 'explicit.stat_1' },
  suffix: { kind: 'valueless', statId: 'explicit.stat_2' },
  status: 'active',
};

export function observation(priceDivine: number, league: string = LEAGUE): PriceObservation {
  return {
    league,
    observedAt: '2026-09-26T10:00:00Z',
    priceDivine,
    sampleSize: 10,
    exchangeObservation: {
      currencyId: 'exalted',
      rate: 0.0042,
      source: 'in-game exchange, by hand',
      league,
      asOf: '2026-09-25T08:00:00Z',
    },
  };
}

export const priced = (priceDivine: number, league: string = LEAGUE): PriceState => ({
  state: 'priced',
  observation: observation(priceDivine, league),
});

export function published(
  entry: TrackedEntry,
  price: PriceState,
  /** `false` publishes no `lastAttemptedAt`; `undefined` would take the default. */
  lastAttemptedAt: string | false = ATTEMPTED,
): DatasetEntry {
  return lastAttemptedAt === false
    ? { entryKey: canonicalKey(entry), price }
    : { entryKey: canonicalKey(entry), price, lastAttemptedAt };
}

export function ranked(input: Partial<RankInput> & Pick<RankInput, 'tracked'>): Ranking {
  return rank({ dataset: [], activeLeague: LEAGUE, threshold: THRESHOLD, weights: WEIGHTS, ...input });
}

export const keysOf = (items: readonly ({ entryKey: string } | { classKey: string })[]): string[] =>
  items.map((item) => ('entryKey' in item ? item.entryKey : item.classKey));

/** Every entry key the ranking mentions, in any group. */
export const everyKey = (result: Ranking): string[] => [
  ...keysOf(result.ordering),
  ...keysOf(result.belowThreshold),
  ...keysOf(result.noListings),
  ...keysOf(result.notYetSynced),
  ...keysOf(result.unresolvable),
];

export const ABSENT = 'class absent from weights file';
export const PARTIAL = 'pool partial';
/** What a rankable class gets when `ranked` is given no recipe (retro item 29). */
export const NO_RECIPE = 'recipe cannot reach this class';

/** A deterministic permutation, so the test itself uses no randomness. */
export function permute<T>(items: readonly T[], seed: number): T[] {
  const copy = [...items];
  let state = seed;
  for (let index = copy.length - 1; index > 0; index -= 1) {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    const swap = state % (index + 1);
    const held = copy[index] as T;
    copy[index] = copy[swap] as T;
    copy[swap] = held;
  }
  return copy;
}

export const TARGET = 'explicit.stat_target';
export const FILLER = 'explicit.stat_filler';
export const SUFFIX_STAT = 'explicit.stat_suffix';

const nextTierSerial = ((): (() => number) => {
  let tierSerial = 0;
  return () => {
    tierSerial += 1;
    return tierSerial;
  };
})();

/** One weights tier, built in the test, never read from a fixture file (NFR-2). */
export function tierOf(statId: string, weight: number, itemLevelMin = 1, moduleGroup?: string): ModifierWeight {
  const tierSerial = nextTierSerial();
  return {
    sourceModifierId: `t${String(tierSerial)}`,
    modGroup: moduleGroup ?? `g${String(tierSerial)}`,
    itemLevelMin,
    weight,
    weightSource: 'published',
    lines: [{ statId, ranges: [[1, 10]] }],
  };
}

export type Pools = readonly [readonly ModifierWeight[], readonly ModifierWeight[]];

/** A weights file whose classes carry real pools: `[categoryId, className, [prefix tiers, suffix tiers]]`. */
export function poolsFile(...classes: readonly (readonly [string, string, Pools])[]): WeightsFile {
  const file = weightsWith(...classes.map(([categoryId, className]) => [categoryId, className] as const));
  for (const [categoryId, className, [prefix, suffix]] of classes) {
    const byClass = file.bases[categoryId];
    if (byClass !== undefined) {
      byClass[className] = {
        prefix: { poolCoverage: 'complete', entries: [...prefix] },
        suffix: { poolCoverage: 'complete', entries: [...suffix] },
      };
    }
  }
  return file;
}

/**
 * A crafted entry on `statId`, banded `[1, 10]`, whose suffix holds the whole suffix pool, so P is the prefix pool's share.
 */
export function chase(
  className: string,
  statId = TARGET,
  status: TrackedEntry['status'] = 'active',
  categoryId = 'weapon.bow',
): TrackedEntry {
  const base = {
    kind: 'crafted' as const,
    categoryId,
    className,
    itemLevelMin: 82,
    prefix: { kind: 'banded' as const, statId, valueMin: 1, valueMax: 10 },
    // Contains every suffix tier these pools carry, so P is the prefix's share.
    suffix: { kind: 'banded' as const, statId: SUFFIX_STAT, valueMin: 1, valueMax: 10 },
  };
  return status === 'pruned' ? { ...base, status, prunedReason: 'no market' } : { ...base, status };
}

function recipeOf(id: string, modifierLevelMin: number, ...currencyIds: string[]): CraftRecipe {
  return { id, currencies: currencyIds.map((currencyId) => ({ currencyId, quantity: 1 })), modifierLevelMin };
}

export const divineRecipe = (id: string): CraftRecipe => recipeOf(id, 0, 'divine');
export function rateOf(currencyId: string, rate: number, league: string = LEAGUE): CurrencyRate {
  return { currencyId, rate, source: 'measured', league, asOf: '2026-09-26T00:00:00Z' };
}

export const GREATER = recipeOf('greater', 0, 'greater-orb-of-transmutation', 'greater-orb-of-augmentation');
export const PERFECT = recipeOf('perfect', 70, 'perfect-orb-of-transmutation', 'perfect-orb-of-augmentation');
export const RATES = [
  rateOf('greater-orb-of-transmutation', 0.01),
  rateOf('greater-orb-of-augmentation', 0.02),
  rateOf('perfect-orb-of-transmutation', 0.1),
  rateOf('perfect-orb-of-augmentation', 0.2),
];
export const GREATER_COST = 0 + 0.01 + 0.02;
export const PERFECT_COST = 0 + 0.1 + 0.2;

/** Bows: the target is 1 in 10 of the prefix pool at floor 0, and 1 in 2 at floor 70. */
export const BOWS_POOLS: Pools = [
  [tierOf(TARGET, 10, 75), tierOf(FILLER, 10, 75), tierOf('explicit.stat_low', 80, 1)],
  [tierOf(SUFFIX_STAT, 10, 80)],
];

export const craftedRows = (rows: readonly RankedRow[]): CraftedRankedRow[] =>
  rows.flatMap((row) => (row.kind === 'crafted' ? [row] : []));

export function rankCrafted(input: Partial<RankInput> & Pick<RankInput, 'tracked'>): Ranking {
  return rank({
    dataset: [],
    activeLeague: LEAGUE,
    threshold: THRESHOLD,
    weights: poolsFile(['weapon.bow', 'Bows', BOWS_POOLS]),
    recipes: [GREATER, PERFECT],
    currencyRates: RATES,
    ...input,
  });
}
