import type { TrackedEntry, WeightsFile } from '@poe/contracts';

import { craftedClassesOf } from './crafted-classes.ts';
import { isEmptyPool, poolOf } from './probability.ts';

/** The pool-coverage figure and its denominator (AD-27). */
export interface PoolCoverage {
  /** A fraction in `[0, 1]`, never a percentage. */
  readonly coverage: number;
  /** The count of rankable classes: the fraction's denominator. */
  readonly rankableClassCount: number;
}

/**
 * Pool coverage (AD-27, IMPLEMENTATION-NOTES.md §3). Pure (AD-1).
 *
 * `undefined` when no class is rankable, since the fraction is undefined then.
 * The caller omits both fields for it, and for an absent weights file.
 */
export function poolCoverage(
  entries: readonly TrackedEntry[],
  weights: WeightsFile,
): PoolCoverage | undefined {
  const classes = craftedClassesOf(entries);
  if (classes.size === 0) {
    return undefined;
  }
  let covered = 0;
  for (const [first] of classes.values()) {
    if (first === undefined) {
      continue;
    }
    const { categoryId, className } = first;
    const lookup = poolOf(weights, categoryId, className);
    if (
      lookup.ok &&
      lookup.pools.prefix.poolCoverage === 'complete' &&
      lookup.pools.suffix.poolCoverage === 'complete' &&
      !isEmptyPool(lookup.pools.prefix) &&
      !isEmptyPool(lookup.pools.suffix)
    ) {
      covered += 1;
    }
  }
  return { coverage: covered / classes.size, rankableClassCount: classes.size };
}
