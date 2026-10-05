import type {
  CraftedTrackedEntry,
  ModifierReference,
  ModifierWeight,
  TrackedEntry,
  WeightsClassPools,
  WeightsFile,
  WeightsLine,
  WeightsPool,
} from '@poe/contracts';
import { WEIGHTS_SCHEMA_VERSION } from '@poe/contracts';

import { crossFileChecks } from '../cross-file.ts';
import { band, line, STAT, tier as weightTier } from '../probability/test-support.ts';

export { band, line, OTHER, STAT } from '../probability/test-support.ts';
export const SUFFIX_STAT = 'explicit.stat_9';

/** One weights tier with the cross-file defaults: weight 100, floor 1. */
export function tier(
  lines: readonly WeightsLine[],
  { itemLevelMin = 1, weight = 100, modGroup }: { itemLevelMin?: number; weight?: number; modGroup?: string } = {},
): ModifierWeight {
  return weightTier(lines, weight, modGroup === undefined ? { itemLevelMin } : { itemLevelMin, modGroup });
}

export const valueless = (statId = STAT): ModifierReference => ({ kind: 'valueless', statId });

/** T7 derives to `[43, 56.5]` (a two-`#` line), T8 to `[56, 80]`. */
export const T7 = () => tier([line(STAT, [40, 53], [46, 60])], { itemLevelMin: 60 });
export const T8 = () => tier([line(STAT, [56, 80])], { itemLevelMin: 75 });
/** A suffix pool one reference aligns on. */
export const SUFFIX_TIER = tier([line(SUFFIX_STAT, [1, 2])]);

export function pools(
  prefix: readonly ModifierWeight[],
  suffix: readonly ModifierWeight[] = [SUFFIX_TIER],
  coverage: { prefix?: WeightsPool['poolCoverage']; suffix?: WeightsPool['poolCoverage'] } = {},
): WeightsClassPools {
  return {
    prefix: { poolCoverage: coverage.prefix ?? 'complete', entries: [...prefix] },
    suffix: { poolCoverage: coverage.suffix ?? 'complete', entries: [...suffix] },
  };
}

export function weightsOf(classes: Record<string, Record<string, WeightsClassPools>>): WeightsFile {
  return {
    schemaVersion: WEIGHTS_SCHEMA_VERSION,
    gamePatch: '0.5.5',
    producer: { id: 'test', generatedAt: '2026-09-27T00:00:00Z' },
    bases: classes,
  };
}

export const bows = (classPools: WeightsClassPools) => weightsOf({ 'weapon.bow': { Bows: classPools } });

/** Both affixes are required; the suffix defaults to one that aligns on `SUFFIX_TIER`. */
export function entry(
  { prefix, suffix = band(1, 2, SUFFIX_STAT) }: { prefix: ModifierReference; suffix?: ModifierReference },
  { itemLevelMin = 82, categoryId = 'weapon.bow', className = 'Bows' } = {},
): CraftedTrackedEntry {
  return { kind: 'crafted', categoryId, className, itemLevelMin, prefix, suffix, status: 'active' };
}

export const failuresOf = (entries: readonly TrackedEntry[], weights: WeightsFile | undefined) =>
  crossFileChecks(entries, weights).failures;

export const checksOf = (entries: readonly TrackedEntry[], weights: WeightsFile | undefined) =>
  failuresOf(entries, weights).map((failure) => [failure.check, failure.entryKey]);

export const byCodeUnit = (a: string, b: string): number => Number(a > b) - Number(a < b);
export const byPair = (a: readonly string[], b: readonly string[]): number => byCodeUnit(a.join(','), b.join(','));
