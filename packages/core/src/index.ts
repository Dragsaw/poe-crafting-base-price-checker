import { INITIAL_SCHEMA_VERSION } from '@poe/contracts';

/**
 * Placeholder export. `core` is pure: no I/O, no clock, no randomness, no env.
 * It may import `@poe/contracts` and nothing else in this workspace.
 *
 * Story 1.2 retired `CONTRACTS_PLACEHOLDER`; this now proves the one allowed
 * workspace edge against a real `contracts` export.
 */
export const CORE_PLACEHOLDER = `contracts@${INITIAL_SCHEMA_VERSION}:core`;

/**
 * The chunk runner's selection order (AD-7). Relative specifiers carry `.ts`:
 * `pnpm sync:dry` loads this source under bare `node`, whose type stripping
 * performs no extension resolution.
 */
export { chunkOrder, pinnedToKeep, UNRESOLVABLE_RETRY_MS } from './chunk-order.ts';
export type { ChunkOrder, ChunkOrderInput } from './chunk-order.ts';

/** The ranking, raw branch (AD-17): computed at read time, league-scoped. */
export { compareRankedRows, rank } from './rank.ts';
export type {
  NotYetSyncedEntry,
  RankInput,
  Ranking,
  UnrankableClass,
  UnrankableReason,
  UnrankedEntry,
} from './rank.ts';

/** The five cross-file checks (AD-17, IMPLEMENTATION-NOTES.md §2.1–§2.6), defined once. */
export {
  classDiscriminability,
  coOccur,
  crossFileChecks,
  edgeAlignment,
  emptyContainment,
  kindAgreement,
  scopedPools,
} from './cross-file.ts';
export type { CrossFileFailure, ScopedPools } from './cross-file.ts';

/** The probability term (AD-11, AD-17, IMPLEMENTATION-NOTES.md §1, §9, §11). */
export {
  affixProbability,
  combinationProbability,
  contains,
  eligible,
  interval,
  poolOf,
} from './probability.ts';
export type {
  CombinationInput,
  Interval,
  PoolLookup,
  ProbabilityReason,
  ProbabilityResult,
  Slot,
} from './probability.ts';
