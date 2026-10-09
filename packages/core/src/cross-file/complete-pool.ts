import type { WeightsPool } from '@poe/contracts';

/** A pool check runs on a `complete` pool only: `untrackable` is `not-in-game`. */
export const COMPLETE: Pick<WeightsPool, 'poolCoverage'> = { poolCoverage: 'complete' };
