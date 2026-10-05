import type { ModifierReference, ModifierWeight, WeightsClassPools, WeightsLine } from '@poe/contracts';

import type { ProbabilityResult } from '../probability.ts';

export const STAT = 'explicit.stat_1';
export const OTHER = 'explicit.stat_2';

const nextSerial = ((): (() => number) => {
  let serial = 0;
  return () => {
    serial += 1;
    return serial;
  };
})();

/** One weights tier. Built in the test, never read from a fixture file (NFR-2). */
export function tier(
  lines: readonly WeightsLine[],
  weight: number,
  { itemLevelMin = 1, modGroup }: { readonly itemLevelMin?: number; readonly modGroup?: string } = {},
): ModifierWeight {
  const serial = nextSerial();
  return {
    sourceModifierId: `m${String(serial)}`,
    modGroup: modGroup ?? `g${String(serial)}`,
    itemLevelMin,
    weight,
    weightSource: 'published',
    lines: [...lines],
  };
}

export const line = (statId: string | null, ...ranges: (readonly [number, number])[]): WeightsLine => ({
  statId,
  ranges: ranges.map(([min, max]) => [min, max] as [number, number]),
});

// eslint-disable-next-line unicorn/no-null -- boundary: the weights file schema allows a null `statId` for an unresolved line (WEIGHTS-FILE-SCHEMA).
export const unresolvedLine = (...ranges: (readonly [number, number])[]): WeightsLine => line(null, ...ranges);

export const band = (valueMin: number, valueMax: number, statId = STAT): ModifierReference => ({
  kind: 'banded',
  statId,
  valueMin,
  valueMax,
});

export function pools(prefix: readonly ModifierWeight[], suffix: readonly ModifierWeight[]): WeightsClassPools {
  return {
    prefix: { poolCoverage: 'complete', entries: [...prefix] },
    suffix: { poolCoverage: 'complete', entries: [...suffix] },
  };
}

export function pOf(result: ProbabilityResult): number {
  if (!result.ok) {
    throw new Error(`expected a probability, got ${JSON.stringify(result.reason)}`);
  }
  return result.p;
}

export function isCloseRelative(actual: number, expected: number): boolean {
  const tolerance = 1e-12;
  return actual === expected || Math.abs(actual - expected) <= tolerance * Math.max(Math.abs(actual), Math.abs(expected));
}
