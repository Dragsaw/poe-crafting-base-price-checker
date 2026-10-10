import { INITIAL_SCHEMA_VERSION } from '@poe/contracts';

/** Placeholder export: proves the one workspace edge `core` may have, to contracts (AD-1). */
export const CORE_PLACEHOLDER = `contracts@${INITIAL_SCHEMA_VERSION}:core`;

/** The chunk runner's selection order (AD-7); `.ts` specifiers: `sync:dry` runs bare `node`. */
export { chunkOrder, pinnedToKeep, UNRESOLVABLE_RETRY_MS } from './chunk-order.ts';
export type { ChunkOrder, ChunkOrderInput } from './chunk-order.ts';

/** The ranking, both branches (AD-17): computed at read time, league-scoped, over every recipe. */
export { compareRankedRows, rank, RECIPE_UNREACHABLE } from './rank.ts';
export { classKeyOf, craftedClassesOf } from './crafted-classes.ts';
export type {
  NotYetSyncedEntry,
  RankInput,
  Ranking,
  UncostableRecipe,
  UnrankableClass,
  UnrankableReason,
  UnrankedEntry,
} from './rank.ts';

/** The price-trust verdict (AD-17, AD-10) and its EXPERIENCE.md *Price trust* bounds. */
export {
  craftedTrust,
  entryTrust,
  OLD_AFTER_HOURS,
  THIN_BELOW_LISTINGS,
  UNRELIABLE_SHARE_MIN,
} from './price-trust.ts';
export type { CraftedTrustEntry, CraftedTrustInput } from './price-trust.ts';

/** The Craft Cost of a recipe (AD-20): costed from the dataset's rates, or uncostable, never `0`. */
export { craftCost } from './craft-cost.ts';
export type { CraftCostResult } from './craft-cost.ts';

/** Provenance of a crafted pair (AD-10). */
export { foldPair, oldestOf, provenanceOfTier, weakest } from './provenance.ts';

/** The six cross-file checks and the unvalidated marks (AD-17). */
export {
  classDiscriminability,
  coOccur,
  crossFileChecks,
  edgeAlignment,
  emptyContainment,
  kindAgreement,
  lineSetCompleteness,
  scopedPools,
} from './cross-file.ts';
export type { CrossFileFailure, CrossFileResult, ScopedPools, UnvalidatedMark } from './cross-file.ts';

/** The probability term (AD-11, AD-17). */
export {
  affixProbability,
  combinationProbability,
  isContaining as contains,
  isCovering as covers,
  eligible,
  floored,
  interval,
  isEmptyPool,
  lineSet,
  needs,
  poolOf,
  recipeReach,
  statIds,
  isUntrackable as untrackable,
  untrackableReason,
} from './probability.ts';
export type {
  CombinationInput,
  Interval,
  PoolLookup,
  ProbabilityReason,
  ProbabilityResult,
  RecipeReach,
  ReferenceLine,
  Slot,
  UntrackableReason,
} from './probability.ts';

/** Pool coverage (AD-27). */
export { poolCoverage } from './coverage.ts';
export type { PoolCoverage } from './coverage.ts';
