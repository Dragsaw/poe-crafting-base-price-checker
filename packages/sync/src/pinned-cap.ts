/**
 * The load-time half of the `pinned` cap (AD-7, IMPLEMENTATION-NOTES.md §6),
 * and the one place outside `chunk/` that reads `config.minChunkSearches`.
 *
 * The chunk runner never reads the declared yardstick, so it can never become
 * a chunk bound. The runtime half — the truncation — is in `chunk/run-chunk.ts`
 * and reports only what it observed; `pinnedStarvationRecord` adds the
 * declared number beside it to make the report record.
 */

import type { ConfigFile, PinnedStarvationRecord, TrackedEntry } from '@poe/contracts';

import type { ChunkStarvation } from './chunk/run-chunk.ts';

/** The share of a minimum chunk the pinned set may take (§6). */
const PINNED_SHARE = 0.5;

/** `count(pinned) > 0.5 × minChunkSearches`: a `tracked.json` validation error. */
export interface PinnedCapExceeded {
  readonly kind: 'pinned-cap-exceeded';
  readonly pinnedCount: number;
  /** `0.5 × minChunkSearches`, the most pinned entries the declaration allows. */
  readonly pinnedLimit: number;
  readonly minChunkSearches: number;
  readonly message: string;
}

export type PinnedCapResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: PinnedCapExceeded };

export function checkPinnedCap(
  entries: readonly TrackedEntry[],
  config: Pick<ConfigFile, 'minChunkSearches'>,
): PinnedCapResult {
  const pinnedCount = entries.filter((entry) => entry.status === 'pinned').length;
  const pinnedLimit = PINNED_SHARE * config.minChunkSearches;
  if (pinnedCount <= pinnedLimit) {
    return { ok: true };
  }
  return {
    ok: false,
    error: {
      kind: 'pinned-cap-exceeded',
      pinnedCount,
      pinnedLimit,
      minChunkSearches: config.minChunkSearches,
      message:
        `data/tracked.json: ${String(pinnedCount)} pinned entries exceed the cap of ${String(pinnedLimit)} ` +
        `(0.5 × minChunkSearches ${String(config.minChunkSearches)})`,
    },
  };
}

export function pinnedStarvationRecord(
  starvation: ChunkStarvation,
  config: Pick<ConfigFile, 'minChunkSearches'>,
): PinnedStarvationRecord {
  return {
    kind: 'pinned-starvation',
    discoveredAllowance: starvation.discoveredAllowance,
    declaredMinChunkSearches: config.minChunkSearches,
    pinnedCount: starvation.pinnedCount,
    pinnedRefreshed: starvation.pinnedRefreshed,
    activeRefreshed: starvation.activeRefreshed,
  };
}
